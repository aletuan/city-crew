// Sign up — name, email, password and confirmation, per the reference.
// When Supabase requires email confirmation the flow falls back to a
// emailed code (links in the email can't open Expo Go). Its length is
// a project setting, so nothing here assumes one — see `lib/otp.ts`.

import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthHeader, AuthScreen, ErrorText, FieldRow, Lede, PrimaryButton, SwitchRow } from '../components/authUi';
import { successHaptic } from '../components/ui';
import { isHandleFree, useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { cleanOtp, OTP_MAX } from '../lib/otp';
import { HANDLE_MAX, handleProblem, normalizeHandle, suggestHandle } from '../lib/handle';
import { colors, type } from '../theme';
import type { Nav } from '../nav';

export default function SignUpScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { signUp, confirmSignUp } = useAuth();
  const [name, setName] = useState('');
  // Suggested from the name until the moment it is edited, then left
  // alone — a suggestion that keeps overwriting what you typed is worse
  // than none.
  const [handle, setHandle] = useState('');
  const [handleTouched, setHandleTouched] = useState(false);
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

  const handleMessage = (bad: NonNullable<ReturnType<typeof handleProblem>>) => ({
    empty: t('Choose a handle.', 'Hãy chọn một tên định danh.', 'ハンドル名を選んでください。'),
    short: t('Handle is too short — at least 3 characters.', 'Tên định danh quá ngắn — ít nhất 3 ký tự.', 'ハンドル名が短すぎます（3文字以上）。'),
    long: t('Handle is too long — 20 characters at most.', 'Tên định danh quá dài — tối đa 20 ký tự.', 'ハンドル名が長すぎます（20文字以内）。'),
    chars: t('Handle can use letters, numbers and _ only.', 'Tên định danh chỉ gồm chữ, số và dấu _.', 'ハンドル名は英数字と _ のみ使えます。'),
  }[bad]);

  const submit = () =>
    run(async () => {
      if (password.length < 8) {
        throw new Error(t('Password must be at least 8 characters.', 'Mật khẩu cần ít nhất 8 ký tự.', 'パスワードは8文字以上にしてください。'));
      }
      if (password !== confirm) {
        throw new Error(t("Passwords don't match.", 'Mật khẩu nhập lại không khớp.', 'パスワードが一致しません。'));
      }
      const chosen = normalizeHandle(handle);
      const bad = handleProblem(chosen);
      if (bad) throw new Error(handleMessage(bad));
      // Checked here so the message names the problem; the database is
      // what actually decides, and losing a race falls back to a
      // generated handle rather than to a failed sign-up.
      if (!(await isHandleFree(chosen))) {
        throw new Error(t(
          `@${chosen} is taken. Try another.`,
          `@${chosen} đã có người dùng. Chọn tên khác.`,
          `@${chosen} は使用されています。別の名前をお試しください。`,
        ));
      }
      const { needsConfirm } = await signUp(name.trim(), chosen, email.trim(), password);
      if (needsConfirm) setStep('confirm');
      else {
        successHaptic();
        navigation.popToTop();
      }
    });

  const verify = () =>
    run(async () => {
      await confirmSignUp(email.trim(), cleanOtp(code));
      successHaptic();
      navigation.popToTop();
    });

  if (step === 'confirm') {
    return (
      <AuthScreen>
        <AuthHeader
          onBack={() => setStep('form')}
          title={t('Check your email', 'Kiểm tra email', 'メールをご確認ください')}
        />
        <Lede>{t(
            `We sent a confirmation code to ${email.trim()}. Enter it below to activate your account.`,
            `Mã xác nhận đã được gửi tới ${email.trim()}. Nhập mã bên dưới để kích hoạt tài khoản.`,
            `${email.trim()} に確認コードを送信しました。以下に入力してアカウントを有効化してください。`,
          )}</Lede>
        <FieldRow
          icon="key-outline"
          label={t('Confirmation code', 'Mã xác nhận', '確認コード')}
          placeholder={t('Paste the code from the email', 'Dán mã trong email', 'メールのコードを貼り付け')}
          value={code}
          onChangeText={(v) => setCode(cleanOtp(v))}
          keyboardType="number-pad"
          maxLength={OTP_MAX}
          onSubmitEditing={verify}
          returnKeyType="done"
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <PrimaryButton label={t('Verify & continue', 'Xác nhận & tiếp tục', '確認して続行')} onPress={verify} busy={busy} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <AuthHeader
        onBack={() => navigation.goBack()}
        title={t('Sign up', 'Đăng ký', '新規登録')}
      />
      <Lede>{t(
          'Join cityCrew to save places, build collections and plan unforgettable trips with your crew.',
          'Tham gia cityCrew để lưu địa điểm, tạo bộ sưu tập và lên kế hoạch cho những chuyến đi đáng nhớ.',
          'cityCrewに参加して、場所を保存し、コレクションを作り、忘れられない旅を計画しましょう。',
        )}</Lede>
      <FieldRow
        icon="person-outline"
        label={t('Full name', 'Họ tên', 'お名前')}
        placeholder={t('What should we call you?', 'Chúng tôi nên gọi bạn là gì?', 'なんとお呼びすれば？')}
        value={name}
        onChangeText={(v) => {
          setName(v);
          if (!handleTouched) setHandle(suggestHandle(v));
        }}
        autoComplete="name"
      />
      {/* Below the name because it is proposed from it. The @ is drawn
          rather than typed — it is not part of the value, and a field
          that silently eats a character you typed is worse than one that
          never asked for it. */}
      <FieldRow
        icon="at-outline"
        label={t('Handle', 'Tên định danh', 'ハンドル名')}
        placeholder="yourname"
        value={handle}
        onChangeText={(v) => { setHandleTouched(true); setHandle(normalizeHandle(v)); }}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={HANDLE_MAX}
      />
      <FieldRow
        icon="mail-outline"
        label={t('Email address', 'Địa chỉ email', 'メールアドレス')}
        placeholder={t("We'll never share your email.", 'Email của bạn được giữ kín.', 'メールアドレスは公開されません。')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      <FieldRow
        icon="lock-closed-outline"
        label={t('Password', 'Mật khẩu', 'パスワード')}
        placeholder={t('Use at least 8 characters', 'Ít nhất 8 ký tự', '8文字以上')}
        value={password}
        onChangeText={setPassword}
        secure
        autoCapitalize="none"
        autoComplete="new-password"
      />
      <FieldRow
        icon="lock-closed-outline"
        label={t('Confirm password', 'Nhập lại mật khẩu', 'パスワード（確認）')}
        placeholder={t('Type your password again', 'Gõ lại mật khẩu của bạn', 'もう一度入力してください')}
        value={confirm}
        onChangeText={setConfirm}
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        onSubmitEditing={submit}
        returnKeyType="done"
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <PrimaryButton label={t('Sign up', 'Đăng ký', '登録')} onPress={submit} busy={busy} />
      <Text style={s.terms}>
        {t(
          'By signing up, you agree to keep your crew’s plans awesome.',
          'Khi đăng ký, bạn đồng ý giữ cho kế hoạch của hội luôn tuyệt vời.',
          '登録することで、仲間との計画を最高のものにすることに同意したことになります。',
        )}
      </Text>
      <SwitchRow
        prompt={t('Already have an account?', 'Đã có tài khoản?', 'すでにアカウントをお持ちの方は')}
        action={t('Sign in', 'Đăng nhập', 'サインイン')}
        onPress={() => navigation.replace('SignIn')}
      />
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  terms: { color: colors.textTertiary, ...type.meta, textAlign: 'center', lineHeight: 21, marginTop: 4 },
});
