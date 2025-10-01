import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

const ROLES = ["EMPLOYEE", "MANAGER", "ADMIN"] as const;

export async function POST(req: Request) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { userId, role } = await req.json().catch(() => ({}));
  if (!userId || !ROLES.includes(role)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 🚫 Do not allow changing an ADMIN to anything else
  if (target.role === "ADMIN" && role !== "ADMIN") {
    return NextResponse.json({ error: "Admins cannot be demoted." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: userId }, data: { role } as any });
  return NextResponse.json({ ok: true });
}
