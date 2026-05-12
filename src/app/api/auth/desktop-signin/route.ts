import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let email: string, password: string;
  try {
    const body = await req.json();
    email = (body.email ?? "").trim().toLowerCase();
    password = body.password ?? "";
    if (!email || !password) throw new Error("missing fields");
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, hashedPassword: true, isPro: true, name: true },
  });

  if (!user?.hashedPassword) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const valid = await compare(password, user.hashedPassword);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = "riq_" + randomBytes(24).toString("hex");
  await db.user.update({ where: { id: user.id }, data: { desktopToken: token } });

  return NextResponse.json({ token, isPro: user.isPro, name: user.name });
}
