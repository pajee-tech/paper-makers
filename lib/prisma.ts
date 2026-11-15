import { PrismaClient } from "@prisma/client";

// Single Prisma client across hot reloads / serverless invocations.
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient({ log: ["error"] });
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
