// @vitest-environment jsdom
//
// The hook behind the Activity row's number: the feed's two reads, over
// the feed's window, summed; a guest answered zero off the network; a
// failed half counted as empty rather than thrown.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '../uitest/render';

const reads = vi.hoisted(() => ({
  fetchApplause: vi.fn(async (_since: string) => [] as { liked_at: string; collection_id: string; liker_handle: string | null; liker_name: string | null }[]),
  fetchCopies: vi.fn(async (_since: string) => [] as { copied_at: string; collection_id: string; copier_handle: string | null; copier_name: string | null }[]),
}));
vi.mock('./data', () => ({ fetchApplause: reads.fetchApplause, fetchCopies: reads.fetchCopies }));

import { useActivityCount } from './useActivityCount';

function Probe({ me }: { me: string | null }) {
  return <span data-testid="n">{String(useActivityCount(me))}</span>;
}
const like = (at: string) => ({ liked_at: at, collection_id: 'c', liker_handle: 'a', liker_name: null });
const copy = (at: string) => ({ copied_at: at, collection_id: 'c', copier_handle: 'b', copier_name: null });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-08T10:00:00Z'));
  reads.fetchApplause.mockReset().mockResolvedValue([]);
  reads.fetchCopies.mockReset().mockResolvedValue([]);
});

describe('useActivityCount', () => {
  it('is zero for a guest, and asks nothing', async () => {
    render(<Probe me={null} />);
    await waitFor(() => expect(screen.getByTestId('n').textContent).toBe('0'));
    expect(reads.fetchApplause).not.toHaveBeenCalled();
  });

  it('sums likes and copies over the feed’s window', async () => {
    reads.fetchApplause.mockResolvedValue([like('2026-10-08T01:00:00Z'), like('2026-10-06T01:00:00Z')]);
    reads.fetchCopies.mockResolvedValue([copy('2026-10-07T12:00:00Z')]);
    render(<Probe me="u1" />);
    await waitFor(() => expect(screen.getByTestId('n').textContent).toBe('3'));
    expect(reads.fetchApplause).toHaveBeenCalledWith('2026-09-24T10:00:00.000Z');
    expect(reads.fetchCopies).toHaveBeenCalledWith('2026-09-24T10:00:00.000Z');
  });

  it('counts the half that answered when the other fails', async () => {
    reads.fetchApplause.mockRejectedValue(new Error('offline'));
    reads.fetchCopies.mockResolvedValue([copy('2026-10-07T12:00:00Z')]);
    render(<Probe me="u1" />);
    await waitFor(() => expect(screen.getByTestId('n').textContent).toBe('1'));
  });
});
