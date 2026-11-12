import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** One client per process; cached on globalThis so dev hot-reload doesn't leak connections. */
export function getPrisma(): PrismaClient {
  globalForPrisma.prisma ??= new PrismaClient();
  return globalForPrisma.prisma;
}

/** True when a Prisma error is a unique-constraint violation touching the given column. */
export function isUniqueViolation(err: unknown, column?: string): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { code, meta } = err as { code?: unknown; meta?: { target?: unknown } };
  if (code !== "P2002") return false;
  if (!column) return true;
  const target = meta?.target;
  if (Array.isArray(target)) return target.includes(column);
  return typeof target === "string" && target.includes(column);
}
