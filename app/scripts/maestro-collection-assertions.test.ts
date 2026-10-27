import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
const source = readFileSync(new URL('../.maestro/scripts/assert-collection.js', import.meta.url), 'utf8');
function exercise(mode: string, options: { leak?: boolean; memberLeak?: boolean; readerMissing?: boolean; status?: number; wrongEmail?: boolean; wrongPlace?: boolean; count?: number } = {}) {
  const owner = 'maestro-e2e-aaa@example.com', reader = 'maestro-e2e-bbb@example.com';
  const get = vi.fn((url: string, request: { headers: { Authorization: string } }) => {
    const isOwner = request.headers.Authorization === 'Bearer owner';
    const members = url.includes('collection_places?');
    const visible = isOwner || (!options.readerMissing && (mode === 'public' || options.leak || (members && options.memberLeak)));
    const body = !visible ? [] : members
      ? Array.from({ length: options.count ?? (mode === 'empty' ? 0 : 1) }, () => ({ place_id: 'place', places: { slug: options.wrongPlace ? 'different' : 'chosen' } }))
      : [{ id: 'aaa', owner_id: 'owner', is_public: mode === 'public' }];
    return { status: options.status ?? 200, body: JSON.stringify(body) };
  });
  const post = vi.fn((_url: string, request: { body: string }) => {
    const { email } = JSON.parse(request.body), id = email === owner ? 'owner' : 'reader';
    return { status: 200, body: JSON.stringify({ access_token: id, user: { id, email: options.wrongEmail ? 'wrong@example.com' : email } }) };
  });
  runInNewContext(source, { MODE: mode, FIXTURE_url: 'https://example.com', FIXTURE_key: 'public-key',
    FIXTURE_privacyId: 'aaa', FIXTURE_resumeId: 'aaa', TRIP_EMAIL: owner, TRIP_EMAIL_2: reader,
    TRIP_PASSWORD: 'test-only', TRIP_PASSWORD_2: 'test-only', FIXTURE_placeSlug: 'chosen',
    http: { get, post }, json: JSON.parse });
  return { get, post };
}
describe('read-only collection oracle', () => {
  for (const mode of ['private', 'public', 'empty', 'saved']) it(`accepts ${mode} with matching server state`, () => {
    const { get } = exercise(mode);
    for (const [url] of get.mock.calls) {
      expect(url).not.toContain('is_public=');
      expect(url).not.toContain('owner_id=');
    }
  });
  it('detects a private row/member leak to B', () => expect(() => exercise('private', { leak: true })).toThrow('visibility leaked'));
  it('detects member leakage even when the collection row is hidden', () => expect(() => exercise('private', { memberLeak: true })).toThrow('Member visibility leaked'));
  it('detects a public list readable by A but missing for B', () => expect(() => exercise('public', { readerMissing: true })).toThrow('public read missing'));
  it('does not mistake a failed read for absence', () => expect(() => exercise('private', { status: 503 })).toThrow('HTTP 503'));
  it('rejects a wrong session', () => expect(() => exercise('public', { wrongEmail: true })).toThrow('identity mismatch'));
  it('requires the exact saved place', () => expect(() => exercise('saved', { wrongPlace: true })).toThrow('different place'));
  it('detects duplicate membership', () => expect(() => exercise('saved', { count: 2 })).toThrow('membership count'));
  it('does not accept missing public members', () => expect(() => exercise('public', { count: 0 })).toThrow('membership count'));
});
