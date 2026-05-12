import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let email: string, password: string, name: string;
  try {
    const body = await req.json();
    email = (body.email ?? "").trim().toLowerCase();
    password = body.password ?? "";
    name = (body.name ?? "").trim();
    if (!email || !password) throw new Error("missing fields");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("invalid email");
    if (password.length < 8) throw new Error("password too short");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid request" },
      { status: 400 }
    );
  }

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const hashedPassword = await hash(password, 12);
  await db.user.create({
    data: { email, name: name || email.split("@")[0], hashedPassword },
  });

  return NextResponse.json({ ok: true });
}
