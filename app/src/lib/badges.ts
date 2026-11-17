// Badges: nine things a person can have done here, each marked once.
//
// ── what they are for (owner, 17 Nov 2026) ──
//
// Measured that day, of 131 accounts: 33 had made a collection, and 98
// had signed up and done nothing after. So a badge is for the first of a
// kind of thing — a first place kept, a first check-in, a first friend —
// and not a prize for those who already do the most.
//
// How many held each on the day, by the rules below: First Find 32,
// Curator 16, Been There 16, Traveller 3, Good Company 19, On the Road
// 17, Contributor 17, Well Liked 10, Trendsetter 5.
//
// ── beside the level, not instead of it ──
//
// The level (`lib/level`) says how much: places kept, five to a level,
// without end. A badge says what kinds of thing. So no badge counts
// places kept — that would be the level said twice — and the level
// stays, because nine badges run out and it does not.
//
// Not taken, from the reference the owner brought:
//
//   - streaks, or anything by the day. Nobody plans a trip daily, and a
//     chain that breaks reads as a penalty.
//   - Local Guide as a badge. A role is a permission the desk grants
//     (`components/RoleBadge`); a badge is a record of what was done.
//   - a badge after the name. That place is the role's.
//
// ── where the numbers come from ──
//
// Every figure is one the app already holds for the reader, or can ask
// under rules already in the database: their lists, check-ins, friends
// and trips from the shared copies; the places they sent in
// (`fetchMySubmittedPlaces`); and the likes and copies other people gave
// their lists (`likes_on_mine`, `copies_of_mine`, which leave out the
// reader's own and anybody they blocked). Nothing new is sent or stored
// on the server, so the privacy policy (`lib/legal`) is as it was.
//
// ── what is still open ──
//
// A badge is worked out from what stands now: delete the list that
// earned Curator and the badge goes with it. What has been said about
// them — which were announced, which the sheet was closed on — is kept
// on the phone (`lib/rewards`), so another phone says it again. Keeping
// badges on the server is the next step, with a migration and a line in
// the policy; showing them on a person's page waits for that, and for a
// decision on which may be seen: a check-in is the reader's alone.
//
// Rejected for this cut: holding on the phone every badge once told, so
// that none is ever taken back. It reads as kinder, and it makes the
// phone the only record of a thing the server can contradict — one
// launch that mistook whose lists it was holding would pin somebody
// else's badges to an account for good.
//
// No React and no client here, as `level.ts` has none: the rules can be
// tested in a plain Node process.

import { visitSummary, type Checkin } from './checkin';
import { splitFriendships, type FriendshipRow } from './friends';
import { membersOf } from './place';
import type { Collection } from './types';

/** The nine, in the order the sheet draws them: what a new account does
 *  first comes first, and what other people give comes last. */
export const BADGES = [
  'firstFind', 'curator', 'beenThere',
  'traveller', 'goodCompany', 'onTheRoad',
  'contributor', 'wellLiked', 'trendsetter',
] as const;
export type BadgeId = (typeof BADGES)[number];

/** What a badge is decided from: counts, each of one kind of thing. */
export type BadgeFacts = {
  /** Distinct places kept in the reader's lists — the level's count. */
  saved: number;
  /** Lists of theirs anybody can open. */
  publicLists: number;
  checkins: number;
  /** Cities checked in in. */
  cities: number;
  friends: number;
  trips: number;
  /** Places they sent in that were not in the app. */
  submitted: number;
  /** Likes other people gave their lists. */
  likes: number;
  /** Copies other people saved of their lists. */
  copies: number;
};

export const NO_FACTS: BadgeFacts = {
  saved: 0, publicLists: 0, checkins: 0, cities: 0, friends: 0, trips: 0, submitted: 0, likes: 0, copies: 0,
};

/**
 * Which count, and how many of it.
 *
 * Seven are a first. The two that are not: three cities, the least that
 * is plainly travelling and not a trip home (3 accounts of 16 that had
 * checked in, on 17 Nov 2026); and five likes, where one or two are a
 * friend being kind (10 of the 15 whose lists had any).
 */
const NEEDS: Record<BadgeId, { fact: keyof BadgeFacts; of: number }> = {
  firstFind: { fact: 'saved', of: 1 },
  curator: { fact: 'publicLists', of: 1 },
  beenThere: { fact: 'checkins', of: 1 },
  traveller: { fact: 'cities', of: 3 },
  goodCompany: { fact: 'friends', of: 1 },
  onTheRoad: { fact: 'trips', of: 1 },
  contributor: { fact: 'submitted', of: 1 },
  wellLiked: { fact: 'likes', of: 5 },
  trendsetter: { fact: 'copies', of: 1 },
};

/** A count as a badge reads it: whole, and never under none. */
const whole = (n: number) => Math.max(0, Math.floor(n || 0));

/** How far along: `done` of `of`, and never more than all of it. */
export function badgeSteps(id: BadgeId, facts: BadgeFacts): { done: number; of: number } {
  const { fact, of } = NEEDS[id];
  return { done: Math.min(whole(facts[fact]), of), of };
}

