/**
 * Prisma client singleton.
 *
 * `DATABASE_URL` / `DATABASE_URL_UNPOOLED` come from `<root>/.env.local`
 * (pulled by `neon env pull`); see `config/env.ts` for the resolution order.
 * When no connection string is available the app boots in demo mode instead
 * of throwing, so the API stays runnable without a database.
 */
import { PrismaClient } from '@prisma/client';
import { DATABASE_URL } from './env';
import { logger } from './logger';

let client: PrismaClient | null = null;

export function hasDatabaseUrl(): boolean {
  return Boolean(DATABASE_URL);
}

/** Lazily constructs the client — never called when there is no DATABASE_URL. */
export function getPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      log: ['warn', 'error'],
    });
  }
  return client;
}

/** Best-effort teardown on shutdown. */
export async function disconnectPrisma(): Promise<void> {
  if (!client) return;
  try {
    await client.$disconnect();
  } catch (err) {
    logger.warn('Failed to disconnect Prisma cleanly', err);
  }
  client = null;
}
