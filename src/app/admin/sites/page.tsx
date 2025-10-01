"use client";
import { useEffect, useState } from "react";

type Site = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  active: boolean;
  createdAt: string;
};

export default function SitesPage() {
  const [items, setItems] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // form state
  const [name, setName] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [radius, setRadius] = useState<string>("150");
  const [active, setActive] = useState(true);

  async function load() {
    setLoading(true); setErr(null);
    const r = await fetch("/api/admin/sites", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setErr(d.error || "Failed to load sites");
    else setItems(d.sites || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function createSite(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      latitude: Number(lat),
      longitude: Number(lng),
      radiusMeters: Number(radius),
      active,
    };
    const r = await fetch("/api/admin/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) alert(d.error || "Failed");
    else {
      setName(""); setLat(""); setLng(""); setRadius("150"); setActive(true);
      await load();
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const r = await fetch(`/api/admin/sites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !current }),
    });
    if (!r.ok) alert("Failed");
    await load();
  }

  async function del(id: string) {
    if (!confirm("Delete this site?")) return;
    const r = await fetch(`/api/admin/sites/${id}`, { method: "DELETE" });
    if (!r.ok) alert("Failed");
    await load();
  }

  function useMyLocation() {
    if (!navigator.geolocation) return alert("Geolocation not available");
    navigator.geolocation.getCurrentPosition(
      p => {
        setLat(String(p.coords.latitude.toFixed(6)));
        setLng(String(p.coords.longitude.toFixed(6)));
      },
      e => alert(e.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  if (loading) return <p>Loading…</p>;
  if (err) return <p className="text-red-600">{err}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Admin • Sites</h1>

      <form onSubmit={createSite} className="card p-4 grid gap-3 md:grid-cols-5">
        <input className="border rounded px-3 py-2 md:col-span-2" placeholder="Name"
               value={name} onChange={e=>setName(e.target.value)} required />
        <input className="border rounded px-3 py-2" placeholder="Latitude"
               value={lat} onChange={e=>setLat(e.target.value)} required />
        <input className="border rounded px-3 py-2" placeholder="Longitude"
               value={lng} onChange={e=>setLng(e.target.value)} required />
        <input className="border rounded px-3 py-2" placeholder="Radius (m)"
               value={radius} onChange={e=>setRadius(e.target.value)} required />
        <div className="flex items-center gap-2">
          <input id="a" type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} />
          <label htmlFor="a">Active</label>
        </div>
        <div className="md:col-span-5 flex gap-2">
          <button type="button" onClick={useMyLocation} className="rounded border px-3 py-2">Use my location</button>
          <button className="rounded bg-black text-white px-3 py-2">Add Site</button>
        </div>
      </form>

      <div className="overflow-x-auto card">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Lat</th>
              <th className="p-2 text-left">Lng</th>
              <th className="p-2 text-left">Radius (m)</th>
              <th className="p-2 text-left">Active</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(s => (
              <tr key={s.id} className="border-t">
                <td className="p-2">{s.name}</td>
                <td className="p-2">{s.latitude.toFixed(6)}</td>
                <td className="p-2">{s.longitude.toFixed(6)}</td>
                <td className="p-2">{s.radiusMeters}</td>
                <td className="p-2">{s.active ? "Yes" : "No"}</td>
                <td className="p-2 flex gap-2">
                  <button className="px-3 py-1 rounded border"
                          onClick={() => toggleActive(s.id, s.active)}>
                    {s.active ? "Deactivate" : "Activate"}
                  </button>
                  <button className="px-3 py-1 rounded border" onClick={() => del(s.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td className="p-3 text-gray-600" colSpan={6}>No sites yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
