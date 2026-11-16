import { PrismaClient } from "@prisma/client";

// Single Prisma client across hot reloads / serverless invocations.
// One client per serverless instance (also in production) so warm Vercel functions reuse the same
// pooled connection. With Neon's pooled URL + connection_limit=1 each instance holds at most one
// connection, which keeps us far below the free-tier connection limit.
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient({ log: ["error"] });
g.prisma = prisma;
