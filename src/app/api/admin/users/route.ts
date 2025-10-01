import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET() {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      employeeCode: true, // 👈 include PIN
      createdAt: true,
    },
  });

  return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } });
}

// Update role (and only role) here.
// PIN is handled by /api/admin/pin to keep responsibilities clear.
export async function PATCH(req: Request) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const session = await getServerSession(authOptions);
  const actorId = (session?.user as any)?.id as string | undefined;

  const body = await req.json().catch(() => ({}));
  const userId = body?.userId as string | undefined;
  const role = body?.role as "EMPLOYEE" | "MANAGER" | "ADMIN" | undefined;

  if (!userId || !role) {
    return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
  }

  // Prevent self-demotion (nice guard even if not last admin)
  if (actorId && actorId === userId && role !== "ADMIN") {
    return NextResponse.json({ error: "You cannot change your own role from ADMIN." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // If trying to demote an ADMIN, ensure they're not the last one
  if (target.role === "ADMIN" && role !== "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "You cannot demote the last ADMIN." }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, name: true, email: true, role: true, employeeCode: true },
  });

  return NextResponse.json({ ok: true, user: updated });
}
