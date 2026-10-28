// Disposable identities isolate trip E2E from every persistent account.
import { randomUUID } from 'node:crypto';
import { readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanupFixture, prepare, validateFixture } from './maestro-account.mjs';

async function api(f, path, body, token, method = 'POST', fetcher = fetch) {
  const r = await fetcher(`${f.url}${path}`, {
    method, headers: { apikey: f.key, 'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Trip fixture setup failed (HTTP ${r.status}); ledger retained`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

export async function createPair(a, b, fetcher = fetch) {
  validateFixture(a); validateFixture(b);
  if (a.email === b.email || a.url !== b.url) throw new Error('Expected two distinct fixtures in one project');
  const signup = async (f) => {
    const auth = await api(f, '/auth/v1/signup', {
      email: f.email, password: f.password, data: { full_name: f.name },
    }, undefined, 'POST', fetcher);
    if (!auth?.access_token || !auth.user?.id || auth.user.email !== f.email) {
      throw new Error('Signup did not return the fixture session; ledger retained');
    }
    return auth;
  };
  const sa = await signup(a), sb = await signup(b);
  await api(a, '/rest/v1/friendships', { requester: sa.user.id, addressee: sb.user.id }, sa.access_token, 'POST', fetcher);
  await api(b, `/rest/v1/friendships?requester=eq.${sa.user.id}&addressee=eq.${sb.user.id}`, {
    status: 'accepted', responded_at: new Date().toISOString(),
  }, sb.access_token, 'PATCH', fetcher);
  const edges = await api(a, '/rest/v1/friendships?select=requester,addressee,status', undefined, sa.access_token, 'GET', fetcher);
  if (edges?.length !== 1 || edges[0].requester !== sa.user.id || edges[0].addressee !== sb.user.id || edges[0].status !== 'accepted') {
    throw new Error('Fixture friendship not verified; ledger retained');
  }
}

// Only setup uses writes. Visibility transitions and saving remain UI actions.
export async function seedCollections(a, fetcher = fetch) {
  validateFixture(a);
  const auth = await api(a, '/auth/v1/token?grant_type=password', {
    email: a.email, password: a.password,
  }, undefined, 'POST', fetcher);
  if (!auth?.access_token || !auth.user?.id || auth.user.email !== a.email) throw new Error('Fixture identity mismatch');
  const token = auth.access_token;
  const places = await api(a, '/rest/v1/places?select=id,city_id,slug,name_en&is_published=eq.true&review_status=eq.approved&city_id=eq.hanoi&limit=1', undefined, token, 'GET', fetcher);
  if (places?.length !== 1 || !places[0].slug || !places[0].name_en) throw new Error('No published Hanoi place for privacy fixture');
  const result = { url: a.url, key: a.key, resumeId: '', resumeTitle: '', privacyId: '', privacyTitle: '',
    placeSlug: places[0].slug,
    placeQuery: places[0].name_en.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/ +/g, ' ').trim(), };
  for (const kind of ['resume', 'privacy']) {
    const id = randomUUID(), title = `Maestro ${kind} ${a.id.slice(0, 8)}`;
    await api(a, '/rest/v1/collections', {
      id, slug: `maestro-${kind}-${a.id}`, owner_id: auth.user.id, city_id: places[0].city_id,
      title_en: title, title_vi: title, title_ja: title, is_public: false,
    }, token, 'POST', fetcher);
    if (kind === 'privacy') await api(a, '/rest/v1/collection_places', {
      collection_id: id, place_id: places[0].id, sort_order: 0,
    }, token, 'POST', fetcher);
    result[`${kind}Id`] = id; result[`${kind}Title`] = title;
  }
  return result;
}

export async function cleanupPair(dir) {
  const errors = [];
  // Attempt both even if one is unavailable; never lose the failed ledger.
  for (const role of ['a', 'b']) {
    const folder = join(dir, role);
    let names;
    try { names = await readdir(folder); } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
    for (const name of names.filter((n) => n.endsWith('.json'))) {
      const path = join(folder, name);
      try {
        await cleanupFixture(JSON.parse(await readFile(path, 'utf8')));
        await unlink(path);
      } catch (e) { errors.push(e.message); }
    }
  }
  if (errors.length) throw new Error(errors.join('; '));
  await unlink(join(dir, 'current.json')).catch((e) => { if (e.code !== 'ENOENT') throw e; });
  console.error('✓ disposable trip accounts cleaned up');
}

async function preparePair(dir, collections) {
  // Recover interrupted runs before provisioning. Both ledgers exist before
  // either signup: a failed second signup still leaves A recoverable.
  await cleanupPair(dir);
  const pa = await prepare(join(dir, 'a'));
  const pb = await prepare(join(dir, 'b'));
  const a = JSON.parse(await readFile(pa, 'utf8')), b = JSON.parse(await readFile(pb, 'utf8'));
  await createPair(a, b);
  const extra = collections ? await seedCollections(a) : {};
  await writeFile(join(dir, 'current.json'), JSON.stringify({
    email: a.email, password: a.password, email2: b.email, password2: b.password, ...extra,
  }), { mode: 0o600, flag: 'wx' });
  console.error('✓ disposable trip accounts and friendship ready');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, dir, mode] = process.argv.slice(2);
    if (!dir) throw new Error('Expected fixture directory');
    if (command === 'prepare') await preparePair(dir, mode === 'collections');
    else if (command === 'cleanup') await cleanupPair(dir);
    else throw new Error('Expected prepare or cleanup');
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
