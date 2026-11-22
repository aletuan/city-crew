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

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import ActionSheet, { SheetRows } from '../../components/ActionSheet';
import ShareSheet from '../../components/ShareSheet';
import { Lede } from '../../components/authUi';
import { CHIP_H, CHIP_SLOP, PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { createCollection, fetchCollectionId, isNotShareable, useMyListShares, writeFriends } from '../../lib/data';
import { useCrew } from '../../lib/crew';
import { useI18n } from '../../lib/i18n';
import { SEEN_GLYPH, seenGloss, seenName, sharesByList, visibilityOf, type Visibility } from '../../lib/shares';
import { splitFriendships } from '../../lib/friends';
import { colors, font, radius, type } from '../../theme';
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
 * Who can see the list, under the form's title: a pill with the answer's
 * glyph and name and a chevron, "🌐 Public ⌄"; for a copy, which has no
 * say, the glyph, the name and what it means in a line of words.
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
 * A pill, not a line (owner, 20 Nov 2026, the same afternoon). The first
 * cut was the line of words with a chevron at the far end of the row,
 * and on the phone the chevron sat a width of grey away from the words
 * it belonged to: read as two things, neither of them a control. Weighed
 * for him beside it: the chevron moved up against the words (still grey
 * words, only now with a mark), and a settings row, "Who can see it ·
 * Public ›" (a second label over a form that has two already). He took
 * the pill. It is the app's chip — `CHIP_H` tall, its rim, its slop to
 * 44 — in the chosen state's fill, so it reads as a thing that holds a
 * value and can be changed, as a "Share" chip does on a shared document.
 *
 * The answer's name alone in it: what each answer means is in the sheet
 * one press away, and the pill is a value, not a sentence. VoiceOver
 * still hears both.
 *
 * Friends opens the picker at once (owner, 22 Nov 2026), for a list being
 * made as for one being edited; the ticks wait for Save with the answer.
 * It had said "once it is made, you choose who" and opened the picker on
 * the list's page afterwards. The sheet has no "Send a link" while making:
 * there is no list to send yet.
 */
export function SeenLine({ aud, making }: {
  aud: ReturnType<typeof useAudience>;
  making: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const { ships, blocks, people } = useCrew();
  const friendIds = useMemo(() => (aud.uid ? splitFriendships(ships.data, aud.uid).friends : []), [ships.data, aud.uid]);
  // The row the answer stands in (owner, 22 Nov 2026): its name and the
  // question on the left, the answer on the right, under the fields it
  // is about rather than over them.
  const row = (answer: React.ReactNode) => (
    <View style={s.access}>
      <View style={s.accessText}>
        <Text style={s.accessName}>{t('Access', 'Quyền truy cập', 'アクセス', '访问权限', '存取許可權')}</Text>
        <Text style={s.accessAsk}>{t('Who can see this collection?', 'Ai có thể xem bộ sưu tập này?', 'このコレクションを見られる人', '谁可以查看此合集？', '誰可以檢視此合集？')}</Text>
      </View>
      {answer}
    </View>
  );
  if (!aud.open) {
    return row(
      <View style={s.seen} testID="collection-form-seen">
        <Glyph name={SEEN_GLYPH[aud.seen]} size={ICON.text} color={colors.textTertiary} />
        <Text style={s.seenText} numberOfLines={1}>{`${seenName(aud.seen, t)} · ${seenGloss(aud.seen, t)}`}</Text>
      </View>,
    );
  }
  const close = () => setOpen(false);
  return row(
    <>
      <PressableScale
        style={s.pillAt}
        contentStyle={s.pill}
        scaleTo={0.96}
        haptic="selection"
        hitSlop={CHIP_SLOP}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${seenName(aud.seen, t)}, ${seenGloss(aud.seen, t)}`}
        accessibilityHint={whoHint(t)}
        testID="collection-form-seen"
      >
        <Glyph name={SEEN_GLYPH[aud.seen]} size={ICON.text} color={colors.text} />
        <Text style={s.pillText} numberOfLines={1}>
          {seenName(aud.seen, t) + (aud.seen === 'friends' && aud.picks.length ? ` · ${aud.picks.length}` : '')}
        </Text>
        <Glyph name="chevron-down" size={ICON.text} color={colors.textSecondary} />
      </PressableScale>
      <ActionSheet visible={open} onClose={close} header={<ShareHead />}>
        <SheetRows
          actions={whoSeesRows(t, {
            seen: aud.seen,
            // Friends is choosing which, here and now (owner, 22 Nov 2026):
            // the ticks wait for Save with the rest of the form.
            onChoose: (v) => (v === 'friends' ? setPicking(true) : aud.set(v)),
          })}
          onClose={close}
        />
        {making ? null : <SheetRows actions={sendRows(t)} onClose={close} />}
      </ActionSheet>
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
    </>,
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
          'コレクションのページで友だちを選び直してください。',
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
  // The app's chip in its chosen state (`ui/controls`' `chip`, `chipOn`),
  // at the left: a pill as wide as its answer, not the row.
  pillAt: { alignSelf: 'flex-start' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: CHIP_H, paddingHorizontal: 12, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.borderGlass, backgroundColor: colors.surfaceGlass,
  },
  pillText: { color: colors.text, fontSize: 14, fontWeight: font.semibold },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft },
});
