import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

function elapsed(from: Date) {
  const ms = Date.now() - new Date(from).getTime();
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function ManagerPage() {
  const gate = await requireRole(["MANAGER", "ADMIN"]);
  if (!gate.ok) return <p>Not authorized.</p>;

  const open = await prisma.workSession.findMany({
    where: { endUtc: null },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { startUtc: "asc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Manager • Who’s in</h1>
      <div className="overflow-x-auto border rounded-xl bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Employee</th>
              <th className="p-2 text-left">Started (local)</th>
              <th className="p-2 text-left">Elapsed</th>
              <th className="p-2 text-left">Method</th>
            </tr>
          </thead>
          <tbody>
            {open.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.user.name ?? r.user.email}</td>
                <td className="p-2">{new Date(r.startUtc).toLocaleString()}</td>
                <td className="p-2">{elapsed(r.startUtc)}</td>
                <td className="p-2">{r.method ?? "-"}</td>
              </tr>
            ))}
            {open.length === 0 && <tr><td className="p-3 text-gray-600" colSpan={4}>No one is clocked in.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
