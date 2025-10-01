import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { clockedIn: false, onBreak: false },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const userId = (session.user as any).id as string;

    const openSession = await prisma.workSession.findFirst({
      where: { userId, endUtc: null },
      orderBy: { startUtc: "desc" },
      select: { id: true, startUtc: true },
    });

    if (!openSession) {
      return NextResponse.json(
        { clockedIn: false, onBreak: false },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const openBreak = await prisma.breakPeriod.findFirst({
      where: { userId, sessionId: openSession.id, endUtc: null },
      orderBy: { startUtc: "desc" },
      select: { id: true, startUtc: true },
    });

    return NextResponse.json(
      {
        clockedIn: true,
        startedAtUtc: openSession.startUtc,
        onBreak: !!openBreak,
        breakStartedAtUtc: openBreak?.startUtc ?? null,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("break/status error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
