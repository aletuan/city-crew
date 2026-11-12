// The plan options screen's heading: what the outing is and when, and
// under it with whom and where.
//
// ── how it got here (owner, 12 Nov 2026) ──
//
// It was "Your evening, three ways" over "Distances checked · each card a
// different angle", over a third line, "Thu, 12/11 · Hanoi · Near you":
// hard to understand, and the subtitle "sounds like AI". The title counted
// the cards the reader was already looking at, and the subtitle described
// the machine's work, not the reader's evening.
//
// The first replacement read the whole request back as one sentence, the
// owner's "Ăn tối ở … cùng …". On the phone the commonest request made the
// worst sentence: "Đi chơi gần bạn cùng người ấy" — "gần bạn" reads as
// talking to somebody else, a second "you" then arrives as "người ấy",
// and the default start ("near you") took the title's best place. The
// owner chose the third shape offered: what + when as the title ("Cà phê
// tối nay"), with whom · where under it ("Cùng người ấy · gần bạn").
//
// Word choices, the owner's: a couple is "cùng người ấy", and anything
// without one or two clear kinds of place is "Đi chơi".

import { CATEGORIES } from './categories';
import { fromISO } from './day';
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
  /**
   * The area nearest where the reader stood when they asked, for a plan
   * from "near me" — said instead of "gần bạn" (owner, 12 Nov 2026): a
   * plan is read again later, often from somewhere else, and "near you"
   * then names nowhere. Absent until the places it is counted from have
   * loaded, when "near you" is all there is to say.
   */
  nearArea?: string | null;
};

/** The day the plan is for, and the two days a word can name. */
export type PlanDay = { day: string; today: string; tomorrow: string; dateline: string };

const NBSP = ' ';
/** One phrase, held together: a title too long for one line breaks
 *  between phrases, never inside one — measured on a 440pt phone at the
 *  header's 26pt, an unheld title left its last word alone on line two. */
const hold = (s: string) => s.replace(/ /g, NBSP);
const upFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the outing is. One clear kind names itself, two are named
 *  together, more or none is going out. `evening` says whether the words
 *  already carry the time of day ("Ăn tối"), so the "when" after them
 *  does not say it twice ("Ăn tối hôm nay", not "Ăn tối tối nay"). */
function activity(categories: readonly string[], when: 'day' | 'evening', lang: Lang, t: T): { words: string; evening: boolean } {
  if (categories.length === 1) {
    const only = categories[0];
    if (only === 'eats') {
      return when === 'evening'
        ? { words: t('Dinner', 'Ăn tối', 'ディナー', '吃晚餐', '吃晚餐'), evening: true }
        : { words: t('Eating out', 'Ăn uống', '食べ歩き', '吃饭', '吃飯'), evening: false };
    }
    if (only === 'cafes') return { words: t('Coffee', 'Cà phê', 'カフェ', '喝咖啡', '喝咖啡'), evening: false };
    if (only === 'nightlife') return { words: t('A night out', 'Đi chơi đêm', '夜遊び', '夜游', '夜遊'), evening: true };
  }
  const named = categories.map((k) => CATEGORIES[k]).filter(Boolean);
  if (named.length === 2 && named.length === categories.length) {
    const [a, b] = named.map((c) => t(c.en, c.vi, c.ja, c.zh, c.hant));
    if (lang === 'ja') return { words: `${a}と${b}`, evening: false };
    if (lang === 'zh' || lang === 'zh-Hant') return { words: `${a}和${b}`, evening: false };
    return { words: `${a} & ${b.charAt(0).toLowerCase()}${b.slice(1)}`, evening: false };
  }
  return { words: t('Going out', 'Đi chơi', 'お出かけ', '出去玩', '出去玩'), evening: false };
}

function weekday(n: number, t: T): string {
  return [
    t('Sunday', 'Chủ nhật', '日曜日', '周日', '週日'),
    t('Monday', 'thứ Hai', '月曜日', '周一', '週一'),
    t('Tuesday', 'thứ Ba', '火曜日', '周二', '週二'),
    t('Wednesday', 'thứ Tư', '水曜日', '周三', '週三'),
    t('Thursday', 'thứ Năm', '木曜日', '周四', '週四'),
    t('Friday', 'thứ Sáu', '金曜日', '周五', '週五'),
    t('Saturday', 'thứ Bảy', '土曜日', '周六', '週六'),
  ][n];
}

