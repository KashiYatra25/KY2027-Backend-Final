import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '@lib/env/environment.js';
import { PrismaClient, Prisma } from '@prisma/client';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
  },
});
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export const ReadCommittedTransationIsolationLevel =
  Prisma.TransactionIsolationLevel.ReadCommitted;

export { Prisma };
