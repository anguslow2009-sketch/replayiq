import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 30;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

const lastChatByIp = new Map<string, number>();
const COOLDOWN_MS = 5_000;

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const now = Date.now();
  const last = lastChatByIp.get(ip) ?? 0;
  if (now - last < COOLDOWN_MS) {
    return NextResponse.json({ error: "Too many messages" }, { status: 429 });
  }
  lastChatByIp.set(ip, now);

  let message: string;
  let sessionSummary: string;
  let history: { role: "user" | "assistant"; content: string }[];
  try {
    const body = await req.json();
    message = body.message?.trim();
    sessionSummary = body.sessionSummary || "No replay analysis data yet.";
    history = body.history || [];
    if (!message) throw new Error("missing message");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const systemPrompt = `You are ReplayIQ Coach — a sharp, direct, expert Fortnite coach. You are talking to a player who just reviewed their replay footage using AI analysis.

SESSION DATA (what was observed during this replay session):
${sessionSummary}

Your personality: Knowledgeable, direct, supportive but honest. You don't sugarcoat mistakes but you also recognize improvement. You speak in Fortnite player language (edits, box fights, zone, mats, etc.). Keep replies concise — 2-4 sentences unless a detailed breakdown is needed. Never give generic advice — always reference specific things from the session data above.

If asked about something not in the session data, say so honestly and give general coaching advice instead.`;

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...history.slice(-6),
    { role: "user", content: message },
  ];

  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json(
      { error: "Chat failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
