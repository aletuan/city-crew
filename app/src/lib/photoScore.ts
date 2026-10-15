// What the phone's eye made of a photograph, put into the reader's words.
//
// The native module (`modules/photo-score`) measures and decides nothing:
// Apple Vision's aesthetics score (−1…1), its "this is a record, not a
// picture" flag, and a handful of plain measurements — light, focus, the
// horizon, where the subject sits, people, writing, Vision's labels. This
// module turns those into the three things the gallery shows: a number
// out of ten, a word for it, and a sentence saying why (owner, 15 Oct
// 2026).
//
// ── why here and not in Swift ──
//
// Every threshold below is a first guess, and says so. None could be
// measured before the module existed: Vision runs on an iPhone and
// nowhere else this repository can reach. They live in JavaScript so
// the first few hundred real readings can correct them with an EAS
// Update instead of a new binary — and because the stored row is the
// measurement, not the sentence, a corrected threshold rewrites every
// explanation already on screen without a photograph being read again.
//
// ── the sentence is measured, not generated ──
//
// The alternative weighed was handing the photograph to a language
// model, which writes fluent reasons it did not measure — and costs a
// network call per photo for a sentence. This one names only what was
// measured, what helped before what held it back, and says so when
// nothing stood out. "Horizon tilted 4°" is true of the photograph; "a
// cosy, inviting space" would be a guess dressed as a reading.
//
// ── score once ──
//
// A photograph is read once. `SCORER_VERSION` is what lets that change
// deliberately: a reading below it counts as unread, so a better module
// rescoring the old rows is one constant, not a migration.

export const SCORER_VERSION = 1;

/** The measurements, as the module hands them over and the row keeps
 *  them. Every field optional: a reading from a later module may carry
 *  more, and one from an image Vision could not see into, less. */
export type Signals = {
  /** The original's pixels, before the module scaled it down. */
  width?: number;
  height?: number;
  /** Mean luma, 0 (black) to 1 (white). */
  brightness?: number;
  /** Share of pixels crushed under 5% and blown over 95%. */
  shadows?: number;
  highlights?: number;
  /** Variance of the Laplacian on a 512-pixel grey copy: high is crisp. */
  sharpness?: number;
  /** The salient region's centre (top-left origin, 0–1) and its area. */
  subject?: { x: number; y: number; area: number };
  /** Degrees off level, signed. Absent when Vision found no horizon. */
  tilt?: number;
  people?: number;
  /** The largest person's share of the frame. */
  peopleArea?: number;
  textLines?: number;
  /** All the writing's share of the frame, summed. */
  textArea?: number;
  /** Vision's five most confident labels from 0.1 up. */
  labels?: { id: string; p: number }[];
};

/** What `scoreAsync` returns. */
export type Reading = { aesthetic: number; isUtility: boolean; signals: Signals };

/** A row of `photo_scores`, as the gallery reads it. */
export type PhotoScore = {
  scorer_version: number;
  aesthetic: number | null;
  is_utility: boolean | null;
  signals: Signals;
};

type T = (en: string, vi: string, ja?: string) => string;

/** A photograph with no reading, or one from an older scorer. */
export function needsScore(score: PhotoScore | null | undefined): boolean {
  return !score || score.scorer_version < SCORER_VERSION;
}

/**
 * Out of ten, one decimal: the owner's scale. Linear on Vision's −1…1,
 * so the stored number and the shown one are the same fact, and a later
 * change of mind about the curve is a change here, not in the rows.
 */
export function toTen(aesthetic: number): number {
  const clamped = Math.max(-1, Math.min(1, aesthetic));
  return Math.round((clamped + 1) * 50) / 10;
}

export type Band = 'excellent' | 'good' | 'fair' | 'weak';

/**
 * The word beside the number. Four, because a gallery needs to say
 * "cover material", "fine", "keep if you must" and "consider removing",
 * and a fifth is a distinction nobody acts on. The cuts are first
 * guesses — see the top of this file — set so that Vision's middle
 * (around 0, a 5) reads as fair rather than as failing.
 */
export function band(ten: number): Band {
  if (ten >= 8) return 'excellent';
  if (ten >= 6.5) return 'good';
  if (ten >= 5) return 'fair';
  return 'weak';
}

