// The app's queue of check-in photos on their way up: one at a time,
// held until they land, a failure kept for another try, a refusal let
// go, and whether a sheet is watching a visit.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const data = vi.hoisted(() => ({
  uploadCheckinPhoto: vi.fn(async (_v: string, _i: string) => ({ id: 'p', path: 'u/k/p.jpg', width: 1, height: 1 })),
}));
vi.mock('./data/checkinPhotos', () => data);

import { PhotoError } from './checkin';
import {
  dropVisitPhoto, isWatched, onVisitUpload, resetVisitUploads, retryVisitPhoto, sendVisitPhoto,
  uploadsFor, uploadsGoing, uploadsSettled, watchVisit, type UploadEvent,
} from './visitUploads';

const one = (key: string, visitId = 'k1') => ({ key, visitId, uri: `file://${key}`, image: `bytes-${key}` });
let heard: UploadEvent[];

beforeEach(() => {
  resetVisitUploads();
  heard = [];
  onVisitUpload((e) => heard.push(e));
  data.uploadCheckinPhoto.mockReset();
  data.uploadCheckinPhoto.mockImplementation(async (_v, i) => ({ id: `id-${i}`, path: `u/k/${i}.jpg`, width: 1, height: 1 }));
});
afterEach(() => resetVisitUploads());

describe('sending', () => {
  it('holds a photo while it goes, then lets it go and says it is up', async () => {
    sendVisitPhoto(one('a'));
    expect(uploadsFor('k1')).toEqual([{ ...one('a'), state: 'sending' }]);
    expect(uploadsGoing()).toBe(1);
    await uploadsSettled();
    expect(data.uploadCheckinPhoto).toHaveBeenCalledWith('k1', 'bytes-a');
    expect(uploadsFor('k1')).toEqual([]);
    expect(heard).toEqual([{ kind: 'up', key: 'a', visitId: 'k1', photo: { id: 'id-bytes-a', path: 'u/k/bytes-a.jpg', width: 1, height: 1 } }]);
  });

  it('sends one at a time, in the order chosen, across visits', async () => {
    let first!: () => void;
    data.uploadCheckinPhoto.mockImplementationOnce(() => new Promise((r) => { first = () => r({ id: 'x', path: 'x', width: 1, height: 1 }); }));
    sendVisitPhoto(one('a'));
    sendVisitPhoto(one('b', 'k2'));
    await Promise.resolve(); await Promise.resolve();
    expect(data.uploadCheckinPhoto).toHaveBeenCalledTimes(1);
    expect(uploadsFor('k2')).toHaveLength(1);
    expect(uploadsGoing()).toBe(2);
    first();
    await uploadsSettled();
    expect(data.uploadCheckinPhoto.mock.calls.map((c) => c[1])).toEqual(['bytes-a', 'bytes-b']);
  });

  it('lets a refused photo go, and says why', async () => {
    data.uploadCheckinPhoto.mockRejectedValueOnce(new PhotoError('day'));
    sendVisitPhoto(one('a'));
    await uploadsSettled();
    expect(uploadsFor('k1')).toEqual([]);
    expect(heard).toEqual([{ kind: 'refused', key: 'a', visitId: 'k1', why: 'day' }]);
  });

  it('keeps one the network lost, marked, with its bytes, and sends those again on a retry', async () => {
    data.uploadCheckinPhoto.mockRejectedValueOnce(new Error('Network request failed'));
    sendVisitPhoto(one('a'));
    await uploadsSettled();
    expect(heard).toEqual([{ kind: 'failed', key: 'a', visitId: 'k1' }]);
    expect(uploadsFor('k1')).toEqual([{ ...one('a'), state: 'failed' }]);
    expect(uploadsGoing()).toBe(0);
    retryVisitPhoto('a');
    expect(uploadsFor('k1')[0].state).toBe('sending');
    await uploadsSettled();
    expect(data.uploadCheckinPhoto).toHaveBeenLastCalledWith('k1', 'bytes-a');
    expect(heard.at(-1)?.kind).toBe('up');
  });

  it('calls a server failure with no reason of its own a lost upload, not a refusal', async () => {
    data.uploadCheckinPhoto.mockRejectedValueOnce(new PhotoError('other'));
    sendVisitPhoto(one('a'));
    await uploadsSettled();
    expect(heard).toEqual([{ kind: 'failed', key: 'a', visitId: 'k1' }]);
  });
});

describe('retrying and dropping', () => {
  it('retries nothing that has not failed', async () => {
    sendVisitPhoto(one('a'));
    retryVisitPhoto('a');
    retryVisitPhoto('nobody');
    await uploadsSettled();
    expect(data.uploadCheckinPhoto).toHaveBeenCalledTimes(1);
  });

  it('drops a failed photo, and not one still going', async () => {
    data.uploadCheckinPhoto.mockRejectedValueOnce(new Error('offline'));
    sendVisitPhoto(one('a'));
    await uploadsSettled();
    sendVisitPhoto(one('b'));
    dropVisitPhoto('b');
    dropVisitPhoto('a');
    dropVisitPhoto('nobody');
    expect(uploadsFor('k1').map((u) => u.key)).toEqual(['b']);
    await uploadsSettled();
  });

  it('sends nothing for a photo forgotten before its turn', async () => {
    let first!: () => void;
    data.uploadCheckinPhoto.mockImplementationOnce(() => new Promise((r) => { first = () => r({ id: 'x', path: 'x', width: 1, height: 1 }); }));
    sendVisitPhoto(one('a'));
    const going = uploadsSettled();
    sendVisitPhoto(one('b'));
    const behind = uploadsSettled();
    await Promise.resolve(); await Promise.resolve();
    resetVisitUploads();
    first();
    await going; await behind;
    expect(data.uploadCheckinPhoto).toHaveBeenCalledTimes(1);
  });
});

describe('watching', () => {
  it('counts the sheets up over a visit, and stops when the last goes', () => {
    expect(isWatched('k1')).toBe(false);
    const a = watchVisit('k1');
    const b = watchVisit('k1');
    a();
    expect(isWatched('k1')).toBe(true);
    b();
    expect(isWatched('k1')).toBe(false);
    // A second stop is harmless.
    b();
    expect(isWatched('k1')).toBe(false);
  });

  it('stops telling a listener that has gone', async () => {
    const late: UploadEvent[] = [];
    const off = onVisitUpload((e) => late.push(e));
    off();
    sendVisitPhoto(one('a'));
    await uploadsSettled();
    expect(late).toEqual([]);
    expect(heard).toHaveLength(1);
  });
});
