import * as https from "https";
import * as http from "http";

interface AnalyzeFrameOptions {
  imageBase64: string;
  apiBase: string;
}

interface AnalyzeFrameResult {
  observation: string;
  mistakes: {
    severity: "critical" | "major" | "minor";
    title: string;
    description: string;
    suggestion: string;
  }[];
  positives: string[];
  timestamp: string;
  rateLimited?: boolean;
  error?: string;
}

export async function analyzeFrame(
  opts: AnalyzeFrameOptions
): Promise<AnalyzeFrameResult> {
  const url = new URL("/api/analyze-frame", opts.apiBase);
  const body = JSON.stringify({
    imageBase64: opts.imageBase64,
    mediaType: "image/jpeg",
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
              resolve({ ...parsed, rateLimited: true, observation: "", mistakes: [], positives: [], timestamp: new Date().toISOString() });
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
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.write(body);
    req.end();
  });
}
