import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

export async function GET(req: Request) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") || "PENDING") as "PENDING" | "APPROVED" | "REJECTED";

  const items = await prisma.signupRequest.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, email: true, name: true, reason: true, createdAt: true, status: true,
    },
  });

  return NextResponse.json({ requests: items }, { headers: { "Cache-Control": "no-store" } });
}
