// Activity — what happened while you were away, and what is about to.
//
// Three sections, three kinds of thing. REQUESTS are questions: somebody
// asked to join your crew and the card carries the only two answers.
// UPCOMING is the one trip about to happen. EARLIER is news: applause on
// your lists. A row opens what it names — the trip, the list that earned
// the like — and wears the chevron that says so; a like on a list that is
// gone opens nothing and wears none.
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
import { useCollections } from '../lib/catalog';
import { useCrew } from '../lib/crew';
import {
  acceptFriendRequest, blockUser, fetchApplause,
  type FriendProfile, removeFriendship, useMyCollections,
} from '../lib/data';
import { useMyTrips } from '../lib/mytrips';
import { todayISO } from '../lib/day';
import {
  type ActivityItem, agoOf, type Applause, buildActivity, splitFriendships,
} from '../lib/friends';
import { atHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { reasonOf, usePending } from '../lib/pending';
import { colors, font, gradAI, radius, space, type } from '../theme';
import type { Nav } from '../nav';

/** How far back the applause reaches. Two weeks: long enough that a
 *  weekly reader misses nothing, short enough that the screen is news
 *  rather than an archive. */
const APPLAUSE_DAYS = 14;

export default function ActivityScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { session } = useAuth();
  const me = session?.user?.id ?? null;
  // Edges and faces from the one shared copy — answered on Crew, gone
  // from here the same moment, and no fetch of this screen's own. The
  // provider's `people` covers every id the edges mention, askers
  // included.
  const { ships, blocks, people: askers } = useCrew();
  const trips = useMyTrips();
  const mine = useMyCollections(me);
  const cols = useCollections();

  const crew = useMemo(() => splitFriendships(ships.data, me ?? ''), [ships.data, me]);

  const [applause, setApplause] = useState<Applause[] | null>(null);
  useEffect(() => {
    if (!me) { setApplause([]); return; }
    const since = new Date(Date.now() - APPLAUSE_DAYS * 86400000).toISOString();
    fetchApplause(since).then(setApplause).catch(() => setApplause([]));
  }, [me]);

  const feed = useMemo<ActivityItem[]>(
    () => buildActivity(applause ?? [], trips.data, todayISO()),
    [applause, trips.data],
  );
  // Split by tense for the two headings; `buildActivity` keeps its one
  // ordered list because the order inside each half is its to decide.
  const upcoming = feed.filter((i): i is Extract<ActivityItem, { kind: 'trip' }> => i.kind === 'trip');
  const earlier = feed.filter((i): i is Extract<ActivityItem, { kind: 'applause' }> => i.kind === 'applause');

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
    return ago.n === 1
      ? t('yesterday', 'hôm qua', '昨日')
      : t(`${ago.n} days ago`, `${ago.n} ngày trước`, `${ago.n}日前`);
  };

  // Only what EARLIER is built from. The crew edges feed REQUESTS, and
  // waiting on them blanked the feed behind a spinner on every answer's
  // reload.
  const loading = applause === null;

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

      {/* Two tenses, two headings. The one trip about to happen used to
          sit in the same card as the applause, under EARLIER — and the
          owner's screenshot (7 Oct 2026) read "“Bữa tối hai người đầu
          giờ” là ngày mai" beneath "TRƯỚC ĐÓ": a thing about to happen
          filed under things that had. The heading is drawn only when
          there is a trip to put under it; a heading over nothing is a
          label for a list of none. */}
      {upcoming.length > 0 && (
        <>
          <Text style={s.eyebrow}>{t('Upcoming', 'Sắp tới', 'これから')}</Text>
          <Card testID="upcoming-card">
            {upcoming.map((item, i) => (
              <PressableScale
                key={`t-${item.tripId}`}
                style={[s.row, i > 0 && s.rowDivider]}
                onPress={() => navigation.navigate('TripDetail', { id: item.tripId })}
                accessibilityRole="button"
              >
                {/* The accent, alone among the marks: every calendar in
                    the app is `colors.accent` and `icons.test.ts` holds
                    it to that — the day a plan turns on is the one
                    meta fact allowed the colour. The heart below is
                    tertiary like the rest of the bare glyphs. */}
                <View style={s.mark} testID="row-glyph">
                  <Ionicons name="calendar-outline" size={19} color={colors.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.line}>
                    {item.inDays === 0
                      ? t(`“${item.title}” is today`, `“${item.title}” là hôm nay`, `「${item.title}」は今日です`)
                      : item.inDays === 1
                        ? t(`“${item.title}” is tomorrow`, `“${item.title}” là ngày mai`, `「${item.title}」は明日です`)
                        : t(`“${item.title}” is in ${item.inDays} days`, `“${item.title}” còn ${item.inDays} ngày nữa`, `「${item.title}」まであと${item.inDays}日`)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} style={s.rowEnd} />
              </PressableScale>
            ))}
          </Card>
        </>
      )}

      {/* EARLIER is drawn when there is applause, while the applause is
          still on its way, or when there is nothing on the page at all —
          then it carries the quiet note, which also names the trips that
          would appear above. A trip and no applause draws no EARLIER: the
          page is not quiet, so it does not say it is. */}
      {(loading || earlier.length > 0 || upcoming.length === 0) && (
        <>
          <Text style={s.eyebrow}>{t('Earlier', 'Trước đó', 'これまで')}</Text>
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
          ) : earlier.length === 0 ? (
            <Empty text={t(
              'Quiet so far. Likes on your lists and upcoming trips will show here.',
              'Chưa có gì. Lượt thích trên các list và chuyến đi sắp tới sẽ hiện ở đây.',
              'まだ静かです。リストへのいいねや近い旅程がここに表示されます。',
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
                const who = item.liker_handle ? atHandle(item.liker_handle) : null;
                return (
                  <PressableScale
                    key={`a-${item.collection_id}-${item.at}`}
                    style={[s.row, i > 0 && s.rowDivider]}
                    onPress={title ? () => navigation.navigate('CollectionDetail', { slug: slugFor(item.collection_id, [...mine.data, ...cols.data]) ?? '' }) : undefined}
                    // A button only when it goes somewhere — VoiceOver has to
                    // hear that this row opens the list.
                    accessibilityRole={title ? 'button' : undefined}
                  >
                    <View style={s.mark} testID="row-glyph">
                      <Ionicons name="heart-outline" size={19} color={colors.textTertiary} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.line} numberOfLines={2}>
                        {who
                          ? t(`${who} liked “${title ?? '…'}”`, `${who} đã thích “${title ?? '…'}”`, `${who} が「${title ?? '…'}」にいいねしました`)
                          : t(`Someone liked “${title ?? '…'}”`, `Ai đó đã thích “${title ?? '…'}”`, `誰かが「${title ?? '…'}」にいいねしました`)}
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
        </>
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
const MARK_BOX = 26;

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

  // Top-aligned, so the mark can be set against the line's first row of
  // text; a liked list's line wraps to two on a narrow phone, and a mark
  // centred against two rows sits in the gap between them.
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 13,
    paddingHorizontal: space.cardPadding, paddingVertical: 13,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  // The row aligns its top so the mark can sit on the first line of text;
  // the chevron keeps the middle, as Profile's rows do it.
  rowEnd: { alignSelf: 'center' },
  // The mark is Profile's `RowGlyph`, to the figure: a bare 19pt outline
  // glyph, tertiary (the calendar excepted — see the row), in the well's
  // 44pt footprint, with the well gone. It was the well — 44pt, radius 13, soft coral fill under a
  // hairline — drawn to match Profile's rows while they wore one; they
  // took it off on 6 Oct 2026 (#793), and this screen opens from one of
  // them now, so a reader tapping a bare glyph and landing on a column
  // of coral boxes had met two conventions in two taps.
  //
  // The arithmetic is Profile's too: the 26pt box holds a 19pt glyph's
  // whole line, and `(21 − 26) / 2` sets its middle on the 21pt line's
  // middle, whatever the second row of text does.
  mark: {
    width: 44, height: MARK_BOX, marginTop: (LINE - MARK_BOX) / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  line: { color: colors.text, fontSize: 15, lineHeight: LINE },
});
