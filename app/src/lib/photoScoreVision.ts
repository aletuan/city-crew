// Apple Vision's measurements, put into the reader's words — the first
// scorer in `photoScore.ts`'s registry, and so far the only one.
//
// The native module (`modules/photo-score`) measures and decides nothing:
// Apple Vision's aesthetics score (−1…1), its "this is a record, not a
// picture" flag, and a handful of plain measurements — light, focus, the
// horizon, where the subject sits, people, writing, Vision's labels. The
// number and its word are every scorer's and live in `photoScore.ts`;
// this file is the sentence saying why (owner, 15 Oct 2026).
//
// ── why a file of its own ──
//
// Every number below is a fact about Vision's measurements, not about
// photographs: 430 is a Laplacian variance on the module's 512-pixel grey
// copy, the scene labels are names from Vision's taxonomy, and "ten lines
// of writing" is what its fast text pass counts on a menu. Another
// scorer's numbers mean something else, so its sentence is its own; the
// gallery asks the registry which interpreter wrote a row and never sees
// these thresholds (owner, 16 Oct 2026). Keying the sentence on which
// signals a row happens to carry was weighed and left: two scorers can
// both report a `sharpness` on different scales, and the row would not
// say which.
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

import type { Interpreter, PhotoScore, Signals, T } from './photoScore';

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
/** Laplacian variance on the 512-pixel copy, cut where the readings
 *  actually fall. The first guess (soft under 60, sharp over 300) was
 *  the usual full-size cut scaled down, and it was wrong by an order of
 *  magnitude: on the 182 photographs read by 15 Oct 2026 the softest
 *  tenth sits under 434, the middle at 1,256 and the sharpest quarter
 *  over 2,048, so "soft" never fired and "sharp" praised 175 of the 182
 *  (owner, from Bengal rooftop's bar). Now "soft" is about the bottom
 *  tenth and "sharp" the top quarter, so either word says something. */
const SOFT = 430;
const SHARP = 2000;
/** Under 2° is the detector's own noise; over 15° is a choice, not a
 *  slip, and not this sentence's business. */
const TILT = [2, 15] as const;
/**
 * The labels of a scene with a horizon in it — a room, a street, a
 * front — at this confidence or more. A tilt is said only of those.
 *
 * Vision's horizon detector finds a line in any photograph, and on a
 * close-up the line is a table's edge: O3 Brunswick's cup of coffee, shot
 * from above, was marked down for a horizon 5° off level (owner, 15 Oct
 * 2026). Of the 46 photographs given a tilt by 15 Oct, 13 carried one of
 * these labels and 17 were a table top. A name Vision never returns
 * costs nothing.
 */
const SCENE = new Set([
  'interior_room', 'restaurant', 'building', 'outdoor', 'sky', 'street', 'arch', 'portal',
  'door', 'window', 'stairs', 'balcony', 'fence', 'skyscraper', 'cityscape', 'bridge',
]);
const SCENE_P = 0.3;
/** A person taking a seventh of the frame is the photo's subject — and
 *  the desk's cover rule is no people. */
const PEOPLE = 0.15;
/**
 * Lines of writing, from which on writing is what the photograph is of.
 *
 * Counted in lines and not in area. Area summed the boxes Vision drew
 * round each line, and its fast pass sometimes draws one box round half
 * the frame: O3 Brunswick's cup of coffee read as one "line" covering 48%
 * of it, its counter with a small menu as one covering 37%, and both
 * were marked down for "a lot of writing" (owner, 15 Oct 2026). Of the
 * 18 photographs over the old 8% cut, 15 had one or two lines. Real
 * writing is the other way round — thin boxes, many of them: the four
 * photographs of a menu, a sign or a chalkboard by 15 Oct had 10 to 55
 * lines covering only 4–6% of the frame, so an area cut that holds them
 * cannot also hold out the false boxes. The next ones down had 5 or 6
 * lines and were a cup, a coffee machine, a wall of plants — writing
 * there, and not what the photograph is of. A small menu in a counter
 * shot is the photographer's detail, not the subject (owner).
 */
