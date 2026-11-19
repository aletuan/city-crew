import { describe, expect, it } from 'vitest';
import { activityGroups, commentNewsOf, type CommentNews } from './commentNews';
import type { ActivityItem } from './friends';

const wire = (over: Record<string, unknown> = {}) => ({
  kind: 'reply', comment_id: 'k1',
  list: { id: 'c1', slug: 'hoi-an-coffee', title_en: 'Hoi An Coffee', title_vi: 'Cà phê Hội An', title_ja: null },
  actor: 'u2', handle: 'trang', full_name: 'Trang Lê', avatar_url: 'https://f/t.jpg',
  body: 'Can I come', at: '2026-11-18T10:00:00Z', others: 0,
  ...over,
});

describe('commentNewsOf', () => {
  it('reads a row whole', () => {
    expect(commentNewsOf([wire()])).toEqual([{
      kind: 'reply', comment_id: 'k1',
      list: { id: 'c1', slug: 'hoi-an-coffee', title_en: 'Hoi An Coffee', title_vi: 'Cà phê Hội An', title_ja: null },
      actor: 'u2', handle: 'trang', full_name: 'Trang Lê', avatar_url: 'https://f/t.jpg',
      body: 'Can I come', at: '2026-11-18T10:00:00Z', others: 0,
    }]);
  });

  it('reads each of the four kinds, and skips one this build does not know', () => {
    const got = commentNewsOf([
      wire({ kind: 'tag' }), wire({ kind: 'reply' }), wire({ kind: 'on_list' }), wire({ kind: 'heart' }),
      wire({ kind: 'follow' }), wire({ kind: null }),
    ]);
    expect(got.map((n) => n.kind)).toEqual(['tag', 'reply', 'on_list', 'heart']);
  });

  it('skips a row with no comment, no time, or no list to open', () => {
    expect(commentNewsOf([
      null, 'x', wire({ comment_id: 7 }), wire({ at: null }), wire({ list: null }), wire({ list: { slug: 'x' } }), wire({ list: 'c1' }),
    ])).toEqual([]);
  });

  it('fills what is missing around a row it can still draw', () => {
    const [n] = commentNewsOf([{ kind: 'heart', comment_id: 'k1', at: 'x', list: { id: 'c1' } }]);
    expect(n).toEqual({
      kind: 'heart', comment_id: 'k1', at: 'x',
      list: { id: 'c1', slug: '', title_en: null, title_vi: null, title_ja: null },
      actor: null, handle: null, full_name: null, avatar_url: null, body: '', others: 0,
    });
  });

  it('counts the others as a whole number of people, never fewer than none', () => {
    const others = (v: unknown) => commentNewsOf([wire({ kind: 'heart', others: v })])[0].others;
    expect([others(2), others(2.7), others(0), others(-1), others('3'), others(null)]).toEqual([2, 2, 0, 0, 0, 0]);
  });

  it('is nothing for an answer that is not a list', () => {
    expect(commentNewsOf(null)).toEqual([]);
    expect(commentNewsOf({ kind: 'reply' })).toEqual([]);
  });
});

describe('activityGroups', () => {
  const news = (at: string, kind: CommentNews['kind'] = 'reply'): CommentNews => commentNewsOf([wire({ at, kind, comment_id: `k-${at}` })])[0];
  const items: ActivityItem[] = [
    { kind: 'liked', at: '2026-11-18T09:00:00Z', collection_id: 'c9', owner_handle: 'son' },
    { kind: 'applause', at: '2026-11-17T09:00:00Z', collection_id: 'c1', liker_handle: 'bao', liker_name: null },
    { kind: 'copied', at: '2026-11-16T09:00:00Z', collection_id: 'c8', owner_handle: 'minh' },
    { kind: 'copy', at: '2026-11-15T09:00:00Z', collection_id: 'c1', copier_handle: 'lan', copier_name: null },
    { kind: 'friend', at: '2026-11-14T09:00:00Z', other: 'u-x', asked: 'you' },
    { kind: 'friend', at: '2026-11-13T09:00:00Z', other: 'u-y', asked: 'them' },
  ];
  const said = (es: ReturnType<typeof activityGroups>['forYou']) =>
    es.map((e) => (e.from === 'log' ? `${e.item.kind}${e.item.kind === 'friend' ? `:${e.item.asked}` : ''}` : `news:${e.news.kind}`));

  it('puts what somebody else did in the first group and what the reader did in the second', () => {
    const g = activityGroups(items, [], '2026-11-01T00:00:00Z');
    expect(said(g.forYou)).toEqual(['applause', 'copy', 'friend:you']);
    expect(said(g.yours)).toEqual(['liked', 'copied', 'friend:them']);
  });

  it('files comment news with what is for the reader, by its own time, newest first', () => {
    const g = activityGroups(items, [news('2026-11-16T12:00:00Z', 'heart'), news('2026-11-18T12:00:00Z', 'tag')], '2026-11-01T00:00:00Z');
    expect(said(g.forYou)).toEqual(['news:tag', 'applause', 'news:heart', 'copy', 'friend:you']);
    expect(g.forYou.map((e) => e.at)).toEqual([...g.forYou.map((e) => e.at)].sort().reverse());
    expect(said(g.yours)).toEqual(['liked', 'copied', 'friend:them']);
  });

  it('orders each group whatever order it was handed', () => {
    const g = activityGroups([...items].reverse(), [], '2026-11-01T00:00:00Z');
    expect(said(g.forYou)).toEqual(['applause', 'copy', 'friend:you']);
    expect(said(g.yours)).toEqual(['liked', 'copied', 'friend:them']);
  });

  it('keeps two rows of the same instant, in the order they came', () => {
    const at = '2026-11-18T12:00:00Z';
    const g = activityGroups([], [news(at, 'tag'), { ...news(at, 'heart'), comment_id: 'k-2' }], '2026-11-01T00:00:00Z');
    expect(said(g.forYou)).toEqual(['news:tag', 'news:heart']);
  });

  it('leaves out comment news from before the page\'s window opened', () => {
    const g = activityGroups([], [news('2026-11-10T00:00:00Z'), news('2026-11-02T00:00:00Z')], '2026-11-05T00:00:00Z');
    expect(g.forYou.map((e) => e.at)).toEqual(['2026-11-10T00:00:00Z']);
  });

  it('is two empty groups for nothing', () => {
    expect(activityGroups([], [], 'x')).toEqual({ forYou: [], yours: [] });
  });
});
