import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export interface Mistake {
  id: string;
  severity: "critical" | "major" | "minor";
  category:
    | "rotation"
    | "positioning"
    | "building"
    | "editing"
    | "decision"
    | "aim"
    | "storm";
  timeMs: number;
  timeSec: number;
  timestamp: string;
  title: string;
  description: string;
  suggestion: string;
}

export interface AnalysisResult {
  summary: string;
  overallRating: number;
  mistakes: Mistake[];
  strengths: string[];
}

const SYSTEM_PROMPT = `You are an elite Fortnite competitive coach and analyst with deep expertise in:

- ROTATIONS: Optimal zone movement, third-partying, rotation timing, and height control
- ZONE STRATEGY: Storm phase awareness, safe zone positioning, late-game decision-making
- BUILD FIGHTS: Box fighting, ramp rushing, high ground retakes, material efficiency
- EDIT SPEED: Edit patterns, reset habits, edit-peek timing, box control
- AIM & DAMAGE: Tracking consistency, weapon choice, shot accuracy, damage dealt vs taken ratios
- POSITIONING: Map awareness, height advantage, cover usage, and player awareness
- DECISION-MAKING: When to engage, when to rotate, when to heal, resource management

You analyze Fortnite competitive match replays and deliver precise, actionable coaching feedback grounded in the actual timestamps and events from the match data provided.

ANALYSIS PRINCIPLES:
- Every mistake you identify MUST be tied to a specific timestamp from the match data
- Be blunt and specific — generic advice has no value to competitive players
- Rate severity accurately: critical = directly caused death or major placement loss; major = significant opportunity cost; minor = habit to improve
- Identify genuine strengths — do not fabricate positives if the match was poor
- Your overall rating (1-10) should reflect actual competitive viability: 1-3 = beginner, 4-5 = casual, 6-7 = above average, 8-9 = high level, 10 = pro-level

OUTPUT FORMAT: You must respond with ONLY valid JSON matching this exact structure, no markdown, no prose before or after:
{
  "summary": "2-3 sentence match overview",
  "overallRating": <number 1-10>,
  "mistakes": [
    {
      "id": "mistake_1",
      "severity": "critical|major|minor",
      "category": "rotation|positioning|building|editing|decision|aim|storm",
      "timeMs": <number>,
      "timeSec": <number>,
      "timestamp": "M:SS",
      "title": "Short descriptive title",
      "description": "2-3 sentences explaining what went wrong and why it matters",
      "suggestion": "Concrete, specific advice on what to do instead"
    }
  ],
  "strengths": ["strength 1", "strength 2"]
}`;

export async function analyzeReplay(
  summary: string,
  analyzedSecs: number,
  isPro: boolean
): Promise<AnalysisResult> {
  const maxMistakes = isPro ? 25 : 8;
  const tierLabel = isPro ? "PRO" : "FREE (first 5 minutes)";

  const userPrompt = `Analyze this Fortnite competitive match replay data and identify the player's mistakes and strengths.

ANALYSIS SCOPE: ${tierLabel} — ${analyzedSecs} seconds of gameplay analyzed.
MAX MISTAKES TO SURFACE: ${maxMistakes} (prioritize by severity, most impactful first).

MATCH DATA:
${summary}

Requirements:
- Ground EVERY mistake in the exact timestamps from the data above
- If the match data lacks events at a certain time, do not fabricate them
- Surface up to ${maxMistakes} mistakes, sorted by severity (critical first)
- For free tier (${analyzedSecs}s analyzed), note in the summary that only the first ${Math.round(analyzedSecs / 60)} minutes were analyzed`;

  try {
    const stream = getClient().messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // Cache the system prompt — it's large and static across all requests
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const message = await stream.finalMessage();

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text content in Claude response");
    }

    const result = parseAnalysisResult(textBlock.text, maxMistakes);
    return result;
  } catch (error) {
    if (error instanceof Anthropic.APIError && error.status === 429) {
      throw new Error("Analysis service is temporarily busy. Please try again in a moment.");
    }
    if (error instanceof Anthropic.APIError && error.status === 401) {
      throw new Error("Analysis service configuration error.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new Error(`Analysis failed: ${error.message}`);
    }
    throw error;
  }
}

function parseAnalysisResult(raw: string, maxMistakes: number): AnalysisResult {
  // Strip any accidental markdown code fences
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract JSON from a response that has surrounding text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse analysis response as JSON");
    }
    parsed = JSON.parse(jsonMatch[0]);
  }

  return validateAndNormalize(parsed, maxMistakes);
}

function validateAndNormalize(raw: unknown, maxMistakes: number): AnalysisResult {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid analysis response structure");
  }

  const obj = raw as Record<string, unknown>;

  const summary = typeof obj.summary === "string" ? obj.summary : "Match analysis complete.";
  const overallRating =
    typeof obj.overallRating === "number"
      ? Math.min(10, Math.max(1, Math.round(obj.overallRating)))
      : 5;

  const rawMistakes = Array.isArray(obj.mistakes) ? obj.mistakes : [];
  const mistakes: Mistake[] = rawMistakes
    .slice(0, maxMistakes)
    .map((m: unknown, i: number) => normalizeMistake(m, i));

  const strengths = Array.isArray(obj.strengths)
    ? obj.strengths.filter((s): s is string => typeof s === "string")
    : [];

  return { summary, overallRating, mistakes, strengths };
}

function normalizeMistake(raw: unknown, index: number): Mistake {
  const m = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  const severities = ["critical", "major", "minor"] as const;
  const categories = [
    "rotation", "positioning", "building", "editing", "decision", "aim", "storm",
  ] as const;

  const timeSec = typeof m.timeSec === "number" ? m.timeSec : 0;
  const timeMs = typeof m.timeMs === "number" ? m.timeMs : timeSec * 1000;

  return {
    id: typeof m.id === "string" ? m.id : `mistake_${index + 1}`,
    severity: severities.includes(m.severity as typeof severities[number])
      ? (m.severity as typeof severities[number])
      : "minor",
    category: categories.includes(m.category as typeof categories[number])
      ? (m.category as typeof categories[number])
      : "decision",
    timeMs,
    timeSec,
    timestamp: typeof m.timestamp === "string" ? m.timestamp : formatTimestamp(timeSec),
    title: typeof m.title === "string" ? m.title : "Unknown mistake",
    description: typeof m.description === "string" ? m.description : "",
    suggestion: typeof m.suggestion === "string" ? m.suggestion : "",
  };
}

function formatTimestamp(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
