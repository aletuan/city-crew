// Your crew — the people you plan with.
//
// Three things live here and nothing else: the friends you have, the
// door for adding one, and a banner for requests waiting on your answer.
// The requests themselves are answered on the Activity screen — this
// list is for the state you arrived at, that one is for the things that
// happened while you were away.
//
// Adding is by exact @handle, deliberately. There is no browse and no
// fuzzy search: nobody can be stumbled upon, a friend hands you their
// handle the same way they would hand you a phone number, and the lookup
// only ever answers about the one account you named. The pure half of
// all of this — which pile an edge belongs to, what stands between two
// accounts — lives in lib/friends, under the gate.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { FieldRow, PrimaryButton } from '../components/authUi';
import {
  Card, Empty, PressableScale, RoundIconButton, Screen, useTabBarClearance,
} from '../components/ui';
import { useAuth } from '../lib/auth';
import {
  blockUser, fetchMutualSaves, fetchProfilesById, type FriendProfile,
  profileByHandle, removeFriendship, searchHandles, sendFriendRequest,
  unblockUser, useFriendships, useMyBlocks,
} from '../lib/data';
import { MIN_SUGGEST_CHARS, splitFriendships, standingWith, suggestable } from '../lib/friends';
import { atHandle, handleProblem, normalizeHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';
import type { Nav } from '../nav';

export default function CrewScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { session } = useAuth();
  const me = session?.user?.id ?? null;
  const tabClearance = useTabBarClearance();
  const ships = useFriendships(me);
  const blocks = useMyBlocks(me);
  useFocusEffect(useCallback(() => { ships.reload(); blocks.reload(); }, [ships.reload, blocks.reload]));

  const crew = useMemo(() => splitFriendships(ships.data, me ?? ''), [ships.data, me]);

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
    fetchProfilesById(ids).then(setPeople).catch(() => {});
    fetchMutualSaves(crew.friends).then(setMutual).catch(() => {});
  }, [ships.loadedAt, blocks.loadedAt]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [handle, me, blocks.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    const bare = normalizeHandle(handle);
    if (handleProblem(bare)) {
      setNote(t('That does not look like a handle.', 'Trông không giống một username.', 'ユーザー名の形式ではありません。'));
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const found = await profileByHandle(bare);
      if (!found) {
        // The one thing the lookup may say about an absent account.
        setNote(t(`Nobody here is ${atHandle(bare)}.`, `Chưa có ai là ${atHandle(bare)}.`, `${atHandle(bare)} は見つかりませんでした。`));
        return;
      }
      const standing = standingWith(ships.data, me ?? '', found.id);
      if (standing === 'yourself') {
        setNote(t('That is you.', 'Đó chính là bạn.', 'それはあなたです。'));
      } else if (standing === 'friends') {
        setNote(t(`You and ${atHandle(found.handle)} are already friends.`, `Bạn và ${atHandle(found.handle)} đã là bạn bè.`, `${atHandle(found.handle)} とはすでに友達です。`));
      } else if (standing === 'asked') {
        setNote(t('Already asked — waiting on their answer.', 'Đã gửi lời mời — đang chờ trả lời.', 'リクエスト送信済み — 返事待ちです。'));
      } else if (standing === 'asks_you') {
        setNote(t('They already asked you — answer in Activity.', 'Họ đã mời bạn — trả lời trong Hoạt động.', '相手からリクエストが来ています — アクティビティで返事を。'));
      } else {
        await sendFriendRequest(me!, found.id);
        setHandle('');
        setAdding(false);
        setNote(null);
        ships.reload();
        Alert.alert(
          t('Request sent', 'Đã gửi lời mời', 'リクエストを送信しました'),
          t(`${atHandle(found.handle)} will see it next time they open the app.`, `${atHandle(found.handle)} sẽ thấy lời mời khi mở app.`, `${atHandle(found.handle)} がアプリを開くと表示されます。`),
        );
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

  // One sheet, both boundaries. Unfriend cuts the edge and nothing else;
  // Block cuts it and keeps it cut — no future request from either side
  // gets through, and their likes leave your Activity. Neither is
  // announced to the other person.
  const confirmUnfriend = (p: FriendProfile) => Alert.alert(
    atHandle(p.handle),
    t('They will not be told either way.', 'Họ sẽ không được báo, dù chọn gì.', 'どちらを選んでも相手に通知されません。'),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
      {
        text: t('Unfriend', 'Hủy kết bạn', '友達をやめる'),
        style: 'destructive',
        onPress: () => { removeFriendship(me!, p.id).then(() => ships.reload()).catch(() => {}); },
      },
      {
        text: t('Block', 'Chặn', 'ブロック'),
        style: 'destructive',
        onPress: () => {
          blockUser(p.id)
            .then(() => { ships.reload(); blocks.reload(); })
            .catch(() => {});
        },
      },
    ],
  );

  // Withdrawing is the same delete declining is — see the migration —
  // and just as silent: the other person is never told a request was
  // taken back, any more than they are told one was refused.
  const confirmWithdraw = (p: FriendProfile) => Alert.alert(
    t(`Cancel the request to ${atHandle(p.handle)}?`, `Huỷ lời mời tới ${atHandle(p.handle)}?`, `${atHandle(p.handle)} へのリクエストを取り消しますか？`),
    t('They will not be told.', 'Họ sẽ không được báo.', '相手に通知されません。'),
    [
      { text: t('Keep waiting', 'Chờ tiếp', 'このまま待つ'), style: 'cancel' },
      {
        text: t('Cancel request', 'Huỷ lời mời', '取り消す'),
        style: 'destructive',
        onPress: () => { removeFriendship(me!, p.id).then(() => ships.reload()).catch(() => {}); },
      },
    ],
  );

  const confirmUnblock = (p: FriendProfile) => Alert.alert(
    t(`Unblock ${atHandle(p.handle)}?`, `Bỏ chặn ${atHandle(p.handle)}?`, `${atHandle(p.handle)} のブロックを解除しますか？`),
    t('They will be able to send you requests again.', 'Họ sẽ có thể gửi lời mời cho bạn lại.', '相手は再びリクエストを送れるようになります。'),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
      {
        text: t('Unblock', 'Bỏ chặn', '解除'),
        onPress: () => { unblockUser(me!, p.id).then(() => blocks.reload()).catch(() => {}); },
      },
    ],
  );

  // The one header every pushed screen wears — Screen's inline form,
  // with its measured column (2pt gap, 13.5pt subtitle in textSecondary).
  // The first cut hand-rolled this with a negative margin and the wrong
  // tokens, and the subtitle sat cramped against the title in a way no
  // other screen's does.
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
          onPress={() => { setAdding((v) => !v); setNote(null); setFound([]); }}
        />
      )}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.page, paddingBottom: tabClearance, gap: space.cardGap,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

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
                  style={[s.suggestRow, i > 0 && s.suggestDivider]}
                  scaleTo={0.97}
                  onPress={() => { setHandle(f.handle); setFound([]); setNote(null); }}
                  accessibilityRole="button"
                  accessibilityLabel={atHandle(f.handle)}
                >
                  {f.avatar_url
                    ? <Image source={{ uri: f.avatar_url }} style={s.suggestFace} contentFit="cover" transition={120} />
                    : (
                      <View style={[s.suggestFace, s.faceBlank]}>
                        <Ionicons name="person-outline" size={14} color={colors.textTertiary} />
                      </View>
                    )}
                  <Text style={s.suggestName} numberOfLines={1}>{f.full_name || atHandle(f.handle)}</Text>
                  <Text style={s.suggestHandle} numberOfLines={1}>{atHandle(f.handle)}</Text>
                </PressableScale>
              ))}
            </View>
          )}
          {/* The same button every form in this app commits with —
              gradient, busy spinner and all — instead of a one-off solid
              accent pill that read darker than everything around it. */}
          <PrimaryButton label={t('Send request', 'Gửi lời mời', 'リクエスト送信')} onPress={send} busy={busy} />
        </Card>
      )}

      {crew.incoming.length > 0 && (
        <PressableScale style={s.waiting} onPress={() => navigation.navigate('Activity')}>
          <View>
            <Ionicons name="people-outline" size={20} color={colors.accent} />
            <View style={s.dot} />
          </View>
          <Text style={s.waitingText}>
            {crew.incoming.length === 1
              ? t('1 request waiting', '1 lời mời đang chờ', 'リクエストが1件待っています')
              : t(`${crew.incoming.length} requests waiting`, `${crew.incoming.length} lời mời đang chờ`, `リクエストが${crew.incoming.length}件待っています`)}
          </Text>
          <Ionicons name="chevron-forward" size={17} color={colors.accent} />
        </PressableScale>
      )}

      {/* What you asked and are still waiting on. Without this the send
          looked like it vanished — the request lived only on the other
          person's screen. The row answers the only two questions a
          sender has: is it still pending, and how do I take it back. */}
      {crew.outgoing.length > 0 && (
        <>
          <Text style={s.sentHead}>{t('Sent', 'Đã gửi', '送信済み')}</Text>
          <Card>
            {crew.outgoing.map((r, i) => {
              const p = people[r.addressee];
              return (
                <View key={r.addressee} style={[s.row, i > 0 && s.rowDivider]}>
                  {p?.avatar_url
                    ? <Image source={{ uri: p.avatar_url }} style={s.face} contentFit="cover" transition={150} />
                    : (
                      <View style={[s.face, s.faceBlank]}>
                        <Ionicons name="person-outline" size={18} color={colors.textTertiary} />
                      </View>
                    )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.name} numberOfLines={1}>{p?.full_name || (p ? atHandle(p.handle) : '…')}</Text>
                    <Text style={s.meta} numberOfLines={1}>
                      {p ? `${atHandle(p.handle)} · ` : ''}
                      {t('waiting on their answer', 'đang chờ trả lời', '返事待ち')}
                    </Text>
                  </View>
                  <PressableScale style={s.withdrawBtn} onPress={() => p && confirmWithdraw(p)} accessibilityRole="button">
                    <Text style={s.withdrawText}>{t('Cancel', 'Huỷ', '取り消す')}</Text>
                  </PressableScale>
                </View>
              );
            })}
          </Card>
        </>
      )}

      {crew.friends.length > 0 ? (
        <Card>
          {crew.friends.map((id, i) => {
            const p = people[id];
            const saves = mutual[id];
            return (
              <PressableScale
                key={id}
                style={[s.row, i > 0 && s.rowDivider]}
                onLongPress={() => p && confirmUnfriend(p)}
                accessibilityLabel={p ? atHandle(p.handle) : id}
              >
                {p?.avatar_url
                  ? <Image source={{ uri: p.avatar_url }} style={s.face} contentFit="cover" transition={150} />
                  : (
                    <View style={[s.face, s.faceBlank]}>
                      <Ionicons name="person-outline" size={18} color={colors.textTertiary} />
                    </View>
                  )}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.name} numberOfLines={1}>{p?.full_name || (p ? atHandle(p.handle) : '…')}</Text>
                  <Text style={s.meta} numberOfLines={1}>
                    {p ? atHandle(p.handle) : ''}
                    {saves != null && saves > 0
                      ? ` · ${saves === 1
                        ? t('1 mutual save', '1 chỗ cùng lưu', '共通の保存1件')
                        : t(`${saves} mutual saves`, `${saves} chỗ cùng lưu`, `共通の保存${saves}件`)}`
                      : ''}
                  </Text>
                </View>
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

      {/* The boundary, visible and reversible — a block managed from the
          same screen it was made on, per the store guideline that asks
          for the control and the plain decency that asks for the undo. */}
      {blocks.data.length > 0 && (
        <>
          <Text style={s.blockedHead}>{t('Blocked', 'Đã chặn', 'ブロック中')}</Text>
          <Card>
            {blocks.data.map((id, i) => {
              const p = people[id];
              return (
                <View key={id} style={[s.row, i > 0 && s.rowDivider]}>
                  {p?.avatar_url
                    ? <Image source={{ uri: p.avatar_url }} style={s.face} contentFit="cover" transition={150} />
                    : (
                      <View style={[s.face, s.faceBlank]}>
                        <Ionicons name="person-outline" size={18} color={colors.textTertiary} />
                      </View>
                    )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.name} numberOfLines={1}>{p?.full_name || (p ? atHandle(p.handle) : '…')}</Text>
                    <Text style={s.meta} numberOfLines={1}>{p ? atHandle(p.handle) : ''}</Text>
                  </View>
                  <PressableScale style={s.unblockBtn} onPress={() => p && confirmUnblock(p)} accessibilityRole="button">
                    <Text style={s.unblockText}>{t('Unblock', 'Bỏ chặn', '解除')}</Text>
                  </PressableScale>
                </View>
              );
            })}
          </Card>
        </>
      )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  addCard: { padding: space.cardPadding, gap: 12 },
  suggestRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9,
  },
  suggestDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  suggestFace: { width: 30, height: 30, borderRadius: 15 },
  suggestName: { color: colors.text, fontSize: 14.5, fontWeight: font.medium, flexShrink: 1 },
  suggestHandle: { color: colors.textTertiary, fontSize: 13.5 },

  waiting: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accentLine, borderRadius: radius.card,
    paddingHorizontal: space.cardPadding, paddingVertical: 14,
  },
  dot: {
    position: 'absolute', top: -2, right: -4,
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent,
  },
  waitingText: { flex: 1, color: colors.text, fontSize: 15.5, fontWeight: font.semibold },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: space.cardPadding, paddingVertical: 13,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  face: { width: 44, height: 44, borderRadius: 22 },
  faceBlank: {
    backgroundColor: colors.surfaceGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  meta: { color: colors.textTertiary, ...type.meta },

  sentHead: {
    color: colors.textTertiary, fontSize: 12.5, fontWeight: font.semibold,
    letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 8,
  },
  withdrawBtn: {
    borderWidth: 1, borderColor: colors.borderGlass, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  withdrawText: { color: colors.textSecondary, fontSize: 13.5, fontWeight: font.semibold },

  blockedHead: {
    color: colors.textTertiary, fontSize: 12.5, fontWeight: font.semibold,
    letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 8,
  },
  unblockBtn: {
    borderWidth: 1, borderColor: colors.borderGlass, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  unblockText: { color: colors.textSecondary, fontSize: 13.5, fontWeight: font.semibold },
});
