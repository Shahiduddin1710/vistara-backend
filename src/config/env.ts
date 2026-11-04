import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

/**
 * Locates the `backend/` directory by walking up to the package.json that
 * belongs to this service. Resolving from `__dirname` alone is wrong: the
 * source lives at `src/config` but the compiled build lives at `dist/src/config`,
 * which is one level deeper.
 */
function findBackendRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 8; i += 1) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name?: string };
        if (pkg.name === 'vistara-backend') return dir;
      } catch {
        // keep walking — a malformed package.json higher up is not ours
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(__dirname, '..', '..');
}

const BACKEND_ROOT = findBackendRoot();
const PROJECT_ROOT = path.dirname(BACKEND_ROOT);

/**
 * Environment resolution order (first writer wins):
 *
 *   1. real process environment
 *   2. `backend/.env`           — this service's own config
 *   3. `<repo root>/.env.local`  — pulled by `neon env pull` (DATABASE_URL, …)
 *
 * Loading the backend file first means an explicitly configured value always
 * beats the Neon-pulled one, while the Neon values still flow through when the
 * backend file leaves them unset. That keeps `neon env pull` the source of
 * truth for the database without duplicating secrets in two files.
 */
dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });
dotenv.config({ path: path.join(PROJECT_ROOT, '.env.local') });

function value(name: string, fallback: string): string {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  return raw.trim();
}

/** PostgreSQL connection string — optional; absence triggers demo mode. */
export const DATABASE_URL = process.env.DATABASE_URL?.trim() || null;

/**
 * Neon exposes the direct endpoint as `DATABASE_URL_UNPOOLED`. Prisma's
 * migrations need it as `directUrl`, so alias it here (before the Prisma
 * client is ever constructed).
 */
if (!process.env.DIRECT_URL && process.env.DATABASE_URL_UNPOOLED) {
  process.env.DIRECT_URL = process.env.DATABASE_URL_UNPOOLED;
}
if (!process.env.DIRECT_URL && DATABASE_URL) {
  process.env.DIRECT_URL = DATABASE_URL;
}

/** Branch the local checkout is pinned to (`neon checkout` / `.neon`). */
export const NEON_BRANCH = process.env.NEON_BRANCH?.trim() || null;

export const JWT_SECRET = value('JWT_SECRET', 'vistara-demo-secret-change-me');
export const PORT = Number(process.env.PORT ?? 4000);
export const CORS_ORIGIN = value('CORS_ORIGIN', '*');
export const SEED_PASSWORD = value('SEED_PASSWORD', '12345678');

/** 12 hours, per docs/API.md. */
export const TOKEN_TTL_SECONDS = 12 * 60 * 60;

export const APP_VERSION = '1.0.0';

export const PATHS = {
  backendRoot: BACKEND_ROOT,
  projectRoot: PROJECT_ROOT,
  envFile: path.join(BACKEND_ROOT, '.env'),
  neonEnvFile: path.join(PROJECT_ROOT, '.env.local'),
} as const;
