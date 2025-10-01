import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const open = await prisma.workSession.findFirst({
    where: { userId, endUtc: null },
    orderBy: { startUtc: "desc" },
  });

  return NextResponse.json({ clockedIn: !!open, startedAtUtc: open?.startUtc ?? null });
}
