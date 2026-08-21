// Edit profile — name, username, location, bio and interests, stored as
// a row in `profiles`; plus what plans should lean towards, stored in
// `preferences`, which is a different table for a reason worth repeating
// here: `profiles` is readable by everyone (`for select using (true)`),
// and a budget is nobody else's business.
//
// "Username" on screen, `handle` in the code and the column: the label is
// the friendlier of the two words, and renaming the data to match would
// be churn through a migration for a caption.

import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthHeader, AuthScreen, ErrorText, FieldRow, Lede, PrimaryButton } from '../components/authUi';
import AvatarPicker from '../components/AvatarPicker';
import { Card, Chip, PressableScale, successHaptic } from '../components/ui';
import { useAuth } from '../lib/auth';
import { CATEGORIES, CATEGORY_ORDER, categoryLabel } from '../lib/categories';
import { useCity } from '../lib/city';
import { clearMyHistory, savePreferences, useMyPreferences } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { HANDLE_MAX, handleProblem, normalizeHandle } from '../lib/handle';
import { colors, font, space, type as type_ } from '../theme';
import type { Nav } from '../nav';

/**
 * Budget as bands rather than as a number to type.
 *
 * The column holds an int and could take any figure, but nobody knows what
 * an outing is worth to them to the nearest thousand đồng — and a keypad
 * on a phone asking for six digits is six chances to add a zero. The bands
 * are what the answer is actually shaped like, and the planner only uses
 * it to divide into per-stop shares anyway.
 */
const BUDGETS: readonly { vnd: number | null; en: string; vi: string; ja: string }[] = [
  { vnd: null, en: 'No limit', vi: 'Không đặt', ja: '指定なし' },
  { vnd: 200_000, en: 'Up to 200k', vi: 'Tới 200k', ja: '20万まで' },
  { vnd: 500_000, en: 'Up to 500k', vi: 'Tới 500k', ja: '50万まで' },
  { vnd: 1_000_000, en: 'Up to 1M', vi: 'Tới 1 triệu', ja: '100万まで' },
];

export default function EditProfileScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { city } = useCity();
  const { profile, session, updateProfile } = useAuth();
  const [name, setName] = useState(profile.full_name);
  const [handle, setHandle] = useState(profile.handle);
  const [location, setLocation] = useState(profile.location);
  const [bio, setBio] = useState(profile.bio);
  const [interests, setInterests] = useState(profile.interests);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uid = session?.user?.id ?? null;
  const prefs = useMyPreferences(uid);
  const [cats, setCats] = useState<string[]>([]);
  const [budget, setBudget] = useState<number | null>(null);
  const [history, setHistory] = useState(false);
  // Seeded once the row lands, not on every render: `useMyPreferences`
  // starts at `NO_PREFERENCES` and fills in a moment later, and copying
  // that into state unconditionally would undo a chip tapped in between.
  // `loadedAt` rather than `loaded` — a failed reload leaves `loaded` true
  // and must not re-seed the form from the empty answer.
  useEffect(() => {
    if (prefs.loadedAt === null) return;
    setCats(prefs.data.categories);
    setBudget(prefs.data.budget_vnd);
    setHistory(prefs.data.history_on);
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
        interests: interests.trim(),
      });
      // Two writes behind one button, and no transaction across them —
      // there cannot be one, they are different tables under different
      // policies. The order is the one that fails safe: the profile is
      // what the reader can see they changed, so it lands first, and a
      // preferences write that fails leaves the form open saying so
      // rather than closing over a half-saved change.
      if (uid) await savePreferences(uid, { categories: cats, budget_vnd: budget, history_on: history });
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
      <FieldRow
        icon="person-outline"
        label={t('Full name', 'Họ tên', 'お名前')}
        placeholder={t('What should we call you?', 'Chúng tôi nên gọi bạn là gì?', 'なんとお呼びすれば？')}
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
      <FieldRow
        icon="heart-outline"
        label={t('Interests', 'Sở thích', '興味')}
        placeholder={t('Cafés, nature, local food, city walks', 'Cà phê, thiên nhiên, món ngon, dạo phố', 'カフェ、自然、ローカルフード、街歩き')}
        value={interests}
        onChangeText={setInterests}
      />

      {/* Everything below is about plans rather than about the person, and
          none of it is visible to anybody else. Signed out there is no row
          to write to, so the whole block goes rather than sitting there
          collecting taps that cannot be saved. */}
      {uid ? (
        <View style={{ gap: 10, marginTop: 8 }}>
          <Text style={s.heading}>{t('Your plans', 'Kế hoạch của bạn', 'あなたのプラン')}</Text>
          <Text style={s.note}>
            {t(
              'Used to break ties when we draft a day. Your answers in the moment always win.',
              'Dùng để phá thế hoà khi phác một ngày. Câu bạn trả lời lúc lên kế hoạch luôn thắng.',
              '日程を組むときの決め手に使います。その場での回答がつねに優先されます。',
            )}
          </Text>
          <View style={s.chips}>
            {CATEGORY_ORDER.map((c) => (
              <Chip
                key={c}
                label={categoryLabel(c, t)}
                icon={CATEGORIES[c]?.icon}
                iconColor={CATEGORIES[c]?.color}
                active={cats.includes(c)}
                onPress={() => setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))}
              />
            ))}
          </View>

          <Text style={s.subheading}>{t('Budget per outing', 'Ngân sách mỗi lần đi', '1回あたりの予算')}</Text>
          <View style={s.chips}>
            {BUDGETS.map((b) => (
              <Chip
                key={b.en}
                label={t(b.en, b.vi, b.ja)}
                active={budget === b.vnd}
                onPress={() => setBudget(b.vnd)}
              />
            ))}
          </View>

          <Card style={s.privacy}>
            <View style={s.toggleRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.toggleTitle}>
                  {t('Remember what I open', 'Nhớ những chỗ tôi mở', '開いた場所を記憶する')}
                </Text>
                <Text style={s.note}>
                  {t(
                    'Off by default. On, a place you opened and walked away from stops coming back.',
                    'Mặc định tắt. Bật lên thì chỗ bạn mở rồi bỏ qua sẽ thôi quay lại.',
                    '初期設定はオフ。オンにすると、開いて保存しなかった場所は出にくくなります。',
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

      {error ? <ErrorText>{error}</ErrorText> : null}
      <PrimaryButton label={t('Save changes', 'Lưu thay đổi', '変更を保存')} onPress={save} busy={busy} />
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  heading: { color: colors.text, ...type_.headline, marginTop: 6 },
  subheading: { color: colors.text, fontSize: 15, fontWeight: font.semibold, marginTop: 4 },
  note: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // The privacy block gets a card of its own. The chips above are
  // preferences; this one is a promise, and a promise sitting in the same
  // undifferentiated column as a filter row reads as a filter.
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
