import { describe, expect, it } from 'vitest';
import {
  BADGES, NO_FACTS, badgeHow, badgeName, badgeSteps, earnedBadges, factsFrom, nextBadge,
  noticeOf, noticeWords, parseTold, sameTold, savedPlaces, seenAll, toldAfter, unseenBadges,
  type BadgeFacts, type BadgeId, type Told,
} from './badges';
import type { Checkin } from './checkin';
import type { FriendshipRow } from './friends';
import type { Collection } from './types';

const facts = (over: Partial<BadgeFacts> = {}): BadgeFacts => ({ ...NO_FACTS, ...over });
const en = (e: string) => e;
const vi = (_e: string, v: string) => v;
const zh = (_e: string, _v: string, _j?: string, z?: string) => z ?? '';
const hant = (_e: string, _v: string, _j?: string, _z?: string, h?: string) => h ?? '';

const list = (slugs: string[], pub = false) => ({
  is_public: pub, members: slugs.map((slug) => ({ slug })), collection_places: [],
}) as unknown as Collection;
const visit = (place_slug: string, city_id: string | null) => ({ id: place_slug, place_slug, city_id, at: '2026-11-01T00:00:00Z' }) as Checkin;
const ship = (requester: string, addressee: string, status: string) => ({
  requester, addressee, status, created_at: '2026-11-01T00:00:00Z',
}) as unknown as FriendshipRow;

describe('the nine', () => {
  it('are nine, each named once', () => {
    expect(BADGES).toHaveLength(9);
    expect(new Set(BADGES).size).toBe(9);
  });

  // The whole table: the count each reads, the number it takes, and that
  // one short of it earns nothing.
  it.each([
    ['firstFind', 'saved', 1],
    ['curator', 'publicLists', 1],
    ['beenThere', 'checkins', 1],
    ['traveller', 'cities', 3],
    ['goodCompany', 'friends', 1],
    ['onTheRoad', 'trips', 1],
    ['contributor', 'submitted', 1],
    ['wellLiked', 'likes', 5],
    ['trendsetter', 'copies', 1],
  ] as [BadgeId, keyof BadgeFacts, number][])('%s is earned by %s reaching %i', (id, fact, of) => {
    expect(earnedBadges(facts({ [fact]: of }))).toEqual([id]);
    expect(earnedBadges(facts({ [fact]: of - 1 }))).toEqual([]);
    expect(badgeSteps(id, facts({ [fact]: of - 1 }))).toEqual({ done: of - 1, of });
  });

  // The level is places kept; no badge is a second count of them.
  it('gives nothing more for keeping many places', () => {
    expect(earnedBadges(facts({ saved: 500 }))).toEqual(['firstFind']);
  });

  it('answers in the sheet’s order, whatever order the counts came in', () => {
    expect(earnedBadges(facts({ copies: 1, saved: 2, trips: 1 }))).toEqual(['firstFind', 'onTheRoad', 'trendsetter']);
    expect(earnedBadges(NO_FACTS)).toEqual([]);
  });
});

describe('badgeSteps', () => {
  it('stops at all of it', () => {
    expect(badgeSteps('wellLiked', facts({ likes: 107 }))).toEqual({ done: 5, of: 5 });
  });

  // Counts come from lengths and Set sizes; a bad one is not a bar that
  // runs backwards or a NaN on the sheet.
  it('reads a count that is not one as none', () => {
    expect(badgeSteps('traveller', facts({ cities: -2 }))).toEqual({ done: 0, of: 3 });
    expect(badgeSteps('traveller', facts({ cities: Number.NaN }))).toEqual({ done: 0, of: 3 });
    expect(badgeSteps('traveller', facts({ cities: 2.9 }))).toEqual({ done: 2, of: 3 });
  });
});

describe('nextBadge', () => {
  it('points a new account at keeping a place', () => {
    expect(nextBadge(NO_FACTS)).toBe('firstFind');
  });

  it('points at the one furthest along', () => {
    // Two of three cities is further than none of anything else.
    expect(nextBadge(facts({ saved: 3, checkins: 4, cities: 2 }))).toBe('traveller');
    // And four of five likes is further than two of three cities.
    expect(nextBadge(facts({ saved: 1, checkins: 1, cities: 2, likes: 4 }))).toBe('wellLiked');
  });

  it('takes the earlier of two equally far along, and passes over one earned', () => {
    expect(nextBadge(facts({ saved: 1 }))).toBe('curator');
    expect(nextBadge(facts({ saved: 1, publicLists: 2 }))).toBe('beenThere');
  });

  it('points at nothing once all nine are earned', () => {
    const all = facts({ saved: 1, publicLists: 1, checkins: 3, cities: 3, friends: 1, trips: 1, submitted: 1, likes: 5, copies: 1 });
    expect(earnedBadges(all)).toHaveLength(9);
    expect(nextBadge(all)).toBeNull();
  });
});

