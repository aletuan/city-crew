// What a photograph shows, as the photo sheet says it (docs/photo-labels.md
// §11, part C; owner, 18 Oct 2026).
//
// The kind comes from the photo labels — the `claude-labels` row of
// `photo_scores`, written on City Crew's side by the `label-photos`
// function — not from anything the phone measured. It is the one label
// the sheet shows: on 24 photographs no definition had been written from
// (round 3c), the model and the owner agreed on all 24 kinds, where the
// attributes still miss in ways a guide would see (a hand counted as a
// person, a few street trees as greenery).
//
// A kind is said only when it is sure. The model marks one `unsure`
// whenever it would not bet on it — 11% of the catalog — and `other` is
// "none of these", which tells a guide nothing; both say nothing here,
// as does a photograph not labelled yet (a guide's upload waits up to an
// hour for the hourly pass, `label-photos/cron.sql`).
//
// The kind does two things in the sheet. It names what the photograph
// is, beside the reasons; and it lets "scores higher than X%" compare a
// latte with lattes instead of with the whole catalog — Apple Vision
// rates food and drink higher than rooms on average (0.568 against
// 0.481), so against the whole catalog a fair coffee photograph read as
// a poor photograph (`photoScoreVision.ts`, `KIND_SPREAD`).
//
// `garden` came with the labels' v5 (owner, 18 Oct 2026): of the 725
// photographs v4 would not bet on, half were a courtyard, a terrace or a
// rooftop with the place's seats in it — neither a front, nor a room,
// nor scenery. It has no spread of its own yet, so its standing is
// against the catalog.
//
// `heritage` came with v7 (owner, 18 Oct 2026, "Văn hóa"): a temple, a
// tomb, a church or a monument as the photograph's subject. It goes by
// what the frame shows, not by the place, so a park's lawn is still a
// view. Its words and mark are the Culture category's (`categories.ts`),
// the places such photographs come from. Like the garden, it is measured
// against the catalog.
//
// `collage` came with v8 (owner, 18 Oct 2026, "Ảnh ghép"): several
// photographs in one frame. The sheet says so, since it is a fact a guide
// can act on — a collage is never a good cover.

import type Ionicons from '@expo/vector-icons/Ionicons';

export const KINDS = ['food', 'interior', 'exterior', 'garden', 'heritage', 'view', 'text', 'collage'] as const;
export type PhotoKind = typeof KINDS[number];

type T = (en: string, vi: string, ja: string) => string;

/** The kind a sheet may say, or null: not labelled, labelled unsure, or
 *  none of the kinds above. */
export function kindOf(labels: unknown): PhotoKind | null {
  if (!labels || typeof labels !== 'object') return null;
  const l = labels as { kind?: unknown; unsure?: unknown };
  if (l.unsure === true) return null;
  return KINDS.find((k) => k === l.kind) ?? null;
}

/** The mark beside each kind: Ionicons outlines, like the analysis rows. */
export const KIND_ICON: Record<PhotoKind, keyof typeof Ionicons.glyphMap> = {
  food: 'restaurant-outline',
  interior: 'home-outline',
  exterior: 'storefront-outline',
  garden: 'leaf-outline',
  heritage: 'library-outline',
  view: 'image-outline',
  text: 'document-text-outline',
  collage: 'grid-outline',
};

/** A kind's name, as the label under the reasons. The Vietnamese is the
 *  label rounds' own words (`dashboard/src/labelRound.js`), which the
 *  owner answered in. */
export function kindName(kind: PhotoKind, t: T): string {
  switch (kind) {
    case 'food': return t('Food & drink', 'Đồ ăn & uống', '料理・ドリンク');
    case 'interior': return t('Inside', 'Nội thất', '店内');
    case 'exterior': return t('Front', 'Mặt tiền', '外観');
    case 'garden': return t('Garden & terrace', 'Sân vườn', '庭・テラス');
    case 'heritage': return t('Culture', 'Văn hóa', '文化');
    case 'view': return t('View', 'Cảnh', '景色');
    case 'text': return t('Menu & signs', 'Chữ, menu', 'メニュー・文字');
    case 'collage': return t('Collage', 'Ảnh ghép', 'コラージュ');
  }
}

/** The same, as it sits inside a sentence: "higher than 40% of the
 *  catalog's food and drink photos". */
export function kindNoun(kind: PhotoKind, t: T): string {
  switch (kind) {
    case 'food': return t('food and drink', 'đồ ăn & uống', '料理・ドリンク');
    case 'interior': return t('interior', 'nội thất', '店内');
    case 'exterior': return t('storefront', 'mặt tiền', '外観');
    case 'garden': return t('garden and terrace', 'sân vườn', '庭・テラス');
    case 'heritage': return t('culture', 'văn hóa', '文化');
    case 'view': return t('view', 'cảnh', '景色');
    case 'text': return t('menu and sign', 'chữ, menu', 'メニュー・文字');
    case 'collage': return t('collage', 'ảnh ghép', 'コラージュ');
  }
}

/** Who said what, once a kind is shown: Apple Vision measured, Claude
 *  named the kind (owner's words, 18 Oct 2026). */
export const bothSources = (t: T) =>
  t('Photo analysed by Apple Vision and Claude.', 'Phân tích ảnh bằng Apple Vision và Claude.', 'Apple VisionとClaudeで写真を分析。');
