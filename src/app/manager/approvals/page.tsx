"use client";
import { useEffect, useState } from "react";

type Req = {
  id: string;
  type: "UPDATE" | "CREATE" | "DELETE";
  reason: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
  session: { id: string; startUtc: string; endUtc: string | null } | null;
  newStartUtc: string | null;
  newEndUtc: string | null;
};

export default function ApprovalsPage() {
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    setMsg(null);
    const r = await fetch("/api/manager/requests?status=PENDING", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setErr(d.error || "Failed to load");
    else setItems(d.requests || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function act(id: string, action: "approve" | "reject") {
    const note = window.prompt(action === "approve" ? "Approval note (optional)" : "Rejection reason (optional)") || "";
    const r = await fetch(`/api/manager/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setErr(d.error || "Failed");
    else { setMsg(action === "approve" ? "Approved." : "Rejected."); await load(); }
  }

  if (loading) return <p>Loading…</p>;
  if (err) return <p className="text-red-600">{err}</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Manager • Approvals</h1>
      {msg && <p className="text-green-700">{msg}</p>}

      <div className="overflow-x-auto border rounded-xl bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Employee</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Current</th>
              <th className="p-2 text-left">Requested</th>
              <th className="p-2 text-left">Reason</th>
              <th className="p-2 text-left">Requested At</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.user.name ?? r.user.email}</td>
                <td className="p-2">{r.type}</td>
                <td className="p-2">
                  {r.session
                    ? `${new Date(r.session.startUtc).toLocaleString()} → ${r.session.endUtc ? new Date(r.session.endUtc).toLocaleString() : "—"}`
                    : "—"}
                </td>
                <td className="p-2">
                  {(r.newStartUtc ? new Date(r.newStartUtc).toLocaleString() : "—") + " → " +
                   (r.newEndUtc ? new Date(r.newEndUtc).toLocaleString() : "—")}
                </td>
                <td className="p-2">{r.reason ?? "—"}</td>
                <td className="p-2">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="p-2 flex gap-2">
                  <button className="px-3 py-1 rounded bg-black text-white" onClick={() => act(r.id, "approve")}>
                    Approve
                  </button>
                  <button className="px-3 py-1 rounded border" onClick={() => act(r.id, "reject")}>
                    Reject
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td className="p-3 text-gray-600" colSpan={7}>No pending requests.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
