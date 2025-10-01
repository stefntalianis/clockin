import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (body.latitude != null) data.latitude = Number(body.latitude);
  if (body.longitude != null) data.longitude = Number(body.longitude);
  if (body.radiusMeters != null) data.radiusMeters = parseInt(String(body.radiusMeters), 10);
  if (body.active != null) data.active = !!body.active;

  const site = await prisma.site.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true, site });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await prisma.site.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
