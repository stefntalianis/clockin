import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 60); // last 60 days

  const rows = await prisma.workSession.findMany({
    where: { userId: (session.user as any).id, startUtc: { gte: since } },
    orderBy: { startUtc: "desc" },
    select: { id: true, startUtc: true, endUtc: true },
  });

  return NextResponse.json({ sessions: rows }, { headers: { "Cache-Control": "no-store" } });
}
