"use client";
import { useEffect, useState } from "react";

type Sess = { id: string; startUtc: string; endUtc: string | null };
type Req = {
  id: string;
  type: "UPDATE" | "CREATE" | "DELETE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string | null;
  note: string | null;
  createdAt: string;
  newStartUtc: string | null;
  newEndUtc: string | null;
  session: Sess | null;
};

function toLocal(dt: string | null) {
  return dt ? new Date(dt).toLocaleString() : "—";
}

export default function MyRequestsPage() {
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [type, setType] = useState<"UPDATE" | "CREATE" | "DELETE">("UPDATE");
  const [sessionId, setSessionId] = useState<string>("");
  const [newStartUtc, setNewStartUtc] = useState<string>("");
  const [newEndUtc, setNewEndUtc] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  async function load() {
    setLoading(true); setErr(null);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/timesheet/my-sessions", { cache: "no-store" }),
        fetch("/api/requests", { cache: "no-store" }),
      ]);
      const d1 = await r1.json(); const d2 = await r2.json();
      if (!r1.ok) throw new Error(d1.error || "Failed sessions");
      if (!r2.ok) throw new Error(d2.error || "Failed requests");
      setSessions(d1.sessions);
      setItems(d2.requests);
    } catch (e: any) {
      setErr(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const payload: any = { type, reason };
    if (type !== "CREATE") payload.sessionId = sessionId || null;
    if (type !== "DELETE") {
      payload.newStartUtc = newStartUtc || null;
      payload.newEndUtc = newEndUtc || null;
    }
    const r = await fetch("/api/requests", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setErr(d.error || "Failed to submit");
    else {
      setReason(""); setNewStartUtc(""); setNewEndUtc("");
      await load();
      alert("Request submitted.");
    }
  }

  if (loading) return <p>Loading…</p>;
  if (err) return <p className="text-red-600">{err}</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My Edit Requests</h1>

      <form onSubmit={submit} className="grid gap-2 md:grid-cols-5 bg-white border rounded-xl p-4">
        <select className="border rounded px-2 py-1" value={type} onChange={e=>setType(e.target.value as any)}>
          <option value="UPDATE">Update existing</option>
          <option value="CREATE">Create missing</option>
          <option value="DELETE">Delete existing</option>
        </select>

        {/* Session selector for UPDATE/DELETE */}
        {(type === "UPDATE" || type === "DELETE") && (
          <select className="border rounded px-2 py-1 md:col-span-2" value={sessionId} onChange={e=>setSessionId(e.target.value)}>
            <option value="">Select session…</option>
            {sessions.map(s=>(
              <option key={s.id} value={s.id}>
                {new Date(s.startUtc).toLocaleString()} → {s.endUtc ? new Date(s.endUtc).toLocaleString() : "—"}
              </option>
            ))}
          </select>
        )}

        {/* New times for UPDATE/CREATE */}
        {type !== "DELETE" && (
          <>
            <input
              className="border rounded px-2 py-1"
              type="datetime-local"
              value={newStartUtc}
              onChange={e=>setNewStartUtc(e.target.value)}
              placeholder="New start (UTC)"
            />
            <input
              className="border rounded px-2 py-1"
              type="datetime-local"
              value={newEndUtc}
              onChange={e=>setNewEndUtc(e.target.value)}
              placeholder="New end (UTC)"
            />
          </>
        )}

        <input
          className="border rounded px-2 py-1 md:col-span-4"
          placeholder="Reason (why you need the change)"
          value={reason}
          onChange={e=>setReason(e.target.value)}
        />

        <button className="rounded bg-black text-white px-3 py-2 md:col-span-1">Submit</button>
      </form>

      <div className="overflow-x-auto border rounded-xl bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Created</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Current</th>
              <th className="p-2 text-left">Requested</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Manager Note</th>
            </tr>
          </thead>
          <tbody>
            {items.map(r=>(
              <tr key={r.id} className="border-t">
                <td className="p-2">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="p-2">{r.type}</td>
                <td className="p-2">
                  {r.session ? `${toLocal(r.session.startUtc)} → ${toLocal(r.session.endUtc)}` : "—"}
                </td>
                <td className="p-2">
                  {(r.newStartUtc ? toLocal(r.newStartUtc) : "—") + " → " + (r.newEndUtc ? toLocal(r.newEndUtc) : "—")}
                </td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">{r.note ?? "—"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td className="p-3 text-gray-600" colSpan={6}>No requests yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
