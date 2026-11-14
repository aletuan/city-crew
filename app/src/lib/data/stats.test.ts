// A list's statistics, pressed against the fake client. The counting is
// Postgres's and tested there (`collection_stats_test.sql`); what is
// pinned here is the name of each function and the argument it takes —
// strings the compiler checks against the generated types, and nothing
// checks against the migration but this.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('../testing').fakeSupabase> | null }));
vi.mock('../supabase', async () => {
  const { fakeSupabase } = await import('../testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import { PRIVACY } from '../legal';
import { fetchCollectionStats, fetchListUse, recordCollectionView } from './stats';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

describe('recordCollectionView', () => {
  it('counts the list by its id, through the function and not the table', async () => {
    fake().replies({ data: null });
    await recordCollectionView('c-1');
    expect(fake().log).toEqual([{ fn: 'record_collection_view', op: 'rpc', payload: { cid: 'c-1' }, filters: [] }]);
  });

  // Loud here, quiet at the caller: the hook that sends it drops the
  // error, and that is a decision for the hook, not for this call.
  it('throws when the count was refused', async () => {
    fake().replies({ error: { message: 'permission denied for function record_collection_view' } });
    await expect(recordCollectionView('c-1')).rejects.toThrow('permission denied');
  });
});

describe('fetchCollectionStats', () => {
  const row = {
    views_total: 9, views_7d: 2, likes_total: 1, likes_7d: 1, copies_total: 0, copies_7d: 0, trips_total: 3, trips_7d: 0,
  };

  it('asks the function for the list by its id, and hands back its rows', async () => {
    fake().replies({ data: [row] });
    expect(await fetchCollectionStats('c-1')).toEqual([row]);
    expect(fake().log).toEqual([{ fn: 'collection_stats', op: 'rpc', payload: { cid: 'c-1' }, filters: [] }]);
  });

  // No row is an answer — not the owner's — and arrives as an empty list.
  it('answers empty rather than null for a list that is not yours', async () => {
    fake().replies({ data: null });
    expect(await fetchCollectionStats('c-1')).toEqual([]);
  });

  it('throws when the read failed', async () => {
    fake().replies({ error: { message: 'timeout' } });
    await expect(fetchCollectionStats('c-1')).rejects.toThrow('timeout');
  });
});

describe('fetchListUse', () => {
  const row = { slug: 'ca-phe-ha-noi', uses: 2, views: 31, liked: 4 };

  it('asks the function, with nothing to tell it, and hands back its rows', async () => {
    fake().replies({ data: [row] });
    expect(await fetchListUse()).toEqual([row]);
    expect(fake().log).toEqual([{ fn: 'collection_use_counts', op: 'rpc', payload: undefined, filters: [] }]);
  });

  it('answers empty rather than null when no list has been used', async () => {
    fake().replies({ data: null });
    expect(await fetchListUse()).toEqual([]);
  });

  // A server without the migration answers like this, and the hook's
  // empty answer is what the shelf is then ranked on.
  it('throws when the server cannot answer', async () => {
    fake().replies({ error: { message: 'Could not find the function public.collection_use_counts' } });
    await expect(fetchListUse()).rejects.toThrow('Could not find the function');
  });
});

// `legal.ts` is binding, and this is the code its sentence is about: the
// policy says, in both of its languages, that opens are counted as a
// number per list per day and never who, and that a list's author sees
// how many trips it started and never whose. Remove the sentence and the
// count it describes fails here, beside it.
describe('the privacy policy', () => {
  const text = PRIVACY.blocks.flatMap((b) => (b.k === 'ul' ? [...b.en, ...b.vi] : b.k === 'p' ? [b.en, b.vi] : []));
  const says = (words: string) => expect(text.some((t) => t.includes(words))).toBe(true);

  it('says what is counted when a list is opened, and that it is never who', () => {
    says('Each time a collection is opened, one is added to that list’s count for the day — a number and nothing else, never who opened it');
    says('Mỗi lần một bộ sưu tập được mở, số lượt mở trong ngày của bộ sưu tập đó tăng thêm một — chỉ là một con số, không bao giờ ghi ai đã mở');
  });

  it('says a trip remembers its lists, and that their author sees how many, never whose', () => {
    says('a trip you save from collections remembers which ones, so each list’s author can see how many trips their list started, never whose');
    says('chuyến đi bạn lưu từ các bộ sưu tập sẽ ghi nhớ đó là những bộ sưu tập nào, để người tạo mỗi bộ sưu tập thấy nó đã mở đầu bao nhiêu chuyến đi, không bao giờ thấy của ai');
  });

  // Since 14 Nov 2026 the totals also order the public shelves
  // (`fetchListUse`, `lib/listRank`), which is a second use of them and
  // so a second sentence.
  it('says the totals order the public collections, and that it is never who', () => {
    says('The app also orders public collections by these totals, and by how many people liked a list or saved a copy of it — numbers only, never who');
    says('App cũng xếp thứ tự các bộ sưu tập công khai theo những tổng số này, và theo số người đã thích hoặc lưu bản sao của một bộ sưu tập — chỉ là con số, không bao giờ là ai');
  });
});
