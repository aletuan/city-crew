// Forgot password — email first, then the emailed 6-digit recovery code
// plus a new password. Codes instead of links: recovery links can't
// deep-link back into Expo Go.

import React, { useState } from 'react';
import { AuthHeader, AuthScreen, ErrorText, FieldRow, PrimaryButton } from '../components/authUi';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import type { Nav } from '../nav';

export default function ForgotPasswordScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { requestReset, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'reset'>('email');
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

  const send = () =>
    run(async () => {
      await requestReset(email.trim());
      setStep('reset');
    });

  const reset = () =>
    run(async () => {
      if (password.length < 8) {
        throw new Error(t('Password must be at least 8 characters.', 'Mật khẩu cần ít nhất 8 ký tự.'));
      }
      await resetPassword(email.trim(), code.trim(), password);
      navigation.popToTop();
    });

  if (step === 'reset') {
    return (
      <AuthScreen onBack={() => setStep('email')}>
        <AuthHeader
          eyebrow={t('Almost there', 'Sắp xong rồi')}
          title={t('Set a new password', 'Đặt mật khẩu mới')}
          lede={t(
            `We sent a 6-digit recovery code to ${email.trim()}. Enter it with your new password.`,
            `Mã khôi phục 6 số đã được gửi tới ${email.trim()}. Nhập mã cùng mật khẩu mới.`,
          )}
        />
        <FieldRow
          icon="key-outline"
          label={t('Recovery code', 'Mã khôi phục')}
          placeholder="••••••"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
        />
        <FieldRow
          icon="lock-closed-outline"
          label={t('New password', 'Mật khẩu mới')}
          placeholder={t('Use at least 8 characters', 'Ít nhất 8 ký tự')}
          value={password}
          onChangeText={setPassword}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          onSubmitEditing={reset}
          returnKeyType="done"
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <PrimaryButton label={t('Reset password', 'Đặt lại mật khẩu')} onPress={reset} busy={busy} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen onBack={() => navigation.goBack()}>
      <AuthHeader
        title={t('Forgot password', 'Quên mật khẩu')}
        lede={t(
          "Enter your email and we'll send you a recovery code.",
          'Nhập email của bạn, chúng tôi sẽ gửi mã khôi phục.',
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
        onSubmitEditing={send}
        returnKeyType="send"
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <PrimaryButton label={t('Send recovery code', 'Gửi mã khôi phục')} onPress={send} busy={busy} />
    </AuthScreen>
  );
}
