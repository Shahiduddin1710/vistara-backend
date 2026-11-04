/**
 * Store selection: live (Prisma / PostgreSQL) when a connection string is
 * present and reachable, otherwise the seeded in-memory demo store.
 *
 * The API never pretends a demo response is live — `DataStore.mode` is
 * surfaced on every 200 as `mode: "live" | "demo"`.
 */
import { DATABASE_URL } from '../config/env';
import { hasDatabaseUrl, getPrisma } from '../config/prisma';
import { logger } from '../config/logger';
import { DataStore } from './Store';
import { MemoryStore } from './memory/MemoryStore';
import { PrismaStore } from './prisma/PrismaStore';

let store: DataStore | null = null;

/** Attempts the live store; falls back to demo when the DB is unreachable. */
export async function initStore(): Promise<DataStore> {
  if (store) return store;

  if (!hasDatabaseUrl()) {
    logger.warn(
      'DATABASE_URL is not set — starting in DEMO mode with seeded in-memory data. ' +
        'Run `neon env pull` in the project root to load the Neon connection string.',
    );
    store = new MemoryStore();
    return store;
  }

  try {
    const prismaStore = new PrismaStore(getPrisma());
    const reachable = await withTimeout(prismaStore.ping(), 4000);
    if (!reachable) throw new Error('SELECT 1 did not respond');
    logger.info('Connected to PostgreSQL — serving LIVE data.');
    store = prismaStore;
    return store;
  } catch (err) {
    logger.warn(
      `PostgreSQL is configured but unreachable (${describe(err)}) — ` +
        'falling back to DEMO mode with seeded in-memory data.',
    );
    store = new MemoryStore();
    return store;
  }
}

/** Returns the store; throws if `initStore()` has not run yet. */
export function getStore(): DataStore {
  if (!store) {
    throw new Error('Store not initialised — call initStore() during boot.');
  }
  return store;
}

/** Test seam: swap the store before the server starts handling requests. */
export function setStore(next: DataStore): void {
  store = next;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export { DATABASE_URL };