describe('factsFrom', () => {
  const have = {
    me: 'me', lists: [] as Collection[], checkins: [] as Checkin[], ships: [] as FriendshipRow[],
    trips: [] as { owner_id: string }[], submitted: 0, likes: 0, copies: 0,
  };

  it('is nothing for an account with nothing', () => {
    expect(factsFrom(have)).toEqual(NO_FACTS);
  });

  // The level's count: a place in two lists is one place found.
  it('counts a place once however many lists hold it', () => {
    const lists = [list(['a', 'b']), list(['b', 'c'], true)];
    expect(savedPlaces(lists)).toBe(3);
    expect(factsFrom({ ...have, lists })).toMatchObject({ saved: 3, publicLists: 1 });
  });

  it('counts visits, and the cities they were in — a visit with no city in none', () => {
    const checkins = [visit('a', 'hn'), visit('b', 'hn'), visit('c', 'dl'), visit('d', null)];
    expect(factsFrom({ ...have, checkins })).toMatchObject({ checkins: 4, cities: 2 });
  });

  // A request waiting either way is not a friend yet, and an edge the
  // reader is not on is nobody's business here.
  it('counts friends accepted, and only the reader’s own', () => {
    const ships = [
      ship('me', 'a', 'accepted'), ship('b', 'me', 'accepted'),
      ship('me', 'c', 'pending'), ship('d', 'me', 'pending'), ship('x', 'y', 'accepted'),
    ];
    expect(factsFrom({ ...have, ships }).friends).toBe(2);
  });

  // The shared copy of trips holds the ones the reader was asked along
  // on as well; being invited is not planning one.
  it('counts the trips the reader planned, not the ones they were asked along on', () => {
    const trips = [{ owner_id: 'me' }, { owner_id: 'somebody' }, { owner_id: 'me' }];
    expect(factsFrom({ ...have, trips }).trips).toBe(2);
  });

  it('passes the three counts it is handed straight through', () => {
    expect(factsFrom({ ...have, submitted: 3, likes: 4, copies: 5 }))
      .toMatchObject({ submitted: 3, likes: 4, copies: 5 });
  });
});

describe('what the phone remembers', () => {
  const told = (over: Partial<Told> = {}): Told => ({ badges: [], seen: [], level: 1, ...over });

  it('reads back what it wrote', () => {
    const t: Told = { badges: ['firstFind', 'curator'], seen: ['firstFind'], level: 4 };
    expect(parseTold(JSON.stringify(t))).toEqual(t);
  });

  it('drops a badge this build does not know, and keeps the rest', () => {
    expect(parseTold('{"badges":["firstFind","moonWalk"],"seen":["moonWalk"],"level":2}'))
      .toEqual({ badges: ['firstFind'], seen: [], level: 2 });
  });

  it.each([
    ['not JSON', '{'],
    ['null', 'null'],
    ['no badges', '{"seen":[],"level":1}'],
    ['no seen', '{"badges":[],"level":1}'],
    ['a level that is not a number', '{"badges":[],"seen":[],"level":"3"}'],
    ['badges that are not a list', '{"badges":"firstFind","seen":[],"level":1}'],
    ['seen that is not a list', '{"badges":[],"seen":{},"level":1}'],
  ])('refuses %s', (_what, raw) => {
    expect(parseTold(raw)).toBeUndefined();
  });

  it('knows which of those earned the sheet has not been closed on', () => {
    expect(unseenBadges(['firstFind', 'curator'], told({ seen: ['firstFind'] }))).toEqual(['curator']);
    expect(unseenBadges(['firstFind'], null)).toEqual(['firstFind']);
  });

  // Seen stays seen: a badge lost and earned again is not a second dot.
  it('marks everything earned as seen, in the sheet’s order, and forgets none seen before', () => {
    expect(seenAll(told({ badges: ['curator', 'firstFind'], level: 3 }), ['curator', 'firstFind']))
      .toEqual({ badges: ['curator', 'firstFind'], seen: ['firstFind', 'curator'], level: 3 });
    expect(seenAll(told({ seen: ['trendsetter'] }), ['firstFind']).seen).toEqual(['firstFind', 'trendsetter']);
  });
});

describe('noticeOf', () => {
  const told = (over: Partial<Told> = {}): Told => ({ badges: [], seen: [], level: 1, ...over });

  // A phone meeting the account for the first time.
  it('tells an account how many it already holds, once, and not its level', () => {
    expect(noticeOf(null, ['firstFind', 'curator', 'beenThere'], 18)).toEqual({ kind: 'badges', count: 3 });
    expect(noticeOf(null, ['firstFind'], 2)).toEqual({ kind: 'badges', count: 1 });
  });

  it('says nothing to a new account with nothing', () => {
    expect(noticeOf(null, [], 1)).toBeNull();
  });

  // The level it has had all along is not news, whatever else is not.
  it('never says a level to a phone that knew nothing', () => {
    expect(noticeOf(null, [], 18)).toBeNull();
  });

  it('names one new badge', () => {
    expect(noticeOf(told({ badges: ['firstFind'] }), ['firstFind', 'beenThere'], 1)).toEqual({ kind: 'badge', id: 'beenThere' });
  });

  it('counts them when two arrive together', () => {
    expect(noticeOf(told(), ['wellLiked', 'trendsetter'], 1)).toEqual({ kind: 'badges', count: 2 });
  });

  it('says a level reached, and only one higher than was told', () => {
    expect(noticeOf(told({ level: 2 }), [], 3)).toEqual({ kind: 'level', level: 3 });
    expect(noticeOf(told({ level: 3 }), [], 3)).toBeNull();
    expect(noticeOf(told({ level: 3 }), [], 2)).toBeNull();
  });

  it('says the badge and not the level when both come at once', () => {
    expect(noticeOf(told({ level: 1 }), ['curator'], 2)).toEqual({ kind: 'badge', id: 'curator' });
  });

  it('says nothing again about a badge already told, still earned or not', () => {
    expect(noticeOf(told({ badges: ['curator'] }), ['curator'], 1)).toBeNull();
    expect(noticeOf(told({ badges: ['curator'] }), [], 1)).toBeNull();
  });
});

