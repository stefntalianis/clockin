// src/lib/authz.ts
import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client"; // "EMPLOYEE" | "MANAGER" | "ADMIN"

export type GateStatus = 200 | 401 | 403;
export type GateResult = {
  ok: boolean;
  status: GateStatus;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    employeeCode: string | null;
  } | null;
  role: Role | null;
};

/**
 * Fetch the currently signed-in user (lightweight select).
 * Returns null if not signed in.
 */
export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as any)?.id as string | undefined;

  if (!id) return null;

  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      employeeCode: true,
    },
  });
}

/**
 * Gatekeeper: checks if the current user has one of the allowed roles.
 * Adds proper status: 401 (not signed in) vs 403 (signed in, wrong role).
 */
export async function requireRole(allowed: Role[]): Promise<GateResult> {
  const user = await getSessionUser();
  const role = (user?.role ?? null) as Role | null;

  if (!user) return { ok: false, status: 401, user: null, role: null };
  if (!role || !allowed.includes(role)) return { ok: false, status: 403, user, role };

  return { ok: true, status: 200, user, role };
}

/** Convenience helpers */
export async function requireAdmin() {
  return requireRole(["ADMIN"]);
}
export async function requireManagerOrAdmin() {
  return requireRole(["MANAGER", "ADMIN"]);
}
export async function requireSignedIn() {
  // useful when any signed-in user is fine
  return requireRole(["EMPLOYEE", "MANAGER", "ADMIN"]);
}
