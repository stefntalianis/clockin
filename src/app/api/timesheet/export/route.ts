import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

const WEEKLY_OT_THRESHOLD_MIN = 40 * 60; // 40h

function parseRange(sp: URLSearchParams) {
  const from = sp.get("from"); const to = sp.get("to");
  if (!from || !to) return null;
  const start = new Date(from + "T00:00:00.000Z");
  const end = new Date(to + "T23:59:59.999Z");
  if (isNaN(+start) || isNaN(+end)) return null;
  return { start, end };
}
function mondayUTC(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setUTCDate(x.getUTCDate() + diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function addDaysUTC(d: Date, days: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}
function overlapMin(a0: Date, a1: Date, b0: Date, b1: Date) {
  const s = Math.max(+a0, +b0), e = Math.min(+a1, +b1);
  return e > s ? Math.round((e - s) / 60000) : 0;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const range = parseRange(url.searchParams);
  if (!range) {
    return NextResponse.json({ error: "from/to required YYYY-MM-DD" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const adminExportAll = url.searchParams.get("all") === "true";
  let where: any;
  if (adminExportAll) {
    const gate = await requireRole(["ADMIN"]);
    if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    where = { startUtc: { lt: range.end }, OR: [{ endUtc: null }, { endUtc: { gt: range.start } }] };
  } else {
    const userId = (session.user as any).id as string;
    where = { userId, startUtc: { lt: range.end }, OR: [{ endUtc: null }, { endUtc: { gt: range.start } }] };
  }

  const rows = await prisma.workSession.findMany({
    where,
    include: { user: { select: { email: true, name: true, id: true } }, breaks: true },
    orderBy: { startUtc: "asc" },
  });

  const now = new Date();
  const header = [
    "userEmail","userName","sessionStartUtc","sessionEndUtc",
    "grossMinutes","breakMinutes","netMinutes",
    "regMinutes","otMinutes","method"
  ].join(",");

  // Track reg used per user/week (UTC Monday keys)
  const regUsedByUserWeek = new Map<string, number>(); // key: `${userId}__${weekStartISO}`

  function weekKey(d: Date) {
    return mondayUTC(d).toISOString();
  }

  const lines = rows.map((r) => {
    // A session may span multiple weeks; split into weekly segments for allocation
    // We'll accumulate totals for this session
    let sessGross = 0;
    let sessBreak = 0;
    let sessNet = 0;
    let sessReg = 0;
    let sessOT = 0;

    let segStart = new Date(Math.max(+r.startUtc, +range.start));
    const sessionEnd = new Date(Math.min(+(r.endUtc ?? now), +range.end));
    if (sessionEnd <= segStart) {
      // Completely outside (shouldn't happen due to where-clause), but handle anyway
      const cols = [
        r.user?.email ?? "",
        (r.user?.name ?? "").replaceAll(",", " "),
        r.startUtc.toISOString(),
        r.endUtc?.toISOString() ?? "",
        "0","0","0","0","0",
        r.method ?? "",
      ];
      return cols.map((v) => `"${v.replaceAll('"','""')}"`).join(",");
    }

    while (segStart < sessionEnd) {
      const wkEnd = addDaysUTC(mondayUTC(segStart), 7); // next Monday
      const segEnd = new Date(Math.min(+wkEnd, +sessionEnd));

      // minutes in this segment
      const gross = overlapMin(segStart, segEnd, segStart, segEnd);

      // breaks within this segment
      let br = 0;
      for (const b of r.breaks) {
        const b0 = new Date(Math.max(+b.startUtc, +segStart));
        const b1 = new Date(Math.min(+(b.endUtc ?? now), +segEnd));
        br += overlapMin(segStart, segEnd, b0, b1);
      }

      const net = Math.max(0, gross - br);

      // allocate reg/ot using per-user weekly consumption
      const k = `${r.user?.id ?? "u"}__${weekKey(segStart)}`;
      const used = regUsedByUserWeek.get(k) ?? 0;
      const regLeft = Math.max(0, WEEKLY_OT_THRESHOLD_MIN - used);
      const regAlloc = Math.min(net, regLeft);
      const otAlloc = Math.max(0, net - regAlloc);
      regUsedByUserWeek.set(k, used + regAlloc);

      sessGross += gross;
      sessBreak += br;
      sessNet += net;
      sessReg += regAlloc;
      sessOT += otAlloc;

      segStart = segEnd; // advance to next segment (next week or to sessionEnd)
    }

    const cols = [
      r.user?.email ?? "",
      (r.user?.name ?? "").replaceAll(",", " "),
      r.startUtc.toISOString(),
      r.endUtc?.toISOString() ?? "",
      String(sessGross),
      String(sessBreak),
      String(sessNet),
      String(sessReg),
      String(sessOT),
      r.method ?? "",
    ];
    return cols.map((v) => `"${v.replaceAll('"','""')}"`).join(",");
  });

  const csv = [header, ...lines].join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clockin-${url.searchParams.get("from")}_to_${url.searchParams.get("to")}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
