"use client";
import { useEffect, useMemo, useState } from "react";

type Freq = "weekly" | "biweekly";

function mondayOfWeek(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}
function fmtYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}
function hhmm(m: number) {
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function PayPeriodPage() {
  const [freq, setFreq] = useState<Freq>("weekly");
  const [anchor, setAnchor] = useState(() => mondayOfWeek(new Date())); // Monday anchor
  const [page, setPage] = useState(0); // 0 = current period

  const start = useMemo(() => {
    const s = new Date(anchor);
    const delta = (freq === "weekly" ? 7 : 14) * page;
    s.setUTCDate(s.getUTCDate() + delta);
    return s;
  }, [anchor, page, freq]);

  const end = useMemo(() => {
    const e = new Date(start);
    e.setUTCDate(e.getUTCDate() + (freq === "weekly" ? 6 : 13));
    return e;
  }, [start, freq]);

  const [tot, setTot] = useState<{ totalMinutes: number; regMinutes: number; otMinutes: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const q = `from=${fmtYMD(start)}&to=${fmtYMD(end)}`;
      const r = await fetch(`/api/timesheet/summary?${q}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setTot({ totalMinutes: d.totalMinutes, regMinutes: d.regMinutes, otMinutes: d.otMinutes });
    } catch (e: any) {
      setErr(e.message || "Error");
      setTot(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start.getTime(), end.getTime(), freq]);

  const q = `from=${fmtYMD(start)}&to=${fmtYMD(end)}`;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pay period</h1>
      <div className="flex gap-2 items-center">
        <select
          value={freq}
          onChange={(e) => {
            setPage(0);
            setFreq(e.target.value as Freq);
          }}
          className="border rounded px-2 py-1"
        >
          <option value="weekly">Weekly (Mon–Sun)</option>
          <option value="biweekly">Biweekly</option>
        </select>
        <button className="border rounded px-2 py-1" onClick={() => setPage((p) => p - 1)}>
          ◀ Prev
        </button>
        <span className="text-sm text-gray-700">
          {fmtYMD(start)} → {fmtYMD(end)}
        </span>
        <button className="border rounded px-2 py-1" onClick={() => setPage((p) => p + 1)}>
          Next ▶
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : err ? (
        <p className="text-red-600">{err}</p>
      ) : tot ? (
        <div className="text-sm text-gray-800 space-y-1">
          <div>Total: <strong>{hhmm(tot.totalMinutes)}</strong></div>
          <div>Regular: <strong>{hhmm(tot.regMinutes)}</strong></div>
          <div>Overtime: <strong>{hhmm(tot.otMinutes)}</strong></div>
        </div>
      ) : null}

      <div className="flex gap-3">
        <a className="rounded px-3 py-2 bg-black text-white" href={`/api/timesheet/export?${q}`}>
          Export CSV (me)
        </a>
        <a className="rounded px-3 py-2 border" href={`/api/timesheet/export?${q}&all=true`} title="Admins only">
          Export CSV (all users – admin)
        </a>
      </div>

      <p className="text-xs text-gray-500">
        Notes: OT is calculated per week (Mon–Sun, UTC) for minutes above 40h/week. Breaks are subtracted from worked time.
      </p>
    </div>
  );
}
