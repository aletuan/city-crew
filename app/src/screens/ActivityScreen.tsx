// Activity — what other people did with your lists and your crew while
// you were away.
//
// Two sections, two kinds of thing. REQUESTS are questions: somebody
// asked to join your crew and the card carries the only two answers.
// EARLIER is news: applause on your lists, and copies saved of them,
// in one timeline. A row opens the list that earned it and wears the
// chevron that says so; one on a list that is gone opens nothing and
// wears none.
//
// Your own plans are not here. An UPCOMING section carried the nearest
// trip for a day (6–7 Oct 2026) and went: by then the same fact was on
// the Trips tab's dot, in the morning notification and on the Trips
// screen, and this copy — the deepest, one line, and showing one trip
// when there were two on the day — was the only one telling it wrong.
//
// The applause comes through `likes_on_mine`, which names every liker
// to the one person allowed to ask — the owner of the list. "Someone
// liked…" survives only as the fallback for a liker whose profile is
// gone. See the named_applause migration for why the owner is not
// "the public" that the likes table's privacy promise protects against.

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthHeader, AuthScreen } from '../components/authUi';
import PersonSheet, { type PersonAction } from '../components/PersonSheet';
import { useReport } from '../components/reportFlow';
import { Avatar, Card, Empty, PressableScale, successHaptic } from '../components/ui';
import { useAuth } from '../lib/auth';
import { APPLAUSE_DAYS } from '../lib/activityWindow';
import { numericDate } from '../lib/format';
import { useCollections } from '../lib/catalog';
import { useCrew } from '../lib/crew';
import {
  acceptFriendRequest, blockUser, fetchApplause, fetchCopies, removeFriendship, type FriendProfile, useCuratorAvatarsQuery, useMyCollections,
} from '../lib/data';
import {
  type ActivityItem, agoOf, type Applause, buildActivity, type Copy, splitFriendships,
} from '../lib/friends';
import { atHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { reasonOf, usePending } from '../lib/pending';
import { colors, font, gradAI, radius, space, type } from '../theme';
import type { Nav } from '../nav';

/** How far back the applause reaches. Two weeks: long enough that a
 *  weekly reader misses nothing, short enough that the screen is news
 *  rather than an archive. */


export default function ActivityScreen({ navigation }: { navigation: Nav }) {
  const { t, lang } = useI18n();
  const { session } = useAuth();
  const me = session?.user?.id ?? null;
  // Edges and faces from the one shared copy — answered on Crew, gone
  // from here the same moment, and no fetch of this screen's own. The
  // provider's `people` covers every id the edges mention, askers
  // included.
  const { ships, blocks, people: askers } = useCrew();
  const mine = useMyCollections(me);
  const cols = useCollections();

  const crew = useMemo(() => splitFriendships(ships.data, me ?? ''), [ships.data, me]);

  const [applause, setApplause] = useState<Applause[] | null>(null);
  const [copies, setCopies] = useState<Copy[] | null>(null);
  useEffect(() => {
    if (!me) { setApplause([]); setCopies([]); return; }
    const since = new Date(Date.now() - APPLAUSE_DAYS * 86400000).toISOString();
    fetchApplause(since).then(setApplause).catch(() => setApplause([]));
    // The same window: a copy is news for as long as a like is.
    fetchCopies(since).then(setCopies).catch(() => setCopies([]));
  }, [me]);

  const earlier = useMemo<ActivityItem[]>(() => buildActivity(applause ?? [], copies ?? []), [applause, copies]);

  // The faces, by handle: the same lookup the bylines use, because a
  // liker need not be a curator and need not be a friend, so neither the
  // catalog's faces nor the crew's cover everyone here. One batched ask
  // for every actor on the screen; a handle with no face gets the blank
  // disc, as does a like whose liker is unnamed.
  const actors = useMemo(
    () => earlier.map((it) => (it.kind === 'applause' ? it.liker_handle : it.copier_handle) ?? '').filter(Boolean),
    [earlier],
  );
  const faces = useCuratorAvatarsQuery(actors);

  // A collection id is what the applause carries; the title is what the
  // reader needs. Both shelves are searched — the liked list is yours,
  // but "yours" spans the desk shelf and your own.
  const titleOf = (collectionId: string): string | null => {
    for (const c of [...mine.data, ...cols.data]) {
      if (c.id === collectionId) return t(c.title_en, c.title_vi, c.title_ja);
    }
    return null;
  };

  // One write per person at a time, and a failure said out loud — the same
  // guard the crew screen uses (see lib/pending). Both writes here used to
  // end in `.catch(() => {})`, so a dropped connection left the request
  // sitting there with no word on whether the tap had landed.
  const { pending, run } = usePending();
  const failed = (title: string) => (e: unknown) => Alert.alert(title, reasonOf(e));

  const answer = (requester: string, yes: boolean) => run(
    requester,
    () => (yes ? acceptFriendRequest(requester, me!) : removeFriendship(requester, me!)),
    () => { if (yes) successHaptic(); ships.reload(); },
    failed(yes
      ? t('Could not accept the request', 'Không chấp nhận được lời mời', 'リクエストを承認できませんでした')
      : t('Could not decline the request', 'Không từ chối được lời mời', 'リクエストを拒否できませんでした')),
  );

  // The stronger no, one press deeper — and in the same sheet the crew
  // screen uses, so a request answered from here and one answered from
  // there present the same two choices in the same words. See
  // PersonSheet for why this is not an Alert any more.
  const [sheet, setSheet] = useState<{
    name: string; meta?: string; avatar?: string; actions: PersonAction[];
  } | null>(null);
  const { report, node: reportSheet } = useReport();

  const openRequestSheet = (requester: string, p?: FriendProfile) => setSheet({
    name: p ? (p.full_name || atHandle(p.handle)) : t('This request', 'Lời mời này', 'このリクエスト'),
    meta: p ? atHandle(p.handle) : undefined,
    avatar: p?.avatar_url || undefined,
    actions: [
      {
        key: 'decline',
        icon: 'close-circle-outline',
        title: t('Decline', 'Từ chối', '拒否'),
        desc: t(
          'The request goes, silently. They can ask again another day.',
          'Lời mời biến mất, im lặng. Hôm khác họ vẫn có thể mời lại.',
          'リクエストは静かに消えます。相手はまた後日申請できます。',
        ),
        onPress: () => answer(requester, false),
      },
      {
        key: 'block',
        icon: 'ban-outline',
        title: t('Decline and block', 'Từ chối và chặn', '拒否してブロック'),
        desc: t(
          'Refuse it and stop them asking again.',
          'Từ chối và chặn họ mời lại.',
          '拒否して、今後の申請も止めます。',
        ),
        destructive: true,
        onPress: () => Alert.alert(
          p
            ? t(`Block ${atHandle(p.handle)}?`, `Chặn ${atHandle(p.handle)}?`, `${atHandle(p.handle)} をブロックしますか？`)
            : t('Block this person?', 'Chặn người này?', 'この人をブロックしますか？'),
          t('They will not be told. You can undo this from Your crew.', 'Họ sẽ không được báo. Bạn có thể bỏ chặn trong Crew của bạn.', '相手に通知されません。クルー画面から解除できます。'),
          [
            { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
            {
              text: t('Block', 'Chặn', 'ブロック'),
              style: 'destructive',
              // Blocks too, not just edges: the body above promises the undo
              // lives on Your crew, whose blocked list reads this copy.
              onPress: () => run(
                requester,
                () => blockUser(requester),
                () => { ships.reload(); blocks.reload(); },
                failed(t('Could not block', 'Không chặn được', 'ブロックできませんでした')),
              ),
            },
          ],
        ),
      },
      ...(p ? [{
        key: 'report',
        icon: 'flag-outline' as const,
        // The verb alone: the sheet's header names them — see `ActionSheet`.
        title: t('Report', 'Báo cáo', '報告する'),
        desc: t(
          'Tell the desk about their name, photo or bio. They are not told who reported them.',
          'Báo cho desk về tên, ảnh hoặc tiểu sử của họ. Họ không biết ai đã báo cáo.',
          '名前・写真・自己紹介についてデスクに報告します。誰が報告したかは相手に伝わりません。',
        ),
        onPress: () => report({
          kind: 'profile' as const,
          id: p.id,
          name: p.full_name || atHandle(p.handle),
          avatarUrl: p.avatar_url || undefined,
        }),
      }] : []),
    ],
  });

  const agoLabel = (iso: string): string => {
    const ago = agoOf(iso, Date.now());
    if (ago.unit === 'now') return t('just now', 'vừa xong', 'たった今');
    if (ago.unit === 'minutes') return t(`${ago.n}m ago`, `${ago.n} phút trước`, `${ago.n}分前`);
    if (ago.unit === 'hours') return t(`${ago.n}h ago`, `${ago.n} giờ trước`, `${ago.n}時間前`);
    if (ago.n === 1) return t('yesterday', 'hôm qua', '昨日');
    // A week of "n days ago", then the date: past a week nobody counts
    // back, they look at a calendar — Mail and Instagram turn the same
    // corner. The date is `numericDate`, the check-in rows' form, so a
    // day already past is written one way across the profile stack.
    if (ago.n > RELATIVE_DAYS) return numericDate(lang, new Date(iso));
    return t(`${ago.n} days ago`, `${ago.n} ngày trước`, `${ago.n}日前`);
  };

  // Only what EARLIER is built from. The crew edges feed REQUESTS, and
  // waiting on them blanked the feed behind a spinner on every answer's
  // reload.
  const loading = applause === null || copies === null;

  return (
    <AuthScreen>
      <AuthHeader onBack={() => navigation.goBack()} title={t('Activity', 'Hoạt động', 'アクティビティ')} />

      {crew.incoming.length > 0 && (
        <>
          <Text style={s.eyebrow}>{t('Requests', 'Lời mời', 'リクエスト')}</Text>
          {crew.incoming.map((r) => {
            const p = askers[r.requester];
            return (
              <Card key={r.requester} style={s.reqCard}>
                <View style={s.reqRow}>
                  <Avatar url={p?.avatar_url} size={46} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.reqTitle}>
                      <Text style={{ fontWeight: font.bold }}>{p?.full_name || (p ? atHandle(p.handle) : '…')}</Text>
                      {' '}
                      {t('wants to join your crew', 'muốn tham gia crew của bạn', 'がクルーに参加したがっています')}
                    </Text>
                    {p ? <Text style={s.meta}>{atHandle(p.handle)}</Text> : null}
                  </View>
                  {/* Same reason the crew rows grew one: Block lived
                      behind a long-press on Decline, which no screen can
                      teach. The ⋯ opens the same decline-or-block ask. */}
                  <PressableScale
                    onPress={() => openRequestSheet(r.requester, p)}
                    scaleTo={0.85}
                    hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('Options', 'Tuỳ chọn', 'オプション')}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.textTertiary} />
                  </PressableScale>
                </View>
                <View style={s.answers}>
                  {/* `flex: 1` must ride the outer Pressable — in `style`
                      it lands on the inner view with nothing to divide,
                      and both buttons shrank onto each other. The exact
                      failure PressableScale's own doc block names. */}
                  {/* The gradient, not solid accent: gradAI is what every
                      primary commit in this app wears — PrimaryButton,
                      GradientCta, the hero — and solid accent in the
                      light theme is a darker brick that read as a
                      different app sitting in this one. */}
                  <PressableScale
                    containerStyle={[s.half, pending.has(r.requester) && s.working]}
                    onPress={() => answer(r.requester, true)}
                    disabled={pending.has(r.requester)}
                    aria-disabled={pending.has(r.requester)}
                    accessibilityRole="button"
                  >
                    <LinearGradient {...gradAI} style={s.accept}>
                      <Ionicons name="checkmark" size={17} color={colors.accentInk} />
                      <Text style={s.acceptText}>{t('Accept', 'Đồng ý', '承認')}</Text>
                    </LinearGradient>
                  </PressableScale>
                  <PressableScale
                    containerStyle={[s.half, pending.has(r.requester) && s.working]}
                    style={s.decline}
                    onPress={() => answer(r.requester, false)}
                    disabled={pending.has(r.requester)}
                    aria-disabled={pending.has(r.requester)}
                    onLongPress={() => openRequestSheet(r.requester, p)}
                    accessibilityRole="button"
                    accessibilityHint={t('Hold to block', 'Giữ để chặn', '長押しでブロック')}
                  >
                    <Text style={s.declineText}>{t('Decline', 'Từ chối', '拒否')}</Text>
                  </PressableScale>
                </View>
              </Card>
            );
          })}
        </>
      )}

      <Text style={s.eyebrow}>{t('Earlier', 'Trước đó', 'これまで')}</Text>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
      ) : earlier.length === 0 ? (
        <Empty text={t(
          'Quiet so far. Likes and copies of your lists will show here.',
          'Chưa có gì. Lượt thích và bản sao list của bạn sẽ hiện ở đây.',
          'まだ静かです。リストへのいいねやコピーがここに表示されます。',
        )} />
      ) : (
            <Card testID="earlier-card">
              {earlier.map((item, i) => {
                const title = titleOf(item.collection_id);
                // The handle, not the full name: it is how the rest of the
                // app names a person in public ("by @trang"), and it is the
                // name they chose to be known by. The full name stays on
                // the request card, where recognising a human is the
                // decision being made.
                const who = (item.kind === 'applause' ? item.liker_handle : item.copier_handle);
                const by = who ? atHandle(who) : null;
                const shown = title ?? '…';
                // Two kinds, one sentence shape. The copy's verb is the
                // button's own words — "Save a copy" is what they pressed.
                const line = item.kind === 'applause'
                  ? (by
                    ? t(`${by} liked “${shown}”`, `${by} đã thích “${shown}”`, `${by} が「${shown}」にいいねしました`)
                    : t(`Someone liked “${shown}”`, `Ai đó đã thích “${shown}”`, `誰かが「${shown}」にいいねしました`))
                  : (by
                    ? t(`${by} saved a copy of “${shown}”`, `${by} đã lưu bản sao “${shown}”`, `${by} が「${shown}」のコピーを保存しました`)
                    : t(`Someone saved a copy of “${shown}”`, `Ai đó đã lưu bản sao “${shown}”`, `誰かが「${shown}」のコピーを保存しました`));
                return (
                  <PressableScale
                    key={`${item.kind}-${item.collection_id}-${item.at}`}
                    style={[s.row, i > 0 && s.rowDivider]}
                    onPress={title ? () => navigation.navigate('CollectionDetail', { slug: slugFor(item.collection_id, [...mine.data, ...cols.data]) ?? '' }) : undefined}
                    // A button only when it goes somewhere — VoiceOver has to
                    // hear that this row opens the list.
                    accessibilityRole={title ? 'button' : undefined}
                  >
                    {/* Who, then what: the actor's face leads the row, as
                        every social feed has it (Instagram, Threads), and
                        the kind of thing they did rides on its corner as a
                        badge — the heart or the copy, filled and in the
                        accent, small enough to be a mark and not a second
                        picture. It replaced a bare glyph per row, which
                        told the eye nothing once five rows shared it. */}
                    <View style={s.face} testID="row-face">
                      <Avatar url={who ? faces.data[who] : null} size={FACE} />
                      <View style={s.kind} testID="kind-badge">
                        <Ionicons name={item.kind === 'applause' ? 'heart' : 'copy'} size={11} color={colors.accent} />
                      </View>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.line} numberOfLines={2}>
                        {line}
                      </Text>
                      <Text style={s.meta}>{agoLabel(item.at)}</Text>
                    </View>
                    {/* Only where there is somewhere to go: the same
                        condition as the role above, so what VoiceOver
                        hears and what the eye sees agree. */}
                    {title ? <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} style={s.rowEnd} /> : null}
                  </PressableScale>
                );
              })}
            </Card>
      )}
      <PersonSheet
        visible={sheet !== null}
        name={sheet?.name ?? ''}
        meta={sheet?.meta}
        avatarUrl={sheet?.avatar}
        actions={sheet?.actions ?? []}
        onClose={() => setSheet(null)}
      />
      {reportSheet}
    </AuthScreen>
  );
}

