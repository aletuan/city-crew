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
import { Avatar, Card } from '../components/ui';
import { useAuth } from '../lib/auth';
import { atHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { colors, font, space, type } from '../theme';
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
  //
  // No "Your" on any row. The card says whose account this is one row
  // above; repeating it four times is four words that carry nothing.
  //
  // "history", not "activity" and not "places you viewed". `Activity` is
  // a screen in this same stack and means something else entirely — what
  // other people did while you were away — and one word cannot mean both
  // on adjacent screens. "Viewed" is too narrow the other way: the table
  // records opening, saving, unsaving, and keeping or dropping a place
  // from a plan, which is four verbs. `History` is what Edit profile
  // already calls this exact data on its own delete button, which makes
  // it the only name a reader could have met before.
  //
  // EVERY ROW IS THE APP'S OWN WORD, IN ALL THREE. That rule is why the
  // English row says "history", and applying it only to English is how
  // three of these came out wrong the first time. A list of what an
  // account is made of has to use the names that account's other screens
  // use, or the reader is being asked to trust a summary written in
  // vocabulary they have never been shown:
  //
  //   crew     `CrewScreen` keeps the English word in Vietnamese — "Crew
  //            của bạn" — and uses クルー in Japanese. "Bạn bè" and 友達
  //            were a translation of the English concept rather than of
  //            this app's word for it.
  //   blocked  "Đã chặn" / "ブロック中", the heading over the blocked list
  //            in that same screen.
  //   taste    "Sở thích" / "興味", the label on the profile's own
  //            interests row and on the picker in Edit profile.
  //   catalog  Said to a reader nowhere in this app, in any language: it
  //            is a word from the code comments. Vietnamese and Japanese
  //            name the product instead, which is what the sign-up lede
  //            and the history note already do.
  const gone = [
    t('Profile, photo and username', 'Hồ sơ, ảnh đại diện và tên người dùng', 'プロフィール・写真・ユーザー名'),
    t('Collections, likes and trips', 'Bộ sưu tập, lượt thích và chuyến đi', 'コレクション・いいね・旅程'),
    t('Crew and blocked accounts', 'Crew và tài khoản đã chặn', 'クルーとブロック中のアカウント'),
    t('Taste preferences and history', 'Sở thích và lịch sử', '興味と履歴'),
  ];

  return (
    <AuthScreen>
      <AuthHeader
        onBack={() => navigation.goBack()}
        title={t('Delete account', 'Xoá tài khoản', 'アカウントを削除')}
      />
      <Lede>{t(
        "Permanently delete your account and personal data. This action can't be undone.",
        'Xoá vĩnh viễn tài khoản và dữ liệu cá nhân của bạn. Hành động này không thể hoàn tác.',
        'アカウントと個人データを完全に削除します。この操作は元に戻せません。',
      )}</Lede>

      {/* One card, three parts: whose account, what it is made of, and
          what outlives it. The card is not decoration — it is what every
          other grouped list in the Profile stack wears (settings, Legal,
          About me), and this screen was the only one in that stack
          standing bare on the page.

          It also deletes a hack. Two headings floating between `gap:
          cardGap` siblings needed a negative margin each to sit near the
          list they named; inside a card they simply sit where they are
          put. A negative margin fighting a parent's gap is a sign the
          thing does not belong to the layout it is in, and it did not. */}
      <Card style={s.card}>
        {/* Which account. Neither alert ever said, and on a phone signed
            into one thing that is easy to call unnecessary — right up
            until somebody has two and deletes the wrong one.

            The real avatar, through the component every other surface
            uses, rather than the generic silhouette this had at first: a
            screen whose entire job is "make sure this is the right
            account" was showing a stranger's outline next to the handle.
            `Avatar` draws its own blank for an account with no photo, so
            that case is its business rather than this file's. */}
        <View style={[s.row, s.divider]}>
          <Avatar url={profile.avatar_url} size={40} />
          <View style={s.who}>
            <Text style={s.whoName} numberOfLines={1}>{profile.full_name.trim() || email || ''}</Text>
            {profile.handle ? <Text style={s.whoHandle} numberOfLines={1}>{atHandle(profile.handle)}</Text> : null}
          </View>
        </View>

        {/* The mark sits on the heading, not on every line.

            Four filled red circles down the left of a card was more red
            than this app spends anywhere — `FormError`'s own note frets
            about "the count of red things" going up by one, and this had
            put it up by five. The heading is what carries the meaning
            anyway; the lines under it are contents, and contents do not
            each need to be told again what list they are in. */}
        <View style={[s.block, s.divider]}>
          <View style={s.blockHead}>
            <Ionicons name="close-circle" size={16} color={colors.bad} />
            <Text style={s.label}>{t('Will be deleted', 'Sẽ bị xoá', '削除されるもの')}</Text>
          </View>
          {gone.map((line) => <Text key={line} style={s.value}>{line}</Text>)}
        </View>

        {/* Said as loudly as the other half, because it is the part people
            get wrong. A café somebody added to the catalog is the
            catalog's now; deleting your account is leaving the room, not
            burning the library. */}
        <View style={s.block}>
          <View style={s.blockHead}>
            <Ionicons name="checkmark-circle" size={16} color={colors.ok} />
            {/* The pair, as a pair in each language. Vietnamese has two
                passives and picks between them by whether what happened
                was wanted — `bị` for the bad, `được` for the good — so
                "Sẽ bị xoá" against "Sẽ được giữ lại" carries the same
                opposition the English pair does, in the grammar rather
                than only in the verbs. "Sẽ ở lại" was neither: an
                active verb, and slightly colloquial for data. */}
            <Text style={s.label}>{t('Will remain', 'Sẽ được giữ lại', '残るもの')}</Text>
          </View>
          <Text style={s.value}>{t(
            'Places you added will remain in the catalog, but will no longer be linked to your account.',
            'Địa điểm bạn đã thêm vẫn còn trên City Crew, nhưng không còn gắn với tài khoản của bạn.',
            '追加したスポットは City Crew に残りますが、アカウントとの紐づけは解除されます。',
          )}</Text>
        </View>
      </Card>

      {error ? <FormError>{failText(error)}</FormError> : null}

      <DangerButton
        label={t('Delete account', 'Xoá tài khoản', 'アカウントを削除')}
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

// `featureCard`'s figures throughout, because this is one of `Profile`'s
// cards and being *almost* one would read as a mistake rather than as a
// variation.
const s = StyleSheet.create({
  card: { paddingHorizontal: space.cardPadding },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderGlassSoft },

  // 2, not 14: a name and the handle under it are one identity read top
  // to bottom — the same figure and the same reason as the profile hero.
  who: { flex: 1, gap: 2 },
  whoName: { color: colors.text, fontSize: 15.5, fontWeight: font.semibold },
  whoHandle: { color: colors.textTertiary, ...type.meta },

  block: { paddingVertical: 14, gap: 7 },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  // `aboutLabel` and `aboutValue`, to the point: the card above this one
  // on the profile says what somebody's account holds in exactly this
  // type, and this one says what would be taken out of it.
  label: { color: colors.textTertiary, fontSize: 12.5, fontWeight: font.medium },
  value: { color: colors.text, fontSize: 15.5, fontWeight: font.regular, lineHeight: 21 },

  // `SignUpScreen`'s skip, verbatim. It sits in the same place under the
  // same kind of button, and it had been the one quiet action in the app
  // wearing neither of the two things this app gives them — an accent, or
  // an underline.
  keep: {
    color: colors.textSecondary, ...type.meta, textAlign: 'center',
    textDecorationLine: 'underline', paddingVertical: 6,
  },
});
