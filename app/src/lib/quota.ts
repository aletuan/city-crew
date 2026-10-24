// What it means when the database says no to a row you were allowed to
// write.
//
// Since `20260910090000_daily_caps.sql` the insert policies on
// `collections`, `collection_places` and `place_events` count what one
// account wrote in the last day and refuse past a number — the same
// refusal, word for word, that a policy gives for a row that was never
// yours. PostgREST reports both as SQLSTATE 42501 with "new row violates
// row-level security policy", and Storage reports its own policies the
// same way, minus the code.
//
// The app only ever writes rows it owns: the save sheet lists your own
// collections, the form creates with your own id, the avatar goes into
// your own folder. So a refusal on one of these writes is, in every case
// the app can produce, the cap — and the cap is what the reader should
// be told about, in the shape `fetch-place`'s `daily_limit` already has.
// The writers throw the name; the screens have the words.
//
// Plain TypeScript, no imports; tested from `quota.test.ts`.

/** SQLSTATE for a policy that said no. */
export const RLS_REFUSED = '42501';

/** The name a writer throws when a daily cap refused it — a name, not a
 *  sentence, for the reason `auth.tsx` throws `not_signed_in`. */
export const DAILY_LIMIT = 'daily_limit';

/** The name the avatar upload throws when the sixty-second cooldown
 *  refused it. Its sentence lives in `authUi`'s table with the rest. */
export const TOO_SOON = 'too_soon';

/**
 * The numbers the policies enforce, so a sentence can say them. The SQL
 * is the authority; these are a copy, and a mismatch is a wrong number in
 * a message rather than a wrong cap.
 */
export const DAILY_CAPS = {
  collections: 20,
  placesIntoLists: 300,
  /** Three visits at one place in a day; none across places. See
   *  `PER_PLACE_PER_DAY` in `lib/checkin` and
   *  `20261009090000_checkins_per_place.sql`. */
  checkinsPerPlace: 3,
} as const;

export type Refusal = { code?: string | null; message?: string | null } | null | undefined;

/** True when the write was refused by a policy rather than by anything else. */
export function refusedByPolicy(err: Refusal): boolean {
  if (!err) return false;
  if (err.code === RLS_REFUSED) return true;
  return /row-level security/i.test(err.message ?? '');
}

/** True when a thrown error is the daily-cap name. */
export function isDailyLimit(e: unknown): boolean {
  return e instanceof Error && e.message === DAILY_LIMIT;
}

type T = (en: string, vi: string, ja: string, zh: string, hant?: string) => string;

/**
 * What to tell a reader whose Google search was refused for the day
 * (24 Oct 2026; see `SearchLimitError`): their own allowance, with its
 * number, or everyone's — "you have searched enough today" is untrue of a
 * reader who searched twice. Here, not on each screen, because two screens
 * search Google and must say it the same way.
 */
export function searchLimitWords(scope: 'account' | 'app', limit: number, t: T): { title: string; body: string } {
  if (scope === 'app') {
    return {
      title: t('Google search is resting', 'Tìm trên Google tạm nghỉ', 'Google 検索はお休み中です', 'Google 搜索暂停中', 'Google 搜尋暫停中'),
      body: t(
        'City Crew has used all of today\'s searches on Google. Try again tomorrow.',
        'Hôm nay City Crew đã dùng hết lượt tìm trên Google. Mai thử lại nhé.',
        '本日の Google 検索の上限に達しました。また明日お試しください。',
        '今天的 Google 搜索次数已用完，明天再试吧。', '今天的 Google 搜尋次數已用完，明天再試吧。',
      ),
    };
  }
  return {
    title: t('That is enough for today', 'Hôm nay vậy là đủ', '本日はここまで', '今天就到这里吧', '今天就到這裡吧'),
    body: t(
      `You can search Google ${limit} times a day. Come back tomorrow.`,
      `Mỗi ngày bạn tìm trên Google được ${limit} lần. Mai quay lại nhé.`,
      `Google 検索は1日${limit}回までです。また明日どうぞ。`,
      `你每天可以在 Google 上搜索 ${limit} 次。明天再来吧。`, `你每天可以在 Google 上搜尋 ${limit} 次。明天再來吧。`,
    ),
  };
}
