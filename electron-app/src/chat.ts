import * as https from "https";
import * as http from "http";

interface ChatOptions {
  message: string;
  sessionSummary: string;
  history: { role: "user" | "assistant"; content: string }[];
  apiBase: string;
}

export async function chatWithCoach(opts: ChatOptions): Promise<string> {
  const url = new URL("/api/chat", opts.apiBase);
  const body = JSON.stringify({
    message: opts.message,
    sessionSummary: opts.sessionSummary,
    history: opts.history,
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
            resolve(parsed.reply || "No response from coach.");
          } catch {
            reject(new Error("Invalid response from chat server"));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Chat request timed out")); });
    req.write(body);
    req.end();
  });
}
