// The collection form's head and rules: who can see the list — three
// answers side by side under the fields — and the hairlines its fields
// stand between.
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

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Segmented from '../../components/Segmented';
import ShareSheet from '../../components/ShareSheet';
import { Lede } from '../../components/authUi';
import { CHIP_SLOP, PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { createCollection, fetchCollectionId, isNotShareable, useMyListShares, writeFriends } from '../../lib/data';
import { useCrew } from '../../lib/crew';
import { useI18n } from '../../lib/i18n';
import { SEEN_GLYPH, seenGloss, seenName, sharesByList, visibilityOf, type Visibility } from '../../lib/shares';
import { splitFriendships } from '../../lib/friends';
import { colors, type } from '../../theme';
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
  // Who the list is shared with now, and who the form means it to be: the
  // picker's ticks wait here for Save (owner, 22 Nov 2026), as the answer
  // does. Untouched, the ticks are the shares it has.
  const before = useMemo(() => (col?.id ? sharesByList(shares.data)[col.id] ?? [] : []), [shares.data, col?.id]);
  const [ticked, setTicked] = useState<ReadonlySet<string> | null>(null);
  const picks = useMemo(() => [...(ticked ?? before)], [ticked, before]);
  // Friends moved when the answer did or when the ticks did: the same
  // answer with other people is a change the page's Save would have made.
  const changed = seen === 'friends' && !!ticked && (ticked.size !== before.length || before.some((id) => !ticked.has(id)));
  const moved = seen !== start || changed;
  /** What a rename's Save hands the list's page (`leaveForm`): only an
   *  answer that moved, and not Friends, which the form writes itself. */
  const handOn = (slug: string) => (moved && seen !== 'friends' ? { slug, audience: seen, renamed: true } : null);
  /** The picker's answer: nobody ticked is Private, whose way out is the page's. */
  const choose = (ids: ReadonlySet<string>) => { setTicked(ids); set(ids.size ? 'friends' : 'private'); };
  return {
    seen, moved, set, open: !!col || making, handOn, uid, picks, before, choose, history: shares.data,
    // Friends and a list to write them to: what Save does about them.
    friends: seen === 'friends' && moved && picks.length > 0,
    wasPublic: !!col?.is_public,
    reload: shares.reload,
  };
}

/**
 * Who can see the list: the three answers side by side, one press each
 * (owner, 24 Nov 2026), and under them what the chosen one means.
 *
 * ── the way here ──
 *
 * It was a sentence under the title ("Only you can see this list until
 * you make it public from its menu"), wrong twice over; then a line that
 * read the answer off what the page reads; then, on 20 Nov, a pill —
 * "🌐 Public ⌄" — that opened the list page's own Share sheet, the same
 * head and the same three rows (`whoSeesRows`). For one day before the
 * pill a list being made chose from three radio rows under its fields,
 * and those went because they said what the sheet said in a second
 * drawing, one drawing too many.
 *
 * The pill cost two presses for a choice of three, and hid the two it was
 * not showing. A control with all three in view costs one and hides
 * none; and the form no longer opens the sheet at all, so this is the one
 * drawing of the choice here, not a second. The Share sheet stays on the
 * list's page, where sharing is the act and the audience is one part of
 * it. "Send a link" went with the form's sheet: it is sharing, not who
 * can see, and on a rename it sat in the form as a greyed "Soon".
 *
 * Friends is a choice of whom, so its press opens the picker at once, as
 * the sheet's row did (owner, 22 Nov 2026); the ticks wait for Save with
 * the answer, and nobody ticked leaves the answer where it was. Once
 * friends are chosen the line under the control says how many and is the
 * way back to the picker — a press on the segment already chosen would
 * be, too, but nothing says so, and a line that names the friends does.
 *
 * The control is `components/Segmented`, lifted out of here the day it
 * was made when a check-in's sheet asked for the same: the chips'
 * material, 44 tall.
 *
 * A copy, which has no say, keeps the answer as a line of words.
 */
