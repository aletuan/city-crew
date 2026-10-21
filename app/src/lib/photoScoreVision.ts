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

import type { Detail, Interpreter, PhotoScore, Signals, T, Tip } from './photoScore';
import type { PhotoKind } from './photoKind';
import { standingIn } from './standing';

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
/**
 * A subject this far from the centre, on either axis, is at the edge.
 *
 * Kept, though on the 434 photographs read by 17 Oct 2026 it never
 * fired: Vision's salient region is wide and central on almost every
 * photograph (its area: a tenth under 0.40, the middle 0.58, a tenth
 * over 0.73). For the same reason the subject no longer earns praise —
 * "a clear subject" was said of every photograph whose region fell under
 * 0.6, which is a fact about the detector, not the photograph — and its
 * size is no longer a row.
 */
const EDGE = 0.35;
/** Under this on the long side looks soft on a 3× phone, full width. */
const LOW_RES = 800;

/**
 * The qualities the detail lists, one row each (owner, 17 Oct 2026):
 * the "Refined UI" board's four less the two nothing here measures —
 * colour and space — with focus, the surest measurement there is, in
 * their place. Everything else measured is said inside one of the three:
 * resolution is how much detail there is, so it is focus; a tilted
 * horizon and people or writing filling the frame are how the photograph
 * is framed, so they are composition. Greenery is not a quality of a
 * photograph at all — a plate of food is not worse for having no plant
 * in it — and is the cover's business (step 5), not this list's.
 */
type Dim = 'light' | 'focus' | 'composition';

/**
 * Each quality's mark, the board's own: a sun, a target, the corners of
 * a frame. The row says what it is about with its glyph and how it went
 * with the colour of its words and its bar.
 */