export function bandLabel(b: Band, t: T): string {
  return {
    excellent: t('Very good', 'Rất tốt', 'とても良い'),
    good: t('Good', 'Tốt', '良い'),
    fair: t('Fair', 'Khá', 'まずまず'),
    weak: t('Weak', 'Chưa tốt', 'いまひとつ'),
  }[b];
}

// ── the thresholds — first guesses, every one ──
//
// Each is where the phrase starts being true of a photograph a guide
// would look at twice, by eye, not by measurement. Correct them from the
// stored rows once there are enough: `select signals from photo_scores`.

/** Mean luma under a quarter reads dark on a phone; a cafe at night
 *  sits around 0.2, a sunlit street around 0.5. */
const DARK = 0.25;
const BRIGHT = 0.8;
/** The comfortable middle, where "well lit" is worth saying. */
const LIT = [0.35, 0.7] as const;
/** A third of the frame crushed to black is a photo that lost its room;
 *  an eighth blown to white is a window that lost its view. */
const SHADOWS = 0.3;
const HIGHLIGHTS = 0.125;
/** Laplacian variance on the 512-pixel copy. The usual full-size cut is
 *  around 100; scaling down sharpens, so the soft cut sits lower and
 *  "sharp" well above it. */
const SOFT = 60;
const SHARP = 300;
/** Under 2° is the detector's own noise; over 15° is a choice, not a
 *  slip, and not this sentence's business. */
const TILT = [2, 15] as const;
/** A person taking a seventh of the frame is the photo's subject — and
 *  the desk's cover rule is no people. */
const PEOPLE = 0.15;
/** A menu board or a sign filling the frame. */
const TEXT_AREA = 0.08;
const TEXT_LINES = 6;
/** A subject this far from the centre, on either axis, is at the edge. */
const EDGE = 0.35;
/** A subject between these shares of the frame reads as one thing. */
const SUBJECT = [0.05, 0.6] as const;
/** Under this on the long side looks soft on a 3× phone, full width. */
const LOW_RES = 800;
/** Labels that mean greenery, at this confidence or more. Greenery is on
 *  the desk's cover list; nothing else Vision labels is, so nothing else
 *  is named. Wider than Vision's taxonomy may turn out to need — a name
 *  it never returns costs nothing — and to be narrowed against the
 *  labels the stored rows actually carry. */
const GREEN = new Set(['plant', 'tree', 'foliage', 'grass', 'garden', 'flower', 'houseplant', 'potted_plant', 'shrub']);
const GREEN_P = 0.3;

type Said = { plus: string[]; minus: string[] };

