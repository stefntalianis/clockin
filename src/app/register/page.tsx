"use client";
import { useState } from "react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setErr(null);
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, reason }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error || "Registration failed");
      else {
        setMsg(d.message || "Signup submitted for approval.");
        setName(""); setEmail(""); setPassword(""); setReason("");
      }
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid place-items-center mt-10">
      <form onSubmit={submit} className="w-full max-w-md bg-white border rounded-2xl p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-4">Request Access</h1>

        {msg && <p className="mb-3 text-green-700">{msg}</p>}
        {err && <p className="mb-3 text-red-600">{err}</p>}

        <label className="block mb-2">
          <span className="text-sm text-gray-700">Name (optional)</span>
          <input className="mt-1 w-full border rounded px-3 py-2" value={name} onChange={e=>setName(e.target.value)} />
        </label>

        <label className="block mb-2">
          <span className="text-sm text-gray-700">Email</span>
          <input type="email" className="mt-1 w-full border rounded px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} required />
        </label>

        <label className="block mb-2">
          <span className="text-sm text-gray-700">Password</span>
          <input type="password" className="mt-1 w-full border rounded px-3 py-2" value={password} onChange={e=>setPassword(e.target.value)} required />
        </label>

        <label className="block mb-4">
          <span className="text-sm text-gray-700">Why do you need access? (optional)</span>
          <textarea className="mt-1 w-full border rounded px-3 py-2" rows={3} value={reason} onChange={e=>setReason(e.target.value)} />
        </label>

        <button disabled={busy} className="w-full rounded bg-black text-white py-2 disabled:opacity-50">
          {busy ? "Submitting…" : "Submit for approval"}
        </button>

        <p className="text-xs text-gray-500 mt-3">
          An admin will review your request. You’ll be able to sign in once approved.
        </p>
      </form>
    </div>
  );
}
