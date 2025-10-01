import "./globals.css";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic"; // ensure session/role isn't cached

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as "ADMIN" | "MANAGER" | undefined;

  return (
    <html lang="en">
      <head />
      <body className="min-h-screen bg-gray-50">
        <header className="border-b bg-white">
          {/* all nav text black + visited stays black */}
          <nav className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between text-black">
            <Link className="font-semibold visited:text-black" href="/">ClockIn</Link>
            <div className="space-x-4">
              {(role === "MANAGER" || role === "ADMIN") && (
                <>
                  <Link className="visited:text-black" href="/manager">Manager</Link>
                  <Link className="visited:text-black" href="/manager/approvals">Approvals</Link>
                </>
              )}
              {role === "ADMIN" && (
                <>
                  <Link className="visited:text-black" href="/admin/users">Admin</Link>
                  <Link className="visited:text-black" href="/admin/sites">Sites</Link>
                  <Link className="visited:text-black" href="/kiosk">Kiosk</Link>
                </>
              )}
              {session?.user ? (
                <>
                  <Link className="visited:text-black" href="/timesheet">My Timesheet</Link>
                  <Link className="visited:text-black" href="/timesheet/period">Pay Period</Link>
                  <SignOutButton />
                </>
              ) : (
                <>
                  <Link className="visited:text-black" href="/login">Sign in</Link>
                  <Link className="visited:text-black" href="/register">Register</Link>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className="max-w-5xl mx-auto p-4">{children}</main>
      </body>
    </html>
  );
}
