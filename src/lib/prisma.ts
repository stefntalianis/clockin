// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

export const prisma =
  globalThis.prisma ||
  new PrismaClient({
    log: ["query", "error", "warn"], // optional: shows SQL in console
  });

// Prevent multiple PrismaClient instances in dev
if (process.env.NODE_ENV !== "production") {
  (globalThis as any).prisma = prisma;
}