/** The badges these counts earn, in the sheet's order. */
export function earnedBadges(facts: BadgeFacts): BadgeId[] {
  return BADGES.filter((id) => {
    const { done, of } = badgeSteps(id, facts);
    return done >= of;
  });
}

/**
 * The badge to point at: of those not earned, the one furthest along, and
 * among equals the earliest in the sheet's order — so a new account is
 * pointed at keeping a place, which is where the app starts.
 */
export function nextBadge(facts: BadgeFacts): BadgeId | null {
  let best: BadgeId | null = null;
  let bestPart = -1;
  for (const id of BADGES) {
    const { done, of } = badgeSteps(id, facts);
    if (done < of && done / of > bestPart) { best = id; bestPart = done / of; }
  }
  return best;
}

/**
 * The counts, from the copies the app holds.
 *
 * Places kept are distinct, as the level counts them (`AccountProfile`
 * had this sum to itself until badges needed it too): a place in two of
 * your lists is one place found. Your own lists arrive carrying their
 * members, so no catalog is consulted.
 */
export function factsFrom(have: {
  me: string;
  lists: readonly Collection[];
  checkins: readonly Checkin[];
  ships: readonly FriendshipRow[];
  /** Every trip the reader can open: theirs, and those they were asked
   *  along on. Only theirs are counted — On the Road is for planning one. */
  trips: readonly { owner_id: string }[];
  submitted: number;
  likes: number;
  copies: number;
}): BadgeFacts {
  const visits = visitSummary(have.checkins);
  return {
    saved: savedPlaces(have.lists),
    publicLists: have.lists.filter((c) => c.is_public).length,
    checkins: visits.visits,
    cities: visits.cities,
    friends: splitFriendships(have.ships, have.me).friends.length,
    trips: have.trips.filter((trip) => trip.owner_id === have.me).length,
    submitted: have.submitted,
    likes: have.likes,
    copies: have.copies,
  };
}

/** Distinct places across a reader's own lists. */
export function savedPlaces(lists: readonly Collection[]): number {
  const seen = new Set<string>();
  for (const c of lists) for (const p of membersOf(c, [])) seen.add(p.slug);
  return seen.size;
}

// ── what the phone remembers, and what it says ──

/**
 * What this phone has already said to this account: the badges it has
 * announced, the ones the sheet has been closed on, and the level.
 */
export type Told = { badges: BadgeId[]; seen: BadgeId[]; level: number };

/** One thing to say in the banner. */
export type Notice =
  | { kind: 'badge'; id: BadgeId }
  | { kind: 'badges'; count: number }
  | { kind: 'level'; level: number };

const isBadge = (x: unknown): x is BadgeId => (BADGES as readonly unknown[]).includes(x);

/** `Told` from its stored text, or undefined for anything else. A name a
 *  later build added and this one does not know is dropped, not kept as
 *  a badge with no picture. */
export function parseTold(raw: string): Told | undefined {
  try {
    const v = JSON.parse(raw) as Partial<Told> | null;
    if (!v || !Array.isArray(v.badges) || !Array.isArray(v.seen) || typeof v.level !== 'number') return undefined;
    return { badges: v.badges.filter(isBadge), seen: v.seen.filter(isBadge), level: v.level };
  } catch {
    return undefined;
  }
}

/** In the sheet's order, everything in either list. */
const either = (a: readonly BadgeId[], b: readonly BadgeId[]): BadgeId[] => (
  BADGES.filter((id) => a.includes(id) || b.includes(id))
);

/**
 * What to say now, if anything.
 *
 * Nothing told yet is a phone meeting this account for the first time —
 * a new account, or one that had its badges before badges were drawn.
 * It is told how many it holds, once, and not one banner for each; and
 * never its level, which it has had all along.
 *
 * After that: a badge by its name, or their number when two arrive
 * together (a launch after a week away). A level is said only when no
 * badge is — one banner at a time, and of the two the badge is the one
 * that will not come round again in five places.
 */
export function noticeOf(told: Told | null, earned: readonly BadgeId[], level: number): Notice | null {
  const fresh = earned.filter((id) => !told?.badges.includes(id));
  if (fresh.length === 1 && told) return { kind: 'badge', id: fresh[0] };
  if (fresh.length > 0) return { kind: 'badges', count: fresh.length };
  if (told && level > told.level) return { kind: 'level', level };
  return null;
}

/**
 * `Told`, after saying it: every badge earned is now announced — and
 * stays announced if it is lost and earned again — and the level is the
 * highest reached, so dropping under a level and coming back is not a
 * second fanfare. What the sheet has been closed on is left alone; that
 * is `seenAll`'s.
 */
export function toldAfter(told: Told | null, earned: readonly BadgeId[], level: number): Told {
  return {
    badges: either(earned, told?.badges ?? []),
    seen: told?.seen ?? [],
    level: Math.max(told?.level ?? 1, level),
  };
}

/** Whether what was told and what would be told now are the same — so a
 *  render that changes nothing writes nothing. */
