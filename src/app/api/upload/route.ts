import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseReplayFile, summarizeForAnalysis } from "@/lib/replay-parser";
import { analyzeReplay } from "@/lib/analyzer";
import { isProUser } from "@/lib/stripe";
import { checkRateLimit, formatSecs } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILE_SIZE = 500 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const formData = await req.formData();
  const file = formData.get("replay") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No replay file provided" }, { status: 400 });
  }
  if (!file.name.endsWith(".replay")) {
    return NextResponse.json({ error: "File must be a Fortnite .replay file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 500MB)" }, { status: 400 });
  }

  const isPro = await isProUser(userId);
  const rateLimit = await checkRateLimit(userId, isPro);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Daily limit reached — you've used all ${formatSecs(rateLimit.limitSecs)} of free coaching today. Resets at midnight.`,
        rateLimited: true,
        resetsAt: rateLimit.resetsAt.toISOString(),
      },
      { status: 429 }
    );
  }

  // Cap this upload at however many seconds remain today (not a flat 5-min cap)
  const cappingAt = isPro ? Infinity : rateLimit.remainingSecs;

  const analysis = await db.analysis.create({
    data: {
      userId,
      fileName: file.name,
      fileSizeBytes: file.size,
      gameDurationSecs: 0,
      analyzedSecs: 0,
      status: "processing",
    },
  });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    let replay;
    try {
      replay = parseReplayFile(buffer);
    } catch (parseErr) {
      await db.analysis.update({
        where: { id: analysis.id },
        data: {
          status: "error",
          errorMessage: `Could not parse replay file: ${parseErr instanceof Error ? parseErr.message : "Unknown error"}`,
        },
      });
      return NextResponse.json(
        { error: "Invalid or corrupted replay file. Make sure you upload a Fortnite .replay file." },
        { status: 422 }
      );
    }

    const gameDurationSecs = Math.round(replay.meta.durationMs / 1000);
    // Analyze only up to whatever the user has left in their daily budget
    const cappedSecs = isPro ? gameDurationSecs : Math.min(cappingAt, gameDurationSecs);

    const summary = summarizeForAnalysis(replay, cappedSecs);

    await db.analysis.update({
      where: { id: analysis.id },
      data: { gameDurationSecs, analyzedSecs: cappedSecs, rawEventsJson: JSON.stringify(replay.gameStats) },
    });

    const result = await analyzeReplay(summary, cappedSecs, isPro);

    await db.analysis.update({
      where: { id: analysis.id },
      data: { status: "complete", mistakesJson: JSON.stringify(result) },
    });

    // Re-fetch so the counter reflects this upload
    const freshLimit = await checkRateLimit(userId, isPro);

    return NextResponse.json({
      analysisId: analysis.id,
      result,
      meta: {
        gameDurationSecs,
        analyzedSecs: cappedSecs,
        isPro,
        placement: replay.gameStats.placement,
        kills: replay.gameStats.kills,
      },
      rateLimit: isPro
        ? null
        : {
            usedSecs: freshLimit.usedSecs,
            remainingSecs: freshLimit.remainingSecs,
            limitSecs: freshLimit.limitSecs,
          },
    });
  } catch (err) {
    await db.analysis.update({
      where: { id: analysis.id },
      data: { status: "error", errorMessage: err instanceof Error ? err.message : "Unknown error" },
    });
    console.error("Analysis error:", err);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}
