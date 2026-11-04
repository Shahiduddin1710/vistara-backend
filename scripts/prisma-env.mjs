#!/usr/bin/env node
/**
 * Runs a command with the Neon environment loaded.
 *
 * Prisma's CLI only auto-loads `backend/.env`, but `neon env pull` writes the
 * connection strings to `<repo root>/.env.local`. This wrapper loads both
 * (backend/.env winning) and then spawns the given command, so `npm run
 * db:push` / `db:seed` talk to the same database the API does.
 *
 * Usage:  node scripts/prisma-env.mjs prisma db push
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(file) {
  if (!existsSync(file)) return [];
  const loaded = [];
  const text = readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const key = match[1];
    let val = match[2];
    if (
      (val.startsWith('"') && val.endsWith('"') && val.length > 1) ||
      (val.startsWith("'") && val.endsWith("'") && val.length > 1)
    ) {
      val = val.slice(1, -1);
    }
    if (key in process.env) continue; // real env > backend/.env > .env.local
    process.env[key] = val;
    loaded.push(key);
  }
  return loaded;
}

const local = path.resolve(here, '..', '..', '.env.local');
const backend = path.resolve(here, '..', '.env');
const localKeys = loadEnv(local);
loadEnv(backend);

// Prisma migrations need the direct (unpooled) Neon endpoint.
if (!process.env.DIRECT_URL && process.env.DATABASE_URL_UNPOOLED) {
  process.env.DIRECT_URL = process.env.DATABASE_URL_UNPOOLED;
}
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('prisma-env.mjs: no command given');
  process.exit(2);
}

if (localKeys.includes('DATABASE_URL')) {
  const host = /@([^/]+)\//.exec(process.env.DATABASE_URL ?? '')?.[1] ?? 'unknown host';
  console.log(`[prisma-env] DATABASE_URL → ${host} (from .env.local)`);
}

const result = spawnSync(cmd, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
  cwd: path.resolve(here, '..'),
});

process.exit(result.status ?? 1);