describe('toldAfter', () => {
  it('starts a phone that knew nothing', () => {
    expect(toldAfter(null, [], 1)).toEqual({ badges: [], seen: [], level: 1 });
    expect(toldAfter(null, ['curator', 'firstFind'], 18)).toEqual({ badges: ['firstFind', 'curator'], seen: [], level: 18 });
  });

  // Told stays told: Curator lost and earned again is not announced twice.
  it('adds what was earned to what was told, and leaves what was seen', () => {
    const was: Told = { badges: ['curator'], seen: ['curator'], level: 2 };
    const now = toldAfter(was, ['firstFind'], 2);
    expect(now).toEqual({ badges: ['firstFind', 'curator'], seen: ['curator'], level: 2 });
    expect(noticeOf(now, ['firstFind', 'curator'], 2)).toBeNull();
  });

  // Three places unsaved and saved again is not a second fanfare.
  it('keeps the highest level reached', () => {
    expect(toldAfter({ badges: [], seen: [], level: 4 }, [], 3).level).toBe(4);
    expect(toldAfter({ badges: [], seen: [], level: 4 }, [], 5).level).toBe(5);
  });

  it('can tell when there is nothing new to write', () => {
    const was: Told = { badges: ['firstFind'], seen: ['firstFind'], level: 2 };
    expect(sameTold(was, toldAfter(was, ['firstFind'], 2))).toBe(true);
    expect(sameTold(was, toldAfter(was, ['firstFind'], 3))).toBe(false);
    expect(sameTold(was, toldAfter(was, ['firstFind', 'curator'], 2))).toBe(false);
    expect(sameTold(was, { ...was, seen: [] })).toBe(false);
    expect(sameTold(null, toldAfter(null, [], 1))).toBe(false);
  });
});

describe('the words', () => {
  it('names every badge, each differently, in every language', () => {
    for (const t of [en, vi, zh, hant]) {
      const names = BADGES.map((id) => badgeName(id, t));
      expect(names.every((n) => n.length > 0)).toBe(true);
      expect(new Set(names).size).toBe(9);
      const hows = BADGES.map((id) => badgeHow(id, t));
      expect(hows.every((h) => h.length > 0)).toBe(true);
      expect(new Set(hows).size).toBe(9);
    }
  });

  it('calls them what the owner chose (17 Nov 2026)', () => {
    expect(BADGES.map((id) => badgeName(id, vi))).toEqual([
      'Khởi đầu', 'Người tuyển chọn', 'Đã đặt chân', 'Lữ khách', 'Bạn đồng hành',
      'Lên đường', 'Người đóng góp', 'Được yêu thích', 'Truyền cảm hứng',
    ]);
    expect(BADGES.map((id) => badgeName(id, en))).toEqual([
      'First Find', 'Curator', 'Been There', 'Traveller', 'Good Company',
      'On the Road', 'Contributor', 'Well Liked', 'Trendsetter',
    ]);
  });

  // The number in the sentence is the number in the rule.
  it('says the number each of the two counted badges takes', () => {
    expect(badgeHow('traveller', en)).toContain(String(badgeSteps('traveller', NO_FACTS).of));
    expect(badgeHow('wellLiked', vi)).toContain(String(badgeSteps('wellLiked', NO_FACTS).of));
  });

  it('writes the banner for one badge, for several, and for a level', () => {
    expect(noticeWords({ kind: 'badge', id: 'beenThere' }, vi)).toEqual({ lead: 'Huy hiệu mới', name: 'Đã đặt chân' });
    expect(noticeWords({ kind: 'badges', count: 5 }, vi)).toEqual({ lead: 'Huy hiệu của bạn', name: 'Bạn đã có 5 huy hiệu' });
    expect(noticeWords({ kind: 'level', level: 19 }, vi)).toEqual({ lead: 'Lên level', name: 'Level 19' });
  });

  // English alone counts its nouns.
  it('counts one badge as one', () => {
    expect(noticeWords({ kind: 'badges', count: 1 }, en).name).toBe('You hold 1 badge');
    expect(noticeWords({ kind: 'badges', count: 2 }, en).name).toBe('You hold 2 badges');
  });
});
