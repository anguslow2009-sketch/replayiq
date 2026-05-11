# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node is not on PATH by default in this environment. Prefix all npm/npx commands with the path set below, or add it to your shell:

```bash
export PATH="$HOME/.local/node-v22.14.0-darwin-arm64/bin:$PATH"
```

```bash
npm run dev          # start Next.js dev server on localhost:3000
npm run build        # production build (runs type-check + lint)
npm run lint         # ESLint
npx prisma generate  # regenerate Prisma client after schema changes
npx prisma migrate dev --name <name>   # create + apply a migration
npx prisma studio    # GUI to browse the SQLite database
```

No test suite is configured yet.

## Architecture

This is a **Next.js 16 App Router** application. All pages use the `src/` directory layout.

### Request flow for a replay upload

```
Browser → POST /api/upload
  → auth() checks NextAuth session
  → isProUser() checks Subscription.status in SQLite
  → parseReplayFile(buffer) — binary parser in src/lib/replay-parser.ts
  → summarizeForAnalysis(replay, cappedSecs) — text summary for Claude
  → analyzeReplay(summary, secs, isPro) — calls claude-sonnet-4-6 via streaming
  → db.analysis.update() — stores mistakesJson
  → returns { analysisId, result, meta } to browser
```

The upload route sets `maxDuration = 120` (Vercel edge limit) and `runtime = "nodejs"`.

### Tier gating

`FREE_ANALYSIS_LIMIT_SECS = 300` (5 minutes). The free cap is enforced in `src/app/api/upload/route.ts` by passing `cappedSecs` to both the parser and the analyzer. The analyzer prompt also receives `maxMistakes` (8 free, 25 pro).

### Key library files

| File | Purpose |
|---|---|
| `src/lib/replay-parser.ts` | Binary parser for Unreal Engine `.replay` format. Reads chunks, extracts elimination/stats events, returns `ParsedReplay`. |
| `src/lib/analyzer.ts` | Wraps Anthropic SDK streaming call. System prompt is cache-controlled (ephemeral). Returns `AnalysisResult` with typed `Mistake[]`. |
| `src/lib/auth.ts` | NextAuth v4 config with GitHub + Google OAuth and Prisma adapter. |
| `src/lib/stripe.ts` | Stripe helpers: `getOrCreateStripeCustomer`, `isProUser`. |
| `src/lib/db.ts` | Singleton Prisma client (dev-safe global pattern). |

### Database

SQLite via Prisma (dev). The `prisma.config.ts` file (not `schema.prisma`) defines the database URL — it reads `process.env.DATABASE_URL`. The schema has five models: `User`, `Account`, `Session`, `VerificationToken` (all NextAuth standard), `Subscription` (Stripe state), `Analysis` (per-upload record with `rawEventsJson` and `mistakesJson` stored as stringified JSON).

### Stripe webhook

`POST /api/stripe/webhook` handles `customer.subscription.created/updated/deleted`. The subscription's `metadata.userId` field links it back to the user — this must be set when creating a Stripe subscription (done in the checkout session via `subscription_data.metadata`).

### Replay parser limitations

The binary parser in `replay-parser.ts` handles the outer Unreal Engine chunk structure and extracts typed events (`playerElim`, `Athena.MatchStats`). It does **not** do full netcode/actor replication parsing — player position data is not extracted. The `summarizeForAnalysis()` function converts parsed events into a plain-text prompt for Claude.

### Environment variables

Copy `.env.example` to `.env`. The required vars are:
- `DATABASE_URL` — SQLite path (default `file:./dev.db`)
- `NEXTAUTH_SECRET` + `NEXTAUTH_URL`
- `GITHUB_CLIENT_ID/SECRET` and/or `GOOGLE_CLIENT_ID/SECRET`
- `ANTHROPIC_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`
