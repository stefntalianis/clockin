"use client";
import { useState } from "react";

async function getGeo(): Promise<{ latitude?: number; longitude?: number }> {
  if (!("geolocation" in navigator)) return {};
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve({}),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 }
    );
  });
}

export default function KioskPage() {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function type(n: string) { if (pin.length < 6) setPin(pin + n); }
  function del() { setPin(pin.slice(0, -1)); }
  function clr() { setPin(""); }

  async function act(action: "in"|"out"|"breakstart"|"breakend") {
    setBusy(true); setMsg(null);
    try {
      const geo = await getGeo();
      const r = await fetch("/api/kiosk/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, code: pin, ...geo }),
      });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) setMsg(d.error || `Error (${r.status})`);
      else setMsg(d.status ? `OK: ${d.status}` : "OK");
      clr();
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid place-items-center min-h-[70vh]">
      <div className="w-full max-w-sm bg-white border rounded-2xl p-6 shadow-sm text-center">
        <h1 className="text-2xl font-semibold mb-4">ClockIn • Kiosk</h1>

        <div className="text-3xl tracking-widest tabular-nums bg-gray-100 rounded-xl py-3 mb-3">
          {pin.padEnd(6, "•")}
        </div>

        {msg && <p className="mb-3 text-sm text-gray-700">{msg}</p>}

        <div className="grid grid-cols-3 gap-2 mb-3">
          {["1","2","3","4","5","6","7","8","9"].map(n => (
            <button key={n} disabled={busy} onClick={()=>type(n)} className="py-3 rounded-xl border">{n}</button>
          ))}
          <button disabled={busy} onClick={clr} className="py-3 rounded-xl border">C</button>
          <button disabled={busy} onClick={()=>type("0")} className="py-3 rounded-xl border">0</button>
          <button disabled={busy} onClick={del} className="py-3 rounded-xl border">⌫</button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button disabled={busy || pin.length < 4} onClick={()=>act("in")} className="py-2 rounded-xl text-white bg-blue-600 disabled:opacity-50">Clock In</button>
          <button disabled={busy || pin.length < 4} onClick={()=>act("out")} className="py-2 rounded-xl text-white bg-red-600 disabled:opacity-50">Clock Out</button>
          <button disabled={busy || pin.length < 4} onClick={()=>act("breakstart")} className="py-2 rounded-xl text-white bg-amber-600 disabled:opacity-50">Start Break</button>
          <button disabled={busy || pin.length < 4} onClick={()=>act("breakend")} className="py-2 rounded-xl text-white bg-green-700 disabled:opacity-50">End Break</button>
        </div>
      </div>
    </div>
  );
}
