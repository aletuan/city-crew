import { describe, expect, it } from 'vitest';
import {
  canPublish, isFlagged, isLive, isMineAndUnlive, isPending,
  ownPendingFirst, publishBlockers, type Reviewable,
} from './live';

const ME = 'me-uuid';
const YOU = 'you-uuid';

const live = (over: Partial<Reviewable> = {}): Reviewable =>
  ({ is_published: true, review_status: 'approved', submitted_by: null, ...over });

describe('isLive', () => {
  it('needs both flags', () => {
    expect(isLive({ is_published: true, review_status: 'approved' })).toBe(true);
    expect(isLive({ is_published: false, review_status: 'approved' })).toBe(false);
    expect(isLive({ is_published: true, review_status: 'pending' })).toBe(false);
  });

  // The state that actually exists in production and that a check written
  // against approval alone waves straight through. Three Da Nang rows are
  // exactly this.
  it('refuses approved-but-unpublished, which is a real state', () => {
    expect(isLive({ is_published: false, review_status: 'approved' })).toBe(false);
  });

  it('treats a row that never selected the columns as not live', () => {
    expect(isLive({})).toBe(false);
  });
});

describe('isPending vs isFlagged', () => {
  it('separates wait from no', () => {
    const pending = { is_published: false, review_status: 'pending' };
    const flagged = { is_published: false, review_status: 'flagged' };
    expect(isPending(pending)).toBe(true);
    expect(isFlagged(pending)).toBe(false);
    expect(isFlagged(flagged)).toBe(true);
    expect(isPending(flagged)).toBe(false);
  });

  it('says nothing of a live place', () => {
    expect(isPending(live())).toBe(false);
    expect(isFlagged(live())).toBe(false);
  });

  // An older client that never asked for review_status should not accuse
  // somebody's suggestion of having been turned down.
  it('reads an unknown status as waiting, not as refused', () => {
    expect(isPending({})).toBe(true);
    expect(isFlagged({})).toBe(false);
  });
});

describe('isMineAndUnlive', () => {
  it('is the only case where you see what others cannot', () => {
    expect(isMineAndUnlive({ submitted_by: ME, review_status: 'pending' }, ME)).toBe(true);
    expect(isMineAndUnlive({ submitted_by: YOU, review_status: 'pending' }, ME)).toBe(false);
    expect(isMineAndUnlive(live({ submitted_by: ME }), ME)).toBe(false);
  });

  it('is nothing to a signed-out reader', () => {
    expect(isMineAndUnlive({ submitted_by: ME, review_status: 'pending' }, null)).toBe(false);
    expect(isMineAndUnlive({ submitted_by: null, review_status: 'pending' }, undefined)).toBe(false);
  });
});

describe('publishBlockers', () => {
  it('counts nothing when everything is live', () => {
    expect(publishBlockers([live(), live()])).toEqual({ pending: 0, flagged: 0 });
    expect(canPublish([live(), live()])).toBe(true);
  });

  // Both numbers, because the sentence the owner reads has to name what
  // is holding it.
  it('counts the two kinds apart', () => {
    const members = [
      live(),
      { is_published: false, review_status: 'pending' },
      { is_published: false, review_status: 'pending' },
      { is_published: false, review_status: 'flagged' },
    ];
    expect(publishBlockers(members)).toEqual({ pending: 2, flagged: 1 });
    expect(canPublish(members)).toBe(false);
  });

  // The one that never resolves on its own. A collection holding it is
  // blocked until its owner removes it, which they can only do if they
  // are told which one it is.
  it('blocks on a flagged place alone', () => {
    expect(canPublish([live(), { review_status: 'flagged', is_published: false }])).toBe(false);
  });

  it('counts an approved-but-unpublished member as waiting', () => {
    expect(publishBlockers([{ is_published: false, review_status: 'approved' }]))
      .toEqual({ pending: 1, flagged: 0 });
  });

  it('lets an empty list through', () => {
    expect(canPublish([])).toBe(true);
  });
});

describe('ownPendingFirst', () => {
  const a = live({ submitted_by: null });
  const b = live({ submitted_by: null });
  const minePending = { is_published: false, review_status: 'pending', submitted_by: ME };
  const yoursPending = { is_published: false, review_status: 'pending', submitted_by: YOU };

  // The failure it exists to catch: in Hanoi a suggestion sorts to
  // position fifty-nine, and the only person who can see it has to scroll
  // the whole catalog to find what they just added.
  it('lifts your own unreviewed place to the front', () => {
    expect(ownPendingFirst([a, b, minePending], ME)).toEqual([minePending, a, b]);
  });

  it('leaves somebody else’s alone', () => {
    // Not that it should ever arrive — RLS hides it — but the ordering
    // must not be the thing that assumes so.
    expect(ownPendingFirst([a, yoursPending, b], ME)).toEqual([a, yoursPending, b]);
  });

  it('keeps the catalog order inside each group', () => {
    const m2 = { is_published: false, review_status: 'flagged', submitted_by: ME };
    expect(ownPendingFirst([a, minePending, b, m2], ME)).toEqual([minePending, m2, a, b]);
  });

  it('stops lifting the moment a place goes live', () => {
    const approved = live({ submitted_by: ME });
    expect(ownPendingFirst([a, approved, b], ME)).toEqual([a, approved, b]);
  });

  it('returns the same array when there is nothing to lift', () => {
    const list = [a, b];
    expect(ownPendingFirst(list, ME)).toBe(list);
    expect(ownPendingFirst(list, null)).toBe(list);
  });
});
