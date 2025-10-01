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

    const openSession = await prisma.workSession.findFirst({
      where: { userId, endUtc: null },
      orderBy: { startUtc: "desc" },
      select: { id: true },
    });
    if (!openSession) {
      return NextResponse.json({ error: "Not clocked in" }, { status: 400 });
    }

    const openBreak = await prisma.breakPeriod.findFirst({
      where: { userId, sessionId: openSession.id, endUtc: null },
      orderBy: { startUtc: "desc" },
      select: { id: true },
    });
    if (!openBreak) {
      return NextResponse.json({ error: "Not on break" }, { status: 400 });
    }

    const now = new Date();
    await prisma.breakPeriod.update({
      where: { id: openBreak.id },
      data: { endUtc: now },
    });

    return NextResponse.json(
      { ok: true, breakEndedAtUtc: now },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("break/end error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
