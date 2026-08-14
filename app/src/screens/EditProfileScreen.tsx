// Edit profile — name, location, bio and interests, stored as Supabase
// user metadata. Same field language as the auth screens.

import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { AuthHeader, AuthScreen, ErrorText, FieldRow, Lede, PrimaryButton } from '../components/authUi';
import AvatarPicker from '../components/AvatarPicker';
import { successHaptic } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useCity } from '../lib/city';
import { useI18n } from '../lib/i18n';
import { colors } from '../theme';
import type { Nav } from '../nav';

export default function EditProfileScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { city } = useCity();
  const { profile, updateProfile } = useAuth();
  const [name, setName] = useState(profile.full_name);
  const [location, setLocation] = useState(profile.location);
  const [bio, setBio] = useState(profile.bio);
  const [interests, setInterests] = useState(profile.interests);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateProfile({
        full_name: name.trim(),
        location: location.trim(),
        bio: bio.trim(),
        interests: interests.trim(),
      });
      successHaptic();
      navigation.goBack();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

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
      <FieldRow
        icon="location-outline"
        label={t('From', 'Đến từ', '出身地')}
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
      {error ? <ErrorText>{error}</ErrorText> : null}
      <PrimaryButton label={t('Save changes', 'Lưu thay đổi', '変更を保存')} onPress={save} busy={busy} />
    </AuthScreen>
  );
}
