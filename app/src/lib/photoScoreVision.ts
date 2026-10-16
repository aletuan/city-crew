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

import type { Detail, Interpreter, PhotoScore, Signals, T } from './photoScore';
import { percentText, standingIn } from './standing';

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

/** The measured qualities the detail lists, one row each. */
type Dim = 'light' | 'focus' | 'subject' | 'level' | 'clutter' | 'green' | 'size';

/**
 * One thing measured and worth saying: which quality it is about, whether
 * it helped, how it is said, and — for what held the photograph back —
 * what would have helped. The sentence under the number and the detail
 * rows are both read off this one list, so they cannot disagree.
 */
type Fact = {
  dim: Dim;
  plus: boolean;
  say: string;
  fix?: string;
  /** Left out of the sentence, which has already said it another way
   *  (the record's lead names the writing); the detail still lists it. */
  quiet?: boolean;
};

/** The measurements, each said where it is worth saying. */
function facts(s: Signals, t: T, record: boolean): Fact[] {
  const out: Fact[] = [];
  const fixLight = t(
    'Choose a photo taken in more light.',
    'Chọn ảnh chụp lúc nhiều ánh sáng hơn.',
    'もっと明るい時に撮った写真を選びましょう。',
  );

  const b = s.brightness;
  if (b !== undefined) {
    if (b < DARK) out.push({ dim: 'light', plus: false, say: t('a little dark', 'hơi thiếu sáng', 'やや暗い'), fix: fixLight });
    else if (b > BRIGHT) {
      out.push({
        dim: 'light', plus: false, say: t('a little overexposed', 'hơi dư sáng', 'やや明るすぎ'),
        fix: t('Avoid shooting into the light.', 'Tránh chụp ngược sáng.', '逆光を避けましょう。'),
      });
    } else if (b >= LIT[0] && b <= LIT[1]) out.push({ dim: 'light', plus: true, say: t('well lit', 'đủ sáng', '明るさが適切') });
  }
  if ((s.shadows ?? 0) > SHADOWS) {
    out.push({ dim: 'light', plus: false, say: t('shadows lose detail', 'vùng tối mất chi tiết', '暗部がつぶれている'), fix: fixLight });
  }
  if ((s.highlights ?? 0) > HIGHLIGHTS) {
    out.push({
      dim: 'light', plus: false, say: t('highlights blown out', 'vùng sáng bị cháy', '白飛びがある'),
      fix: t(
        'Keep bright windows and lamps from filling the frame.',
        'Tránh để cửa sổ hay đèn sáng chiếm nhiều khung.',
        '明るい窓や照明が大きく入らないようにしましょう。',
      ),
    });
  }

  if (s.sharpness !== undefined) {
    if (s.sharpness < SOFT) {
      out.push({
        dim: 'focus', plus: false, say: t('a little soft', 'hơi mờ', 'ややぼやけている'),
        fix: t(
          'Hold the phone steady and tap the subject to focus.',
          'Giữ máy chắc tay và chạm vào chủ thể để lấy nét.',
          '端末をしっかり持ち、被写体をタップしてピントを合わせましょう。',
        ),
      });
    } else if (s.sharpness > SHARP) out.push({ dim: 'focus', plus: true, say: t('sharp', 'rõ nét', 'シャープ') });
  }

  const tilt = Math.abs(s.tilt ?? 0);
  if (scene(s) && tilt >= TILT[0] && tilt <= TILT[1]) {
    const n = Math.round(tilt);
    out.push({
      dim: 'level', plus: false,
      say: t(`horizon tilted ${n}°`, `đường chân trời nghiêng ${n}°`, `水平が${n}°傾いている`),
      fix: t(
        'Straighten it: Edit → Crop in Photos levels the horizon.',
        'Chỉnh thẳng khung: Sửa → Cắt trong app Ảnh sẽ cân lại đường chân trời.',
        '写真アプリの「編集 → 切り取り」で水平を直せます。',
      ),
    });
  }

  if ((s.peopleArea ?? 0) > PEOPLE) {
    out.push({
      dim: 'clutter', plus: false,
      say: t('people fill much of the frame', 'người chiếm nhiều khung hình', '人物が大きく写っている'),
      fix: t(
        'Choose a moment with fewer people, or keep them small in the frame.',
        'Chụp lúc vắng người, hoặc để người nhỏ trong khung.',
        '人が少ない時に撮るか、人物を小さく写しましょう。',
      ),
    });
  }
  // Said once in the sentence: a record's lead already names the writing.
  if (writing(s)) {
    out.push({
      dim: 'clutter', plus: false, quiet: record,
      say: t('a lot of writing in frame', 'nhiều chữ trong khung', '文字が多い'),
      fix: t(
        'Step back or crop so signs and menus do not fill the frame.',
        'Lùi ra hoặc cắt bớt để biển, menu không chiếm khung.',
        '看板やメニューが画面を占めないよう、下がるか切り取りましょう。',
      ),
    });
  }

  if (s.subject) {
    const { x, y, area } = s.subject;
    if (Math.abs(x - 0.5) > EDGE || Math.abs(y - 0.5) > EDGE) {
      out.push({
        dim: 'subject', plus: false,
        say: t('subject pushed to the edge', 'chủ thể lệch sát mép', '被写体が端に寄っている'),
        fix: t('Bring the subject in from the edge.', 'Đưa chủ thể vào gần giữa khung hơn.', '被写体を中央寄りにしましょう。'),
      });
    } else if (area >= SUBJECT[0] && area <= SUBJECT[1]) {
      out.push({ dim: 'subject', plus: true, say: t('a clear subject', 'chủ thể rõ ràng', '被写体がはっきりしている') });
    }
  }

  if (green(s)) out.push({ dim: 'green', plus: true, say: t('greenery in frame', 'có cây xanh', '緑がある') });

  if (s.width !== undefined && s.height !== undefined && Math.max(s.width, s.height) < LOW_RES) {
    out.push({
      dim: 'size', plus: false, say: t('low resolution', 'độ phân giải thấp', '解像度が低い'),
      fix: t('Use the original photo, not a resized copy.', 'Dùng ảnh gốc, không dùng bản đã thu nhỏ.', '縮小版ではなく元の写真を使いましょう。'),
    });
  }

  return out;
}

