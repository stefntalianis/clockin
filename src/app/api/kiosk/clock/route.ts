import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toRad(v: number) { return (v * Math.PI) / 180; }
function haversineMeters(a: {lat:number;lng:number}, b: {lat:number;lng:number}) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").toLowerCase(); // "in" | "out" | "breakstart" | "breakend"
    const code = body?.code as string | undefined;
    const latitude = body?.latitude as number | undefined;
    const longitude = body?.longitude as number | undefined;

    if (!code || !/^\d{4,6}$/.test(code)) {
      return NextResponse.json({ error: "PIN required (4–6 digits)" }, { status: 400 });
    }
    if (!["in","out","breakstart","breakend"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { employeeCode: code },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "Invalid PIN" }, { status: 404 });
    const userId = user.id;

    // Enforce geofence if sites exist
    const sites = await prisma.site.findMany({ where: { active: true } });
    let chosenSiteId: string | null = null;
    if (sites.length > 0) {
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return NextResponse.json({ error: "Location required at this kiosk." }, { status: 400 });
      }
      let nearest: { id: string; dist: number } | null = null;
      for (const s of sites) {
        const dist = haversineMeters({ lat: latitude, lng: longitude }, { lat: s.latitude, lng: s.longitude });
        if (!nearest || dist < nearest.dist) nearest = { id: s.id, dist };
        if (dist <= s.radiusMeters) { chosenSiteId = s.id; break; }
      }
      if (!chosenSiteId) {
        return NextResponse.json({ error: "Outside geofence." }, { status: 403 });
      }
    }

    const now = new Date();

    if (action === "in") {
      const open = await prisma.workSession.findFirst({ where: { userId, endUtc: null } });
      if (open) return NextResponse.json({ error: "Already clocked in" }, { status: 400 });
      const rec = await prisma.workSession.create({
        data: {
          userId,
          startUtc: now,
          method: "kiosk",
          latitude: typeof latitude === "number" ? latitude : undefined,
          longitude: typeof longitude === "number" ? longitude : undefined,
          siteId: chosenSiteId ?? undefined,
        },
        select: { startUtc: true, siteId: true },
      });
      return NextResponse.json({ ok: true, status: "in", startedAtUtc: rec.startUtc, siteId: rec.siteId ?? null });
    }

    if (action === "out") {
      const open = await prisma.workSession.findFirst({ where: { userId, endUtc: null } });
      if (!open) return NextResponse.json({ error: "Not clocked in" }, { status: 400 });
      await prisma.workSession.update({ where: { id: open.id }, data: { endUtc: now } });
      return NextResponse.json({ ok: true, status: "out", endedAtUtc: now });
    }

    if (action === "breakstart") {
      const open = await prisma.workSession.findFirst({ where: { userId, endUtc: null }, select: { id: true } });
      if (!open) return NextResponse.json({ error: "Not clocked in" }, { status: 400 });
      const existing = await prisma.breakPeriod.findFirst({ where: { userId, sessionId: open.id, endUtc: null } });
      if (existing) return NextResponse.json({ error: "Already on break" }, { status: 400 });
      const rec = await prisma.breakPeriod.create({
        data: { userId, sessionId: open.id, startUtc: now },
        select: { startUtc: true },
      });
      return NextResponse.json({ ok: true, status: "break", breakStartedAtUtc: rec.startUtc });
    }

    if (action === "breakend") {
      const open = await prisma.workSession.findFirst({ where: { userId, endUtc: null }, select: { id: true } });
      if (!open) return NextResponse.json({ error: "Not clocked in" }, { status: 400 });
      const openBreak = await prisma.breakPeriod.findFirst({
        where: { userId, sessionId: open.id, endUtc: null }, select: { id: true }
      });
      if (!openBreak) return NextResponse.json({ error: "Not on break" }, { status: 400 });
      await prisma.breakPeriod.update({ where: { id: openBreak.id }, data: { endUtc: now } });
      return NextResponse.json({ ok: true, status: "break-ended", breakEndedAtUtc: now });
    }

    return NextResponse.json({ error: "Unhandled" }, { status: 400 });
  } catch (e) {
    console.error("kiosk/clock error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
