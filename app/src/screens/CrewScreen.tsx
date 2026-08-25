// Your crew — the people you plan with, and the people you might.
//
// Two tabs, because the screen answers two different questions and they
// arrive at different moments. **Requests** is the inbox and the outbox:
// who is waiting on you, who you are waiting on, and — new here — who
// the shelves say you would get on with. **Your friends** is the state
// you arrived at: the crew itself, and the boundaries you have drawn.
//
// One list held all of it before, and the order was a compromise nobody
// won: requests buried under the friend list on a busy account, the
// friend list pushed off-screen by three pending rows on a new one. A
// tab is the honest fix — each half gets the top of the screen when it
// is the half you came for, and the count on the Requests tab says when
// that is without you having to look.
//
// Adding by exact @handle is still the only way to reach a *particular*
// person: nobody is browsable and the lookup only ever answers about the
// one account you named. Suggestions are the other direction — the app
// naming people whose public lists overlap yours (see suggested_friends,
// which invents no visibility: every place it counts is on a public
// shelf already). The pure half of all of it — which pile an edge is in,
// what stands between two accounts, which suggestions are still open —
// lives in lib/friends, under the gate.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { FieldRow, PrimaryButton } from '../components/authUi';
import PersonSheet, { type PersonAction } from '../components/PersonSheet';
import { useReport } from '../components/reportFlow';
import {
  Avatar, Card, Empty, PressableScale, RoundIconButton, Screen, successHaptic, useTabBarClearance,
} from '../components/ui';
import { useAuth } from '../lib/auth';
import {
  acceptFriendRequest, blockUser, fetchMutualSaves, fetchProfilesById,
  fetchSuggestedFriends, type FriendProfile, profileByHandle, removeFriendship,
  searchHandles, sendFriendRequest, unblockUser, useFriendships, useMyBlocks,
} from '../lib/data';
import {
  MIN_SUGGEST_CHARS, openSuggestions, splitFriendships, standingWith,
  type Suggestion, suggestable,
} from '../lib/friends';
import { atHandle, handleProblem, normalizeHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { colors, font, gradAI, radius, space, type } from '../theme';
import type { Nav } from '../nav';

type Tab = 'requests' | 'friends';

export default function CrewScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { session } = useAuth();
  const me = session?.user?.id ?? null;
  const tabClearance = useTabBarClearance();
  const ships = useFriendships(me);
  const blocks = useMyBlocks(me);
  // The two `.reload`s are stable; their Fetch wrappers are not.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { ships.reload(); blocks.reload(); }, [ships.reload, blocks.reload]));

  const crew = useMemo(() => splitFriendships(ships.data, me ?? ''), [ships.data, me]);

  const [tab, setTab] = useState<Tab>('friends');
  // Opened on Requests when somebody is actually waiting — but only the
  // first time the edges land, and never again. A tab that re-picks
  // itself on every reload would move under a reader who chose the other
  // one, which is the difference between a helpful default and a screen
  // arguing with you.
  const chosen = useRef(false);
  useEffect(() => {
    if (chosen.current || ships.loadedAt === null) return;
    chosen.current = true;
    if (crew.incoming.length > 0) setTab('requests');
  }, [ships.loadedAt, crew.incoming.length]);

  // The names and faces behind the ids, and the shared-taste number.
  // Loaded after the edges land; a miss leaves a row with its handle
  // blank rather than the screen empty.
  const [people, setPeople] = useState<Record<string, FriendProfile>>({});
  const [mutual, setMutual] = useState<Record<string, number>>({});
  useEffect(() => {
    const ids = [
      ...crew.friends,
      ...crew.incoming.map((r) => r.requester),
      ...crew.outgoing.map((r) => r.addressee),
      ...blocks.data,
    ];
    if (!ids.length) return;
    fetchProfilesById(ids).then((more) => setPeople((prev) => ({ ...prev, ...more }))).catch(() => {});
    fetchMutualSaves(crew.friends).then(setMutual).catch(() => {});
  }, [ships.loadedAt, blocks.loadedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── introductions ──
  //
  // Asked once per visit and then trusted: the list is stable between
  // visits, and every action taken since is applied by `openSuggestions`
  // rather than by asking the server again. So a tapped row disappears
  // at the speed of the tap.
  const [suggested, setSuggested] = useState<Suggestion[]>([]);
  useEffect(() => {
    if (!me) { setSuggested([]); return; }
    fetchSuggestedFriends().then(setSuggested).catch(() => {});
  }, [me]);
  useEffect(() => {
    const ids = suggested.map((sg) => sg.other);
    if (!ids.length) return;
    fetchProfilesById(ids).then((more) => setPeople((prev) => ({ ...prev, ...more }))).catch(() => {});
  }, [suggested]);
  const intros = useMemo(
    () => openSuggestions(suggested, me ?? '', ships.data, blocks.data),
    [suggested, me, ships.data, blocks.data],
  );

  // ── the add flow ──
  const [adding, setAdding] = useState(false);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Suggestions under the field, from two typed letters up. Prefix only
  // — see `searchHandles` — debounced a beat so a fast typist costs one
  // query, not one per letter; and answers are checked against the text
  // still in the box, so a slow reply for "an" cannot overwrite the
  // suggestions for "anh" that already landed.
  const [found, setFound] = useState<FriendProfile[]>([]);
  useEffect(() => {
    const bare = normalizeHandle(handle);
    if (bare.length < MIN_SUGGEST_CHARS) { setFound([]); return; }
    const timer = setTimeout(() => {
      searchHandles(bare).then((rows) => {
        setFound((prev) => (normalizeHandle(handle) === bare ? suggestable(rows, me ?? '', blocks.data) : prev));
      }).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [handle, me, blocks.data]);

  const send = async () => {
    const bare = normalizeHandle(handle);
    if (handleProblem(bare)) {
      setNote(t('That does not look like a handle.', 'Trông không giống một username.', 'ユーザー名の形式ではありません。'));
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const who = await profileByHandle(bare);
      if (!who) {
        // The one thing the lookup may say about an absent account.
        setNote(t(`Nobody here is ${atHandle(bare)}.`, `Chưa có ai là ${atHandle(bare)}.`, `${atHandle(bare)} は見つかりませんでした。`));
        return;
      }
      const standing = standingWith(ships.data, me ?? '', who.id);
      if (standing === 'yourself') {
        setNote(t('That is you.', 'Đó chính là bạn.', 'それはあなたです。'));
      } else if (standing === 'friends') {
        setNote(t(`You and ${atHandle(who.handle)} are already friends.`, `Bạn và ${atHandle(who.handle)} đã là bạn bè.`, `${atHandle(who.handle)} とはすでに友達です。`));
      } else if (standing === 'asked') {
        setNote(t('Already asked — waiting on their answer.', 'Đã gửi lời mời — đang chờ trả lời.', 'リクエスト送信済み — 返事待ちです。'));
      } else if (standing === 'asks_you') {
        setNote(t('They already asked you — their request is above.', 'Họ đã mời bạn — lời mời ở ngay trên.', '相手からのリクエストが上にあります。'));
      } else {
        await sendFriendRequest(me!, who.id);
        setHandle('');
        setAdding(false);
        setNote(null);
        successHaptic();
        ships.reload();
      }
    } catch (e) {
      // A policy refusal is worded neutrally on purpose: the one way an
      // insert fails for a signed-in user under the cap is a block, and
      // a block must not announce itself. The cap has its own honest
      // sentence because the server names it in the count check's wake.
      const msg = (e as Error).message;
      setNote(/row-level security/i.test(msg)
        ? t('Could not send this request.', 'Không gửi được lời mời này.', 'リクエストを送信できませんでした。')
        : msg);
    } finally {
      setBusy(false);
    }
  };

  /** One tap from an introduction. No confirmation: the row says who and
   *  the ask is silent and withdrawable — a sheet here would be asking
   *  permission to be friendly. It lands in Sent, which is directly
   *  above, so the tap has somewhere visible to go. */
  const askSuggested = (id: string) => {
    sendFriendRequest(me!, id)
      .then(() => { successHaptic(); ships.reload(); })
      .catch(() => {});
  };

  const answer = (requester: string, yes: boolean) => {
    const done = yes ? acceptFriendRequest(requester, me!) : removeFriendship(requester, me!);
    done.then(() => { if (yes) successHaptic(); ships.reload(); }).catch(() => {});
  };

  // ── the ⋯ sheet ──
  //
  // One component for every person-shaped menu on this screen, because
  // the alternative was four stacked Alerts whose rows were bare verbs
  // in identical red. A sheet can say who the menu is about and what
  // each choice will actually do; see PersonSheet.
  const [sheet, setSheet] = useState<{
    name: string; meta?: string; avatar?: string; actions: PersonAction[];
  } | null>(null);
  const { report, node: reportSheet } = useReport();

  /** The row every person-shaped sheet ends with. Last, and not red:
   *  reporting is not a thing done to somebody you know, it is a thing
   *  said to the desk, and it belongs where a reader looks when the
   *  other choices were not the point. */
  const reportAction = (p: FriendProfile): PersonAction => ({
    key: 'report',
    icon: 'flag-outline',
    title: t(`Report ${atHandle(p.handle)}`, `Báo cáo ${atHandle(p.handle)}`, `${atHandle(p.handle)} を報告`),
    desc: t(
      'Tell the desk about their name, photo or bio. They are not told who reported them.',
      'Báo cho desk về tên, ảnh hoặc tiểu sử của họ. Họ không biết ai đã báo cáo.',
      '名前・写真・自己紹介についてデスクに報告します。誰が報告したかは相手に伝わりません。',
    ),
    onPress: () => report({
      kind: 'profile',
      id: p.id,
      name: p.full_name || atHandle(p.handle),
      avatarUrl: p.avatar_url || undefined,
    }),
  });

  /** The one place a native dialog is still right: the moment of no
   *  return, after the sheet has gone. */
  const askThen = (title: string, body: string, verb: string, run: () => void) => Alert.alert(
    title,
    body,
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
      { text: verb, style: 'destructive', onPress: run },
    ],
  );

  const cutEdge = (id: string) => { removeFriendship(me!, id).then(() => ships.reload()).catch(() => {}); };
  const bar = (id: string) => {
    blockUser(id).then(() => { ships.reload(); blocks.reload(); }).catch(() => {});
  };

  const blockAction = (p: FriendProfile, title: string, desc: string): PersonAction => ({
    key: 'block',
    icon: 'ban-outline',
    title,
    desc,
    destructive: true,
    onPress: () => askThen(
      t(`Block ${atHandle(p.handle)}?`, `Chặn ${atHandle(p.handle)}?`, `${atHandle(p.handle)} をブロックしますか？`),
      t('They will not be told. You can undo this from Blocked.', 'Họ sẽ không được báo. Bạn có thể bỏ chặn trong mục Đã chặn.', '相手に通知されません。ブロック中から解除できます。'),
      t('Block', 'Chặn', 'ブロック'),
      () => bar(p.id),
    ),
  });

  const openFriendSheet = (p: FriendProfile, saves?: number) => setSheet({
    name: p.full_name || atHandle(p.handle),
    meta: [atHandle(p.handle), savesLine(saves)].filter(Boolean).join(' · '),
    avatar: p.avatar_url || undefined,
    actions: [
      {
        key: 'unfriend',
        icon: 'person-remove-outline',
        title: t(`Unfriend ${atHandle(p.handle)}`, `Hủy kết bạn với ${atHandle(p.handle)}`, `${atHandle(p.handle)} と友達をやめる`),
        desc: t(
          'Take them out of your crew. They will not be told, and either of you can ask again later.',
          'Bỏ họ khỏi crew. Họ sẽ không được báo, và sau này ai cũng có thể mời lại.',
          'クルーから外します。相手に通知されず、あとでどちらからでも申請できます。',
        ),
        destructive: true,
        onPress: () => askThen(
          t(`Unfriend ${atHandle(p.handle)}?`, `Hủy kết bạn với ${atHandle(p.handle)}?`, `${atHandle(p.handle)} と友達をやめますか？`),
          t('They will not be told.', 'Họ sẽ không được báo.', '相手に通知されません。'),
          t('Unfriend', 'Hủy kết bạn', '友達をやめる'),
          () => cutEdge(p.id),
        ),
      },
      blockAction(
        p,
        t(`Block ${atHandle(p.handle)}`, `Chặn ${atHandle(p.handle)}`, `${atHandle(p.handle)} をブロック`),
        t(
          'Ends the friendship and keeps it ended: no requests either way, and their likes leave your Activity.',
          'Hủy kết bạn và giữ nguyên như vậy: không ai mời được ai, và lượt thích của họ rời khỏi Hoạt động.',
          '友達関係を解消し、以後どちらからも申請できません。相手のいいねもアクティビティから消えます。',
        ),
      ),
      reportAction(p),
    ],
  });

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
      ...(p ? [
        blockAction(
          p,
          t('Decline and block', 'Từ chối và chặn', '拒否してブロック'),
          t(
            'Refuse it and stop them asking again.',
            'Từ chối và chặn họ mời lại.',
            '拒否して、今後の申請も止めます。',
          ),
        ),
        reportAction(p),
      ] : []),
    ],
  });

  const openSentSheet = (p: FriendProfile) => setSheet({
    name: p.full_name || atHandle(p.handle),
    meta: `${atHandle(p.handle)} · ${t('waiting on their answer', 'đang chờ trả lời', '返事待ち')}`,
    avatar: p.avatar_url || undefined,
    actions: [
      {
        key: 'withdraw',
        icon: 'arrow-undo-outline',
        title: t('Cancel the request', 'Huỷ lời mời', 'リクエストを取り消す'),
        desc: t(
          'Take it back before they answer. They will not be told, and you can ask again.',
          'Rút lại trước khi họ trả lời. Họ sẽ không được báo, và bạn vẫn có thể mời lại.',
          '返事の前に取り消します。相手に通知されず、また申請できます。',
        ),
        onPress: () => cutEdge(p.id),
      },
      blockAction(
        p,
        t('Cancel and block', 'Huỷ và chặn', '取り消してブロック'),
        t(
          'Take the request back and bar the door in both directions.',
          'Rút lời mời và chặn cả hai chiều.',
          'リクエストを取り消し、双方向に連絡を止めます。',
        ),
      ),
      reportAction(p),
    ],
  });

  const confirmUnblock = (p: FriendProfile) => askThen(
    t(`Unblock ${atHandle(p.handle)}?`, `Bỏ chặn ${atHandle(p.handle)}?`, `${atHandle(p.handle)} のブロックを解除しますか？`),
    t('They will be able to send you requests again.', 'Họ sẽ có thể gửi lời mời cho bạn lại.', '相手は再びリクエストを送れるようになります。'),
    t('Unblock', 'Bỏ chặn', '解除'),
    () => { unblockUser(me!, p.id).then(() => blocks.reload()).catch(() => {}); },
  );

  /** The face, or the space one would take — every row here draws it, so
   *  a missing avatar never changes a row's height. The circle itself is
   *  `Avatar` now; what stays local is only the unwrapping of a profile
   *  that may not have arrived yet, which is this screen's own problem. */
  const Face = ({ p, size = 44 }: { p?: FriendProfile; size?: number }) => (
    <Avatar url={p?.avatar_url} size={size} />
  );

  const savesLine = (n?: number) => (n != null && n > 0
    ? (n === 1
      ? t('1 mutual save', '1 chỗ cùng lưu', '共通の保存1件')
      : t(`${n} mutual saves`, `${n} chỗ cùng lưu`, `共通の保存${n}件`))
    : '');

  const nameOf = (p?: FriendProfile) => p?.full_name || (p ? atHandle(p.handle) : '…');

  const segment = (k: Tab, label: string, count?: number) => {
    const on = tab === k;
    const inner = (
      <>
        <Text style={[s.segText, on && s.segTextOn]} numberOfLines={1}>{label}</Text>
        {count ? (
          <View style={[s.segBadge, on && s.segBadgeOn]}>
            <Text style={s.segBadgeText}>{count}</Text>
          </View>
        ) : null}
      </>
    );
    return on ? (
      <PressableScale
        containerStyle={s.segHalf}
        scaleTo={0.97}
        haptic="selection"
        onPress={() => setTab(k)}
        accessibilityRole="tab"
        accessibilityState={{ selected: true }}
      >
        {/* The gradient every committed control in this app wears, so the
            chosen tab belongs to the same family as Accept and Add. */}
        <LinearGradient {...gradAI} style={s.seg}>{inner}</LinearGradient>
      </PressableScale>
    ) : (
      <PressableScale
        containerStyle={s.segHalf}
        style={s.seg}
        scaleTo={0.97}
        haptic="selection"
        onPress={() => setTab(k)}
        accessibilityRole="tab"
        accessibilityState={{ selected: false }}
      >
        {inner}
      </PressableScale>
    );
  };

  const nothingWaiting = crew.incoming.length === 0 && crew.outgoing.length === 0 && intros.length === 0;

  return (
    <Screen
      title={t('Your crew', 'Crew của bạn', 'あなたのクルー')}
      subtitle={crew.friends.length === 1
        ? t('1 friend · plans get better together', '1 người bạn · kế hoạch vui hơn khi có nhau', '友達1人 · 計画は一緒がいい')
        : t(`${crew.friends.length} friends · plans get better together`, `${crew.friends.length} người bạn · kế hoạch vui hơn khi có nhau`, `友達${crew.friends.length}人 · 計画は一緒がいい`)}
      onBack={() => navigation.goBack()}
      right={(
        <RoundIconButton
          icon="person-add-outline"
          label={t('Add a friend', 'Thêm bạn', '友達を追加')}
          // The field belongs with the asking, so the control that opens
          // it takes you there — pressing ⊕ from the friends list and
          // getting a box on a screen about somebody else would be the
          // header talking past the page.
          onPress={() => {
            setTab('requests');
            setAdding((v) => !v);
            setNote(null);
            setFound([]);
          }}
        />
      )}
    >
      <View style={s.segments}>
        {segment('requests', t('Requests', 'Lời mời', 'リクエスト'), crew.incoming.length)}
        {segment('friends', t('Your friends', 'Bạn bè', '友達'))}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.page, paddingTop: 4, paddingBottom: tabClearance, gap: space.cardGap,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {tab === 'requests' ? (
          <>
            {adding && (
              <Card style={s.addCard}>
                <FieldRow
                  icon="at-outline"
                  label={t('Their username', 'Username của bạn ấy', '相手のユーザー名')}
                  value={handle}
                  onChangeText={setHandle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="send"
                  onSubmitEditing={send}
                  error={note}
                />
                {found.length > 0 && (
                  <View>
                    {found.map((f, i) => (
                      <PressableScale
                        key={f.id}
                        style={[s.typeRow, i > 0 && s.rowDivider]}
                        scaleTo={0.97}
                        onPress={() => { setHandle(f.handle); setFound([]); setNote(null); }}
                        accessibilityRole="button"
                        accessibilityLabel={atHandle(f.handle)}
                      >
                        <Face p={f} size={30} />
                        <Text style={s.typeName} numberOfLines={1}>{nameOf(f)}</Text>
                        <Text style={s.typeHandle} numberOfLines={1}>{atHandle(f.handle)}</Text>
                      </PressableScale>
                    ))}
                  </View>
                )}
                <PrimaryButton label={t('Send request', 'Gửi lời mời', 'リクエスト送信')} onPress={send} busy={busy} />
              </Card>
            )}

            {/* Answered here as well as in Activity, and that is not a
                duplicate: Activity is what happened while you were away,
                this is the desk where the crew is managed. Both reach
                the same two verbs. */}
            {crew.incoming.length > 0 && (
              <>
                <Text style={s.head}>{t('Pending', 'Đang chờ', '保留中')}</Text>
                {crew.incoming.map((r) => {
                  const p = people[r.requester];
                  return (
                    <Card key={r.requester} style={s.reqCard}>
                      <View style={s.reqTop}>
                        <Face p={p} size={46} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={s.reqTitle}>
                            <Text style={{ fontWeight: font.bold }}>{nameOf(p)}</Text>
                            {' '}
                            {t('wants to join your crew', 'muốn tham gia crew của bạn', 'がクルーに参加したがっています')}
                          </Text>
                          {p ? <Text style={s.meta}>{atHandle(p.handle)}</Text> : null}
                        </View>
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
                        >
                          <Text style={s.declineText}>{t('Decline', 'Từ chối', '拒否')}</Text>
                        </PressableScale>
                      </View>
                    </Card>
                  );
                })}
              </>
            )}

            {/* What you asked and are still waiting on. Without this the
                send looked like it vanished — the request lived only on
                the other person's screen. */}
            {crew.outgoing.length > 0 && (
              <>
                <Text style={s.head}>{t('Sent', 'Đã gửi', '送信済み')}</Text>
                <Card>
                  {crew.outgoing.map((r, i) => {
                    const p = people[r.addressee];
                    return (
                      <View key={r.addressee} style={[s.row, i > 0 && s.rowDivider]}>
                        <Face p={p} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={s.name} numberOfLines={1}>{nameOf(p)}</Text>
                          <Text style={s.meta} numberOfLines={1}>
                            {p ? `${atHandle(p.handle)} · ` : ''}
                            {t('waiting on their answer', 'đang chờ trả lời', '返事待ち')}
                          </Text>
                        </View>
                        <PressableScale style={s.quietBtn} onPress={() => p && openSentSheet(p)} accessibilityRole="button">
                          <Text style={s.quietText}>{t('Cancel', 'Huỷ', '取り消す')}</Text>
                        </PressableScale>
                      </View>
                    );
                  })}
                </Card>
              </>
            )}

            {/* The introductions. The heading carries its own reason —
                a suggested stranger with no stated basis reads as the
                app guessing, and this one is not guessing: these are
                people whose public lists hold the places yours do. */}
            {intros.length > 0 && (
              <>
                <Text style={s.head}>
                  {t('Suggested · you save the same places', 'Gợi ý · cùng lưu những chỗ giống nhau', 'おすすめ · 同じスポットを保存')}
                </Text>
                <Card>
                  {intros.map((sg, i) => {
                    const p = people[sg.other];
                    return (
                      <View key={sg.other} style={[s.row, i > 0 && s.rowDivider]}>
                        <Face p={p} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={s.name} numberOfLines={1}>{nameOf(p)}</Text>
                          <Text style={s.meta} numberOfLines={1}>
                            {p ? `${atHandle(p.handle)} · ` : ''}{savesLine(sg.mutual)}
                          </Text>
                        </View>
                        <PressableScale onPress={() => askSuggested(sg.other)} scaleTo={0.94} accessibilityRole="button">
                          <LinearGradient {...gradAI} style={s.addBtn}>
                            <Ionicons name="person-add-outline" size={15} color={colors.accentInk} />
                            <Text style={s.addText}>{t('Add', 'Thêm', '追加')}</Text>
                          </LinearGradient>
                        </PressableScale>
                      </View>
                    );
                  })}
                </Card>
              </>
            )}

            {nothingWaiting && (ships.loading ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} />
            ) : (
              <Empty text={t(
                'Nothing waiting. Add someone by username — and anyone who saves the places you save will turn up here.',
                'Chưa có gì. Thêm bạn bằng username — và những người cùng lưu các chỗ giống bạn sẽ hiện ở đây.',
                '今は何もありません。ユーザー名で追加してみましょう — 同じスポットを保存している人もここに出てきます。',
              )} />
            ))}
          </>
        ) : (
          <>
            {crew.friends.length > 0 ? (
              <Card>
                {crew.friends.map((id, i) => {
                  const p = people[id];
                  return (
                    <PressableScale
                      key={id}
                      style={[s.row, i > 0 && s.rowDivider]}
                      onLongPress={() => p && openFriendSheet(p, mutual[id])}
                      accessibilityLabel={p ? atHandle(p.handle) : id}
                    >
                      <Face p={p} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={s.name} numberOfLines={1}>{nameOf(p)}</Text>
                        <Text style={s.meta} numberOfLines={1}>
                          {p ? atHandle(p.handle) : ''}
                          {mutual[id] ? ` · ${savesLine(mutual[id])}` : ''}
                        </Text>
                      </View>
                      {/* The visible door to Unfriend and Block. The
                          long-press stays, but a gesture with no mark on
                          the screen is a feature only its author knows
                          about. */}
                      <PressableScale
                        onPress={() => p && openFriendSheet(p, mutual[id])}
                        scaleTo={0.85}
                        hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel={t('Options', 'Tuỳ chọn', 'オプション')}
                      >
                        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textTertiary} />
                      </PressableScale>
                    </PressableScale>
                  );
                })}
              </Card>
            ) : ships.loading ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} />
            ) : (
              <Empty text={t(
                'No friends yet. Ask for a username and add them here.',
                'Chưa có bạn nào. Hỏi username của bạn bè rồi thêm ở đây.',
                'まだ友達がいません。ユーザー名を聞いて追加しましょう。',
              )} />
            )}

            {/* The boundary, visible and reversible — a block managed
                from the same screen it was made on, per the store
                guideline that asks for the control and the plain decency
                that asks for the undo. */}
            {blocks.data.length > 0 && (
              <>
                <Text style={s.head}>{t('Blocked', 'Đã chặn', 'ブロック中')}</Text>
                <Card>
                  {blocks.data.map((id, i) => {
                    const p = people[id];
                    return (
                      <View key={id} style={[s.row, i > 0 && s.rowDivider]}>
                        <Face p={p} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={s.name} numberOfLines={1}>{nameOf(p)}</Text>
                          <Text style={s.meta} numberOfLines={1}>{p ? atHandle(p.handle) : ''}</Text>
                        </View>
                        <PressableScale style={s.quietBtn} onPress={() => p && confirmUnblock(p)} accessibilityRole="button">
                          <Text style={s.quietText}>{t('Unblock', 'Bỏ chặn', '解除')}</Text>
                        </PressableScale>
                      </View>
                    );
                  })}
                </Card>
              </>
            )}
          </>
        )}
      </ScrollView>

      <PersonSheet
        visible={sheet !== null}
        name={sheet?.name ?? ''}
        meta={sheet?.meta}
        avatarUrl={sheet?.avatar}
        actions={sheet?.actions ?? []}
        onClose={() => setSheet(null)}
      />
      {reportSheet}
    </Screen>
  );
}

