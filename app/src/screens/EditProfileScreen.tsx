// Edit profile — name, location, bio and interests, stored as Supabase
// user metadata. Same field language as the auth screens.

import React, { useState } from 'react';
import { AuthHeader, AuthScreen, ErrorText, FieldRow, PrimaryButton } from '../components/authUi';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import type { Nav } from '../nav';

export default function EditProfileScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
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
      navigation.goBack();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen onBack={() => navigation.goBack()}>
      <AuthHeader
        title={t('Edit profile', 'Sửa hồ sơ')}
        lede={t('Tell your crew a little about yourself.', 'Kể cho hội của bạn nghe đôi chút về bạn.')}
      />
      <FieldRow
        icon="person-outline"
        label={t('Full name', 'Họ tên')}
        placeholder={t('What should we call you?', 'Chúng tôi nên gọi bạn là gì?')}
        value={name}
        onChangeText={setName}
        autoComplete="name"
      />
      <FieldRow
        icon="location-outline"
        label={t('From', 'Đến từ')}
        placeholder={t('Ho Chi Minh City, Vietnam', 'TP. Hồ Chí Minh, Việt Nam')}
        value={location}
        onChangeText={setLocation}
      />
      <FieldRow
        icon="chatbubble-ellipses-outline"
        label={t('Bio', 'Giới thiệu')}
        placeholder={t('Coffee lover · Weekend explorer', 'Mê cà phê · Thích khám phá cuối tuần')}
        value={bio}
        onChangeText={setBio}
        multiline
      />
      <FieldRow
        icon="heart-outline"
        label={t('Interests', 'Sở thích')}
        placeholder={t('Cafés, nature, local food, city walks', 'Cà phê, thiên nhiên, món ngon, dạo phố')}
        value={interests}
        onChangeText={setInterests}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <PrimaryButton label={t('Save changes', 'Lưu thay đổi')} onPress={save} busy={busy} />
    </AuthScreen>
  );
}
