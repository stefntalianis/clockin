import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

export async function GET() {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sites = await prisma.site.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ sites }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const latitude = Number(body?.latitude);
  const longitude = Number(body?.longitude);
  const radiusMeters = parseInt(String(body?.radiusMeters || "150"), 10);
  const active = body?.active !== false;

  if (!name || isNaN(latitude) || isNaN(longitude) || isNaN(radiusMeters)) {
    return NextResponse.json({ error: "Invalid site data" }, { status: 400 });
  }

  const site = await prisma.site.create({
    data: { name, latitude, longitude, radiusMeters, active },
  });

  return NextResponse.json({ ok: true, site });
}