const DIM_ICON = {
  light: 'sunny-outline',
  focus: 'locate-outline',
  composition: 'scan-outline',
} as const satisfies Record<Dim, Detail['icon']>;

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
    '选择一张光线更充足时拍的照片。', '選擇一張光線更充足時拍的照片。',
  );

  const b = s.brightness;
  if (b !== undefined) {
    if (b < DARK) out.push({ dim: 'light', plus: false, say: t('a little dark', 'hơi thiếu sáng', 'やや暗い', '略暗', '略暗'), fix: fixLight });
    else if (b > BRIGHT) {
      out.push({
        dim: 'light', plus: false, say: t('a little overexposed', 'hơi dư sáng', 'やや明るすぎ', '略微过曝', '略微過曝'),
        fix: t('Avoid shooting into the light.', 'Tránh chụp ngược sáng.', '逆光を避けましょう。', '避免逆光拍摄。', '避免逆光拍攝。'),
      });
    } else if (b >= LIT[0] && b <= LIT[1]) out.push({ dim: 'light', plus: true, say: t('well lit', 'đủ sáng', '明るさが適切', '光线充足', '光線充足') });
  }
  if ((s.shadows ?? 0) > SHADOWS) {
    out.push({ dim: 'light', plus: false, say: t('shadows lose detail', 'vùng tối mất chi tiết', '暗部がつぶれている', '暗部丢失细节', '暗部丟失細節'), fix: fixLight });
  }
  if ((s.highlights ?? 0) > HIGHLIGHTS) {
    out.push({
      dim: 'light', plus: false, say: t('highlights blown out', 'vùng sáng bị cháy', '白飛びがある', '高光过曝', '高光過曝'),
      fix: t(
        'Keep bright windows and lamps from filling the frame.',
        'Tránh để cửa sổ hay đèn sáng chiếm nhiều khung.',
        '明るい窓や照明が大きく入らないようにしましょう。',
        '避免明亮的窗户和灯占满画面。', '避免明亮的窗戶和燈佔滿畫面。',
      ),
    });
  }

  if (s.sharpness !== undefined) {
    if (s.sharpness < SOFT) {
      out.push({
        dim: 'focus', plus: false, say: t('a little soft', 'hơi mờ', 'ややぼやけている', '略微模糊', '略微模糊'),
        fix: t(
          'Hold the phone steady and tap the subject to focus.',
          'Giữ máy chắc tay và chạm vào chủ thể để lấy nét.',
          '端末をしっかり持ち、被写体をタップしてピントを合わせましょう。',
          '拿稳手机，点按主体对焦。', '拿穩手機，點按主體對焦。',
        ),
      });
    } else if (s.sharpness > SHARP) out.push({ dim: 'focus', plus: true, say: t('sharp', 'rõ nét', 'シャープ', '清晰', '清晰') });
  }

  const tilt = Math.abs(s.tilt ?? 0);
  if (scene(s) && tilt >= TILT[0] && tilt <= TILT[1]) {
    const n = Math.round(tilt);
    out.push({
      dim: 'composition', plus: false,
      say: t(`horizon tilted ${n}°`, `đường chân trời nghiêng ${n}°`, `水平が${n}°傾いている`, `地平线倾斜 ${n}°`, `地平線傾斜 ${n}°`),
      fix: t(
        'Straighten it: Edit → Crop in Photos levels the horizon.',
        'Chỉnh thẳng khung: Sửa → Cắt trong app Ảnh sẽ cân lại đường chân trời.',
        '写真アプリの「編集 → 切り取り」で水平を直せます。',
        '在“照片”中用“编辑 → 裁剪”可以拉直地平线。', '在「照片」中用「編輯 → 裁切」可以拉直地平線。',
      ),
    });
  }

  if ((s.peopleArea ?? 0) > PEOPLE) {
    out.push({
      dim: 'composition', plus: false,
      say: t('people fill much of the frame', 'người chiếm nhiều khung hình', '人物が大きく写っている', '人物占据画面较多', '人物佔據畫面較多'),
      fix: t(
        'Choose a moment with fewer people, or keep them small in the frame.',
        'Chụp lúc vắng người, hoặc để người nhỏ trong khung.',
        '人が少ない時に撮るか、人物を小さく写しましょう。',
        '选择人少的时候拍，或让人物在画面中小一些。', '選擇人少的時候拍，或讓人物在畫面中小一些。',
      ),
    });
  }
  // Said once in the sentence: a record's lead already names the writing.
  if (writing(s)) {
    out.push({
      dim: 'composition', plus: false, quiet: record,
      say: t('a lot of writing in frame', 'nhiều chữ trong khung', '文字が多い', '画面中文字较多', '畫面中文字較多'),
      fix: t(
        'Step back or crop so signs and menus do not fill the frame.',
        'Lùi ra hoặc cắt bớt để biển, menu không chiếm khung.',
        '看板やメニューが画面を占めないよう、下がるか切り取りましょう。',
        '退后一点或裁剪，不要让招牌和菜单占满画面。', '退後一點或裁切，不要讓招牌和菜單佔滿畫面。',
      ),
    });
  }

  if (s.subject && atEdge(s.subject)) {
    out.push({
      dim: 'composition', plus: false,
      say: t('subject pushed to the edge', 'chủ thể lệch sát mép', '被写体が端に寄っている', '主体太靠边', '主體太靠邊'),
      fix: t('Bring the subject in from the edge.', 'Đưa chủ thể vào gần giữa khung hơn.', '被写体を中央寄りにしましょう。', '把主体从边缘移向中间。', '把主體從邊緣移向中間。'),
    });
  }

  if (s.width !== undefined && s.height !== undefined && Math.max(s.width, s.height) < LOW_RES) {
    out.push({
      dim: 'focus', plus: false, say: t('low resolution', 'độ phân giải thấp', '解像度が低い', '分辨率低', '解析度低'),
      fix: t('Use the original photo, not a resized copy.', 'Dùng ảnh gốc, không dùng bản đã thu nhỏ.', '縮小版ではなく元の写真を使いましょう。', '请使用原图，而不是缩小后的副本。', '請使用原圖，而不是縮小後的副本。'),
    });
  }

  return out;
}

