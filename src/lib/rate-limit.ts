import { db } from "./db";

export const FREE_DAILY_SECS = 300; // 5 minutes of gameplay per day

export interface RateLimitResult {
  allowed: boolean;
  usedSecs: number;
  remainingSecs: number;
  limitSecs: number;
  resetsAt: Date;
}

export async function checkRateLimit(
  userId: string,
  isPro: boolean
): Promise<RateLimitResult> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const tomorrow = new Date(startOfDay);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isPro) {
    return {
      allowed: true,
      usedSecs: 0,
      remainingSecs: Infinity,
      limitSecs: Infinity,
      resetsAt: tomorrow,
    };
  }

  // Sum analyzedSecs across all non-errored analyses today
  const agg = await db.analysis.aggregate({
    where: {
      userId,
      createdAt: { gte: startOfDay },
      status: { not: "error" },
    },
    _sum: { analyzedSecs: true },
  });

  const usedSecs = agg._sum.analyzedSecs ?? 0;
  const remainingSecs = Math.max(0, FREE_DAILY_SECS - usedSecs);

  return {
    allowed: remainingSecs > 0,
    usedSecs,
    remainingSecs,
    limitSecs: FREE_DAILY_SECS,
    resetsAt: tomorrow,
  };
}

export function formatSecs(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
