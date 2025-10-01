import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

export async function GET(req: Request) {
  const gate = await requireRole(["MANAGER", "ADMIN"]);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") || "PENDING") as "PENDING" | "APPROVED" | "REJECTED";

  const requests = await prisma.editRequest.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      reason: true,
      createdAt: true,
      newStartUtc: true,
      newEndUtc: true,
      user: { select: { id: true, name: true, email: true } },
      session: { select: { id: true, startUtc: true, endUtc: true } },
    },
  });

  return NextResponse.json({ requests }, { headers: { "Cache-Control": "no-store" } });
}
