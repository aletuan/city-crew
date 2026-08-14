// Forgot password — email first, then the emailed recovery code plus a
// new password. Codes instead of links: recovery links can't deep-link
// back into Expo Go.
//
// The code's length is not assumed anywhere here. See `lib/otp.ts`.

import React, { useState } from 'react';
import { AuthHeader, AuthScreen, ErrorText, FieldRow, Lede, PrimaryButton } from '../components/authUi';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { cleanOtp, OTP_MAX } from '../lib/otp';
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
        throw new Error(t('Password must be at least 8 characters.', 'Mật khẩu cần ít nhất 8 ký tự.', 'パスワードは8文字以上にしてください。'));
      }
      await resetPassword(email.trim(), cleanOtp(code), password);
      navigation.popToTop();
    });

  if (step === 'reset') {
    return (
      <AuthScreen>
        <AuthHeader
          onBack={() => setStep('email')}
          title={t('Set a new password', 'Đặt mật khẩu mới', '新しいパスワードを設定')}
        />
        <Lede>{t(
            `We sent a recovery code to ${email.trim()}. Enter it with your new password.`,
            `Mã khôi phục đã được gửi tới ${email.trim()}. Nhập mã cùng mật khẩu mới.`,
            `${email.trim()} にリカバリーコードを送信しました。新しいパスワードと一緒に入力してください。`,
          )}</Lede>
        <FieldRow
          icon="key-outline"
          label={t('Recovery code', 'Mã khôi phục', 'リカバリーコード')}
          placeholder={t('Paste the code from the email', 'Dán mã trong email', 'メールのコードを貼り付け')}
          value={code}
          onChangeText={(v) => setCode(cleanOtp(v))}
          keyboardType="number-pad"
          maxLength={OTP_MAX}
        />
        <FieldRow
          icon="lock-closed-outline"
          label={t('New password', 'Mật khẩu mới', '新しいパスワード')}
          placeholder={t('Use at least 8 characters', 'Ít nhất 8 ký tự', '8文字以上')}
          value={password}
          onChangeText={setPassword}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          onSubmitEditing={reset}
          returnKeyType="done"
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <PrimaryButton label={t('Reset password', 'Đặt lại mật khẩu', 'パスワードをリセット')} onPress={reset} busy={busy} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <AuthHeader
        onBack={() => navigation.goBack()}
        title={t('Forgot password', 'Quên mật khẩu', 'パスワードをお忘れの方')}
      />
      <Lede>{t(
          "Enter your email and we'll send you a recovery code.",
          'Nhập email của bạn, chúng tôi sẽ gửi mã khôi phục.',
          'メールアドレスを入力すると、リカバリーコードをお送りします。',
        )}</Lede>
      <FieldRow
        icon="mail-outline"
        label={t('Email address', 'Địa chỉ email', 'メールアドレス')}
        placeholder={t('Enter your email', 'Nhập email của bạn', 'メールアドレスを入力')}
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
      <PrimaryButton label={t('Send recovery code', 'Gửi mã khôi phục', 'コードを送信')} onPress={send} busy={busy} />
    </AuthScreen>
  );
}
