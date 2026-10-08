// @vitest-environment jsdom
//
// The export, from the tap to the share sheet.
//
// What the file holds is `export.ts`'s to decide and `export.test.ts`'s
// to hold, at 100% in Node. What is left here is the wire, and the one
// promise the wire itself keeps: that the other people in somebody's
// export arrive as handles and nothing else — their names and faces are
// fetched to find the handle and must not travel with it (rule 5). And
// the order the file comment insists on: sharing is asked about before
// anything is read, so a phone that cannot share is not left holding a
// file it cannot hand over.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '../uitest/render';

const world = vi.hoisted(() => ({
  uid: 'me' as string | null,
  canShare: true,
  nativeMissing: false,
  written: [] as { dir: string; name: string; body: string }[],
  shared: [] as { uri: string; opts: Record<string, unknown> }[],
}));
const reads = vi.hoisted(() => ({
  fetchMyCollections: vi.fn(async () => []),
  fetchMyLikedCollections: vi.fn(async () => []),
  fetchMyTrips: vi.fn(async () => []),
  fetchPreferences: vi.fn(async () => ({ categories: [], budget_vnd: null, history_on: false })),
  fetchFriendships: vi.fn(async () => [
    { requester: 'me', addressee: 'f1', status: 'accepted', created_at: '2026-09-01T00:00:00Z' },
    { requester: 'f2', addressee: 'me', status: 'pending', created_at: '2026-09-02T00:00:00Z' },
  ]),
  fetchMyBlocks: vi.fn(async () => ['b1']),
  fetchMySubmittedPlaces: vi.fn(async () => []),
  fetchMyHistory: vi.fn(async () => []),
  fetchMyCheckins: vi.fn(async () => [{ id: 'k1', place_slug: 'cong', city_id: 'hanoi', at: '2026-09-20T03:00:00Z' }]),
  fetchProfilesById: vi.fn(async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, {
    id, handle: `${id}_handle`, full_name: `Private Name ${id}`, avatar_url: `https://faces/${id}.jpg`,
  }]))),
}));

vi.mock('./auth', () => ({
  useAuth: () => ({
    session: world.uid ? { user: { id: world.uid, created_at: '2026-08-01T00:00:00Z' } } : null,
    email: 'minh@example.com',
    profile: { handle: 'Minh', full_name: 'Minh Le', bio: '', location: '', interests: '', avatar_url: '' },
  }),
}));
vi.mock('./i18n', () => ({ useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }) }));
vi.mock('./data', () => ({
  fetchMyCollections: reads.fetchMyCollections,
  fetchMyCheckins: reads.fetchMyCheckins,
  fetchMyTrips: reads.fetchMyTrips,
  fetchPreferences: reads.fetchPreferences,
  fetchFriendships: reads.fetchFriendships,
  fetchMyBlocks: reads.fetchMyBlocks,
  fetchProfilesById: reads.fetchProfilesById,
}));
vi.mock('./data/export', () => ({
  fetchMyLikedCollections: reads.fetchMyLikedCollections,
  fetchMySubmittedPlaces: reads.fetchMySubmittedPlaces,
  fetchMyHistory: reads.fetchMyHistory,
}));
vi.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(private dir: string, private name: string) { this.uri = `${dir}/${name}`; }
    create() {}
    write(body: string) { world.written.push({ dir: this.dir, name: this.name, body }); }
  }
  // A getter, so one test can be a binary without the module: reading the
  // export is the first thing `nativeIO` does with it.
  return {
    get File() {
      if (world.nativeMissing) throw new Error('Cannot find native module ExpoFileSystem');
      return File;
    },
    Paths: { cache: 'file:///cache' },
  };
});
vi.mock('expo-sharing', () => ({
  isAvailableAsync: async () => world.canShare,
  shareAsync: async (uri: string, opts: Record<string, unknown>) => { world.shared.push({ uri, opts }); },
}));

import { useTakeout } from './takeout';


