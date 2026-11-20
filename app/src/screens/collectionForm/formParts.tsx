// The collection form's head and rules: who can see the list — a line
// under the title, or for a list being made the choice itself — and the
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

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Lede } from '../../components/authUi';
import { Card, PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { useMyListShares } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { SEEN_GLYPH, seenGloss, seenName, sharesByList, visibilityOf, type Visibility } from '../../lib/shares';
import { colors, font, type } from '../../theme';
import type { Collection } from '../../lib/types';
import { goTo, type Nav } from '../../nav';

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
 * `SEEN_GLYPH`). A copy, which does not exist yet, is private: the form
 * makes it so (`createCollection`). A list of your own being made has no
 * line — it has the choice, `AudienceChoice`, under its fields.
 *
 * Read, not pressed. The page is where the answer is changed, by a sheet
 * that says what each choice does; a second door to it here would be a
 * control in the one line of the form meant only to be glanced at. So no
 * chevron, and nothing a thumb would take for a button.
 */
export function SeenLine({ col, uid, making }: {
  /** The list being renamed; null for one not yet made. */
  col: Pick<Collection, 'id' | 'is_public'> | null;
  uid: string | undefined;
  /** A list of your own being made, which asks instead of saying. */
  making: boolean;
}) {
  const { t } = useI18n();
  const shares = useMyListShares(col ? uid : null);
  if (making) return null;
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

/**
 * Who sees a list you are making: Public, Friends or Private, Public
 * first and chosen (owner, 20 Nov 2026).
 *
 * Until that day a list was made private and published from its page
 * afterwards — the database refused anything else, on purpose
 * (`20261120120000_lists_born_public.sql` has the argument and where each
 * part of it went). The owner wanted the choice where the list is made,
 * and public by default.
 *
 * Three rows rather than three segments side by side: both were drawn
 * for him, and he took the rows. They differ in what they lead to, and a
 * row has room to say it — "Only the friends you choose" under Friends is
 * the difference between "my friends" and "these friends", which a
 * segment's one word cannot carry. The same three rows, glyphs and words
 * as the list's own sheet (`seenName`, `seenGloss`, `SEEN_GLYPH`), so the
 * choice reads the same the day it is changed.
 *
 * The line under says what happens next for the answer chosen, since each
 * has a consequence the row's words do not: a public list is not shown to
 * others until it has a place; Friends opens the picker once the list is
 * made (`leaveForm`); Private is changed later on the list's page.
 *
 * Not on a copy, which is made private: somebody else's choices
 * republished under your name should not be the default, nor one press
 * from it. Not on a rename, whose answer is changed on the list's page.
 */
export function AudienceChoice({ making, value, onChange }: {
  making: boolean;
  value: Visibility;
  onChange: (v: Visibility) => void;
}) {
  const { t } = useI18n();
  if (!making) return null;
  const next: Record<Visibility, string> = {
    public: t('Shown on Community and on your page once it has a place.', 'Hiện trên Cộng đồng và trang cá nhân của bạn khi có địa điểm đầu tiên.', '最初のスポットが入ると、みんなのとあなたのページに表示されます。', '有了第一个地点后，会显示在社区和你的主页上。', '有了第一個地點後，會顯示在社群和你的主頁上。'),
    friends: t('Once it is made, you choose who.', 'Lưu xong, bạn chọn những người được xem.', '作成したら、見られる人を選びます。', '创建后，你来选择谁能看。', '建立後，你來選擇誰能看。'),
    private: t('You can change this any time on the collection’s page.', 'Bạn đổi được bất cứ lúc nào trên trang bộ sưu tập.', 'コレクションのページでいつでも変更できます。', '随时可以在合集页面上更改。', '隨時可以在合集頁面上更改。'),
  };
  return (
    <View style={s.choice} testID="collection-form-audience">
      <Text style={s.choiceHead}>{t('Who can see it', 'Ai được xem', '公開範囲', '谁能看到', '誰能看到')}</Text>
      <Card>
        <View accessibilityRole="radiogroup">
          {(['public', 'friends', 'private'] as const).map((v, i) => {
            const on = v === value;
            return (
              <PressableScale
                key={v}
                onPress={() => onChange(v)}
                haptic="selection"
                scaleTo={0.99}
                contentStyle={[s.choiceRow, i > 0 && s.choiceRule]}
                accessibilityRole="radio"
                aria-checked={on}
                accessibilityLabel={`${seenName(v, t)}, ${seenGloss(v, t)}`}
                testID={`collection-form-audience-${v}`}
              >
                <View style={[s.choiceDisc, on && s.choiceDiscOn]}>
                  <Glyph name={SEEN_GLYPH[v]} size={ICON.action} color={on ? colors.accent : colors.textSecondary} />
                </View>
                <View style={s.choiceWords}>
                  <Text style={s.choiceName}>{seenName(v, t)}</Text>
                  <Text style={s.choiceGloss}>{seenGloss(v, t)}</Text>
                </View>
                <View style={[s.ring, on && s.ringOn]}>{on ? <View style={s.dot} /> : null}</View>
              </PressableScale>
            );
          })}
        </View>
      </Card>
      <Text style={s.choiceNext} testID="collection-form-audience-next">{next[value]}</Text>
    </View>
  );
}

/** Whether the form is making a list of your own: not a rename, not a
 *  copy. The one case that asks who sees it (`AudienceChoice`). */
export const makingOwn = (editing: string | undefined, copyFrom: unknown): boolean => !editing && !copyFrom;

/**
 * Leaving the form once a save landed: back to where it was opened, and
 * for a list just made with Friends chosen, on to that list with "Share
 * with friends" open (`CollectionDetail`'s `share`).
 *
 * The list is private until a friend is ticked there — `createCollection`
 * was told public only for Public — so "Not now" in the picker leaves it
 * private, which is what it is, and nothing has been shown to anybody.
 * Through the Collections tab, as a copy lands: the form may have been
 * opened from a place's save on another tab, and the list is a thing the
 * reader now owns.
 *
 * A public list is drawn from the catalog's copy too (the Community tab,
 * a person's page), which refreshes only on a pull or a stale
 * foreground; `reload` is that copy's, asked only for a list made public.
 */
export function leaveForm(navigation: Nav, saved: { current: boolean }, made: { slug: string; audience: Visibility } | null, reload: () => void) {
  saved.current = true;
  navigation.goBack();
  if (made?.audience === 'public') reload();
  if (made?.audience === 'friends') {
    goTo('Collections', { screen: 'CollectionDetail', initial: false, params: { slug: made.slug, share: true } });
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
  // `AudienceChoice`. The heading is the small capitals Crew heads its
  // groups with; the card is the app's card with its rows inside, as the
  // list's own sheet draws the same three.
  choice: { gap: 10, marginTop: 14 },
  choiceHead: {
    color: colors.textTertiary, fontSize: 13, fontWeight: font.semibold,
    letterSpacing: 1.1, textTransform: 'uppercase',
  },
  // 64 tall: a 36pt disc and two lines, and over the 44 a thumb needs.
  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64 },
  choiceRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  choiceDisc: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceGlass },
  choiceDiscOn: { backgroundColor: colors.badgeSolid },
  choiceWords: { flex: 1, gap: 2 },
  choiceName: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  choiceGloss: { color: colors.textSecondary, ...type.meta },
  // The radio: a ring, filled with a dot in the accent when chosen. Shape
  // and colour both, so the answer is not told by colour alone.
  ring: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.borderGlass, alignItems: 'center', justifyContent: 'center' },
  ringOn: { borderWidth: 2, borderColor: colors.accent },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  choiceNext: { color: colors.textTertiary, ...type.meta, paddingHorizontal: 4 },
});
