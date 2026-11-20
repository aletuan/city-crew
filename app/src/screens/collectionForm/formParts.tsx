// The collection form's head and rules: who can see the list — a line
// under the title that opens the list's own "Share" sheet — and the
// hairlines its fields stand between.
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

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ActionSheet, { SheetRows } from '../../components/ActionSheet';
import { Lede } from '../../components/authUi';
import { PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { useMyListShares } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { SEEN_GLYPH, seenGloss, seenName, sharesByList, visibilityOf, type Visibility } from '../../lib/shares';
import { colors, type } from '../../theme';
import { sendRows, ShareHead, whoHint, whoSeesRows } from '../collectionDetail/Share';
import type { Collection } from '../../lib/types';
import { goTo, type Nav } from '../../nav';

/**
 * Who sees the list, as the form holds it: what it was on opening, and
 * what the reader chose since — kept for Save, as the name and the cover
 * are, so the ✓ lights for it and the discard guard asks about it.
 *
 * A list being made starts Public (owner, 20 Nov 2026: the database
 * refused anything but private until that day, and
 * `20261120120000_lists_born_public.sql` has why and where each part of
 * that went). A rename starts where the list stands, read off the same
 * two facts the page reads (`visibilityOf`). A copy is private and has
 * no say: somebody else's choices republished under your name should not
 * be the default, nor one press from it.
 */
export function useAudience(col: Pick<Collection, 'id' | 'is_public'> | null, uid: string | undefined, making: boolean) {
  const shares = useMyListShares(col ? uid : null);
  const shared = col?.id ? sharesByList(shares.data)[col.id]?.length ?? 0 : 0;
  const start: Visibility = col ? visibilityOf(!!col.is_public, shared) : making ? 'public' : 'private';
  const [picked, set] = useState<Visibility | null>(null);
  const seen = picked ?? start;
  const moved = seen !== start;
  /** What a rename's Save hands the list's page (`leaveForm`): only an
   *  answer that moved. */
  const handOn = (slug: string) => (moved ? { slug, audience: seen, renamed: true } : null);
  return { seen, moved, set, open: !!col || making, handOn };
}

/**
 * Who can see the list, under the form's title: a glyph, the answer's
 * name and what it means. "Public · Everyone can see it".
 *
 * It replaced a sentence that had come to be wrong twice over ("Only you
 * can see this list until you make it public from its menu"), and it
 * reads the answer off what the page reads, so the two cannot drift.
 *
 * A press opens the sheet the paper plane opens on the list's page —
 * the same head, the same three rows (`whoSeesRows`) — for a rename and
 * for a list being made alike (owner, 20 Nov 2026). It had been read
 * only, on the grounds that the page was where the answer changed and a
 * second door here would be a control in a line meant to be glanced at;
 * the owner pressed it on his phone, expecting the sheet, and that
 * settled it. For one day before, a list being made chose from three
 * radio rows under its fields: they said the same three things as the
 * sheet in a second drawing, which is one drawing too many.
 *
 * The answer is kept until Save, like the fields: changing who sees a
 * list from a form whose ✓ has not been pressed would be the one edit
 * here that did not wait for it. What Save does with it is `leaveForm`'s.
 *
 * A chevron after the words, which the mark under the handle on the page
 * does not have: there the glyph sits in a byline, here it is the whole
 * line, and a line of grey words with nothing to say it can be pressed
 * would not be pressed. A copy's line stays words alone.
 *
 * Making a list, Friends says when the friends are chosen — once it is
 * made, on its page — and the sheet has no "Send a link": there is no
 * list to send yet.
 */
export function SeenLine({ aud, making }: {
  aud: ReturnType<typeof useAudience>;
  making: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const words = (
    <>
      <Glyph name={SEEN_GLYPH[aud.seen]} size={ICON.text} color={colors.textTertiary} />
      <Text style={s.seenText} numberOfLines={1}>{`${seenName(aud.seen, t)} · ${seenGloss(aud.seen, t)}`}</Text>
    </>
  );
  if (!aud.open) return <View style={s.seen} testID="collection-form-seen">{words}</View>;
  const close = () => setOpen(false);
  return (
    <>
      <PressableScale
        contentStyle={s.seen}
        scaleTo={0.98}
        haptic="selection"
        hitSlop={{ top: 12, bottom: 12 }}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${seenName(aud.seen, t)}, ${seenGloss(aud.seen, t)}`}
        accessibilityHint={whoHint(t)}
        testID="collection-form-seen"
      >
        {words}
        <Glyph name="chevron-down" size={ICON.text} color={colors.textTertiary} />
      </PressableScale>
      <ActionSheet visible={open} onClose={close} header={<ShareHead />}>
        <SheetRows
          actions={whoSeesRows(t, {
            seen: aud.seen,
            friendsDesc: making
              ? t('Once it is made, you choose who', 'Lưu xong, bạn chọn những người được xem', '作成したら、見られる人を選びます', '创建后，你来选择谁能看', '建立後，你來選擇誰能看')
              : undefined,
            onChoose: aud.set,
          })}
          onClose={close}
        />
        {making ? null : <SheetRows actions={sendRows(t)} onClose={close} />}
      </ActionSheet>
    </>
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

/** Whether the form is making a list of your own: not a rename, not a
 *  copy. The case that starts Public (`useAudience`). */
export const makingOwn = (editing: string | undefined, copyFrom: unknown): boolean => !editing && !copyFrom;

/**
 * Leaving the form once a save landed: back to where it was opened, and
 * what was chosen in the sheet handed to the list's page to do
 * (`CollectionDetail`'s `seen`), by the hands its own sheet uses —
 * `publish`, `makePrivate`, "Share with friends" — so the form has no
 * second copy of what each answer writes to the other two (the shares
 * kept behind Public, all taken off by Private).
 *
 * A rename goes back onto that page, so the answer is set on it as it is
 * uncovered; it is only there when the answer moved. A list just made
 * was made public or private already (`createCollection`), so only
 * Friends is handed on: the list is private until a friend is ticked
 * there, and "Not now" in the picker leaves it so. Through the
 * Collections tab, as a copy lands: the form may have been opened from a
 * place's save on another tab, and the list is a thing the reader now
 * owns.
 *
 * A public list is drawn from the catalog's copy too (the Community tab,
 * a person's page), which refreshes only on a pull or a stale
 * foreground; `reload` is that copy's, asked only for a list made public.
 */
export function leaveForm(
  navigation: Nav,
  saved: { current: boolean },
  made: { slug: string; audience: Visibility; renamed?: boolean } | null,
  reload: () => void,
) {
  saved.current = true;
  const { routes, index } = navigation.getState();
  const under = routes[index - 1];
  if (made?.renamed && under?.name === 'CollectionDetail') {
    // `CommonActions.setParams` spelled out, with the route it is for.
    navigation.dispatch({ type: 'SET_PARAMS', payload: { params: { seen: made.audience } }, source: under.key });
  }
  navigation.goBack();
  if (made?.audience === 'public' && !made.renamed) reload();
  if (made?.audience === 'friends' && !made.renamed) {
    goTo('Collections', { screen: 'CollectionDetail', initial: false, params: { slug: made.slug, seen: 'friends' } });
  }
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
