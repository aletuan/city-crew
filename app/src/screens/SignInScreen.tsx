// Sign in — email + password, per the reference layout: welcome-back
// eyebrow, editorial title, list-row fields, forgot-password link and
// one big champagne action.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthHeader, AuthScreen, ErrorText, FieldRow, PrimaryButton, SwitchRow } from '../components/authUi';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { colors, font } from '../theme';
import type { Nav } from '../nav';

export default function SignInScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      navigation.popToTop();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen onBack={() => navigation.goBack()}>
      <AuthHeader
        eyebrow={t('Welcome back', 'Mừng bạn trở lại')}
        title={t('Sign in', 'Đăng nhập')}
        lede={t(
          'Glad to see you again! Sign in to continue planning amazing trips with your crew.',
          'Rất vui được gặp lại! Đăng nhập để tiếp tục lên kế hoạch cùng hội của bạn.',
        )}
      />
      <FieldRow
        icon="mail-outline"
        label={t('Email address', 'Địa chỉ email')}
        placeholder={t('Enter your email', 'Nhập email của bạn')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      <FieldRow
        icon="lock-closed-outline"
        label={t('Password', 'Mật khẩu')}
        placeholder={t('Enter your password', 'Nhập mật khẩu')}
        value={password}
        onChangeText={setPassword}
        secure
        autoCapitalize="none"
        autoComplete="password"
        onSubmitEditing={submit}
        returnKeyType="go"
      />
      <View style={s.metaRow}>
        <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={8}>
          <Text style={s.forgot}>{t('Forgot password?', 'Quên mật khẩu?')}</Text>
        </Pressable>
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <PrimaryButton label={t('Sign in', 'Đăng nhập')} onPress={submit} busy={busy} />
      <SwitchRow
        prompt={t("Don't have an account?", 'Chưa có tài khoản?')}
        action={t('Sign up', 'Đăng ký')}
        onPress={() => navigation.replace('SignUp')}
      />
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  forgot: { color: colors.champagne, fontSize: 14, fontWeight: font.medium },
});