/** A scene with a horizon in it — see `SCENE`. */
const scene = (s: Signals) => (s.labels ?? []).some((l) => SCENE.has(l.id) && l.p >= SCENE_P);
/** The salient region off centre — see `EDGE`. */
const atEdge = (sub: NonNullable<Signals['subject']>) => Math.abs(sub.x - 0.5) > EDGE || Math.abs(sub.y - 0.5) > EDGE;

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
  const sep = t(', ', ', ', '、', '，', '，');
  const stop = t('.', '.', '。', '。', '。');
  const gap = t(' ', ' ', '', '', '');
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
      '画面中文字较多 — 看起来更像菜单或招牌，而不是照片。', '畫面中文字較多 — 看起來更像菜單或招牌，而不是照片。',
    ));
  }
  if (plus.length) out.push(capital(plus.join(sep)) + stop);
  if (minus.length) out.push(t('Held back by: ', 'Trừ điểm: ', '減点：', '扣分项：', '扣分項：') + minus.join(sep) + stop);
  if (!out.length) out.push(t('Nothing measured stands out either way.', 'Không có điểm đo nào nổi bật.', '測定上、目立つ点はありません。', '测量结果没有特别突出的地方。', '測量結果沒有特別突出的地方。'));
  return out.join(gap);
}
// ── the detailed analysis ──
//
// Three rows, each with a bar (owner, 17 Oct 2026, from the "Refined UI"
// board, which drew one per quality). A bar has to be something
// measured, and each row says what its bar is:
//
//   light        how close the photograph came to a full range of tone:
//                its mean luma's distance from the middle, times the
//                share of pixels not crushed to black or blown to white
//                (`exposure`)
//   focus        its place among the catalog's photographs for
//                sharpness (`SHARPNESS_SPREAD`)
//   composition  the share of the framing checks it passed — subject in
//                from the edge, a scene's horizon level, people and
//                writing not filling the frame (`framing`)
//
// Colour and space, the board's other two, are not here: nothing Vision
// reports measures either, and a bar drawn for them would be a number
// with nothing under it (D2, D12).

/**
 * The catalog's spread of focus and of Vision's number: the least, every
 * tenth, and the most, over the 277 photographs read by 16 Oct 2026
 * (`percentile_cont` over `photo_scores`). Kept here rather than asked
 * for, since the spread moves slowly and a query per sheet would not;
 * read again when the catalog has doubled.
 */
const SHARPNESS_SPREAD = [67, 425, 701, 906, 1126, 1385, 1770, 2078, 2768, 3657, 11559] as const;
const AESTHETIC_SPREAD = [0.072, 0.368, 0.408, 0.442, 0.479, 0.508, 0.555, 0.596, 0.635, 0.696, 0.881] as const;

/**
 * Vision's number again, the same deciles, kind by kind: the 434
 * photographs it had read by 18 Oct 2026 that also carry a photo label
 * (`docs/photo-labels.md` §11). Vision rates them unevenly — food and
 * drink average 0.568, rooms 0.481, fronts 0.483 — so a photograph is
 * placed among its own kind where that kind has a spread to place it in.
 * Three do: food and drink (154), interiors (172) and fronts (81). Views
 * (19) and writing (6) are too few for ten deciles to mean anything, and
 * fall back to the whole catalog's spread above. Read again with it.
 */
const KIND_SPREAD: Partial<Record<PhotoKind, readonly number[]>> = {
  food: [0.212, 0.423, 0.468, 0.497, 0.537, 0.571, 0.605, 0.636, 0.669, 0.709, 0.919],
  interior: [0.235, 0.367, 0.398, 0.424, 0.449, 0.473, 0.498, 0.523, 0.563, 0.614, 0.783],
  exterior: [0.303, 0.352, 0.387, 0.417, 0.439, 0.453, 0.485, 0.535, 0.572, 0.632, 0.881],
};

/**
 * Light as a bar, 0–1. Mean luma 0.5 is the middle of the range and the
 * ends are black and white, so `1 − |b − 0.5| × 2` is how far the
 * exposure stayed from either; the second factor takes off every pixel
 * that lost its detail at either end. On the 434 photographs read by 17
 * Oct 2026 it spreads a tenth under 0.39, the middle at 0.76 and a tenth
 * over 0.94 — enough to tell a dim bar from a sunlit street.
 */
function exposure(b: number, shadows = 0, highlights = 0): number {
  return (1 - Math.min(1, Math.abs(b - 0.5) * 2)) * Math.max(0, 1 - shadows - highlights);
}

/**
 * Composition as the framing checks a photograph passed, and how many
 * applied. A check applies only where its measurement exists — the
 * horizon only on a scene that has one (`SCENE`). On the 434 photographs
 * read by 17 Oct 2026, 52 failed one: 35 scenes tilted, 13 with people
 * filling the frame, 4 with a lot of writing; none had its subject at
 * the edge.
 */
function framing(s: Signals): { passed: number; of: number } {
  const checks: boolean[] = [];
  if (s.subject) checks.push(!atEdge(s.subject));
  if (scene(s) && s.tilt !== undefined) {
    const tilt = Math.abs(s.tilt);
    checks.push(tilt < TILT[0] || tilt > TILT[1]);
  }
  if (s.peopleArea !== undefined) checks.push(s.peopleArea <= PEOPLE);
  if (s.textLines !== undefined) checks.push(!writing(s));
  return { passed: checks.filter(Boolean).length, of: checks.length };
}

