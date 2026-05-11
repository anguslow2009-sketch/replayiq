import * as https from "https";
import * as http from "http";

interface AnalyzeFrameOptions {
  imageBase64: string;
  apiBase: string;
  skillLevel?: string;
  focusAreas?: string[];
}

interface AnalyzeFrameResult {
  is_replay: boolean;
  observation: string;
  mistakes: {
    severity: "critical" | "major" | "minor";
    category: string;
    title: string;
    description: string;
    why_bad: string;
    what_pros_do: string;
    suggestion: string;
  }[];
  positives: { category: string; title: string; description: string }[];
  skill_scores: Record<string, number | null>;
  game_state: Record<string, unknown>;
  timestamp: string;
  rateLimited?: boolean;
  error?: string;
}

export async function analyzeFrame(opts: AnalyzeFrameOptions): Promise<AnalyzeFrameResult> {
  const url = new URL("/api/analyze-frame", opts.apiBase);
  const body = JSON.stringify({
    imageBase64: opts.imageBase64,
    mediaType: "image/jpeg",
    skillLevel: opts.skillLevel || "intermediate",
    focusAreas: opts.focusAreas || [],
  });

  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode === 429) {
              resolve({ ...parsed, rateLimited: true, is_replay: false, observation: "", mistakes: [], positives: [], skill_scores: {}, game_state: {}, timestamp: new Date().toISOString() });
            } else if (res.statusCode !== 200) {
              reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
            } else {
              resolve(parsed);
            }
          } catch {
            reject(new Error("Invalid response from server"));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error("Request timed out")); });
    req.write(body);
    req.end();
  });
}