/** A scene with a horizon in it — see `SCENE`. */
const scene = (s: Signals) => (s.labels ?? []).some((l) => SCENE.has(l.id) && l.p >= SCENE_P);
/** Greenery in frame — see `GREEN`. */
const green = (s: Signals) => (s.labels ?? []).some((l) => GREEN.has(l.id) && l.p >= GREEN_P);

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
  const said = facts(score.signals ?? {}, t, record).filter((f) => !f.quiet);
  const plus = said.filter((f) => f.plus).map((f) => f.say);
  const minus = said.filter((f) => !f.plus).map((f) => f.say);
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
// ── the detailed analysis ──
//
// The design review drew seven bars out of ten — light, composition,
// focus, subject, colour, angle, distractions (owner, 16 Oct 2026).
// Vision gives one number, not seven, and measures neither composition
// nor colour at all, so those two rows are not here and the rest are
// what was measured, said in words: "Nghiêng 6°", not "Góc chụp 8.8". A
// bar appears only where higher is plainly better and there is a
// catalog to stand in — focus — and it is the photograph's place among
// the catalog's, not a score.

/**
 * The catalog's spread of focus and of Vision's number: the least, every
 * tenth, and the most, over the 277 photographs read by 16 Oct 2026
 * (`percentile_cont` over `photo_scores`). Kept here rather than asked
 * for, since the spread moves slowly and a query per sheet would not;
 * read again when the catalog has doubled.
 */
const SHARPNESS_SPREAD = [67, 425, 701, 906, 1126, 1385, 1770, 2078, 2768, 3657, 11559] as const;
const AESTHETIC_SPREAD = [0.072, 0.368, 0.408, 0.442, 0.479, 0.508, 0.555, 0.596, 0.635, 0.696, 0.881] as const;

/** The measured qualities, one row each, in the order a guide reads a
 *  photograph: its light and focus, then what it shows, then its size. */
