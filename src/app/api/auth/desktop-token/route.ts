import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// GET — return existing token (or generate one)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { desktopToken: true },
  });

  if (user?.desktopToken) {
    return NextResponse.json({ token: user.desktopToken });
  }

  // Generate a new token
  const token = "riq_" + randomBytes(24).toString("hex");
  await db.user.update({
    where: { id: session.user.id },
    data: { desktopToken: token },
  });

  return NextResponse.json({ token });
}

// POST — rotate/regenerate token
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = "riq_" + randomBytes(24).toString("hex");
  await db.user.update({
    where: { id: session.user.id },
    data: { desktopToken: token },
  });

  return NextResponse.json({ token });
}
