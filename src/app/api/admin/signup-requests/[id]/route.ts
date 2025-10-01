import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const session = await getServerSession(authOptions);
  const actorId = (session?.user as any)?.id as string | undefined;

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "").toLowerCase(); // "approve" | "reject"
  const note = (body?.note as string | undefined) ?? null;
  const role = (body?.role as "EMPLOYEE" | "MANAGER" | "ADMIN" | undefined) ?? "EMPLOYEE";

  const s = await prisma.signupRequest.findUnique({ where: { id: params.id } });
  if (!s) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (s.status !== "PENDING") return NextResponse.json({ error: "Already decided" }, { status: 400 });

  const now = new Date();

  if (action === "reject") {
    await prisma.signupRequest.update({
      where: { id: s.id },
      data: { status: "REJECTED", decidedById: actorId, decidedAt: now, note },
    });
    return NextResponse.json({ ok: true });
  }

  if (action !== "approve") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Approve: create the User, then mark request APPROVED (transaction)
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Safety: email might have been taken since the request was created
      const exists = await tx.user.findUnique({ where: { email: s.email } });
      if (exists) {
        throw new Error("A user with this email already exists.");
      }

      const user = await tx.user.create({
        data: {
          email: s.email,
          name: s.name,
          passwordHash: s.passwordHash,
          role,
        },
        select: { id: true, email: true },
      });

      await tx.signupRequest.update({
        where: { id: s.id },
        data: { status: "APPROVED", decidedById: actorId, decidedAt: now, note },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: "SIGNUP_APPROVED",
          entityType: "User",
          entityId: user.id,
          beforeJson: null,
          afterJson: JSON.stringify({ id: user.id, email: user.email, role }),
        },
      });

      return user;
    });

    return NextResponse.json({ ok: true, userId: result.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to approve" }, { status: 400 });
  }
}
