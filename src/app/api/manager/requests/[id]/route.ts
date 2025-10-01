import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireRole(["MANAGER", "ADMIN"]);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const session = await getServerSession(authOptions);
  const actorId = (session?.user as any)?.id as string | undefined;

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "").toLowerCase(); // approve | reject
  const note = (body?.note as string | undefined) ?? null;

  const r = await prisma.editRequest.findUnique({
    where: { id: params.id },
    include: { session: true, user: true },
  });
  if (!r) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (r.status !== "PENDING") return NextResponse.json({ error: "Already decided" }, { status: 400 });

  const now = new Date();

  if (action === "reject") {
    await prisma.$transaction([
      prisma.editRequest.update({
        where: { id: r.id },
        data: { status: "REJECTED", decidedById: actorId, decidedAt: now, note },
      }),
      prisma.auditLog.create({
        data: {
          actorId,
          action: "REQUEST_REJECTED",
          entityType: "EditRequest",
          entityId: r.id,
          beforeJson: null,
          afterJson: null,
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (action !== "approve") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Apply effect based on type
  if (r.type === "UPDATE") {
    if (!r.sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    const before = await prisma.workSession.findUnique({ where: { id: r.sessionId } });
    if (!before) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const updated = await prisma.workSession.update({
      where: { id: before.id },
      data: {
        ...(r.newStartUtc ? { startUtc: r.newStartUtc } : {}),
        ...(r.newEndUtc !== null ? { endUtc: r.newEndUtc ?? null } : {}),
      },
    });

    await prisma.$transaction([
      prisma.editRequest.update({
        where: { id: r.id },
        data: { status: "APPROVED", decidedById: actorId, decidedAt: now, note },
      }),
      prisma.auditLog.create({
        data: {
          actorId,
          action: "REQUEST_APPROVED",
          entityType: "WorkSession",
          entityId: updated.id,
          beforeJson: JSON.stringify(before),
          afterJson: JSON.stringify(updated),
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (r.type === "CREATE") {
    if (!r.newStartUtc || !r.newEndUtc) {
      return NextResponse.json({ error: "newStartUtc and newEndUtc required" }, { status: 400 });
    }
    const created = await prisma.workSession.create({
      data: {
        userId: r.userId,
        startUtc: r.newStartUtc,
        endUtc: r.newEndUtc,
        method: "manager-edit",
      },
    });

    await prisma.$transaction([
      prisma.editRequest.update({
        where: { id: r.id },
        data: { status: "APPROVED", decidedById: actorId, decidedAt: now, note, sessionId: created.id },
      }),
      prisma.auditLog.create({
        data: {
          actorId,
          action: "REQUEST_APPROVED",
          entityType: "WorkSession",
          entityId: created.id,
          beforeJson: null,
          afterJson: JSON.stringify(created),
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (r.type === "DELETE") {
    if (!r.sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    const before = await prisma.workSession.findUnique({ where: { id: r.sessionId } });
    if (!before) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    await prisma.$transaction([
      prisma.workSession.delete({ where: { id: r.sessionId } }),
      prisma.editRequest.update({
        where: { id: r.id },
        data: { status: "APPROVED", decidedById: actorId, decidedAt: now, note },
      }),
      prisma.auditLog.create({
        data: {
          actorId,
          action: "REQUEST_APPROVED",
          entityType: "WorkSession",
          entityId: r.sessionId,
          beforeJson: JSON.stringify(before),
          afterJson: null,
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unhandled type" }, { status: 400 });
}
