// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Update this list if you add more public endpoints
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/api/auth",        // next-auth endpoints
  "/api/auth/register",
  "/kiosk",
  "/api/kiosk/clock",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

function isPublic(pathname: string) {
  if (pathname.startsWith("/_next/")) return true;           // Next.js assets
  if (pathname.startsWith("/static/")) return true;          // your static folder (if any)
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Allow public paths
  if (isPublic(pathname)) return NextResponse.next();

  // 2) Check auth (JWT)
  const token = await getToken({ req }); // requires NEXTAUTH_SECRET
  const role = (token as any)?.role as "EMPLOYEE" | "MANAGER" | "ADMIN" | undefined;

  // 3) Not signed in → redirect (pages) or 401 (API)
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return new NextResponse(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // 4) Role-gated areas
  const isApi = pathname.startsWith("/api/");
  const forbid = (status = 403) =>
    isApi
      ? new NextResponse(JSON.stringify({ error: "forbidden" }), {
          status,
          headers: { "Content-Type": "application/json" },
        })
      : NextResponse.redirect(new URL("/", req.url));

  // /admin → ADMIN only
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (role !== "ADMIN") return forbid(403);
  }

  // /manager → MANAGER or ADMIN
  if (pathname.startsWith("/manager") || pathname.startsWith("/api/manager")) {
    if (role !== "ADMIN" && role !== "MANAGER") return forbid(403);
  }

  // 5) Otherwise allow
  return NextResponse.next();
}

// Apply to everything except next.js internal assets we already handle in code
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
