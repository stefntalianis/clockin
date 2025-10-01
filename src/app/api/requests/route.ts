import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

function isoOrNull(v: unknown) {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(+d) ? null : d;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as "PENDING" | "APPROVED" | "REJECTED" | null;

  const requests = await prisma.editRequest.findMany({
    where: { userId: (session.user as any).id, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, type: true, status: true, reason: true, note: true, createdAt: true,
      newStartUtc: true, newEndUtc: true,
      session: { select: { id: true, startUtc: true, endUtc: true } },
    },
  });

  return NextResponse.json({ requests }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const type = String(body?.type || "").toUpperCase() as "UPDATE" | "CREATE" | "DELETE";
  const reason = (body?.reason as string | undefined) ?? null;
  const sessionId = (body?.sessionId as string | undefined) ?? null;
  const newStartUtc = isoOrNull(body?.newStartUtc);
  const newEndUtc = isoOrNull(body?.newEndUtc);

  if (!["UPDATE", "CREATE", "DELETE"].includes(type)) {
    return NextResponse.json({ error: "type must be UPDATE | CREATE | DELETE" }, { status: 400 });
  }

  // Validate by type
  if (type === "UPDATE") {
    if (!sessionId) return NextResponse.json({ error: "sessionId required for UPDATE" }, { status: 400 });
    if (!newStartUtc && newEndUtc === null) {
      return NextResponse.json({ error: "provide newStartUtc and/or newEndUtc" }, { status: 400 });
    }
  }
  if (type === "CREATE") {
    if (!newStartUtc || !newEndUtc) {
      return NextResponse.json({ error: "newStartUtc and newEndUtc required for CREATE" }, { status: 400 });
    }
    if (+newEndUtc <= +newStartUtc) {
      return NextResponse.json({ error: "newEndUtc must be after newStartUtc" }, { status: 400 });
    }
  }
  if (type === "DELETE" && !sessionId) {
    return NextResponse.json({ error: "sessionId required for DELETE" }, { status: 400 });
  }

  // Optional: avoid duplicate pending per session
  if (sessionId) {
    const dup = await prisma.editRequest.findFirst({
      where: { userId: (session.user as any).id, sessionId, status: "PENDING" },
    });
    if (dup) return NextResponse.json({ error: "You already have a pending request for this session." }, { status: 409 });
  }

  const created = await prisma.editRequest.create({
    data: {
      userId: (session.user as any).id,
      type,
      sessionId,
      newStartUtc: newStartUtc ?? undefined,
      newEndUtc: newEndUtc ?? undefined,
      reason,
      status: "PENDING",
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
