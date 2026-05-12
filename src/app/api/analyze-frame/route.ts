import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const FREE_DAILY_LIMIT = 10;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

async function resolveUser(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  return db.user.findUnique({
    where: { desktopToken: token },
    select: { id: true, isPro: true, dailyAnalyses: true, lastAnalysisDate: true },
  });
}

async function checkAndIncrementQuota(userId: string, isPro: boolean, dailyAnalyses: number, lastAnalysisDate: string | null): Promise<{ allowed: boolean; remaining: number }> {
  if (isPro) return { allowed: true, remaining: 999 };

  const today = new Date().toISOString().slice(0, 10);
  const count = lastAnalysisDate === today ? dailyAnalyses : 0;

  if (count >= FREE_DAILY_LIMIT) return { allowed: false, remaining: 0 };

  await db.user.update({
    where: { id: userId },
    data: {
      dailyAnalyses: lastAnalysisDate === today ? count + 1 : 1,
      lastAnalysisDate: today,
    },
  });

  return { allowed: true, remaining: FREE_DAILY_LIMIT - count - 1 };
}

const VISION_SYSTEM_PROMPT = `You are an elite Fortnite competitive coach with 10,000+ hours of coaching experience. You are analyzing a screenshot from the Fortnite replay viewer.

FIRST: Determine if this screenshot shows the Fortnite REPLAY VIEWER (not the main menu, lobby, loading screen, or live gameplay). The replay viewer has a scrubber bar at the bottom, camera controls, and shows past gameplay from a third-person/cinematic angle.

If it IS a replay frame, provide deep coaching analysis. If it is NOT a replay frame, set is_replay to false and leave other fields empty.

CATEGORIES to classify mistakes and strengths:
- positioning (high ground, cover, exposure, angles)
- building (edits, box fights, ramp rushes, structure choices)
- mechanics (edits, aim, movement, building speed)
- rotation (zone awareness, timing, pathing)
- decision_making (when to fight, heal, push, retreat)
- looting (priority, speed, inventory management)
- healing (timing, cover usage, potion selection)
- awareness (storm, players, audio cues)

For EACH mistake, provide:
- WHY it was bad (specific tactical reason, not generic)
- WHAT PRO PLAYERS DO instead (specific technique or habit)
- A concrete actionable fix

SKILL SCORES (0-10) based on what you can observe:
- Rate only what is visible in the frame. Use null if not observable.

RESPONSE FORMAT — valid JSON only, no markdown, no explanation outside JSON:
{
  "is_replay": true,
  "observation": "2-3 sentence vivid description of what's happening in this exact frame — player position, situation, health/shields if visible, build structure, storm proximity",
  "mistakes": [
    {
      "severity": "critical|major|minor",
      "category": "positioning|building|mechanics|rotation|decision_making|looting|healing|awareness",
      "title": "Short punchy mistake title (5 words max)",
      "description": "What mistake is happening and why it's bad",
      "why_bad": "The specific competitive reason this costs you — e.g. 'exposes your head to 3 angles with no cover option'",
      "what_pros_do": "Specific pro technique — e.g. 'Place a cone above your 1x1 before peeking to force one angle'",
      "suggestion": "One actionable thing to do RIGHT NOW in this situation"
    }
  ],
  "positives": [
    {
      "category": "positioning|building|mechanics|rotation|decision_making|looting|healing|awareness",
      "title": "What you did well",
      "description": "Why this was a good play"
    }
  ],
  "skill_scores": {
    "positioning": null,
    "building": null,
    "mechanics": null,
    "rotation": null,
    "decision_making": null,
    "awareness": null
  },
  "game_state": {
    "phase": "early|mid|endgame|unknown",
    "health_visible": false,
    "storm_visible": false,
    "in_fight": false
  },
  "timestamp": "<ISO string>"
}

If not a replay:
{"is_replay": false, "observation": "", "mistakes": [], "positives": [], "skill_scores": {}, "game_state": {}, "timestamp": "<ISO>"}`;

export async function POST(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Sign in required", message: "Please sign in to use ReplayIQ." },
      { status: 401 }
    );
  }

  const quota = await checkAndIncrementQuota(user.id, user.isPro, user.dailyAnalyses, user.lastAnalysisDate);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: "Daily limit reached",
        message: `Free accounts get ${FREE_DAILY_LIMIT} analyses per day. Upgrade to Pro for unlimited coaching.`,
        upgradeRequired: true,
      },
      { status: 402 }
    );
  }

  let imageBase64: string;
  let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  let skillLevel: string;
  let focusAreas: string[];
  try {
    const body = await req.json();
    imageBase64 = body.imageBase64;
    mediaType = body.mediaType || "image/jpeg";
    skillLevel = body.skillLevel || "intermediate";
    focusAreas = body.focusAreas || [];
    if (!imageBase64) throw new Error("missing imageBase64");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const userContext = skillLevel || focusAreas.length
    ? `\n\nPLAYER CONTEXT: Skill level: ${skillLevel}. Focus areas: ${focusAreas.length ? focusAreas.join(", ") : "all"}. Tailor feedback depth accordingly.`
    : "";

  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: VISION_SYSTEM_PROMPT + userContext,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
            {
              type: "text",
              text: "Analyze this Fortnite replay frame. Provide elite-level coaching feedback.",
            },
          ],
        },
      ],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";

    let result: Record<string, unknown>;
    try {
      const cleaned = rawText.replace(/^```json\s*/m, "").replace(/```\s*$/m, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      result = {
        is_replay: false,
        observation: rawText.slice(0, 200),
        mistakes: [],
        positives: [],
        skill_scores: {},
        game_state: {},
        timestamp: new Date().toISOString(),
      };
    }

    if (!result.timestamp) result.timestamp = new Date().toISOString();
    result.isPro = user.isPro;
    result.analysesRemaining = quota.remaining;
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Analysis failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