/** id → slug, over whichever shelves the screen already holds. */
function slugFor(
  collectionId: string,
  cols: readonly { slug: string; id?: string }[],
): string | null {
  for (const c of cols) if (c.id === collectionId) return c.slug;
  return null;
}

/** The feed line's line height, and the box that holds a 19pt glyph's
 *  whole line — see `mark`. */
const LINE = 21;
/** How many days a time is told as a distance before it is told as a date. */
const RELATIVE_DAYS = 7;
/** The face's side: the 44pt the slot it replaced had, so the text
 *  column stays where it was, and the width a row's leading avatar has
 *  everywhere else here (the request cards are 46, a card's own call). */
const FACE = 44;

const s = StyleSheet.create({
  eyebrow: {
    color: colors.textTertiary, fontSize: 12.5, fontWeight: font.semibold,
    letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 6,
  },
  reqCard: { padding: space.cardPadding, gap: 14 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reqTitle: { color: colors.text, fontSize: 15.5, lineHeight: 21 },
  meta: { color: colors.textTertiary, ...type.meta },
  answers: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  // A request whose answer is in flight: dimmed, and refusing the tap.
  working: { opacity: 0.5 },
  accept: {
    flexDirection: 'row', gap: 7,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill, paddingVertical: 11,
  },
  acceptText: { color: colors.accentInk, fontSize: 15, fontWeight: font.semibold },
  decline: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderGlass, borderRadius: radius.pill, paddingVertical: 11,
  },
  declineText: { color: colors.textSecondary, fontSize: 15, fontWeight: font.semibold },

  // Centred: a 44pt face beside one or two lines of text wants its
  // middle on theirs. The rows were top-aligned while the mark was a
  // 19pt glyph set on the first line; a face has no first line to sit on.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: space.cardPadding, paddingVertical: 12,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  // The row aligns its top so the mark can sit on the first line of text;
  // the chevron keeps the middle, as Profile's rows do it.
  rowEnd: { alignSelf: 'center' },
  face: { width: FACE, height: FACE },
  // The badge: a 20pt disc on the card's own ground with the row's
  // hairline around it, hung a hair past the face's corner so it reads
  // as pinned on rather than printed on. 11pt glyph: the heart is a
  // mark here, not an icon to tap.
  kind: {
    position: 'absolute', right: -3, bottom: -3,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  line: { color: colors.text, fontSize: 15, lineHeight: LINE },
});
