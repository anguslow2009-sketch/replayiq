import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { isProUser } from "@/lib/stripe";

export const runtime = "nodejs";
export const maxDuration = 60;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

const VISION_SYSTEM_PROMPT = `You are an elite Fortnite competitive coach watching a player's replay in real-time. You are analyzing a screenshot taken from within the Fortnite replay viewer.

Your job is to identify mistakes and coaching opportunities visible in this exact frame.

WHAT TO LOOK FOR:
- Positioning: Is the player exposed, low ground, bad cover?
- Building: Unnecessary structures, missing walls, poor box position?
- Storm awareness: Are they near the storm circle edge without need?
- Health/shield status visible in HUD: Low health with avoidable aggression?
- Map position vs zone: Late rotation, bad angle relative to remaining players?
- Weapon loadout visible: Wrong weapon for the situation?
- Material counts if visible: Out of materials in a build fight?

RESPONSE FORMAT — respond ONLY with valid JSON, no markdown:
{
  "observation": "1-2 sentence description of what you see in this frame",
  "mistakes": [
    {
      "severity": "critical|major|minor",
      "title": "Short mistake title",
      "description": "What's wrong and why it matters competitively",
      "suggestion": "Specific, actionable fix"
    }
  ],
  "positives": ["thing done well if any — omit array if nothing notable"],
  "timestamp": "<ISO string>"
}

If this frame does not show gameplay (loading screen, menus, non-replay content), respond with:
{"observation":"Non-gameplay frame","mistakes":[],"positives":[],"timestamp":"<ISO string>"}`;

export async function POST(req: NextRequest) {
  // Authenticate via Bearer token (desktop app)
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  // Look up user by desktop token
  const user = await db.user.findUnique({
    where: { desktopToken: token },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Rate limit check (30 seconds per analysis call)
  const ANALYSIS_SECS = 30;
  const isPro = await isProUser(user.id);
  const rateLimit = await checkRateLimit(user.id, isPro);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Daily limit reached",
        message: `You've used your ${Math.floor(rateLimit.limitSecs! / 60)}-minute daily coaching limit. Resets at midnight.`,
        resetsAt: rateLimit.resetsAt.toISOString(),
      },
      { status: 429 }
    );
  }

  // Parse body
  let imageBase64: string;
  let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  try {
    const body = await req.json();
    imageBase64 = body.imageBase64;
    mediaType = body.mediaType || "image/jpeg";
    if (!imageBase64) throw new Error("missing imageBase64");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Record usage in DB (create a lightweight analysis entry)
  const analysis = await db.analysis.create({
    data: {
      userId: user.id,
      fileName: "desktop-capture",
      fileSizeBytes: 0,
      gameDurationSecs: ANALYSIS_SECS,
      analyzedSecs: ANALYSIS_SECS,
      status: "processing",
    },
  });

  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: VISION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: "Analyze this Fortnite replay frame and provide coaching feedback.",
            },
          ],
        },
      ],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    let result: {
      observation: string;
      mistakes: { severity: string; title: string; description: string; suggestion: string }[];
      positives: string[];
      timestamp: string;
    };

    try {
      result = JSON.parse(rawText);
    } catch {
      result = {
        observation: rawText.slice(0, 200),
        mistakes: [],
        positives: [],
        timestamp: new Date().toISOString(),
      };
    }

    // Ensure timestamp
    result.timestamp = result.timestamp || new Date().toISOString();

    // Mark analysis complete
    await db.analysis.update({
      where: { id: analysis.id },
      data: { status: "complete", mistakesJson: JSON.stringify(result.mistakes) },
    });

    return NextResponse.json(result);
  } catch (err) {
    await db.analysis.update({
      where: { id: analysis.id },
      data: {
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        analyzedSecs: 0, // don't count failed analysis against quota
      },
    });

    return NextResponse.json(
      { error: "Analysis failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
