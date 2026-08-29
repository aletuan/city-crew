// Edit profile — name, username, location and bio, stored as a row in
// `profiles`; plus taste and the recording opt-in, stored in
// `preferences`, which is a different table for a reason worth repeating
// here: `profiles` is readable by everyone (`for select using (true)`),
// and what you have been opening is nobody else's business.
//
// ── the chips, gone and back, and why that is not a reversal ──
//
// This screen used to ask for categories and a budget band. Both were
// removed, on the argument that the wizard asks the same question with
// more force: `canPlan` will not start a plan without at least one
// category, so a standing set of chips could only re-order what that gate
// had already let through.
//
// That argument was about the planner, and it still holds — the chips
// below are **not** passed to it; see `usePlanProfile`, which still
// withholds them. What changed is that Explore and Search now read a
// taste too, and there is no wizard on either: no gate, no question, and
// until now no answer. `useBrowseTaste` is the seam, and it is a separate
// hook precisely so this distinction cannot be lost by someone passing a
// flag from the wrong screen.
//
// Budget stayed gone, for its own reason: it is the *most* situational of
// the three, and what a plan costs is printed on every plan card, every
// editor and every saved trip. That is the honest way to let somebody
// decide with their own eyes.
//
// The free-text "Interests" box went when the chips arrived. It was read
// by nothing — not the planner, not search, not ranking — and the rows it
// collected show why a box is the wrong instrument: half were category
// keys typed by somebody who had read the source, and the rest were
// "Sleep", "classics" and "Nitendo, Netflix, Robolox". The column stays
// and nothing migrates; the chips write `preferences.categories`, which
// is the one the arithmetic has always been pointed at.
//
// "Username" on screen, `handle` in the code and the column: the label is
// the friendlier of the two words, and renaming the data to match would
// be churn through a migration for a caption.

import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthHeader, AuthScreen, FieldRow, FormError, Lede, PrimaryButton, useFailText } from '../components/authUi';
import AvatarPicker from '../components/AvatarPicker';
import TastePicker from '../components/TastePicker';
import { Card, PressableScale, successHaptic } from '../components/ui';
import { useAuth } from '../lib/auth';
import { CATEGORIES } from '../lib/categories';
import { useCity } from '../lib/city';
import { clearMyHistory, savePreferences, useMyPreferences } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { HANDLE_MAX, handleProblem, normalizeHandle } from '../lib/handle';
import { cleanTaste } from '../lib/tastepick';
import { colors, font, space } from '../theme';
import type { Nav } from '../nav';