/** When, as a person says it: tonight, tomorrow, a weekday this week —
 *  or null past a week, where only the date says which. */
function whenWords(d: PlanDay, evening: boolean, carried: boolean, t: T): string | null {
  const tonightish = evening && !carried;
  if (d.day === d.today) {
    return tonightish ? t('tonight', 'tối nay', '今夜', '今晚', '今晚')
      : evening ? t('tonight', 'hôm nay', '今夜', '今晚', '今晚')
        : t('today', 'hôm nay', '今日', '今天', '今天');
  }
  if (d.day === d.tomorrow) {
    return tonightish ? t('tomorrow evening', 'tối mai', '明日の夜', '明晚', '明晚')
      : t('tomorrow', 'ngày mai', '明日', '明天', '明天');
  }
  const date = fromISO(d.day);
  const from = fromISO(d.today);
  const ahead = date && from ? Math.round((date.getTime() - from.getTime()) / 86400000) : 99;
  if (ahead < 1 || ahead > 6) return null;
  const name = weekday(date!.getDay(), t);
  return tonightish
    ? t(`on ${name} evening`, `tối ${name}`, `${name}の夜`, `${name}晚上`, `${name}晚上`)
    : t(`on ${name}`, name, name, name, name);
}

/** "Cà phê tối nay", "Ăn tối hôm nay", "Đi chơi thứ Bảy". */
export function planTitle(a: PlanHeadingInput, d: PlanDay, lang: Lang, t: T): string {
  const what = activity(a.categories, a.when, lang, t);
  const when = whenWords(d, a.when === 'evening', what.evening, t);
  const cjk = lang === 'ja' || lang === 'zh' || lang === 'zh-Hant';
  if (cjk) {
    const at = when ?? d.dateline;
    return lang === 'ja' ? `${at}の${what.words}` : `${at}${what.words}`;
  }
  return when
    ? `${hold(what.words)} ${hold(when)}`
    : `${hold(what.words)} · ${hold(d.dateline)}`;
}

/** Where it starts, as the wizard said it, for the line under the title.
 *  A plan reached without the wizard's kind reads what the words alone
 *  can tell. */
function place(a: PlanHeadingInput, t: T): string | null {
  const kind = a.whereKind ?? (a.district ? 'district' : a.where === null ? 'city' : null);
  if (kind === 'district' && a.where) return a.where;
  if (kind === 'place' && a.where) return t(`near ${a.where}`, `gần ${a.where}`, `${a.where}の近く`, `${a.where}附近`, `${a.where}附近`);
  if (kind === 'pin') return t('near your pin', 'gần điểm ghim', 'ピンの近く', '图钉附近', '圖釘附近');
  if (kind === 'near') {
    const at = a.nearArea;
    return at
      ? t(`near ${at}`, `gần ${at}`, `${at}の近く`, `${at}附近`, `${at}附近`)
      : t('near you', 'gần bạn', '近く', '你附近', '你附近');
  }
  if (kind === 'city' && a.city) return a.city;
  return null;
}

function company(key: string | null, t: T): string | null {
  switch (key) {
    case 'solo': return t('On your own', 'Một mình', 'ひとりで', '一个人', '一個人');
    case 'couple': return t('For two', 'Cùng người ấy', 'ふたりで', '两个人', '兩個人');
    case 'friends': return t('With friends', 'Cùng hội bạn', '友だちと', '和朋友', '和朋友');
    case 'family': return t('With family', 'Cùng cả nhà', '家族で', '和家人', '和家人');
    default: return null;
  }
}

/** "Cùng người ấy · gần bạn": who, then where. Null when neither was
 *  given, so the header draws no empty line. */
export function planSub(a: PlanHeadingInput, t: T): string | null {
  const parts = [company(a.company, t), place(a, t)].filter((x): x is string => !!x);
  return parts.length ? upFirst(parts.join(' · ')) : null;
}
