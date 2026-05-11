import Anthropic from "@anthropic-ai/sdk";

// Lazy singleton — instantiating at module level throws if ANTHROPIC_API_KEY
// is absent during build-time static analysis
let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}
