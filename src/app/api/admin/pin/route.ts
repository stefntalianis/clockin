import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

export async function POST(req: Request) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { userId, code } = await req.json().catch(() => ({}));
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // Clear PIN
  if (code === null || code === "") {
    await prisma.user.update({ where: { id: userId }, data: { employeeCode: null } });
    return NextResponse.json({ ok: true, code: null });
  }

  // Validate 4–6 digits
  if (typeof code !== "string" || !/^\d{4,6}$/.test(code)) {
    return NextResponse.json({ error: "PIN must be 4–6 digits" }, { status: 400 });
  }

  try {
    await prisma.user.update({ where: { id: userId }, data: { employeeCode: code } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // Unique constraint (PIN already used by someone else)
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "PIN already in use" }, { status: 409 });
    }
    console.error("set pin error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
