// The collection form's head and rules: who can see the list, in a line
// under the title, and the hairlines its fields stand between.
//
// ── the form, laid on the page (owner, 16 Nov 2026) ──
//
// It was two boxed fields, each with an accent glyph down its left side
// (a bookmark, an "Aa") and a label as heavy as the value, under a
// sentence two lines long about who could see the list. The owner brought
// a sketch of it as one sheet instead, and the reading behind the sketch
// holds on this page:
//   - the glyphs said nothing a label did not, and took a column 36pt
//     wide (22 of glyph and 14 of gap) off every line of a description;
//   - a label in the value's weight competes with the value, on a form
//     whose whole content is two values;
//   - two rounded boxes are two objects for what the reader has one of,
//     a list's words. The profile form had already made the same move
//     (`FieldRow`'s `grouped`), into one card; here there is no card
//     either, and hairlines carry the division, since the cover grid
//     below is not in a card and the fields now belong to the same page.
//
// So: `FieldRow` grouped and `flush`, between `FieldRule`s, under a
// `SeenLine`.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Lede } from '../../components/authUi';
import { Glyph, ICON } from '../../components/ui/glyph';
import { useMyListShares } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { SEEN_GLYPH, seenGloss, seenName, sharesByList, visibilityOf } from '../../lib/shares';
import { colors, type } from '../../theme';
import type { Collection } from '../../lib/types';

/**
 * Who can see the list, under the form's title: a glyph, the answer's
 * name and what it means. "Public · Everyone can see it".
 *
 * It replaces a sentence: "This list is public — its new name and
 * description will show to everyone", or "Only you can see this list
 * until you make it public from its menu". The first took two lines to
 * say what four words do. The second had come to be wrong twice over: a
 * list shared with chosen friends is not seen by you alone, and since
 * 13 Nov who can see a list is changed under your handle on its page,
 * not from its menu. Reading the answer off the same two facts the page
 * reads (`visibilityOf`) is what keeps the form from drifting again.
 *
 * All three answers, in the page's own words and glyphs (`seenName`,
 * `SEEN_GLYPH`). A list that does not exist yet — a new one, a copy — is
 * private: the insert policy refuses anything else.
 *
 * Read, not pressed. The page is where the answer is changed, by a sheet
 * that says what each choice does; a second door to it here would be a
 * control in the one line of the form meant only to be glanced at. So no
 * chevron, and nothing a thumb would take for a button.
 */
export function SeenLine({ col, uid }: {
  /** The list being renamed; null for one not yet made. */
  col: Pick<Collection, 'id' | 'is_public'> | null;
  uid: string | undefined;
}) {
  const { t } = useI18n();
  const shares = useMyListShares(col ? uid : null);
  const shared = col?.id ? sharesByList(shares.data)[col.id]?.length ?? 0 : 0;
  const seen = visibilityOf(!!col?.is_public, shared);
  return (
    <View style={s.seen} testID="collection-form-seen">
      <Glyph name={SEEN_GLYPH[seen]} size={ICON.text} color={colors.textTertiary} />
      <Text style={s.seenText} numberOfLines={1}>{`${seenName(seen, t)} · ${seenGloss(seen, t)}`}</Text>
    </View>
  );
}

/**
 * The one sentence a copy and a save-from-a-place still need, each about
 * what Save will do. A plain new list and a rename have the line above
 * and nothing more to be told: the sentence they wore was about who can
 * see the list, which `SeenLine` says.
 */
export function SaveHint({ kind }: { kind: 'copy' | 'place' | null }) {
  const { t } = useI18n();
  if (!kind) return null;
  return (
    <Lede>{kind === 'copy'
      ? t(
        'Make it yours before it saves — nothing is copied until you do.',
        'Sửa thoải mái trước khi lưu — chưa lưu thì chưa có bản sao nào cả.',
        '保存する前に自由に編集できます — 保存するまでコピーは作られません。',
        '保存前可以随意修改 — 保存后才会创建副本。', '儲存前可以隨意修改 — 儲存後才會建立副本。',
      )
      : t(
        'Name it, and the place you just saved goes in first.',
        'Đặt tên, và địa điểm bạn vừa lưu sẽ vào đầu tiên.',
        '名前をつければ、いま保存したスポットが最初に入ります。',
        '起个名字，你刚保存的地点会排在第一个。', '起個名字，你剛儲存的地點會排在第一個。',
      )}</Lede>
  );
}

/** The hairline over, between and under the form's fields. The colour of
 *  the profile card's own (`EditProfileScreen`'s `fieldLine`), and the
 *  page's width: there is no card here to inset it from. */
export function FieldRule() {
  return <View style={s.rule} testID="collection-form-rule" />;
}

const s = StyleSheet.create({
  // The glyph and the words as the page draws them under the handle: a
  // 15pt glyph in the tertiary ink, the meta face. Secondary for the
  // words, not the page's tertiary: there they sit under a name, here
  // they are the only line between the title and the fields.
  seen: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seenText: { flex: 1, color: colors.textSecondary, ...type.meta },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft },
});