export function sameTold(a: Told | null, b: Told): boolean {
  return !!a && a.level === b.level
    && a.badges.join() === b.badges.join() && a.seen.join() === b.seen.join();
}

/** `Told`, once the sheet has been closed on everything earned. */
export function seenAll(told: Told, earned: readonly BadgeId[]): Told {
  return { ...told, seen: either(earned, told.seen) };
}

/** The badges earned that the sheet has not been closed on. */
export function unseenBadges(earned: readonly BadgeId[], told: Told | null): BadgeId[] {
  return earned.filter((id) => !told?.seen.includes(id));
}

// ── the words ──

type T = (en: string, vi: string, ja?: string, zh?: string, hant?: string) => string;

/** What a badge is called. */
export function badgeName(id: BadgeId, t: T): string {
  switch (id) {
    case 'firstFind': return t('First Find', 'Khởi đầu', 'はじめの一歩', '初次收藏', '初次收藏');
    case 'curator': return t('Curator', 'Người tuyển chọn', 'キュレーター', '策展人', '策展人');
    case 'beenThere': return t('Been There', 'Đã đặt chân', '行ってきた', '到此一游', '到此一遊');
    case 'traveller': return t('Traveller', 'Lữ khách', '旅人', '旅行者', '旅行者');
    case 'goodCompany': return t('Good Company', 'Bạn đồng hành', '旅の仲間', '结伴同行', '結伴同行');
    case 'onTheRoad': return t('On the Road', 'Lên đường', '出発', '启程', '啟程');
    case 'contributor': return t('Contributor', 'Người đóng góp', 'コントリビューター', '贡献者', '貢獻者');
    case 'wellLiked': return t('Well Liked', 'Được yêu thích', '人気者', '广受喜爱', '廣受喜愛');
    default: return t('Trendsetter', 'Truyền cảm hứng', 'トレンドセッター', '引领风潮', '引領風潮');
  }
}

/** What earns it, said as the thing to do. */
export function badgeHow(id: BadgeId, t: T): string {
  switch (id) {
    case 'firstFind': return t('Save your first place.', 'Lưu địa điểm đầu tiên.', '最初の場所を保存する。', '保存第一个地点。', '儲存第一個地點。');
    case 'curator': return t('Make one of your collections public.', 'Đưa một bộ sưu tập lên công khai.', 'コレクションを1つ公開する。', '公开一个合集。', '公開一個合集。');
    case 'beenThere': return t('Check in at a place.', 'Check-in ở một địa điểm.', '場所でチェックインする。', '在一个地点打卡。', '在一個地點打卡。');
    case 'traveller': return t('Check in across 3 cities.', 'Check-in ở 3 thành phố.', '3つの都市でチェックインする。', '在 3 个城市打卡。', '在 3 個城市打卡。');
    case 'goodCompany': return t('Add your first friend.', 'Kết bạn với một người.', '最初の友達を追加する。', '添加第一位好友。', '新增第一位好友。');
    case 'onTheRoad': return t('Plan your first trip.', 'Tạo chuyến đi đầu tiên.', '最初の旅程を作る。', '创建第一个行程。', '建立第一個行程。');
    case 'contributor': return t('Add a place that is not in the app yet.', 'Thêm một địa điểm chưa có trong ứng dụng.', 'アプリにない場所を追加する。', '添加一个应用里还没有的地点。', '新增一個App裡還沒有的地點。');
    case 'wellLiked': return t('Get 5 likes on your collections.', 'Nhận 5 lượt thích cho các bộ sưu tập của bạn.', 'コレクションに「いいね」を5件もらう。', '你的合集获得 5 个赞。', '你的合集獲得 5 個讚。');
    default: return t('Have someone save a copy of your collection.', 'Có người lưu bản sao bộ sưu tập của bạn.', '誰かにコレクションをコピーしてもらう。', '有人保存了你合集的副本。', '有人儲存了你合集的副本。');
  }
}

/** The banner's two lines for a notice: what happened, and its name. */
export function noticeWords(notice: Notice, t: T): { lead: string; name: string } {
  if (notice.kind === 'badge') {
    return { lead: t('New badge', 'Huy hiệu mới', '新しいバッジ', '新徽章', '新徽章'), name: badgeName(notice.id, t) };
  }
  if (notice.kind === 'badges') {
    const n = notice.count;
    return {
      lead: t('Your badges', 'Huy hiệu của bạn', 'あなたのバッジ', '你的徽章', '你的徽章'),
      name: t(
        `You hold ${n} ${n === 1 ? 'badge' : 'badges'}`,
        `Bạn đã có ${n} huy hiệu`,
        `バッジを${n}個獲得しています`,
        `你已获得 ${n} 枚徽章`, `你已獲得 ${n} 枚徽章`,
      ),
    };
  }
  const { level } = notice;
  return {
    lead: t('Level up', 'Lên level', 'レベルアップ', '升级了', '升級了'),
    name: t(`Level ${level}`, `Level ${level}`, `レベル${level}`, `${level} 级`, `${level} 級`),
  };
}
