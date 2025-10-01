import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const s = await getServerSession(authOptions);
    if (!s?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const userId = (s.user as any).id as string;

    const open = await prisma.workSession.findFirst({
      where: { userId, endUtc: null },
      orderBy: { startUtc: "desc" },
      select: { id: true },
    });
    if (!open) {
      return NextResponse.json({ error: "Not clocked in" }, { status: 400 });
    }

    const existing = await prisma.breakPeriod.findFirst({
      where: { userId, sessionId: open.id, endUtc: null },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Already on break" }, { status: 400 });
    }

    const now = new Date();
    const rec = await prisma.breakPeriod.create({
      data: { userId, sessionId: open.id, startUtc: now },
      select: { startUtc: true },
    });

    return NextResponse.json(
      { ok: true, breakStartedAtUtc: rec.startUtc },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("break/start error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
