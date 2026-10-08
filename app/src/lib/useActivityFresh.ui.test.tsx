// @vitest-environment jsdom
//
// The hook behind the Activity row's number, and the mark the feed
// leaves when it is opened.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, waitFor } from '../uitest/render';

const reads = vi.hoisted(() => ({
  fetchApplause: vi.fn(async (_since: string) => [] as { liked_at: string; collection_id: string; liker_handle: string | null; liker_name: string | null }[]),
  fetchCopies: vi.fn(async (_since: string) => [] as { copied_at: string; collection_id: string; copier_handle: string | null; copier_name: string | null }[]),
}));
vi.mock('./data', () => ({ fetchApplause: reads.fetchApplause, fetchCopies: reads.fetchCopies }));

import { activitySeenKey } from './activityFresh';
import { markActivitySeen, useActivityFresh } from './useActivityFresh';

function Probe({ me }: { me: string | null }) {
  return <span data-testid="n">{String(useActivityFresh(me))}</span>;
}
const like = (at: string) => ({ liked_at: at, collection_id: 'c', liker_handle: 'a', liker_name: null });
const copy = (at: string) => ({ copied_at: at, collection_id: 'c', copier_handle: 'b', copier_name: null });

beforeEach(async () => {
  vi.useRealTimers();
  reads.fetchApplause.mockReset().mockResolvedValue([]);
  reads.fetchCopies.mockReset().mockResolvedValue([]);
  await AsyncStorage.removeItem(activitySeenKey('u1'));
});

describe('useActivityFresh', () => {
  it('is zero for a guest, and asks nothing', async () => {
    render(<Probe me={null} />);
    await waitFor(() => expect(screen.getByTestId('n').textContent).toBe('0'));
    expect(reads.fetchApplause).not.toHaveBeenCalled();
  });

  it('counts likes and copies newer than the last look, and asks only since then', async () => {
    await AsyncStorage.setItem(activitySeenKey('u1'), '2026-10-07T00:00:00.000Z');
    reads.fetchApplause.mockResolvedValue([like('2026-10-08T01:00:00Z'), like('2026-10-06T01:00:00Z')]);
    reads.fetchCopies.mockResolvedValue([copy('2026-10-07T12:00:00Z')]);
    render(<Probe me="u1" />);
    await waitFor(() => expect(screen.getByTestId('n').textContent).toBe('2'));
    // The server is asked from the last look, not from the window's
    // start, when the look is the later of the two.
    expect(reads.fetchApplause).toHaveBeenCalledWith('2026-10-07T00:00:00.000Z');
    expect(reads.fetchCopies).toHaveBeenCalledWith('2026-10-07T00:00:00.000Z');
  });

  it('counts the whole window for a feed never opened', async () => {
    reads.fetchApplause.mockResolvedValue([like('2026-10-08T01:00:00Z')]);
    reads.fetchCopies.mockResolvedValue([copy('2026-10-07T12:00:00Z'), copy('2026-10-05T12:00:00Z')]);
    render(<Probe me="u1" />);
    await waitFor(() => expect(screen.getByTestId('n').textContent).toBe('3'));
  });

  it('reads zero when the network fails, rather than throwing', async () => {
    reads.fetchApplause.mockRejectedValue(new Error('offline'));
    reads.fetchCopies.mockResolvedValue([copy('2026-10-07T12:00:00Z')]);
    render(<Probe me="u1" />);
    await waitFor(() => expect(reads.fetchCopies).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('n').textContent).toBe('1'));
  });
});

describe('markActivitySeen', () => {
  it('stamps now under the account’s key', async () => {
    await markActivitySeen('u1', new Date('2026-10-08T10:00:00Z'));
    expect(await AsyncStorage.getItem(activitySeenKey('u1'))).toBe('2026-10-08T10:00:00.000Z');
  });
});
