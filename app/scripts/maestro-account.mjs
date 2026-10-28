// Own-account cleanup only: no service-role key or admin deletion API.
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const owner = 'citycrew-maestro-signup-v1';

export function validateFixture(f) {
  if (f?.owner !== owner || !/^[0-9a-f-]{36}$/.test(f.id) ||
      f.email !== `maestro-e2e-${f.id}@example.com` ||
      typeof f.password !== 'string' || f.password.length < 16 ||
      typeof f.key !== 'string' || !/^https:\/\//.test(f.url)) {
    throw new Error('Refusing cleanup: not a generated signup fixture');
  }
}

async function request(f, path, body, token, fetcher) {
  const response = await fetcher(`${f.url}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { apikey: f.key, 'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

export async function cleanupFixture(f, fetcher = fetch) {
  validateFixture(f);
  const login = () => request(f, '/auth/v1/token?grant_type=password',
    { email: f.email, password: f.password }, undefined, fetcher);
  const auth = await login();
  // Only this specific response means absent. Offline, throttling, an
  // unconfirmed email, or an unknown server response must retain the ledger.
  if (auth.status === 400 && (auth.data.error_code ?? auth.data.code) === 'invalid_credentials') return 'absent';
  if (!auth.ok || !auth.data.access_token || auth.data.user?.email !== f.email) {
    throw new Error(`Cannot verify fixture identity (HTTP ${auth.status}); ledger retained`);
  }
  const removed = await request(f, '/functions/v1/delete-account', {}, auth.data.access_token, fetcher);
  if (!removed.ok || removed.data.ok !== true) {
    throw new Error(`Fixture deletion failed (HTTP ${removed.status}); ledger retained`);
  }
  const after = await login();
  if (after.status !== 400 || (after.data.error_code ?? after.data.code) !== 'invalid_credentials') {
    throw new Error('Deletion not verified; ledger retained');
  }
  return 'recovered';
}

async function cleanFile(path) {
  const state = await cleanupFixture(JSON.parse(await readFile(path, 'utf8')));
  await unlink(path);
  console.error(state === 'absent'
    ? '✓ signup fixture cannot sign in (deleted or never created)'
    : '⚠ recovered leftover signup account using its own session');
  return state;
}

export async function prepare(dir) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  // Retry interrupted runs before creating any new account. Never discard
  // credentials when the network cannot prove cleanup succeeded.
  for (const name of await readdir(dir)) {
    if (name.endsWith('.json')) await cleanFile(join(dir, name));
  }
  const { load } = await import('@expo/env');
  load(app, { silent: true });
  const source = await readFile(join(app, 'src/lib/supabase.ts'), 'utf8');
  const fallback = (name) => source.match(new RegExp(`const ${name} = .*\\?\\? '([^']+)'`))?.[1];
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || fallback('url');
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || fallback('key');
  if (!url || !key) throw new Error('Cannot resolve app Supabase configuration');
  const settings = await request({ url, key }, '/auth/v1/settings', undefined, undefined, fetch);
  if (!settings.ok || settings.data.mailer_autoconfirm !== true) {
    throw new Error('Signup smoke requires email confirmation OFF; no account created');
  }
  const id = randomUUID();
  const f = { owner, id, url, key, email: `maestro-e2e-${id}@example.com`,
    name: `Maestro ${id.slice(0, 8)}`, password: `Smoke-${randomBytes(18).toString('hex')}!` };
  const path = join(dir, `${id}.json`);
  await writeFile(path, JSON.stringify(f), { mode: 0o600, flag: 'wx' });
  return path;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, path] = process.argv.slice(2);
    if (!path) throw new Error('Expected a fixture directory or file');
    if (command === 'prepare') console.log(await prepare(path));
    else if (command === 'cleanup') {
      // A successful UI flow must have deleted its account already. Recover
      // a survivor, but return failure so cleanup cannot hide a UI defect.
      if (await cleanFile(path) === 'recovered') process.exitCode = 2;
    } else throw new Error('Expected prepare or cleanup');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