/** The three rows, light first: the order a photograph is read in. */
export function detailsOf(score: Pick<PhotoScore, 'is_utility' | 'signals'>, t: T): Detail[] {
  const sig = score.signals ?? {};
  const all = facts(sig, t, isRecord(score));
  const sep = t(', ', ', ', '、', '，', '，');
  const rows: Detail[] = [];
  /** A row read off the facts about `key`: what held it back if anything
   *  did, else what helped, else `empty` — measured, and unremarkable. */
  const row = (key: Dim, label: string, bar: number, empty: Pick<Detail, 'value' | 'tone'>) => {
    const of = all.filter((f) => f.dim === key);
    const minus = of.filter((f) => !f.plus);
    const said = minus.length ? minus : of;
    rows.push({
      key, label, icon: DIM_ICON[key], bar,
      ...(said.length
        ? { value: capital(said.map((f) => f.say).join(sep)), tone: minus.length ? 'warn' : 'good' }
        : empty),
    });
  };

  if (sig.brightness !== undefined) {
    row('light', t('Light', 'Ánh sáng', '明るさ', '光线', '光線'), exposure(sig.brightness, sig.shadows, sig.highlights),
      { value: t('Neither dark nor bright', 'Không tối, không quá sáng', '暗くも明るすぎもしない', '不暗也不过亮', '不暗也不過亮'), tone: 'plain' });
  }
  if (sig.sharpness !== undefined) {
    row('focus', t('Focus', 'Độ nét', 'ピント', '对焦', '對焦'), standingIn(sig.sharpness, SHARPNESS_SPREAD),
      { value: t('Average', 'Trung bình', '標準的', '一般', '一般'), tone: 'plain' });
  }
  const frame = framing(sig);
  if (frame.of > 0) {
    // "Nothing wrong found", not "Good": the checks look for faults, and
    // passing them all says the framing has none of those — not that it
    // is good, which nothing here can see.
    row('composition', t('Composition', 'Bố cục', '構図', '构图', '構圖'), frame.passed / frame.of,
      { value: t('No problems found', 'Không thấy lỗi', '問題なし', '未发现问题', '未發現問題'), tone: 'plain' });
  }
  return rows;
}

/**
 * What would have helped, once each: one line for every distinct thing
 * that held the photograph back. Nothing when nothing did — a tip with
 * no fault under it would be advice for its own sake. A record's writing
 * is its subject, not a fault, and gets none.
 */
export function suggestionsOf(score: Pick<PhotoScore, 'is_utility' | 'signals'>, t: T): Tip[] {
  const tips: Tip[] = [];
  for (const f of facts(score.signals ?? {}, t, isRecord(score))) {
    if (f.plus || f.quiet || tips.some((tip) => tip.text === f.fix)) continue;
    tips.push({ icon: DIM_ICON[f.dim], text: f.fix! });
  }
  return tips;
}

/** Where Vision's number for this photograph stands in the catalog. */
export function standingOf(score: Pick<PhotoScore, 'aesthetic'>): number | null {
  return score.aesthetic == null ? null : standingIn(score.aesthetic, AESTHETIC_SPREAD);
}

/** Where it stands among the catalog's photographs of the same kind;
 *  null for a kind with no spread of its own (`KIND_SPREAD`). */
export function standingAmongOf(score: Pick<PhotoScore, 'aesthetic'>, kind: PhotoKind): number | null {
  const spread = KIND_SPREAD[kind];
  return score.aesthetic == null || !spread ? null : standingIn(score.aesthetic, spread);
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
  // "Analysed", the scoring dialog's own word ("Phân tích ngay trên
  // máy"), so the promise made while the phone reads and the line under
  // what it read are one sentence said twice (owner, 17 Oct 2026).
  source: (t) => t('Analysed on this phone by Apple Vision.', 'Phân tích trên máy bằng Apple Vision.', 'この端末でApple Visionが分析。', '由 Apple Vision 在本机分析。', '由 Apple Vision 在本機分析。'),
  explain: explainScore,
  details: detailsOf,
  suggestions: suggestionsOf,
  standing: standingOf,
  standingAmong: standingAmongOf,
};
