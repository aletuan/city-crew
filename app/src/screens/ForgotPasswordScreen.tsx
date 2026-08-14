// Forgot password — email first, then the emailed recovery code plus a
// new password. Codes instead of links: recovery links can't deep-link
// back into Expo Go.
//
// The code's length is not assumed anywhere here. See `lib/otp.ts`.

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AuthHeader, AuthScreen, ErrorText, FieldRow, Lede, PrimaryButton } from '../components/authUi';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { cleanOtp, OTP_MAX } from '../lib/otp';
import { colors, font } from '../theme';
import type { Nav } from '../nav';

/** Supabase's own limit is one recovery email per address per minute. */
const RESEND_SECONDS = 60;

export default function ForgotPasswordScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { requestReset, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Seconds before another code may be asked for. Supabase allows one per
  // address per minute, so a button that ignored that would spend its
  // taps on rejections.
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown > 0]);

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
      setCooldown(RESEND_SECONDS);
      setStep('reset');
    });

  // The old code dies the moment a new one is issued, so the field is
  // cleared rather than left holding something that will now be refused.
  const resend = () =>
    run(async () => {
      await requestReset(email.trim());
      setCode('');
      setCooldown(RESEND_SECONDS);
      setResent(true);
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
        {/* Between the fields and the action, where someone looks after
            finding no email to copy from. Disabled rather than hidden
            during the wait: a control that vanishes reads as one that was
            never there. */}
        <Pressable
          onPress={resend}
          disabled={busy || cooldown > 0}
          accessibilityRole="button"
          style={s.resend}
        >
          <Text style={[s.resendText, cooldown > 0 && s.resendWaiting]}>
            {cooldown > 0
              ? t(`Resend code in ${cooldown}s`, `Gửi lại mã sau ${cooldown}s`, `${cooldown}秒後に再送信`)
              : t("Didn't get it? Resend code", 'Chưa nhận được? Gửi lại mã', '届きませんか？コードを再送信')}
          </Text>
        </Pressable>
        {resent && cooldown > 0 ? (
          <Text style={s.resentNote}>
            {t(
              'A new code is on its way. The previous one no longer works.',
              'Mã mới đang được gửi. Mã cũ không còn dùng được.',
              '新しいコードを送信しました。前のコードは使えません。',
            )}
          </Text>
        ) : null}
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

const s = StyleSheet.create({
  resend: { alignSelf: 'flex-start', paddingVertical: 10, marginTop: 2 },
  resendText: { color: colors.accent, fontSize: 15, lineHeight: 20, fontWeight: font.semibold },
  // Still legible, plainly not pressable — a countdown greyed to the
  // point of illegibility is a number nobody can use.
  resendWaiting: { color: colors.textTertiary, fontWeight: font.regular },
  resentNote: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 19, marginBottom: 4 },
});
