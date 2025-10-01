import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

function fmt(d?: Date | null) {
  return d ? new Date(d).toLocaleString() : "-";
}
function minsBetween(a: Date, b?: Date | null) {
  if (!b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return ms > 0 ? Math.round(ms / 60000) : 0;
}
function hhmm(totalMins: number) {
  const h = Math.floor(totalMins / 60), m = totalMins % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

export default async function TimesheetPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return <p>Please sign in.</p>;
  const userId = (session.user as any).id as string;

  const rows = await prisma.workSession.findMany({
    where: { userId },
    orderBy: { startUtc: "desc" },
    take: 100,
    include: { breaks: true },
  });

  let totalNet = 0;

  const view = rows.map(r => {
    const end = r.endUtc ?? null;
    const gross = end ? minsBetween(r.startUtc, end) : 0;
    const breakMins = r.breaks.reduce((acc, b) => {
      const e = b.endUtc ?? new Date();
      const m = minsBetween(b.startUtc, e);
      return acc + m;
    }, 0);
    const net = Math.max(0, gross - breakMins);
    totalNet += net;
    return { ...r, gross, breakMins, net };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Timesheet</h1>
        <Link
          href="/timesheet/requests"
          className="inline-flex items-center rounded-lg bg-black text-white px-3 py-2 hover:opacity-90"
        >
          Submit edit request
        </Link>
      </div>

      <div className="text-sm text-gray-600">Net total (shown): <strong>{hhmm(totalNet)}</strong></div>

      <div className="overflow-x-auto border rounded-xl bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Start (local)</th>
              <th className="text-left p-2">End (local)</th>
              <th className="text-left p-2">Gross</th>
              <th className="text-left p-2">Breaks</th>
              <th className="text-left p-2">Net</th>
              <th className="text-left p-2">Method</th>
            </tr>
          </thead>
          <tbody>
            {view.map(r=>(
              <tr key={r.id} className="border-t">
                <td className="p-2">{fmt(r.startUtc)}</td>
                <td className="p-2">{fmt(r.endUtc)}</td>
                <td className="p-2">{hhmm(r.gross)}</td>
                <td className="p-2">{hhmm(r.breakMins)}</td>
                <td className="p-2 font-medium">{hhmm(r.net)}</td>
                <td className="p-2">{r.method ?? "-"}</td>
              </tr>
            ))}
            {view.length===0 && <tr><td className="p-3 text-gray-600" colSpan={6}>No sessions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
