import { describe, expect, it, vi } from 'vitest';
import { cleanupPair, createPair } from './maestro-trip-fixtures.mjs';
const make = (id: string) => ({ owner: 'citycrew-maestro-signup-v1', id,
  email: `maestro-e2e-${id}@example.com`, password: 'Smoke-fixture-password!',
  url: 'https://project.example.com', key: 'public-key', name: 'Maestro test' });
const a = make('11111111-1111-1111-1111-111111111111');
const b = make('22222222-2222-2222-2222-222222222222');
const response = (status: number, data?: object) => new Response(data ? JSON.stringify(data) : null, { status });
const session = (f: typeof a) => response(200, { access_token: f.id, user: { id: f.id, email: f.email } });
describe('isolated trip fixture setup', () => {
  it('refuses persistent identities before any mutation', async () => {
    const fetcher = vi.fn();
    await expect(createPair({ ...a, email: 'persistent@example.com' }, b, fetcher)).rejects.toThrow('Refusing');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('requires distinct accounts in the same project', async () => {
    const fetcher = vi.fn();
    await expect(createPair(a, a, fetcher)).rejects.toThrow('distinct');
    await expect(createPair(a, { ...b, url: 'https://other.example.com' }, fetcher)).rejects.toThrow('distinct');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('stops when signup has no usable matching session', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(200, { user: { id: a.id, email: a.email } }));
    await expect(createPair(a, b, fetcher)).rejects.toThrow('fixture session');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('requests as A, accepts as B, then verifies the actual edge', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(session(a)).mockResolvedValueOnce(session(b))
      .mockResolvedValueOnce(response(201)).mockResolvedValueOnce(response(204))
      .mockResolvedValueOnce(response(200, [{ requester: a.id, addressee: b.id, status: 'accepted' }]));
    await createPair(a, b, fetcher);
    expect(fetcher.mock.calls[2][1].headers.Authorization).toBe(`Bearer ${a.id}`);
    expect(fetcher.mock.calls[3][1].headers.Authorization).toBe(`Bearer ${b.id}`);
    expect(fetcher.mock.calls[3][1].method).toBe('PATCH');
    expect(fetcher.mock.calls[4][1].method).toBe('GET');
  });
  it('rejects a successful update that changed no edge under RLS', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(session(a)).mockResolvedValueOnce(session(b))
      .mockResolvedValueOnce(response(201)).mockResolvedValueOnce(response(204))
      .mockResolvedValueOnce(response(200, []));
    await expect(createPair(a, b, fetcher)).rejects.toThrow('not verified');
  });
});

// Exercise recovery on disk as well as mocked provisioning: failures must
// retain the owning credential record while allowing the other role to clean.
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

it('retains a failed A ledger, cleans B, then recovers A on the next attempt', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'maestro-trip-recovery-'));
  try {
    for (const [role, fixture] of [['a', a], ['b', b]] as const) {
      await mkdir(join(dir, role));
      await writeFile(join(dir, role, `${fixture.id}.json`), JSON.stringify(fixture));
    }
    await writeFile(join(dir, 'current.json'), '{}');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(503, {}))
      .mockResolvedValueOnce(response(400, { error_code: 'invalid_credentials' })));
    await expect(cleanupPair(dir)).rejects.toThrow('ledger retained');
    expect(JSON.parse(await readFile(join(dir, 'a', `${a.id}.json`), 'utf8')).email).toBe(a.email);
    expect(await readdir(join(dir, 'b'))).toEqual([]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(400, { error_code: 'invalid_credentials' })));
    await cleanupPair(dir);
    expect(await readdir(join(dir, 'a'))).toEqual([]);
    await expect(readFile(join(dir, 'current.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  } finally { vi.unstubAllGlobals(); await rm(dir, { recursive: true, force: true }); }
});
