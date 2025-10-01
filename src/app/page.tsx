"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [inStatus, setInStatus] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [onBreak, setOnBreak] = useState(false);
  const [breakStartedAt, setBreakStartedAt] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // location
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locErr, setLocErr] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const [s1, s2] = await Promise.all([
      fetch("/api/punch/status"),
      fetch("/api/break/status"),
    ]);

    if (s1.ok) {
      const d = await s1.json();
      setInStatus(d.clockedIn);
      setStartedAt(d.startedAtUtc);
    }
    if (s2.ok) {
      const d = await s2.json();
      setOnBreak(!!d.onBreak);
      setBreakStartedAt(d.breakStartedAtUtc ?? null);
    }
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  function getLocation() {
    setLocErr(null);
    if (!navigator.geolocation) {
      setLocErr("Geolocation not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      p => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      e => setLocErr(e.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function toggleClock() {
    setMsg(null);
    if (!inStatus) {
      // clock in → send coords if we have them
      const body: any = { method: "web" };
      if (coords) { body.latitude = coords.lat; body.longitude = coords.lng; }
      const r = await fetch("/api/punch/in", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg(d.error || "Error");
      else setMsg("You clocked in.");
    } else {
      const r = await fetch("/api/punch/out", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg(d.error || "Error");
      else setMsg("You clocked out.");
    }
    await refresh();
  }

  async function toggleBreak() {
    setMsg(null);
    const path = onBreak ? "/api/break/end" : "/api/break/start";
    const r = await fetch(path, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setMsg(d.error || "Error");
    else setMsg(onBreak ? "Break ended." : "Break started.");
    await refresh();
  }

  return (
    <div className="grid place-items-center mt-16">
      <div className="w-full max-w-lg card p-6 text-center">
        <h1 className="text-2xl font-semibold mb-2">ClockIn</h1>
        {msg && <p className="mb-3">{msg}</p>}

        {!coords && (
          <button onClick={getLocation} className="rounded border px-3 py-2 mb-3">
            Share my location (for geofence)
          </button>
        )}
        {coords && <p className="text-xs mb-2">Location: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>}
        {locErr && <p className="text-xs text-red-600 mb-2">{locErr}</p>}

        <div className="flex items-center justify-center gap-3">
          <button
            disabled={loading}
            onClick={toggleClock}
            className={`px-6 py-3 rounded-xl text-white font-medium ${inStatus ? "bg-red-600" : "bg-blue-600"} disabled:opacity-50`}
          >
            {loading ? "Loading..." : inStatus ? "Clock out" : "Clock in"}
          </button>

          <button
            disabled={!inStatus || loading}
            onClick={toggleBreak}
            className={`px-6 py-3 rounded-xl text-white font-medium ${onBreak ? "bg-green-700" : "bg-amber-600"} disabled:opacity-50`}
            title={!inStatus ? "You must be clocked in to start a break" : ""}
          >
            {onBreak ? "End break" : "Start break"}
          </button>
        </div>

        <p className="text-sm mt-3">
          {inStatus && startedAt ? `Started: ${new Date(startedAt).toLocaleString()}` : "You are currently clocked out."}
          {inStatus && onBreak && breakStartedAt ? (
            <> • On break since {new Date(breakStartedAt).toLocaleTimeString()}</>
          ) : null}
        </p>
      </div>
    </div>
  );
}
