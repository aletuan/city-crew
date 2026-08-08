// Sign up — name, email, password and confirmation, per the reference.
// When Supabase requires email confirmation the flow falls back to a
// 6-digit code (links in the email can't open Expo Go).

import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthHeader, AuthScreen, ErrorText, FieldRow, PrimaryButton, SwitchRow } from '../components/authUi';
import { successHaptic } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { colors, type } from '../theme';
import type { Nav } from '../nav';

export default function SignUpScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { signUp, confirmSignUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    run(async () => {
      if (password.length < 8) {
        throw new Error(t('Password must be at least 8 characters.', 'Mật khẩu cần ít nhất 8 ký tự.'));
      }
      if (password !== confirm) {
        throw new Error(t("Passwords don't match.", 'Mật khẩu nhập lại không khớp.'));
      }
      const { needsConfirm } = await signUp(name.trim(), email.trim(), password);
      if (needsConfirm) setStep('confirm');
      else {
        successHaptic();
        navigation.popToTop();
      }
    });

  const verify = () =>
    run(async () => {
      await confirmSignUp(email.trim(), code.trim());
      successHaptic();
      navigation.popToTop();
    });

  if (step === 'confirm') {
    return (
      <AuthScreen onBack={() => setStep('form')}>
        <AuthHeader
          eyebrow={t('One last step', 'Bước cuối cùng')}
          title={t('Check your email', 'Kiểm tra email')}
          lede={t(
            `We sent a 6-digit confirmation code to ${email.trim()}. Enter it below to activate your account.`,
            `Mã xác nhận 6 số đã được gửi tới ${email.trim()}. Nhập mã bên dưới để kích hoạt tài khoản.`,
          )}
        />
        <FieldRow
          icon="key-outline"
          label={t('Confirmation code', 'Mã xác nhận')}
          placeholder="••••••"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          onSubmitEditing={verify}
          returnKeyType="done"
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <PrimaryButton label={t('Verify & continue', 'Xác nhận & tiếp tục')} onPress={verify} busy={busy} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen onBack={() => navigation.goBack()}>
      <AuthHeader
        title={t('Sign up', 'Đăng ký')}
        lede={t(
          'Join cityCrew to save places, build collections and plan unforgettable trips with your crew.',
          'Tham gia cityCrew để lưu địa điểm, tạo bộ sưu tập và lên kế hoạch cho những chuyến đi đáng nhớ.',
        )}
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
        icon="mail-outline"
        label={t('Email address', 'Địa chỉ email')}
        placeholder={t("We'll never share your email.", 'Email của bạn được giữ kín.')}
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
        placeholder={t('Use at least 8 characters', 'Ít nhất 8 ký tự')}
        value={password}
        onChangeText={setPassword}
        secure
        autoCapitalize="none"
        autoComplete="new-password"
      />
      <FieldRow
        icon="lock-closed-outline"
        label={t('Confirm password', 'Nhập lại mật khẩu')}
        placeholder={t('Type your password again', 'Gõ lại mật khẩu của bạn')}
        value={confirm}
        onChangeText={setConfirm}
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        onSubmitEditing={submit}
        returnKeyType="done"
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <PrimaryButton label={t('Sign up', 'Đăng ký')} onPress={submit} busy={busy} />
      <Text style={s.terms}>
        {t(
          'By signing up, you agree to keep your crew’s plans awesome.',
          'Khi đăng ký, bạn đồng ý giữ cho kế hoạch của hội luôn tuyệt vời.',
        )}
      </Text>
      <SwitchRow
        prompt={t('Already have an account?', 'Đã có tài khoản?')}
        action={t('Sign in', 'Đăng nhập')}
        onPress={() => navigation.replace('SignIn')}
      />
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  terms: { color: colors.textTertiary, ...type.meta, textAlign: 'center', lineHeight: 21, marginTop: 4 },
});
