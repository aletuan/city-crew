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
// whenever it would not bet on it, and that says nothing here, as does a
// photograph not labelled yet (a guide's upload waits up to an hour for
// the hourly pass, `label-photos/cron.sql`).
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
// photographs in one frame. It can be a cover, as any of the place
// kinds can (owner, same day); its standing is against the catalog.
//
// `other` is said too (owner, 18 Oct 2026). It was left out as "none of
// these", which tells a guide nothing, but then the one head in the sheet
// with no mark was the odd one out: the score moved up a line and the
// star had nowhere to sit. Once the owner had looked at every unsure
// label, 15 photographs were left as Other (docs/photo-labels.md §13), so
// this was no longer a rare case. It has no spread, so its standing is
// against the catalog.

import type Ionicons from '@expo/vector-icons/Ionicons';

export const KINDS = ['food', 'interior', 'exterior', 'garden', 'heritage', 'view', 'text', 'collage', 'other'] as const;
export type PhotoKind = typeof KINDS[number];

type T = (en: string, vi: string, ja: string, zh?: string) => string;

/** The kind a sheet may say, or null: not labelled, labelled unsure, or
 *  a kind this build does not know. */
export function kindOf(labels: unknown): PhotoKind | null {
  if (!labels || typeof labels !== 'object') return null;
  const l = labels as { kind?: unknown; unsure?: unknown };
  if (l.unsure === true) return null;
  return KINDS.find((k) => k === l.kind) ?? null;
}

type Tri = readonly [en: string, vi: string, ja: string];

/** Everything the sheet says about a kind, in one row. */
type KindDef = {
  /** The mark beside it: Ionicons outlines, like the analysis rows. */
  icon: keyof typeof Ionicons.glyphMap;
  /** Its name, as the label under the reasons. The Vietnamese is the
   *  label rounds' own words (`dashboard/src/labelRound.js`), which the
   *  owner answered in. */
  name: Tri;
  /** The same, as it sits inside a sentence: "higher than 40% of the
   *  catalog's food and drink photos". */
  noun: Tri;
};

// A kind is its name in KINDS and a row here; without the row this does
// not compile.
//
// Two other lists of kinds exist and cannot read this one. The labels'
// own (`supabase/functions/_shared/photoLabels.ts`) is what the model is
// asked to answer from, and ships in the Edge Function bundle, which
// holds only `supabase/functions`. The desk's (`dashboard/src/
// coverReview.js`) is plain JavaScript in its own package, worded for the
// desk ("Food", where a reader sees "Food & drink"). Metro bundles only
// `app/`. So a new kind is still three edits, as #1046 was; the test
// beside this file holds the labels' list to KINDS, so the model cannot
// learn a kind this build has no row for without CI saying so.
const KIND_DEFS = {
  food: {
    icon: 'restaurant-outline',
    name: ['Food & drink', 'Đồ ăn & uống', '料理・ドリンク'],
    noun: ['food and drink', 'đồ ăn & uống', '料理・ドリンク'],
  },
  interior: {
    icon: 'home-outline',
    name: ['Inside', 'Nội thất', '店内'],
    noun: ['interior', 'nội thất', '店内'],
  },
  exterior: {
    icon: 'storefront-outline',
    name: ['Front', 'Mặt tiền', '外観'],
    noun: ['storefront', 'mặt tiền', '外観'],
  },
  garden: {
    icon: 'leaf-outline',
    name: ['Garden & terrace', 'Sân vườn', '庭・テラス'],
    noun: ['garden and terrace', 'sân vườn', '庭・テラス'],
  },
  heritage: {
    icon: 'library-outline',
    name: ['Culture', 'Văn hóa', '文化'],
    noun: ['culture', 'văn hóa', '文化'],
  },
  view: {
    icon: 'image-outline',
    name: ['View', 'Cảnh', '景色'],
    noun: ['view', 'cảnh', '景色'],
  },
  text: {
    icon: 'document-text-outline',
    name: ['Menu & signs', 'Chữ, menu', 'メニュー・文字'],
    noun: ['menu and sign', 'chữ, menu', 'メニュー・文字'],
  },
  collage: {
    icon: 'grid-outline',
    name: ['Collage', 'Ảnh ghép', 'コラージュ'],
    noun: ['collage', 'ảnh ghép', 'コラージュ'],
  },
  // An empty frame, four corners with nothing in them, because the owner
  // asked for a picture frame. Ionicons' own picture frame,
  // `image-outline`, is already View's. `images-outline` is several
  // photographs, which reads as Collage, and `easel-outline` is a
  // painting, which reads as Culture.
  other: {
    icon: 'scan-outline',
    name: ['Other', 'Khác', 'その他'],
    noun: ['other', 'khác', 'その他'],
  },
} as const satisfies Record<PhotoKind, KindDef>;

/** A kind's row, as the shape every row has: nine literal tuples are a
 *  union TypeScript will not spread into `t`. */
const def = (kind: PhotoKind): KindDef => KIND_DEFS[kind];

/** The mark beside a kind. */
export const kindIcon = (kind: PhotoKind): KindDef['icon'] => def(kind).icon;

/** A kind's name, as the label under the reasons. */
export const kindName = (kind: PhotoKind, t: T): string => t(...def(kind).name);

/** A kind as it sits inside a sentence. */
export const kindNoun = (kind: PhotoKind, t: T): string => t(...def(kind).noun);

/** Who said what, once a kind is shown: Apple Vision measured, Claude
 *  named the kind (owner's words, 18 Oct 2026). */
export const bothSources = (t: T) =>
  t('Photo analysed by Apple Vision and Claude.', 'Phân tích ảnh bằng Apple Vision và Claude.', 'Apple VisionとClaudeで写真を分析。');
