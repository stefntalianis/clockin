import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

const WEEKLY_OT_THRESHOLD_MIN = 40 * 60; // 40h

function parseRange(sp: URLSearchParams) {
  const from = sp.get("from"), to = sp.get("to");
  if (!from || !to) return null;
  const start = new Date(from + "T00:00:00.000Z");
  const end = new Date(to + "T23:59:59.999Z");
  if (isNaN(+start) || isNaN(+end)) return null;
  return { start, end };
}

function mondayUTC(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay(); // 0..6 (Sun..Sat)
  const diff = (dow === 0 ? -6 : 1 - dow); // back to Mon
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
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const range = parseRange(url.searchParams);
  if (!range) {
    return NextResponse.json({ error: "from/to required YYYY-MM-DD" }, { status: 400 });
  }

  const userId = (session.user as any).id as string;
  const now = new Date();

  // Get sessions that overlap range
  const sessions = await prisma.workSession.findMany({
    where: {
      userId,
      startUtc: { lt: range.end },
      OR: [{ endUtc: null }, { endUtc: { gt: range.start } }],
    },
    orderBy: { startUtc: "asc" },
    select: { id: true, startUtc: true, endUtc: true },
  });

  // Fetch breaks for those sessions
  const ids = sessions.map((s) => s.id);
  const breaks = ids.length
    ? await prisma.breakPeriod.findMany({
        where: { sessionId: { in: ids } },
        select: { sessionId: true, startUtc: true, endUtc: true },
      })
    : [];

  const breaksBySession = new Map<string, { startUtc: Date; endUtc: Date | null }[]>();
  for (const b of breaks) {
    const arr = breaksBySession.get(b.sessionId) ?? [];
    arr.push({ startUtc: b.startUtc, endUtc: b.endUtc });
    breaksBySession.set(b.sessionId, arr);
  }

  // Iterate the range week-by-week (Mon..Sun)
  let weekStart = mondayUTC(range.start);
  // If range.start is after weekStart (mid-week), still start from that Monday
  let totalReg = 0;
  let totalOT = 0;

  while (weekStart <= range.end) {
    const weekEnd = addDaysUTC(weekStart, 7); // next Monday 00:00
    const windowStart = new Date(Math.max(+range.start, +weekStart));
    const windowEnd = new Date(Math.min(+range.end, +addDaysUTC(weekStart, 6)));
    // The above shows Mon..Sun inclusive for display, but for overlap math we use [weekStart, weekEnd)
    const segStart = new Date(Math.max(+range.start, +weekStart));
    const segEnd = new Date(Math.min(+range.end, +weekEnd));

    if (segEnd > segStart) {
      // compute net minutes inside this week window
      let weekNet = 0;
      for (const s of sessions) {
        const s0 = new Date(Math.max(+s.startUtc, +segStart));
        const s1 = new Date(Math.min(+(s.endUtc ?? now), +segEnd));
        if (s1 <= s0) continue;

        // gross in this week window
        let gross = overlapMin(s0, s1, s0, s1);

        // subtract breaks overlapping this segment
        const bList = breaksBySession.get(s.id) ?? [];
        for (const b of bList) {
          const b0 = new Date(Math.max(+b.startUtc, +s0));
          const b1 = new Date(Math.min(+(b.endUtc ?? now), +s1));
          gross -= overlapMin(s0, s1, b0, b1);
        }
        weekNet += Math.max(0, gross);
      }

      // allocate weekNet into reg/ot based on threshold
      const reg = Math.min(weekNet, WEEKLY_OT_THRESHOLD_MIN);
      const ot = Math.max(0, weekNet - WEEKLY_OT_THRESHOLD_MIN);
      totalReg += reg;
      totalOT += ot;
    }

    weekStart = weekEnd; // advance to next Monday
  }

  const totalMinutes = totalReg + totalOT;
  const hhmm = (m: number) => {
    const h = Math.floor(m / 60), mm = m % 60;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };

  return NextResponse.json(
    {
      from: range.start,
      to: range.end,
      totalMinutes,
      totalFormatted: hhmm(totalMinutes),
      regMinutes: totalReg,
      regFormatted: hhmm(totalReg),
      otMinutes: totalOT,
      otFormatted: hhmm(totalOT),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
