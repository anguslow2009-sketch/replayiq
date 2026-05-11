import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isProUser } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isPro = await isProUser(session.user.id);
  const result = await checkRateLimit(session.user.id, isPro);

  return NextResponse.json({
    isPro,
    usedSecs: isPro ? null : result.usedSecs,
    remainingSecs: isPro ? null : result.remainingSecs,
    limitSecs: isPro ? null : result.limitSecs,
    resetsAt: result.resetsAt.toISOString(),
    allowed: result.allowed,
  });
}