const TEXT_LINES = 10;
/** Vision's labels for a page or a board, at this confidence or more —
 *  the other evidence, beside measured writing, that a photograph is a
 *  record. A name it never returns costs nothing. */
const RECORD = new Set(['document', 'handwriting', 'chalkboard', 'menu', 'poster', 'receipt', 'screenshot']);
const RECORD_P = 0.3;

/** Writing is what the photograph is of — see `TEXT_LINES`. */
const writing = (s: Signals) => (s.textLines ?? 0) >= TEXT_LINES;

/**
 * Whether Vision's "record, not a picture" is worth repeating.
 *
 * Only when something measured agrees. `isUtility` is Apple's own
 * classifier and says nothing of why; on the 182 photographs read by 15
 * Oct 2026 it fired on 27, and 20 of those had no writing and no
 * document label at all — Bengal rooftop's dark bar among them, which
 * the first build captioned as a menu (owner). Those 20 were the photos
 * Vision was least sure about: their most confident label averaged 0.66,
 * against 0.80 for the rest. The flag stays in the row; the sentence
 * repeats it only with evidence beside it.
 */
const isRecord = (score: Pick<PhotoScore, 'is_utility' | 'signals'>) => {
  const s = score.signals ?? {};
  return !!score.is_utility
    && (writing(s) || (s.labels ?? []).some((l) => RECORD.has(l.id) && l.p >= RECORD_P));
};
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
function said(s: Signals, t: T, record: boolean): Said {
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
  const scene = (s.labels ?? []).some((l) => SCENE.has(l.id) && l.p >= SCENE_P);
  if (scene && tilt >= TILT[0] && tilt <= TILT[1]) {
    const n = Math.round(tilt);
    minus.push(t(`horizon tilted ${n}°`, `đường chân trời nghiêng ${n}°`, `水平が${n}°傾いている`));
  }

  if ((s.peopleArea ?? 0) > PEOPLE) {
    minus.push(t('people fill much of the frame', 'người chiếm nhiều khung hình', '人物が大きく写っている'));
  }
  // Said once: a record's lead sentence already names the writing.
  if (writing(s) && !record) {
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
 * and — when the photograph is a record rather than a picture, by
 * Vision's flag and a measurement together (`isRecord`) — that first,
 * because it outweighs the rest. Only measured things, named as
 * measured: the record sentence says there is writing, which was seen,
 * not that it is a menu, which was not. When nothing measured stands
 * out, it says so rather than inventing praise.
 */
export function explainScore(score: Pick<PhotoScore, 'is_utility' | 'signals'>, t: T): string {
  const sep = t(', ', ', ', '、');
  const stop = t('.', '.', '。');
  const gap = t(' ', ' ', '');
  const record = isRecord(score);
  const { plus, minus } = said(score.signals ?? {}, t, record);
  const out: string[] = [];
  if (record) {
    out.push(t(
      'Lots of writing in frame — it reads like a menu or a sign rather than a picture.',
      'Trong khung có nhiều chữ, trông như ảnh menu hoặc biển hiệu hơn là ảnh để ngắm.',
      '文字が多く、鑑賞用の写真というよりメニューや看板のように見えます。',
    ));
  }
  if (plus.length) out.push(capital(plus.join(sep)) + stop);
  if (minus.length) out.push(t('Held back by: ', 'Trừ điểm: ', '減点：') + minus.join(sep) + stop);
  if (!out.length) out.push(t('Nothing measured stands out either way.', 'Không có điểm đo nào nổi bật.', '測定上、目立つ点はありません。'));
  return out.join(gap);
}
/**
 * Apple Vision, as the registry knows it. `version` is the reading's,
 * not the sentence's: raise it only when the module measures something
 * differently, which makes every row it wrote count as unread. A better
 * sentence is an edit above and rereads nothing.
 */
export const appleVision: Interpreter = {
  id: 'apple-vision',
  version: 1,
  source: (t) => t('Measured on this phone by Apple Vision.', 'Đo trên máy bằng Apple Vision.', 'この端末でApple Visionが測定。'),
  explain: explainScore,
};
