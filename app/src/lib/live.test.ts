import { describe, expect, it } from 'vitest';
import {
  isFlagged, isLive, isMineAndUnlive, isPending,
  ownPendingFirst, type Reviewable, unseenMembers, unseenSentence,
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

describe('unseenSentence', () => {
  const en = (e: string) => e;
  const vi = (_e: string, v: string) => v;
  const ja = (_e: string, _v: string, j: string) => j;
  const zh = (_e: string, _v: string, _j: string, z?: string) => z ?? '';

  // Both kinds named, because they end differently.
  it('names both kinds, joined, after what the list is shown as', () => {
    expect(unseenSentence({ pending: 2, flagged: 1 }, en))
      .toBe('Shown in Explore and in search, except 2 places not public yet and 1 not accepted');
    expect(unseenSentence({ pending: 2, flagged: 1 }, vi))
      .toBe('Hiện trên Khám phá và trong tìm kiếm, trừ 2 địa điểm chưa công khai và 1 địa điểm không được duyệt');
    expect(unseenSentence({ pending: 2, flagged: 1 }, ja))
      .toBe('「探索する」と検索に表示されます（まだ公開されていない2件と不採用の1件を除く）');
    expect(unseenSentence({ pending: 2, flagged: 1 }, zh))
      .toBe('会显示在探索和搜索中，尚未公开的 2 个地点和未通过的 1 个除外');
  });

  it('counts in the singular and the plural, and names one kind alone', () => {
    expect(unseenSentence({ pending: 1, flagged: 0 }, en))
      .toBe('Shown in Explore and in search, except 1 place not public yet');
    expect(unseenSentence({ pending: 0, flagged: 2 }, en))
      .toBe('Shown in Explore and in search, except 2 not accepted');
  });
});

describe('unseenMembers', () => {
  it('counts nothing when everything is live, or there is nothing', () => {
    expect(unseenMembers([live(), live()])).toEqual({ pending: 0, flagged: 0 });
    expect(unseenMembers([])).toEqual({ pending: 0, flagged: 0 });
  });

  // Both numbers, because the sentence the owner reads names both.
  it('counts the two kinds apart', () => {
    const members = [
      live(),
      { is_published: false, review_status: 'pending' },
      { is_published: false, review_status: 'pending' },
      { is_published: false, review_status: 'flagged' },
    ];
    expect(unseenMembers(members)).toEqual({ pending: 2, flagged: 1 });
  });

  // Approved and unpublished is unseen too: two flags, one meaning.
  it('counts an approved-but-unpublished member as not public yet', () => {
    expect(unseenMembers([{ is_published: false, review_status: 'approved' }]))
      .toEqual({ pending: 1, flagged: 0 });
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