export default function EditProfileScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { city } = useCity();
  const { profile, session, updateProfile } = useAuth();
  const failText = useFailText();
  const [name, setName] = useState(profile.full_name);
  const [handle, setHandle] = useState(profile.handle);
  const [location, setLocation] = useState(profile.location);
  const [bio, setBio] = useState(profile.bio);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uid = session?.user?.id ?? null;
  const prefs = useMyPreferences(uid);
  const [history, setHistory] = useState(false);
  const [taste, setTaste] = useState<string[]>([]);
  // Seeded once the row lands, not on every render: `useMyPreferences`
  // starts at `NO_PREFERENCES` and fills in a moment later, and copying
  // that into state unconditionally would undo a chip tapped in between.
  // `loadedAt` rather than `loaded` — a failed reload leaves `loaded` true
  // and must not re-seed the form from the empty answer.
  useEffect(() => {
    if (prefs.loadedAt === null) return;
    setHistory(prefs.data.history_on);
    setTaste(cleanTaste(prefs.data.categories, Object.keys(CATEGORIES)));
  }, [prefs.loadedAt, prefs.data]);
  // Kept apart from `error`: this one belongs to a field and is drawn
  // there, where the form-wide one sits by the button that failed.
  const [nameError, setNameError] = useState<string | null>(null);
  // The deletion happens immediately, so the row has to say so afterwards
  // — a destructive action that leaves the screen exactly as it found it
  // is one the reader will press again to make sure.
  const [cleared, setCleared] = useState(false);

  const confirmClear = () => Alert.alert(
    t('Delete your history?', 'Xoá lịch sử của bạn?', '履歴を削除しますか？'),
    t(
      'Every place you opened is forgotten. Your saved collections and trips stay.',
      'Mọi địa điểm bạn từng mở sẽ bị quên. Bộ sưu tập và chuyến đi đã lưu vẫn còn.',
      '開いた場所の記録はすべて消えます。保存したコレクションと旅程は残ります。',
    ),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
      {
        text: t('Delete', 'Xoá', '削除'),
        style: 'destructive',
        // Deleted straight away rather than staged until Save. A person
        // who asks for their history to be gone has not asked for it to be
        // gone if they also remember to press another button.
        onPress: () => {
          if (!uid) return;
          clearMyHistory(uid)
            .then(() => { successHaptic(); setCleared(true); })
            .catch((e: Error) => Alert.alert(
              t('Could not delete', 'Không xoá được', '削除できませんでした'), e.message,
            ));
        },
      },
    ],
  );

  const save = async () => {
    setBusy(true);
    setError(null);
    setNameError(null);
    try {
      const next = normalizeHandle(handle);
      const bad = handleProblem(next);
      if (bad) { setNameError(handleMessage(bad)); return; }
      await updateProfile({
        // Sent only when it changed. An unchanged handle would collide
        // with its own row's unique index on some paths, and asking the
        // server to set a value to what it already holds is noise.
        ...(next === profile.handle ? {} : { handle: next }),
        full_name: name.trim(),
        location: location.trim(),
        bio: bio.trim(),
      });
      // Two writes behind one button, and no transaction across them —
      // there cannot be one, they are different tables under different
      // policies. The order is the one that fails safe: the profile is
      // what the reader can see they changed, so it lands first, and a
      // preferences write that fails leaves the form open saying so
      // rather than closing over a half-saved change.
      // The band this screen no longer edits is written back as it was
      // found. Saving `null` instead would be this form deciding, on
      // somebody's behalf and without asking, to discard an answer they
      // gave — and the row is theirs, not this screen's.
      if (uid) {
        await savePreferences(uid, {
          categories: taste,
          budget_vnd: prefs.data.budget_vnd,
          history_on: history,
        });
      }
      successHaptic();
      navigation.goBack();
    } catch (err) {
      const m = (err as Error).message;
      if (m === 'handle_taken') {
        setNameError(t(
          `@${normalizeHandle(handle)} is taken. Try another.`,
          `@${normalizeHandle(handle)} đã có người dùng. Chọn tên khác.`,
          `@${normalizeHandle(handle)} は使用されています。別の名前をお試しください。`,
        ));
      } else if (m === 'handle_reserved') {
        setNameError(t('That username is reserved.', 'Tên người dùng này đã được giữ chỗ.', 'このユーザー名は予約されています。'));
      } else {
        setError(m);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleMessage = (bad: NonNullable<ReturnType<typeof handleProblem>>) => ({
    empty: t('Choose a username.', 'Hãy chọn một tên người dùng.', 'ユーザー名を選んでください。'),
    short: t('At least 3 characters.', 'Ít nhất 3 ký tự.', '3文字以上にしてください。'),
    long: t('20 characters at most.', 'Tối đa 20 ký tự.', '20文字以内にしてください。'),
    chars: t('Letters, numbers and _ only.', 'Chỉ gồm chữ, số và dấu _.', '英数字と _ のみ使えます。'),
  }[bad]);

  return (
    <AuthScreen>
      <AuthHeader
        onBack={() => navigation.goBack()}
        title={t('Edit profile', 'Sửa hồ sơ', 'プロフィール編集')}
      />
      {/* Saved on pick, not on submit — see AvatarPicker. The caption says
          so, because a form with a Save button implies otherwise. */}
      <View style={{ alignItems: 'center', gap: 10, marginBottom: 22 }}>
        <AvatarPicker size={96} />
        <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
          {t('Tap to change — saved right away', 'Chạm để đổi — lưu ngay', 'タップで変更 — すぐ保存されます')}
        </Text>
      </View>
      {/* Below the avatar, immediately above the fields it introduces —
          the avatar is its own self-contained control and needs no
          sentence of its own. */}
      <Lede>{t('Tell your crew a little about yourself.', 'Kể cho hội của bạn nghe đôi chút về bạn.', 'あなたのことを少し教えてください。')}</Lede>
      {/* Named to match sign-up; see the note there for why the label
          moved off "Họ tên" and the hint into the imperative. */}
      <FieldRow
        icon="person-outline"
        label={t('Display name', 'Tên hiển thị', '表示名')}
        placeholder={t('Enter your full name', 'Nhập họ và tên', 'お名前を入力')}
        value={name}
        onChangeText={setName}
        autoComplete="name"
      />
      {/* Right under the name, the way it sits on the profile itself. */}
      <FieldRow
        icon="at-outline"
        label={t('Username', 'Tên người dùng', 'ユーザー名')}
        placeholder="yourname"
        value={handle}
        error={nameError}
        onChangeText={(v) => { setNameError(null); setHandle(normalizeHandle(v)); }}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={HANDLE_MAX}
      />
      <FieldRow
        icon="location-outline"
        // Same word the profile shows it under. The field and the row that
        // displays it drifting apart is how a reader ends up unsure whether
        // they are two different things.
        label={t('Hometown', 'Quê quán', '出身地')}
        placeholder={t(`${city?.short_en ?? 'Saigon'}, Vietnam`, `${city?.short_vi ?? 'Sài Gòn'}, Việt Nam`, `${city?.short_ja ?? 'サイゴン'}、ベトナム`)}
        value={location}
        onChangeText={setLocation}
      />
      <FieldRow
        icon="chatbubble-ellipses-outline"
        label={t('Bio', 'Giới thiệu', '自己紹介')}
        placeholder={t('Coffee lover · Weekend explorer', 'Mê cà phê · Thích khám phá cuối tuần', 'コーヒー好き · 週末の探検家')}
        value={bio}
        onChangeText={setBio}
        multiline
      />
      {/* Chips rather than a box, and the reason is in the rows the box
          collected: it accepted "Sleep" and "Nitendo" as readily as
          "cafes", and nothing downstream could read either. A chip can
          only produce a key the taxonomy has, which is what makes the
          answer worth ranking with.

          Signed out there is no row to write to, so it goes with the
          switch below rather than sitting here taking taps that cannot
          be saved.

          In a card, like everything else on this screen. It was drawn
          bare for a while on the argument that a chip grid is not a list
          row — true, and beside the point: it sat between four white
          cards and a fifth, and the one block on a page with no surface
          under it reads as unfinished rather than as different. The
          card's own padding is what separates it now, which is the same
          separating the rows above it get. */}
      {uid ? (
        <Card>
          <View style={s.taste}>
            <Text style={s.tasteTitle}>{t('Interests', 'Sở thích', '興味')}</Text>
            <Text style={s.tasteSub}>
              {t(
                'Search and Explore lean towards these. Change them whenever you like.',
                'Tìm kiếm và Khám phá sẽ nghiêng về những mục này. Đổi lúc nào cũng được.',
                '検索と探索がこの傾向に寄ります。いつでも変更できます。',
              )}
            </Text>
            <TastePicker chosen={taste} onChange={setTaste} />
          </View>
        </Card>
      ) : null}

      {/* One thing, and it is not a preference about outings — it is
          permission. Signed out there is no row to write to, so the block
          goes rather than sitting there collecting taps that cannot be
          saved.

          The section heading went with the chips above it: the card names
          itself, and a heading over a single card is a label for a list
          of one. */}
      {uid ? (
        <View style={{ gap: 10, marginTop: 8 }}>
          <Card style={s.privacy}>
            <View style={s.toggleRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.toggleTitle}>
                  {t('Remember what I open', 'Nhớ những chỗ tôi mở', '開いた場所を記憶する')}
                </Text>
                <Text style={s.note}>
                  {t(
                    'On by default. A place you opened and walked away from stops coming back. Off, nothing is recorded.',
                    'Mặc định bật. Chỗ bạn mở rồi bỏ qua sẽ thôi quay lại. Tắt thì không ghi gì cả.',
                    '初期設定はオン。開いて保存しなかった場所は出にくくなります。オフにすると何も記録されません。',
                  )}
                </Text>
              </View>
              <Switch
                value={history}
                onValueChange={setHistory}
                trackColor={{ false: colors.borderGlass, true: colors.accentFaint }}
                thumbColor={colors.text}
                accessibilityLabel={t('Remember what I open', 'Nhớ những chỗ tôi mở', '開いた場所を記憶する')}
              />
            </View>
            {/* Not conditional on the toggle. Switching recording off and
                being unable to remove what was already recorded is the trap
                the whole table has to avoid — which is why the delete
                policy in the migration does not consult `history_on`
                either. */}
            <View style={s.divider} />
            <PressableScale onPress={confirmClear} style={s.clearRow} accessibilityRole="button">
              <Ionicons name="trash-outline" size={18} color={colors.bad} />
              <Text style={s.clearText}>
                {cleared
                  ? t('History deleted', 'Đã xoá lịch sử', '履歴を削除しました')
                  : t('Delete my history', 'Xoá lịch sử của tôi', '履歴を削除')}
              </Text>
            </PressableScale>
          </Card>
        </View>
      ) : null}

      {error ? <FormError>{failText(error)}</FormError> : null}
      <PrimaryButton label={t('Save changes', 'Lưu thay đổi', '変更を保存')} onPress={save} busy={busy} />
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  // Inside the card, padded the way the toggle row below it is — the
  // two `preferences` blocks should measure the same from the border in.
  taste: { gap: 6, paddingHorizontal: space.cardPadding, paddingVertical: 14 },
  tasteTitle: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
  tasteSub: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 19, marginBottom: 6 },
  note: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 19 },

  // The privacy block keeps a card of its own rather than joining the
  // chips in theirs. They are both `preferences`, but one is a taste and
  // the other is permission, and a promise sitting inside the same border
  // as a preference reads as another preference.
  privacy: { paddingVertical: 4, marginTop: 4 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: space.cardPadding, paddingVertical: 14,
  },
  toggleTitle: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft, marginHorizontal: space.cardPadding },
  clearRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: space.cardPadding, paddingVertical: 14,
  },
  clearText: { color: colors.bad, fontSize: 15, fontWeight: font.semibold },
});
