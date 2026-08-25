// Activity — what happened while you were away.
//
// Two sections, two kinds of thing. REQUESTS are questions: somebody
// asked to join your crew and the card carries the only two answers.
// EARLIER is news: applause on your lists, and the one trip about to
// happen. News rows do nothing on tap except the applause rows, which
// open the list that earned it.
//
// The applause comes through `likes_on_mine`, which names every liker
// to the one person allowed to ask — the owner of the list. "Someone
// liked…" survives only as the fallback for a liker whose profile is
// gone. See the named_applause migration for why the owner is not
// "the public" that the likes table's privacy promise protects against.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { AuthHeader, AuthScreen } from '../components/authUi';
import PersonSheet, { type PersonAction } from '../components/PersonSheet';
import { useReport } from '../components/reportFlow';
import { Avatar, Card, Empty, PressableScale, successHaptic } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useCollections } from '../lib/catalog';
import {
  acceptFriendRequest, blockUser, fetchApplause, fetchProfilesById,
  type FriendProfile, removeFriendship, useFriendships, useMyCollections,
  useMyTrips,
} from '../lib/data';
import { todayISO } from '../lib/day';
import {
  type ActivityItem, agoOf, type Applause, buildActivity, splitFriendships,
} from '../lib/friends';
import { atHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
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
  const ships = useFriendships(me);
  const trips = useMyTrips(me);
  const mine = useMyCollections(me);
  const cols = useCollections();
  // `ships.reload` is stable; `ships` is a new object on every load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { ships.reload(); }, [ships.reload]));

  const crew = useMemo(() => splitFriendships(ships.data, me ?? ''), [ships.data, me]);

  const [askers, setAskers] = useState<Record<string, FriendProfile>>({});
  useEffect(() => {
    const ids = crew.incoming.map((r) => r.requester);
    if (ids.length) fetchProfilesById(ids).then(setAskers).catch(() => {});
  }, [ships.loadedAt]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // A collection id is what the applause carries; the title is what the
  // reader needs. Both shelves are searched — the liked list is yours,
  // but "yours" spans the desk shelf and your own.
  const titleOf = (collectionId: string): string | null => {
    for (const c of [...mine.data, ...cols.data]) {
      if (c.id === collectionId) return t(c.title_en, c.title_vi, c.title_ja);
    }
    return null;
  };

  const answer = (requester: string, yes: boolean) => {
    const done = yes
      ? acceptFriendRequest(requester, me!)
      : removeFriendship(requester, me!);
    done.then(() => { if (yes) successHaptic(); ships.reload(); }).catch(() => {});
  };

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
              onPress: () => { blockUser(requester).then(() => ships.reload()).catch(() => {}); },
            },
          ],
        ),
      },
      ...(p ? [{
        key: 'report',
        icon: 'flag-outline' as const,
        title: t(`Report ${atHandle(p.handle)}`, `Báo cáo ${atHandle(p.handle)}`, `${atHandle(p.handle)} を報告`),
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

  const loading = ships.loading || applause === null;

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
                  <PressableScale containerStyle={s.half} onPress={() => answer(r.requester, true)} accessibilityRole="button">
                    <LinearGradient {...gradAI} style={s.accept}>
                      <Ionicons name="checkmark" size={17} color={colors.accentInk} />
                      <Text style={s.acceptText}>{t('Accept', 'Đồng ý', '承認')}</Text>
                    </LinearGradient>
                  </PressableScale>
                  <PressableScale
                    containerStyle={s.half}
                    style={s.decline}
                    onPress={() => answer(r.requester, false)}
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
      ) : feed.length === 0 ? (
        <Empty text={t(
          'Quiet so far. Likes on your lists and upcoming trips will show here.',
          'Chưa có gì. Lượt thích trên các list và chuyến đi sắp tới sẽ hiện ở đây.',
          'まだ静かです。リストへのいいねや近い旅程がここに表示されます。',
        )} />
      ) : (
        <Card>
          {feed.map((item, i) => {
            if (item.kind === 'trip') {
              return (
                <View key={`t-${item.tripId}`} style={[s.row, i > 0 && s.rowDivider]}>
                  <View style={s.mark}>
                    <Ionicons name="calendar-outline" size={20} color={colors.accent} />
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
                </View>
              );
            }
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
              >
                <View style={s.mark}>
                  <Ionicons name="heart-outline" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.line} numberOfLines={2}>
                    {who
                      ? t(`${who} liked “${title ?? '…'}”`, `${who} đã thích “${title ?? '…'}”`, `${who} が「${title ?? '…'}」にいいねしました`)
                      : t(`Someone liked “${title ?? '…'}”`, `Ai đó đã thích “${title ?? '…'}”`, `誰かが「${title ?? '…'}」にいいねしました`)}
                  </Text>
                  <Text style={s.meta}>{agoLabel(item.at)}</Text>
                </View>
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

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: space.cardPadding, paddingVertical: 13,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  // The same box Profile's RoundIcon draws — 44pt, radius 13, soft fill
  // under a hairline, outline glyph at 20 — so the feed's marks and the
  // settings rows' read as one family. Filled glyphs at solid accent
  // were the "darker" the review named: in the light theme accent is a
  // brick, and a filled heart of it carries far more ink than the
  // outline the rest of the app draws.
  mark: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  line: { color: colors.text, fontSize: 15, lineHeight: 21 },
});
