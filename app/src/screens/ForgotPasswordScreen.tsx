// Forgot password — email first, then the emailed recovery code plus a
// new password. Codes instead of links: recovery links can't deep-link
// back into Expo Go.
//
// The code's length is not assumed anywhere here. See `lib/otp.ts`.

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AuthHeader, AuthScreen, FieldRow, FormError, Lede, PrimaryButton, useFailText } from '../components/authUi';
import { useAuthActions } from '../lib/auth';
import { afterEmailEdit, cleanEmail, emailShapeOk } from '../lib/email';
import { useI18n } from '../lib/i18n';
import { cleanOtp, OTP_MAX } from '../lib/otp';
import { PASSWORD_MIN } from '../lib/password';
import { colors, font } from '../theme';
import { leaveAuth, type Nav, type RootRoute } from '../nav';

/** Supabase's own limit is one recovery email per address per minute. */
const RESEND_SECONDS = 60;

export default function ForgotPasswordScreen({ navigation, route }: { navigation: Nav; route?: RootRoute<'ForgotPassword'> }) {
  const { t } = useI18n();
  const { requestReset, resetPassword } = useAuthActions();
  const failText = useFailText();
  // What Sign in already held, filled in rather than asked for again.
  // Editable, and nothing is sent until the reader asks.
  const [email, setEmail] = useState(() => cleanEmail(route?.params?.email ?? ''));
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
  // The interval restarts when the countdown starts or ends, not on each tick — depending on
  // `cooldown` would tear down and rebuild the timer every second.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Before the request, not after it: the server's answer to an empty
      // address here is "Password recovery requires an email", in English.
      if (!email) throw new Error('need_email');
      // Shaped like an address, before the mail is asked for. This form
      // is the one where a wrong address is quietest: the step below
      // says a code was sent and starts a countdown, so an address the
      // server never reached looks exactly like one it did, and the
      // reader waits out sixty seconds for a mail that was never
      // written. Named here, on the screen with the field.
      if (!emailShapeOk(email)) throw new Error('bad_email');
      await requestReset(email);
      setCooldown(RESEND_SECONDS);
      setStep('reset');
    });

  // The old code dies the moment a new one is issued, so the field is
  // cleared rather than left holding something that will now be refused.
  const resend = () =>
    run(async () => {
      await requestReset(email);
      setCode('');
      setCooldown(RESEND_SECONDS);
      setResent(true);
    });

  const reset = () =>
    run(async () => {
      // In field order: the code sits above the new password.
      if (!cleanOtp(code)) throw new Error('need_code');
      if (password.length < PASSWORD_MIN) {
        throw new Error(t('Password must be at least 8 characters.', 'Mật khẩu cần ít nhất 8 ký tự.', 'パスワードは8文字以上にしてください。', '密码至少需要 8 个字符。', '密碼至少需要 8 個字元。'));
      }
      await resetPassword(email, cleanOtp(code), password);
      leaveAuth(navigation);
    });

  if (step === 'reset') {
    return (
      <AuthScreen>
        <AuthHeader
          onBack={() => setStep('email')}
          title={t('Set a new password', 'Đặt mật khẩu mới', '新しいパスワードを設定', '设置新密码', '設定新密碼')}
        />
        <Lede>{t(
            `We sent a recovery code to ${email}. Enter it with your new password.`,
            `Mã khôi phục đã được gửi tới ${email}. Nhập mã cùng mật khẩu mới.`,
            `${email} にリカバリーコードを送信しました。新しいパスワードと一緒に入力してください。`,
            `我们已向 ${email} 发送了找回验证码。请输入验证码和新密码。`, `我們已向 ${email} 傳送了找回驗證碼。請輸入驗證碼和新密碼。`,
          )}</Lede>
        <FieldRow
          icon="key-outline"
          label={t('Recovery code', 'Mã khôi phục', 'リカバリーコード', '找回验证码', '找回驗證碼')}
          placeholder={t('Paste the code from the email', 'Dán mã trong email', 'メールのコードを貼り付け', '粘贴邮件中的验证码', '貼上郵件中的驗證碼')}
          value={code}
          onChangeText={(v) => setCode(cleanOtp(v))}
          keyboardType="number-pad"
          maxLength={OTP_MAX}
          testID="forgot-code"
        />
        <FieldRow
          icon="lock-closed-outline"
          label={t('New password', 'Mật khẩu mới', '新しいパスワード', '新密码', '新密碼')}
          placeholder={t('Use at least 8 characters', 'Ít nhất 8 ký tự', '8文字以上', '至少 8 个字符', '至少 8 個字元')}
          value={password}
          onChangeText={setPassword}
          secure
          strength
          autoCapitalize="none"
          autoComplete="new-password"
          onSubmitEditing={reset}
          returnKeyType="done"
          testID="forgot-password"
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
          testID="forgot-resend"
        >
          <Text style={[s.resendText, cooldown > 0 && s.resendWaiting]}>
            {cooldown > 0
              ? t(`Resend code in ${cooldown}s`, `Gửi lại mã sau ${cooldown}s`, `${cooldown}秒後に再送信`, `${cooldown} 秒后可重新发送`, `${cooldown} 秒後可重新傳送`)
              : t("Didn't get it? Resend code", 'Chưa nhận được? Gửi lại mã', '届きませんか？コードを再送信', '没收到？重新发送验证码', '沒收到？重新傳送驗證碼')}
          </Text>
        </Pressable>
        {resent && cooldown > 0 ? (
          <Text style={s.resentNote}>
            {t(
              'A new code is on its way. The previous one no longer works.',
              'Mã mới đang được gửi. Mã cũ không còn dùng được.',
              '新しいコードを送信しました。前のコードは使えません。',
              '新的验证码已发送，之前的验证码已失效。', '新的驗證碼已傳送，之前的驗證碼已失效。',
            )}
          </Text>
        ) : null}
        {error ? <FormError>{failText(error)}</FormError> : null}
        <PrimaryButton label={t('Reset password', 'Đặt lại mật khẩu', 'パスワードをリセット', '重置密码', '重設密碼')} onPress={reset} busy={busy} testID="forgot-reset" />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <AuthHeader
        onBack={() => navigation.goBack()}
        title={t('Forgot password', 'Quên mật khẩu', 'パスワードをお忘れの方', '忘记密码', '忘記密碼')}
      />
      <Lede>{t(
          "Enter your email and we'll send you a recovery code.",
          'Nhập email của bạn, chúng tôi sẽ gửi mã khôi phục.',
          'メールアドレスを入力すると、リカバリーコードをお送りします。',
          '输入你的邮箱，我们会发送找回验证码。', '輸入你的電子郵件，我們會傳送找回驗證碼。',
        )}</Lede>
      <FieldRow
        icon="mail-outline"
        label={t('Email address', 'Địa chỉ email', 'メールアドレス', '电子邮箱', '電子郵件')}
        placeholder={t('Enter your email', 'Nhập email của bạn', 'メールアドレスを入力', '输入你的邮箱', '輸入你的電子郵件')}
        value={email}
        // Stripped as it is typed rather than trimmed at submit — the
        // keyboard's space lands inside the address. See `lib/email`.
        // The error this edit fixes goes with it, as on Sign in.
        onChangeText={(v) => {
          const next = cleanEmail(v);
          setEmail(next);
          setError((current) => afterEmailEdit(current, next));
        }}
        invalid={step === 'email' && (error === 'need_email' || error === 'bad_email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        onSubmitEditing={send}
        returnKeyType="send"
        testID="forgot-email"
      />
      {error ? <FormError>{failText(error)}</FormError> : null}
      <PrimaryButton label={t('Send recovery code', 'Gửi mã khôi phục', 'コードを送信', '发送找回验证码', '傳送找回驗證碼')} onPress={send} busy={busy} testID="forgot-submit" />
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  resend: { alignSelf: 'flex-start', paddingVertical: 10, marginTop: 2 },
  resendText: { color: colors.accent, fontSize: 15, lineHeight: 20, fontWeight: font.semibold },
  // Still legible, plainly not pressable — a countdown greyed to the
  // point of illegibility is a number nobody can use.
  resendWaiting: { color: colors.textTertiary, fontWeight: font.regular },
  resentNote: { color: colors.textSecondary, fontSize: 14, lineHeight: 19, marginBottom: 4 },
});
