// Sign up — name, email, password and confirmation, per the reference.
// When Supabase requires email confirmation the flow falls back to a
// emailed code (links in the email can't open Expo Go). Its length is
// a project setting, so nothing here assumes one — see `lib/otp.ts`.

import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthHeader, AuthScreen, FieldRow, FormError, Lede, PrimaryButton, SwitchRow, useFailText } from '../components/authUi';
import LegalSheet from '../components/LegalSheet';
import { successHaptic } from '../components/ui';
import { isHandleFree, useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import type { LegalId } from '../lib/legal';
import { cleanOtp, OTP_MAX } from '../lib/otp';
import { HANDLE_MAX, handleProblem, normalizeHandle, suggestHandle } from '../lib/handle';
import { PASSWORD_MIN } from '../lib/password';
import { colors, font, type } from '../theme';
import type { Nav } from '../nav';

export default function SignUpScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { signUp, confirmSignUp } = useAuth();
  const failText = useFailText();
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
  const [nameError, setNameError] = useState<string | null>(null);

  // Which document is open over the form, if any. State rather than a
  // navigate: a Modal renders inside this screen, so nothing here
  // unmounts and every field the reader has already filled in survives
  // the round trip with no work at all.
  const [legal, setLegal] = useState<LegalId | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNameError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
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

  const submit = () =>
    run(async () => {
      // The two fields nothing downstream would name properly. An empty
      // name reaches the server as valid metadata and makes a nameless
      // account; an empty address comes back as "missing email or phone".
      // The handle is not here because `handleProblem` already names its
      // own empty case.
      if (!name.trim()) throw new Error('need_name');
      if (!email.trim()) throw new Error('need_email');
      if (password.length < PASSWORD_MIN) {
        throw new Error(t('Password must be at least 8 characters.', 'Mật khẩu cần ít nhất 8 ký tự.', 'パスワードは8文字以上にしてください。'));
      }
      if (password !== confirm) {
        throw new Error(t("Passwords don't match.", 'Mật khẩu nhập lại không khớp.', 'パスワードが一致しません。'));
      }
      const chosen = normalizeHandle(handle);
      const bad = handleProblem(chosen);
      if (bad) { setNameError(handleMessage(bad)); return; }
      // Checked here so the message names the problem; the database is
      // what actually decides, and losing a race falls back to a
      // generated handle rather than to a failed sign-up.
      if (!(await isHandleFree(chosen))) {
        setNameError(t(
          `@${chosen} is taken. Try another.`,
          `@${chosen} đã có người dùng. Chọn tên khác.`,
          `@${chosen} は使用されています。別の名前をお試しください。`,
        ));
        return;
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
      if (!cleanOtp(code)) throw new Error('need_code');
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
        {error ? <FormError>{failText(error)}</FormError> : null}
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
          'Join City Crew to save places, build collections and plan unforgettable trips with your crew.',
          'Tham gia City Crew để lưu địa điểm, tạo bộ sưu tập và lên kế hoạch cho những chuyến đi đáng nhớ.',
          'City Crewに参加して、場所を保存し、コレクションを作り、忘れられない旅を計画しましょう。',
        )}</Lede>
      {/* Vietnamese apps ask in the imperative — "Nhập …" — and almost
          never in the friendly question this used to carry, which is a
          Western product voice that reads as translated here.

          And the label: "Họ tên" is what a reader meets on an ID
          verification screen, so it asked for a legal name. This field
          is the display name — it sits beside the @handle on a crew
          row and verifies nothing. It now says so. */}
      <FieldRow
        icon="person-outline"
        label={t('Display name', 'Tên hiển thị', '表示名')}
        placeholder={t('Enter your full name', 'Nhập họ và tên', 'お名前を入力')}
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
        label={t('Username', 'Tên người dùng', 'ユーザー名')}
        placeholder="yourname"
        value={handle}
        error={nameError}
        onChangeText={(v) => { setNameError(null); setHandleTouched(true); setHandle(normalizeHandle(v)); }}
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
        strength
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
      {error ? <FormError>{failText(error)}</FormError> : null}
      <PrimaryButton label={t('Sign up', 'Đăng ký', '登録')} onPress={submit} busy={busy} />
      {/* This line used to be a joke — "you agree to keep your crew's
          plans awesome" — sitting in exactly the place where the two
          real documents belong, and nowhere in the app linked to either.
          Apple's guideline 1.2 wants an app with user content to say what
          is not allowed and what happens to it; the product already does
          all four things it asks for, so what was missing was only the
          writing down and this way in.

          The sentence is assembled from fragments rather than one string
          with placeholders, because the pieces move: Vietnamese ends on
          "của City Crew", English ends on a full stop, and Japanese wants
          no spaces around either link. The spacing lives inside each
          translation for that reason.

          The two links now open a sheet rather than a browser, which is
          also why `lineHeight` grew: a nested <Text> inside a <Text> is
          one text run in one native view on iOS, so `hitSlop` does
          nothing to it and the tappable area is exactly the glyph box.
          44pt is unreachable without breaking the sentence into separate
          Pressables — which would take the wrapping with it — and 44pt
          is a rule about controls, not about links inside running text.
          The line height is what can honestly be spent, and it buys
          about a quarter more. */}
      <Text style={s.terms}>
        {t(
          'By signing up, you agree to City Crew’s ',
          'Khi đăng ký, bạn đồng ý với ',
          '登録すると、City Crew の',
        )}
        <Text style={s.termsLink} onPress={() => setLegal('terms')} accessibilityRole="link">
          {t('Terms of Service', 'Điều khoản sử dụng', '利用規約')}
        </Text>
        {t(' and ', ' và ', 'と')}
        <Text style={s.termsLink} onPress={() => setLegal('privacy')} accessibilityRole="link">
          {t('Privacy Policy', 'Chính sách quyền riêng tư', 'プライバシーポリシー')}
        </Text>
        {t('.', ' của City Crew.', 'に同意したことになります。')}
      </Text>
      <SwitchRow
        prompt={t('Already have an account?', 'Đã có tài khoản?', 'すでにアカウントをお持ちの方は')}
        action={t('Sign in', 'Đăng nhập', 'サインイン')}
        onPress={() => navigation.replace('SignIn')}
      />
      <LegalSheet id={legal} onClose={() => setLegal(null)} />
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  terms: { color: colors.textTertiary, ...type.meta, textAlign: 'center', lineHeight: 26, marginTop: 4 },
  // Only the colour and the weight change: a different size inside a
  // sentence would break the line's rhythm, and there is no underline
  // anywhere else in the app.
  termsLink: { color: colors.accent, fontWeight: font.medium },
});
