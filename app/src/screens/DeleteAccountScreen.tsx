// Closing the account, as a place rather than as two dialogs.
//
// WHAT THIS REPLACED, AND WHY. Two stacked `Alert.alert`s: the first
// naming what goes and what stays, the second saying "This cannot be
// undone / Delete the account now?" and nothing else. #298, which built
// them, had already written the rule that condemns the second one — "the
// server deliberately asks nothing; by the time it runs, another
// confirmation would be theatre" — and then asked twice in the UI anyway.
//
// The second alert was worse than redundant. iOS lays a two-button alert
// out side by side when the titles fit and stacks them when they do not,
// so in English — "Delete for good" beside "Keep my account" — it stacked,
// and the destructive button moved *away* from where the thumb had just
// tapped `Delete`. In Japanese (`完全に削除`, `アカウントを残す`) it fits
// on one line, the cancel goes left and the destructive goes right: the
// exact spot the previous alert's `Delete` occupied. The same two taps
// deleted an account in one language and did not in another, and nothing
// in the app decided that — UIAlertController did, from string widths.
//
// That is the `accentFaint` lesson again, one context over: what tells a
// safe action from a destructive one must not be a property that changes
// when the language does. Here the buttons are laid out by this file, and
// they are the same in all three.
//
// So the friction is not a second question. It is having to be *here* —
// somewhere you navigated to, that says whose account it is and what
// exactly it is made of. That is friction with something in it, which is
// the only kind that survives being seen twice.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthHeader, AuthScreen, DangerButton, FormError, Lede, useFailText } from '../components/authUi';
import { useAuth } from '../lib/auth';
import { atHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';
import type { Nav } from '../nav';

export default function DeleteAccountScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { email, profile, deleteAccount } = useAuth();
  const failText = useFailText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      // Nothing sets `busy` back on this path: the account is gone, the
      // session with it, and this screen leaves with them. `ProfileHome`
      // is already rendering `GuestHub` by the time it arrives.
      navigation.popToTop();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  // The list the alert had to say in one breath, given room to be a list.
  // `preferences` and `place_events` are named here and were not there,
  // which was an omission rather than a simplification: the taste profile
  // is the one thing this app collects that it made a promise about, on
  // the sign-up screen, and the person reading this screen is exactly the
  // person that promise was made to.
  const gone = [
    t('Your profile, photo and username', 'Hồ sơ, ảnh đại diện và tên người dùng', 'プロフィール・写真・ユーザー名'),
    t('Your collections, likes and trips', 'Bộ sưu tập, lượt thích và chuyến đi', 'コレクション・いいね・旅程'),
    t('Your crew, and anyone you blocked', 'Bạn bè, và những người bạn đã chặn', '友達と、ブロックした相手'),
    t('Your taste, and the places you opened', 'Gu của bạn, và những nơi bạn đã mở', '好みと、開いたスポットの記録'),
  ];

  return (
    <AuthScreen>
      <AuthHeader
        onBack={() => navigation.goBack()}
        title={t('Delete account', 'Xoá tài khoản', 'アカウントを削除')}
      />
      <Lede>{t(
        'This removes the account itself, not just this device. It cannot be undone.',
        'Việc này xoá chính tài khoản, không chỉ trên máy này. Không thể hoàn tác.',
        'この端末だけでなく、アカウントそのものが削除されます。元に戻せません。',
      )}</Lede>

      {/* Which account. Neither alert ever said, and on a phone signed
          into one thing that is easy to call unnecessary — right up until
          somebody has two and deletes the wrong one. It costs a line. */}
      <View style={s.who}>
        <Ionicons name="person-circle-outline" size={20} color={colors.textSecondary} />
        <Text style={s.whoText} numberOfLines={1}>
          {profile.handle ? atHandle(profile.handle) : email ?? ''}
        </Text>
      </View>

      <Text style={s.heading}>{t('Gone for good', 'Mất hẳn', '完全に削除されるもの')}</Text>
      <View style={s.list}>
        {gone.map((line) => (
          <View key={line} style={s.item}>
            {/* The red is on the glyph, where 3:1 is the bar it has to
                clear, and never on the sentence — the same division
                `FormError` makes and for the same measurement. */}
            <Ionicons name="close-circle" size={17} color={colors.bad} />
            <Text style={s.itemText}>{line}</Text>
          </View>
        ))}
      </View>

      {/* Said as loudly as the other half, because it is the part people
          get wrong. A café somebody added to the catalog is the catalog's
          now; deleting your account is leaving the room, not burning the
          library. */}
      <Text style={s.heading}>{t('Stays', 'Ở lại', '残るもの')}</Text>
      <View style={s.list}>
        <View style={s.item}>
          <Ionicons name="checkmark-circle" size={17} color={colors.ok} />
          <Text style={s.itemText}>{t(
            'Places you added stay in the catalog, no longer linked to you.',
            'Địa điểm bạn đã thêm vẫn ở lại catalog, không còn gắn với bạn.',
            '追加したスポットはカタログに残り、あなたとの関連は消えます。',
          )}</Text>
        </View>
      </View>

      {error ? <FormError>{failText(error)}</FormError> : null}

      <DangerButton
        label={t('Delete my account', 'Xoá tài khoản của tôi', 'アカウントを削除する')}
        onPress={remove}
        busy={busy}
      />
      {/* The way out, next to the way through, so the reader who scrolled
          to the bottom does not have to go back up to the header to
          change their mind. Not a button: two full-width controls side by
          side is a screen asking a question, and this screen has already
          asked it. */}
      <Pressable
        onPress={() => { if (!busy) navigation.goBack(); }}
        accessibilityRole="button"
        hitSlop={10}
      >
        <Text style={s.keep}>{t('Keep my account', 'Giữ tài khoản', 'アカウントを残す')}</Text>
      </Pressable>
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  who: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingVertical: 11, paddingHorizontal: 14,
    borderRadius: radius.input,
    backgroundColor: colors.surfaceGlass,
  },
  whoText: { flex: 1, color: colors.text, ...type.meta, fontWeight: font.medium },

  heading: { color: colors.textSecondary, ...type.meta, fontWeight: font.semibold, marginBottom: -space.cardGap + 4 },
  list: { gap: 9 },
  // `flex-start` rather than centre: these wrap to two lines on a narrow
  // phone in Vietnamese, and a glyph centred against two lines sits in
  // the gap between them instead of beside the first word.
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  itemText: { flex: 1, color: colors.text, ...type.meta, lineHeight: 21 },

  keep: {
    color: colors.textSecondary, fontSize: 15, fontWeight: font.medium,
    textAlign: 'center', paddingVertical: 12,
  },
});
