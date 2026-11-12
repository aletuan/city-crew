// The plan options screen's heading: what the reader asked for, said back
// as one sentence, and when.
//
// ── what it replaced (owner, 12 Nov 2026) ──
//
// "Your evening, three ways" over "Distances checked · each card a
// different angle", over a third line, "Thu, 12/11 · Hanoi · Near you".
// The owner's verdict: hard to understand, and the subtitle "sounds like
// AI". The title counted the cards the reader was already looking at and
// said nothing of the four answers they had just given; the subtitle
// described the machine's work, not the reader's evening, and its second
// half repeated what the badges on the cards already say.
//
// The owner's own shape replaced it: "Ăn tối ở … cùng …" — what, where,
// with whom — and the day under it. So the heading reads back the
// request, and a reader whose answers came out wrong sees it before
// comparing a single card. Three lines became two; the count went, since
// the cards are right there and a thin set says so under them.
//
// Word choices, the owner's: a couple is "cùng người ấy" (not "cho hai
// người", not "hẹn hò"), and anything without one clear kind of place is
// "Đi chơi".

import type { Lang } from './lang';

/** Which of the wizard's answers to "starting from where" this was. */
export type WhereKind = 'district' | 'place' | 'pin' | 'near' | 'city';

type T = (en: string, vi: string, ja: string, zh: string, hant: string) => string;

export type PlanHeadingInput = {
  company: string | null;
  categories: readonly string[];
  when: 'day' | 'evening';
  /** The wizard's words for the start: a district's or a place's name. */
  where: string | null;
  whereKind?: WhereKind;
  district?: string | null;
  /** The city's short name, for a plan from its centre. */
  city: string | null;
};

const fill = (template: string, value: string) => template.replace('{}', value);

/** What the outing is, from the kinds asked for. One clear kind names
 *  itself; a mix, or none, is going out. */
function activity(categories: readonly string[], when: 'day' | 'evening', t: T): string {
  const only = categories.length === 1 ? categories[0] : null;
  if (only === 'eats') {
    return when === 'evening'
      ? t('Dinner', 'Ăn tối', 'ディナー', '吃晚餐', '吃晚餐')
      : t('Eating out', 'Ăn uống', '食べ歩き', '吃饭', '吃飯');
  }
  if (only === 'cafes') return t('Coffee', 'Cà phê', 'カフェ', '喝咖啡', '喝咖啡');
  if (only === 'nightlife') return t('A night out', 'Đi chơi đêm', '夜遊び', '夜游', '夜遊');
  return t('Going out', 'Đi chơi', 'お出かけ', '出去玩', '出去玩');
}

/** Where it starts, as the wizard said it. A plan reached without the
 *  wizard's kind falls back on what the words alone can tell. */
function place(a: PlanHeadingInput, t: T): string | null {
  const kind = a.whereKind ?? (a.district ? 'district' : a.where === null ? 'city' : null);
  if ((kind === 'district' || kind === 'place') && a.where) {
    return kind === 'district'
      ? fill(t('in {}', 'ở {}', '{}で', '在{}', '在{}'), a.where)
      : fill(t('near {}', 'gần {}', '{}の近くで', '在{}附近', '在{}附近'), a.where);
  }
  if (kind === 'pin') return t('near your pin', 'gần điểm ghim', 'ピンの近くで', '在图钉附近', '在圖釘附近');
  if (kind === 'near') return t('near you', 'gần bạn', '近くで', '在你附近', '在你附近');
  if (kind === 'city' && a.city) return fill(t('in {}', 'ở {}', '{}で', '在{}', '在{}'), a.city);
  return null;
}

/** Who is going. Nobody chosen is nobody named. */
function company(key: string | null, t: T): string | null {
  switch (key) {
    case 'solo': return t('on your own', 'một mình', 'ひとりで', '一个人', '一個人');
    case 'couple': return t('for two', 'cùng người ấy', 'ふたりで', '两个人', '兩個人');
    case 'friends': return t('with friends', 'cùng hội bạn', '友だちと', '和朋友', '和朋友');
    case 'family': return t('with family', 'cùng cả nhà', '家族で', '和家人', '和家人');
    default: return null;
  }
}

/**
 * "Ăn tối ở Tây Hồ cùng hội bạn". English and Vietnamese say it in the
 * same order; Japanese puts the verb last ("西湖で友だちとディナー"), and
 * Chinese puts who and where before what ("和朋友在西湖吃晚餐").
 */
export function planTitle(a: PlanHeadingInput, lang: Lang, t: T): string {
  const what = activity(a.categories, a.when, t);
  const where = place(a, t);
  const who = company(a.company, t);
  const parts = (xs: (string | null)[]) => xs.filter((x): x is string => !!x);
  if (lang === 'ja') return parts([where, who, what]).join('');
  if (lang === 'zh' || lang === 'zh-Hant') return parts([who, where, what]).join('');
  // Each phrase held together with no-break spaces, so a title too long
  // for one line breaks between phrases and never inside one. Measured on
  // a 440pt phone at the header's 26pt: "Cà phê gần bạn cùng người ấy"
  // broke before "ấy" and "Ăn tối ở Tây Hồ cùng hội bạn" before "bạn" —
  // one word alone on the second line, which reads as a layout that came
  // out wrong. Held together, they break as "Cà phê gần bạn / cùng người
  // ấy" and "Ăn tối ở Tây Hồ / cùng hội bạn".
  return parts([what, where, who]).map((x) => x.replace(/ /g, NBSP)).join(' ');
}

const NBSP = '\u00A0';

/**
 * When, under the title: "Tonight", "Tomorrow evening", or the date and
 * the half of it — the words a person uses, and the date only once it is
 * further off than a word can say.
 */
export function planWhen(
  day: string, today: string, tomorrow: string, when: 'day' | 'evening', dateline: string, t: T,
): string {
  const evening = when === 'evening';
  if (day === today) {
    return evening ? t('Tonight', 'Tối nay', '今夜', '今晚', '今晚') : t('Today', 'Hôm nay', '今日', '今天', '今天');
  }
  if (day === tomorrow) {
    return evening
      ? t('Tomorrow evening', 'Tối mai', '明日の夜', '明晚', '明晚')
      : t('Tomorrow', 'Ngày mai', '明日', '明天', '明天');
  }
  const half = evening ? t('evening', 'buổi tối', '夜', '晚上', '晚上') : t('all day', 'cả ngày', '終日', '全天', '全天');
  return `${dateline} · ${half}`;
}