describe('useTakeout', () => {
  // Inside the describe, as the other providers' tests keep theirs: the
  // probe hands the hook's latest answer out, and at module level the
  // lint rule against writing outer variables during render would fire.
  let takeout: ReturnType<typeof useTakeout>;
  const Probe = () => { takeout = useTakeout(); return null; };
  const mount = () => render(<Probe />);
  const run = () => act(async () => { await takeout.run(); });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T09:30:00Z'));
    world.uid = 'me';
    world.canShare = true;
    world.nativeMissing = false;
    world.written = [];
    world.shared = [];
    for (const f of Object.values(reads)) f.mockClear();
    return () => vi.useRealTimers();
  });

  describe('an export', () => {
    it('writes one JSON file to the cache, named for the account and the day, and shares it', async () => {
      mount();
      await run();
      expect(world.written).toHaveLength(1);
      const [file] = world.written;
      expect(file.dir).toBe('file:///cache');
      expect(file.name).toBe('citycrew-minh-2026-09-28.json');
      const bundle = JSON.parse(file.body);
      expect(bundle.export.account).toEqual({ id: 'me', email: 'minh@example.com', created_at: '2026-08-01T00:00:00.000Z' });
      expect(bundle.export.generated_at).toBe('2026-09-28T09:30:00.000Z');
      expect(world.shared).toEqual([{
        uri: 'file:///cache/citycrew-minh-2026-09-28.json',
        opts: { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'City Crew' },
      }]);
      expect(takeout.busy).toBe(false);
      expect(takeout.error).toBeNull();
    });

    it('carries the check-ins, read for this account', async () => {
      mount();
      await run();
      expect(reads.fetchMyCheckins).toHaveBeenCalledWith('me');
      expect(JSON.parse(world.written[0].body).checkins)
        .toEqual([{ place_slug: 'cong', city_id: 'hanoi', at: '2026-09-20T03:00:00.000Z' }]);
    });

    it('asks for every other end of an edge, and every block — never for the reader', async () => {
      mount();
      await run();
      expect(reads.fetchProfilesById).toHaveBeenCalledOnce();
      expect([...(reads.fetchProfilesById.mock.calls[0][0] as string[])].sort()).toEqual(['b1', 'f1', 'f2']);
    });

    // Rule 5: the other people in somebody's export are handles. Their
    // names and faces were fetched to find the handle, and stay behind.
    it('carries other people as handles, and leaves their names and faces behind', async () => {
      mount();
      await run();
      const body = world.written[0].body;
      for (const handle of ['f1_handle', 'f2_handle', 'b1_handle']) expect(body).toContain(handle);
      expect(body).not.toContain('Private Name');
      expect(body).not.toContain('https://faces/');
    });
  });

  describe('when it cannot go through', () => {
    it('reads nothing and writes nothing on a phone that cannot share', async () => {
      world.canShare = false;
      mount();
      await run();
      expect(takeout.error).toBe('sharing_unavailable');
      expect(reads.fetchMyCollections).not.toHaveBeenCalled();
      expect(world.written).toHaveLength(0);
      expect(takeout.busy).toBe(false);
    });

    // An older binary, reached by an EAS update that carries this feature:
    // the native module is not there, and the failure is the button's, not
    // the launch's — and comes before anything is read or written.
    it('says so when the binary has no file system to write with', async () => {
      world.nativeMissing = true;
      mount();
      await run();
      expect(takeout.error).toBe('Cannot find native module ExpoFileSystem');
      expect(takeout.busy).toBe(false);
      expect(reads.fetchMyCollections).not.toHaveBeenCalled();
      expect(world.written).toHaveLength(0);
    });

    it('says what failed when a read does, and stops', async () => {
      reads.fetchMyHistory.mockRejectedValueOnce(new Error('Network request failed'));
      mount();
      await run();
      expect(takeout.error).toBe('Network request failed');
      expect(world.written).toHaveLength(0);
      expect(world.shared).toHaveLength(0);
      expect(takeout.busy).toBe(false);
    });

    it('clears the last failure when it is asked again', async () => {
      reads.fetchMyHistory.mockRejectedValueOnce(new Error('Network request failed'));
      mount();
      await run();
      await run();
      expect(takeout.error).toBeNull();
      expect(world.written).toHaveLength(1);
    });

    it('does nothing for a guest', async () => {
      world.uid = null;
      mount();
      await run();
      expect(reads.fetchMyCollections).not.toHaveBeenCalled();
      expect(world.written).toHaveLength(0);
    });

    it('runs once for a second tap while the first is working', async () => {
      let release: () => void = () => {};
      reads.fetchMyHistory.mockImplementationOnce(() => new Promise((r) => { release = () => r([]); }));
      mount();
      let first: Promise<void> = Promise.resolve();
      act(() => { first = takeout.run(); });
      await act(async () => { await Promise.resolve(); });
      expect(takeout.busy).toBe(true);
      await run();
      await act(async () => { release(); await first; });
      expect(reads.fetchMyHistory).toHaveBeenCalledOnce();
      expect(world.written).toHaveLength(1);
    });
  });
});