export function detailsOf(score: Pick<PhotoScore, 'is_utility' | 'signals'>, t: T): Detail[] {
  const sig = score.signals ?? {};
  const all = facts(sig, t, isRecord(score));
  const sep = t(', ', ', ', '、');
  const rows: Detail[] = [];
  /** A row read off the facts about `key`: what held it back if anything
   *  did, else what helped, else `empty` — measured, and unremarkable. */
  const row = (key: Dim, label: string, empty: Pick<Detail, 'value' | 'tone'>, extra: Partial<Detail> = {}) => {
    const of = all.filter((f) => f.dim === key);
    const minus = of.filter((f) => !f.plus);
    const said = minus.length ? minus : of;
    rows.push({
      key, label, ...extra,
      ...(said.length
        ? { value: capital(said.map((f) => f.say).join(sep)), tone: minus.length ? 'warn' : 'good' }
        : empty),
    });
  };

  if (sig.brightness !== undefined) {
    row('light', t('Light', 'Ánh sáng', '明るさ'),
      { value: t('Neither dark nor bright', 'Không tối, không quá sáng', '暗くも明るすぎもしない'), tone: 'plain' });
  }
  if (sig.sharpness !== undefined) {
    const rank = standingIn(sig.sharpness, SHARPNESS_SPREAD);
    const n = percentText(rank);
    row('focus', t('Focus', 'Độ nét', 'ピント'), { value: t('Average', 'Trung bình', '標準的'), tone: 'plain' }, {
      rank,
      note: t(`Sharper than ${n}% of the catalog's photos`, `Nét hơn ${n}% ảnh trong catalog`, `カタログの${n}%の写真よりシャープ`),
    });
  }
  if (sig.subject) {
    row('subject', t('Subject', 'Chủ thể', '被写体'), sig.subject.area < SUBJECT[0]
      ? { value: t('Small in the frame', 'Nhỏ trong khung', '画面の中で小さい'), tone: 'plain' }
      : { value: t('Fills most of the frame', 'Chiếm gần hết khung', '画面のほとんどを占める'), tone: 'plain' });
  }
  // Only of a scene with a horizon in it: on a close-up the "horizon" is
  // a table's edge (`SCENE`).
  if (scene(sig)) {
    const tilt = Math.abs(sig.tilt ?? 0);
    const n = Math.round(tilt);
    row('level', t('Horizon', 'Đường chân trời', '水平'), sig.tilt === undefined
      ? { value: t('None found', 'Không thấy', '見つからない'), tone: 'plain' }
      : tilt < TILT[0]
        ? { value: t('Level', 'Thẳng', '水平'), tone: 'good' }
        : { value: t(`Tilted ${n}°, by the look of it on purpose`, `Nghiêng ${n}°, có vẻ cố ý`, `${n}°傾いている（意図的に見える）`), tone: 'plain' });
  }
  if (sig.peopleArea !== undefined || sig.textLines !== undefined) {
    row('clutter', t('Distractions', 'Yếu tố gây nhiễu', '邪魔な要素'),
      { value: t('Few people, little writing', 'Ít người, ít chữ', '人も文字も少ない'), tone: 'good' });
  }
  if (sig.labels !== undefined) {
    row('green', t('Greenery', 'Cây xanh', '緑'), { value: t('None seen', 'Không thấy', '見当たらない'), tone: 'plain' });
  }
  if (sig.width !== undefined && sig.height !== undefined) {
    const long = Math.max(sig.width, sig.height);
    row('size', t('Resolution', 'Độ phân giải', '解像度'),
      { value: t(`${long} px on the long side`, `Cạnh dài ${long} px`, `長辺${long}px`), tone: 'good' });
  }
  return rows;
}

/**
 * What would have helped, once each: one line for every distinct thing
 * that held the photograph back. Nothing when nothing did — a tip with
 * no fault under it would be advice for its own sake. A record's writing
 * is its subject, not a fault, and gets none.
 */
export function suggestionsOf(score: Pick<PhotoScore, 'is_utility' | 'signals'>, t: T): string[] {
  const fixes = facts(score.signals ?? {}, t, isRecord(score))
    .filter((f) => !f.plus && !f.quiet)
    .map((f) => f.fix!);
  return [...new Set(fixes)];
}

/** Where Vision's number for this photograph stands in the catalog. */
export function standingOf(score: Pick<PhotoScore, 'aesthetic'>): number | null {
  return score.aesthetic == null ? null : standingIn(score.aesthetic, AESTHETIC_SPREAD);
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
  details: detailsOf,
  suggestions: suggestionsOf,
  standing: standingOf,
};
