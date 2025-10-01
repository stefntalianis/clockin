import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

// Haversine distance (meters)
function distMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function POST(req: Request) {
  try {
    const s = await getServerSession(authOptions);
    if (!s?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const userId = (s.user as any).id as string;

    const body = await req.json().catch(() => ({}));
    const method = (body?.method as string) ?? "web";
    const latitude = typeof body?.latitude === "number" ? body.latitude : null;
    const longitude = typeof body?.longitude === "number" ? body.longitude : null;

    // block double open session
    const open = await prisma.workSession.findFirst({
      where: { userId, endUtc: null },
      select: { id: true },
    });
    if (open) return NextResponse.json({ error: "Already clocked in" }, { status: 400 });

    // geofence: if there are active sites, you must be inside one
    const activeSites = await prisma.site.findMany({ where: { active: true } });
    let siteId: string | null = null;

    if (activeSites.length > 0) {
      if (latitude == null || longitude == null) {
        return NextResponse.json({ error: "Location required to clock in at this company." }, { status: 400 });
      }

      // find nearest site within its radius
      let best: { id: string; d: number } | null = null;
      for (const s of activeSites) {
        const d = distMeters(latitude, longitude, s.latitude, s.longitude);
        if (d <= s.radiusMeters && (!best || d < best.d)) best = { id: s.id, d };
      }
      if (!best) {
        return NextResponse.json({ error: "You are not within any approved site geofence." }, { status: 403 });
      }
      siteId = best.id;
    }

    const now = new Date();
    const rec = await prisma.workSession.create({
      data: {
        userId,
        startUtc: now,
        method,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        siteId: siteId ?? undefined,
      },
      select: { id: true, startUtc: true },
    });

    return NextResponse.json({ ok: true, startedAtUtc: rec.startUtc, siteId });
  } catch (e) {
    console.error("punch/in error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
