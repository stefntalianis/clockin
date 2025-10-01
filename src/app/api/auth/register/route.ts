import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = (body?.name as string | undefined) ?? null;
  const email = (body?.email as string | undefined)?.toLowerCase();
  const password = body?.password as string | undefined;
  const reason = (body?.reason as string | undefined) ?? null;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  // Block if a real user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Upsert pending signup
  await prisma.signupRequest.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      reason,
      status: "PENDING",
      decidedById: null,
      decidedAt: null,
      note: null,
    },
    create: { email, name, passwordHash, reason },
  });

  return NextResponse.json({
    ok: true,
    message: "Thanks! Your signup is pending admin approval.",
  });
}