const s = StyleSheet.create({
  // The switch. A tray with two halves rather than an underline, because
  // the two sides are peers — neither is "the page" with the other as a
  // filter of it.
  segments: {
    flexDirection: 'row', gap: 4,
    marginHorizontal: space.page, marginBottom: 12,
    padding: 4,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.pill,
  },
  segHalf: { flex: 1 },
  seg: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 11, borderRadius: radius.pill,
  },
  segText: { color: colors.textSecondary, fontSize: 14.5, fontWeight: font.semibold },
  segTextOn: { color: colors.accentInk },
  // On the unchosen half the badge is the coral itself; on the chosen
  // one the ground is already coral, so the badge darkens instead —
  // same mark, legible on either.
  segBadge: {
    minWidth: 21, height: 21, borderRadius: 10.5, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.badgeSolid,
  },
  segBadgeOn: { backgroundColor: 'rgba(20,19,16,0.20)' },
  segBadgeText: { color: colors.accentInk, fontSize: 12.5, fontWeight: font.semibold },

  addCard: { padding: space.cardPadding, gap: 12 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  typeName: { color: colors.text, fontSize: 14.5, fontWeight: font.medium, flexShrink: 1 },
  typeHandle: { color: colors.textTertiary, fontSize: 13.5 },

  head: {
    color: colors.textTertiary, fontSize: 12.5, fontWeight: font.semibold,
    letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 6,
  },

  reqCard: { padding: space.cardPadding, gap: 14 },
  reqTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reqTitle: { color: colors.text, fontSize: 15.5, lineHeight: 21 },
  answers: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  accept: {
    flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill, paddingVertical: 11,
  },
  acceptText: { color: colors.accentInk, fontSize: 15, fontWeight: font.semibold },
  decline: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderGlass, borderRadius: radius.pill, paddingVertical: 11,
  },
  declineText: { color: colors.textSecondary, fontSize: 15, fontWeight: font.semibold },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: space.cardPadding, paddingVertical: 13,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  name: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  meta: { color: colors.textTertiary, ...type.meta },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9,
  },
  addText: { color: colors.accentInk, fontSize: 13.5, fontWeight: font.semibold },

  // The two reversals — cancel a request, lift a block — wear the same
  // quiet outline: neither is a thing to encourage, both must be easy.
  quietBtn: {
    borderWidth: 1, borderColor: colors.borderGlass, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  quietText: { color: colors.textSecondary, fontSize: 13.5, fontWeight: font.semibold },
});