export function SeenLine({ aud }: {
  aud: ReturnType<typeof useAudience>;
}) {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);
  const { ships, blocks, people } = useCrew();
  const friendIds = useMemo(() => (aud.uid ? splitFriendships(ships.data, aud.uid).friends : []), [ships.data, aud.uid]);
  const name = <Text style={s.accessName}>{t('Access', 'Quyền truy cập', 'アクセス', '访问权限', '存取許可權')}</Text>;
  if (!aud.open) {
    return (
      <View style={s.access}>
        <View style={s.accessText}>
          {name}
          <Text style={s.accessAsk}>{t('Who can see this collection?', 'Ai có thể xem bộ sưu tập này?', 'このコレクションを見られる人', '谁可以查看此合集？', '誰可以檢視此合集？')}</Text>
        </View>
        <View style={s.seen} testID="collection-form-seen">
          <Glyph name={SEEN_GLYPH[aud.seen]} size={ICON.text} color={colors.textTertiary} />
          <Text style={s.seenText} numberOfLines={1}>{`${seenName(aud.seen, t)} · ${seenGloss(aud.seen, t)}`}</Text>
        </View>
      </View>
    );
  }
  const n = aud.picks.length;
  // The answer the control shows: Friends from the press that opens the
  // picker (owner, 24 Nov 2026), not only once friends are ticked. The
  // control had stayed on the old answer under the open picker, so the
  // press looked as if it had not landed. Leaving the picker with nobody
  // chosen lets it fall back to where the answer stands — shown only,
  // never kept: Save and the discard guard read `aud.seen`.
  const shown: Visibility = picking ? 'friends' : aud.seen;
  // What the chosen answer means: the sheet's own words for Public, the
  // page's for Private, and for Friends whom.
  const gloss = shown === 'public'
    ? t('Shown in Explore and in search', 'Hiện trên Khám phá và trong tìm kiếm', '「探索する」と検索に表示されます', '会显示在探索和搜索中', '會顯示在探索和搜尋中')
    : shown === 'private'
      ? seenGloss('private', t)
      // Nobody ticked yet: the picker is open over a first choice.
      : n === 0
        ? seenGloss('friends', t)
      : n === 1
        ? t('1 friend chosen', 'Đã chọn 1 bạn', '1人を選択中', '已选择 1 位好友', '已選擇 1 位好友')
        : t(`${n} friends chosen`, `Đã chọn ${n} bạn`, `${n}人を選択中`, `已选择 ${n} 位好友`, `已選擇 ${n} 位好友`);
  const choose = (v: Visibility) => (v === 'friends' ? setPicking(true) : aud.set(v));
  return (
    <View style={s.accessStack}>
      {name}
      <Segmented
        items={(['public', 'friends', 'private'] as const).map((v) => ({ key: v, label: seenName(v, t), icon: SEEN_GLYPH[v], testID: `collection-form-seen-${v}` }))}
        chosen={shown}
        onPick={choose}
        label={t('Who can see this collection?', 'Ai có thể xem bộ sưu tập này?', 'このコレクションを見られる人', '谁可以查看此合集？', '誰可以檢視此合集？')}
        said={gloss}
        testID="collection-form-seen"
      />
      {shown === 'friends' && n > 0 ? (
        <PressableScale
          style={s.glossAt}
          contentStyle={s.glossRow}
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel={gloss}
          accessibilityHint={t('Choose friends', 'Chọn bạn bè', '友達を選ぶ', '选择好友', '選擇好友')}
          hitSlop={CHIP_SLOP}
          testID="collection-form-seen-gloss"
        >
          <Text style={s.gloss}>{gloss}</Text>
          <Glyph name="chevron-forward" size={ICON.text} color={colors.textTertiary} />
        </PressableScale>
      ) : <Text style={s.gloss} testID="collection-form-seen-gloss">{gloss}</Text>}
      <ShareSheet
        open={picking}
        later
        isPublic={aud.wasPublic}
        friendIds={friendIds}
        blocked={blocks.data}
        people={people}
        shared={aud.picks}
        history={aud.history}
        sending={false}
        onClose={() => setPicking(false)}
        onSave={(add, remove) => {
          aud.choose(new Set([...aud.picks.filter((id) => !remove.includes(id)), ...add]));
          setPicking(false);
        }}
      />
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
 * Save's second step for Friends: the picker's ticks, written now that the
 * list is there (owner, 22 Nov 2026). True when they landed. When they did
 * not — a friend gone from the crew since it was read, or the network —
 * the list is already made and the words say so; the caller leaves the
 * form the old way, by the list's page and its picker, which is where the
 * ticks can be tried again. Staying here would put a second Save under a
 * thumb that would make a second list.
 */
export async function shareChosen(
  aud: ReturnType<typeof useAudience>, list: { id: string; slug: string }, t: (en: string, vi: string, ja: string, zh: string, hant?: string) => string,
): Promise<boolean> {
  try {
    await writeFriends(list, aud.picks, aud.before, aud.wasPublic);
    aud.reload();
    return true;
  } catch (e) {
    Alert.alert(
      t('Saved, but not shared', 'Đã lưu, chưa chia sẻ được', '保存しましたが共有できませんでした', '已保存，但未能分享', '已儲存，但未能分享'),
      isNotShareable(e)
        ? t(
          'Someone you ticked is no longer in your crew. Choose your friends again on the collection\'s page.',
          'Có người bạn chọn không còn trong nhóm. Hãy chọn lại bạn bè ở trang bộ sưu tập.',
          '選んだ人の中に、もう仲間ではない人がいます。コレクションのページで選び直してください。',
          '你勾选的人中有人已不在你的好友里。请在合集页面重新选择。', '你勾選的人中有人已不在你的好友裡。請在合集頁面重新選擇。',
        )
        : t(
          'Choose your friends again on the collection\'s page.',
          'Hãy chọn lại bạn bè ở trang bộ sưu tập.',
          'コレクションのページで友達を選び直してください。',
          '请在合集页面重新选择好友。', '請在合集頁面重新選擇好友。',
        ),
    );
    return false;
  }
}

/**
 * A new list, and its friends when the form chose some. Written, the
 * list lands as any private one does — the answer handed on is Private,
 * not Friends, which would have the page open a picker for ticks already
 * made.
 */
export async function createList(
  aud: ReturnType<typeof useAudience>, args: Parameters<typeof createCollection>[0], t: Parameters<typeof shareChosen>[2],
): Promise<{ slug: string; audience: Visibility }> {
  const slug = await createCollection(args);
  const shared = aud.friends && await shareChosen(aud, { id: await fetchCollectionId(slug), slug }, t);
  return { slug, audience: shared ? 'private' : aud.seen };
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
  seen: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  seenText: { flexShrink: 1, color: colors.textSecondary, ...type.meta },
  // One stack with the fields, so the screen's own gap does not add to the
  // air: the row's own, the fields' (`fieldFlush`): 20 over and 22 under
  // so the hairline above and the one below stand as far off as they do
  // from the name and the description.
  access: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 20, paddingBottom: 22 },
  accessText: { flex: 1 },
  accessName: { color: colors.text, fontSize: 17 },
  accessAsk: { color: colors.textTertiary, ...type.meta, marginTop: 5 },
  // The control's row: the name over the three, the meaning under them,
  // with the air the fields' rows keep (`access`).
  accessStack: { gap: 12, paddingTop: 20, paddingBottom: 22 },
  glossAt: { alignSelf: 'flex-start' },
  glossRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gloss: { color: colors.textTertiary, ...type.meta },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft },
});