/** The measurements, each said where it is worth saying. */
function said(s: Signals, t: T): Said {
  const plus: string[] = [];
  const minus: string[] = [];

  const b = s.brightness;
  if (b !== undefined) {
    if (b < DARK) minus.push(t('a little dark', 'hơi thiếu sáng', 'やや暗い'));
    else if (b > BRIGHT) minus.push(t('a little overexposed', 'hơi dư sáng', 'やや明るすぎ'));
    else if (b >= LIT[0] && b <= LIT[1]) plus.push(t('well lit', 'đủ sáng', '明るさが適切'));
  }
  if ((s.shadows ?? 0) > SHADOWS) minus.push(t('shadows lose detail', 'vùng tối mất chi tiết', '暗部がつぶれている'));
  if ((s.highlights ?? 0) > HIGHLIGHTS) minus.push(t('highlights blown out', 'vùng sáng bị cháy', '白飛びがある'));

  if (s.sharpness !== undefined) {
    if (s.sharpness < SOFT) minus.push(t('a little soft', 'hơi mờ', 'ややぼやけている'));
    else if (s.sharpness > SHARP) plus.push(t('sharp', 'rõ nét', 'シャープ'));
  }

  const tilt = Math.abs(s.tilt ?? 0);
  if (tilt >= TILT[0] && tilt <= TILT[1]) {
    const n = Math.round(tilt);
    minus.push(t(`horizon tilted ${n}°`, `đường chân trời nghiêng ${n}°`, `水平が${n}°傾いている`));
  }

  if ((s.peopleArea ?? 0) > PEOPLE) {
    minus.push(t('people fill much of the frame', 'người chiếm nhiều khung hình', '人物が大きく写っている'));
  }
  if ((s.textArea ?? 0) > TEXT_AREA || (s.textLines ?? 0) >= TEXT_LINES) {
    minus.push(t('a lot of writing in frame', 'nhiều chữ trong khung', '文字が多い'));
  }

  if (s.subject) {
    const { x, y, area } = s.subject;
    if (Math.abs(x - 0.5) > EDGE || Math.abs(y - 0.5) > EDGE) {
      minus.push(t('subject pushed to the edge', 'chủ thể lệch sát mép', '被写体が端に寄っている'));
    } else if (area >= SUBJECT[0] && area <= SUBJECT[1]) {
      plus.push(t('a clear subject', 'chủ thể rõ ràng', '被写体がはっきりしている'));
    }
  }

  if ((s.labels ?? []).some((l) => GREEN.has(l.id) && l.p >= GREEN_P)) {
    plus.push(t('greenery in frame', 'có cây xanh', '緑がある'));
  }

  if (s.width !== undefined && s.height !== undefined && Math.max(s.width, s.height) < LOW_RES) {
    minus.push(t('low resolution', 'độ phân giải thấp', '解像度が低い'));
  }

  return { plus, minus };
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The sentence under the number: what helped, then what held it back,
 * and — when Vision called it a record rather than a picture — that
 * first, because it outweighs the rest. Only measured things; when
 * nothing measured stands out, it says so rather than inventing praise.
 */
export function explainScore(score: Pick<PhotoScore, 'is_utility' | 'signals'>, t: T): string {
  const sep = t(', ', ', ', '、');
  const stop = t('.', '.', '。');
  const gap = t(' ', ' ', '');
  const { plus, minus } = said(score.signals ?? {}, t);
  const out: string[] = [];
  if (score.is_utility) {
    out.push(t(
      'Vision reads this as a record — a menu, a sign, a document — rather than a picture.',
      'Vision xếp đây là ảnh ghi lại thông tin (thực đơn, biển hiệu, giấy tờ) hơn là ảnh để ngắm.',
      'Visionはこれを鑑賞用ではなく記録用の写真（メニュー、看板、書類）と判断しました。',
    ));
  }
  if (plus.length) out.push(capital(plus.join(sep)) + stop);
  if (minus.length) out.push(t('Held back by: ', 'Trừ điểm: ', '減点：') + minus.join(sep) + stop);
  if (!out.length) out.push(t('Nothing measured stands out either way.', 'Không có điểm đo nào nổi bật.', '測定上、目立つ点はありません。'));
  return out.join(gap);
}

/**
 * Reads each photograph in turn and keeps each answer as it comes, so
 * stopping halfway keeps the half (owner: Cancel keeps what was scored).
 * One at a time: Vision is already using the phone's neural engine, and
 * two at once would finish no sooner. A photograph that fails is counted
 * and passed over — one unreadable Google URL is no reason to stop the
 * other five.
 */
export async function scoreAll<P extends { id: string; photo_uri: string }>(
  todo: readonly P[],
  io: {
    read: (uri: string) => Promise<Reading>;
    save: (photoId: string, reading: Reading) => Promise<void>;
    /** After each photograph, however it went: how many are behind us. */
    onStep: (done: number) => void;
    stopped: () => boolean;
  },
): Promise<{ scored: number; failed: number }> {
  let scored = 0;
  let failed = 0;
  for (const p of todo) {
    if (io.stopped()) break;
    try {
      await io.save(p.id, await io.read(p.photo_uri));
      scored += 1;
    } catch {
      failed += 1;
    }
    io.onStep(scored + failed);
  }
  return { scored, failed };
}

/** The best-read photograph of those with a score, for the card that
 *  closes a run; null when none has one. */
export function bestOf<P extends { score?: PhotoScore | null }>(photos: readonly P[]): { photo: P; ten: number } | null {
  let best: { photo: P; ten: number } | null = null;
  for (const p of photos) {
    if (p.score?.aesthetic == null) continue;
    const ten = toTen(p.score.aesthetic);
    if (!best || ten > best.ten) best = { photo: p, ten };
  }
  return best;
}
