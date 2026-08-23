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
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { AuthHeader, AuthScreen, FieldRow } from '../components/authUi';
import { Card, Empty, PressableScale, RoundIconButton } from '../components/ui';
import { useAuth } from '../lib/auth';
import {
  fetchMutualSaves, fetchProfilesById, type FriendProfile, profileByHandle,
  removeFriendship, sendFriendRequest, useFriendships,
} from '../lib/data';
import { splitFriendships, standingWith } from '../lib/friends';
import { atHandle, handleProblem, normalizeHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';
import type { Nav } from '../nav';

export default function CrewScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { session } = useAuth();
  const me = session?.user?.id ?? null;
  const ships = useFriendships(me);
  useFocusEffect(useCallback(() => { ships.reload(); }, [ships.reload]));

  const crew = useMemo(() => splitFriendships(ships.data, me ?? ''), [ships.data, me]);

  // The names and faces behind the ids, and the shared-taste number.
  // Loaded after the edges land; a miss leaves a row with its handle
  // blank rather than the screen empty.
  const [people, setPeople] = useState<Record<string, FriendProfile>>({});
  const [mutual, setMutual] = useState<Record<string, number>>({});
  useEffect(() => {
    const ids = [...crew.friends, ...crew.incoming.map((r) => r.requester)];
    if (!ids.length) return;
    fetchProfilesById(ids).then(setPeople).catch(() => {});
    fetchMutualSaves(crew.friends).then(setMutual).catch(() => {});
  }, [ships.loadedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── the add flow ──
  const [adding, setAdding] = useState(false);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

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
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmUnfriend = (p: FriendProfile) => Alert.alert(
    t(`Unfriend ${atHandle(p.handle)}?`, `Hủy kết bạn với ${atHandle(p.handle)}?`, `${atHandle(p.handle)} と友達をやめますか？`),
    t('They will not be told.', 'Họ sẽ không được báo.', '相手に通知されません。'),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
      {
        text: t('Unfriend', 'Hủy kết bạn', '友達をやめる'),
        style: 'destructive',
        onPress: () => { removeFriendship(me!, p.id).then(() => ships.reload()).catch(() => {}); },
      },
    ],
  );

  return (
    <AuthScreen>
      <View style={s.headRow}>
        <View style={{ flex: 1 }}>
          <AuthHeader onBack={() => navigation.goBack()} title={t('Your crew', 'Crew của bạn', 'あなたのクルー')} />
          <Text style={s.sub}>
            {crew.friends.length === 1
              ? t('1 friend · plans get better together', '1 người bạn · kế hoạch vui hơn khi có nhau', '友達1人 · 計画は一緒がいい')
              : t(`${crew.friends.length} friends · plans get better together`, `${crew.friends.length} người bạn · kế hoạch vui hơn khi có nhau`, `友達${crew.friends.length}人 · 計画は一緒がいい`)}
          </Text>
        </View>
        <RoundIconButton
          icon="person-add-outline"
          label={t('Add a friend', 'Thêm bạn', '友達を追加')}
          onPress={() => { setAdding((v) => !v); setNote(null); }}
        />
      </View>

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
          <PressableScale style={s.sendBtn} onPress={send} accessibilityRole="button">
            {busy
              ? <ActivityIndicator color={colors.accentInk} size="small" />
              : <Text style={s.sendText}>{t('Send request', 'Gửi lời mời', 'リクエスト送信')}</Text>}
          </PressableScale>
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
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sub: { color: colors.textTertiary, ...type.meta, marginTop: -6, marginBottom: 4 },

  addCard: { padding: space.cardPadding, gap: 12 },
  sendBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingHorizontal: 18, paddingVertical: 10,
    minWidth: 132, alignItems: 'center',
  },
  sendText: { color: colors.accentInk, fontSize: 14.5, fontWeight: font.semibold },

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
});
