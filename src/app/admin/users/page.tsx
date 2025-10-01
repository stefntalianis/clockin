"use client";
import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: "EMPLOYEE" | "MANAGER" | "ADMIN";
  employeeCode: string | null;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/users", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Failed to load users");
      setRows(d.users as UserRow[]);
    } catch (e: any) {
      setErr(e.message || "Error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function changeRole(userId: string, role: UserRow["role"]) {
    setMsg(null);
    setErr(null);
    const r = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(d.error || "Failed to change role");
    } else {
      setMsg("Role updated");
      await load();
    }
  }

  async function setPin(userId: string, current: string | null) {
    const code = window.prompt("Enter 4–6 digit PIN (leave empty to clear)", current ?? "") ?? null;
    if (code === null) return; // cancelled
    setMsg(null);
    setErr(null);
    const r = await fetch("/api/admin/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, code }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(d.error || "Failed to set PIN");
    } else {
      setMsg(code ? "PIN set" : "PIN cleared");
      await load();
    }
  }

  if (loading) return <p>Loading…</p>;
  if (err) return <p className="text-red-600">{err}</p>;

  async function setPin(userId: string, current: string | null) {
  const code = window.prompt("Enter 4–6 digit PIN (leave empty to clear)", current ?? "") ?? null;
  if (code === null) return;

  setMsg(null);
  setErr(null);

  const r = await fetch("/api/admin/pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, code }),
  });

  let d: any = {};
  const txt = await r.text();
  try { d = JSON.parse(txt); } catch {}

  if (!r.ok) {
    setErr(d?.error || txt || `HTTP ${r.status}`);
  } else {
    setMsg(code ? "PIN set" : "PIN cleared");
    await load();
  }
}

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Admin • Users</h1>
      {msg && <p className="text-green-700">{msg}</p>}
      <div className="overflow-x-auto border rounded-xl bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Role</th>
              <th className="p-2 text-left">PIN</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.name ?? "—"}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value as UserRow["role"])}
                    className="border rounded px-2 py-1"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td className="p-2">
                  <span className="tabular-nums">{u.employeeCode ?? "—"}</span>
                </td>
                <td className="p-2">
                  <button
                    className="px-3 py-1 rounded border"
                    onClick={() => setPin(u.id, u.employeeCode)}
                  >
                    Set PIN
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-3 text-gray-600" colSpan={5}>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        PIN must be 4–6 digits. Use the <strong>Kiosk</strong> page for PIN-based clocking.
      </p>
    </div>
  );
}
