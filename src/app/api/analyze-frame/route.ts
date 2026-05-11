import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

// Simple in-memory rate limit: 1 analysis per 30 seconds per IP
const lastCallByIp = new Map<string, number>();
const COOLDOWN_MS = 30_000;

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const last = lastCallByIp.get(ip) ?? 0;
  if (now - last < COOLDOWN_MS) return false;
  lastCallByIp.set(ip, now);
  return true;
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
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkIpRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too soon", message: "Wait 30 seconds between analyses." },
      { status: 429 }
    );
  }

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
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
            { type: "text", text: "Analyze this Fortnite replay frame and provide coaching feedback." },
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
      result = { observation: rawText.slice(0, 200), mistakes: [], positives: [], timestamp: new Date().toISOString() };
    }

    result.timestamp = result.timestamp || new Date().toISOString();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Analysis failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
