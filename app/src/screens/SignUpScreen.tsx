// Sign up — name, email, password and confirmation, per the reference.
// When Supabase requires email confirmation the flow falls back to a
// emailed code (links in the email can't open Expo Go). Its length is
// a project setting, so nothing here assumes one — see `lib/otp.ts`.

import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthHeader, AuthScreen, FieldRow, FormError, Lede, PrimaryButton, SwitchRow, useFailText } from '../components/authUi';
import LegalSheet from '../components/LegalSheet';
import TastePicker from '../components/TastePicker';
import { successHaptic } from '../components/ui';
import { isHandleFree, useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import type { LegalId } from '../lib/legal';
import { NO_PREFERENCES, savePreferences } from '../lib/data';
import { cleanOtp, OTP_MAX } from '../lib/otp';
import { HANDLE_MAX, handleProblem, normalizeHandle, suggestHandle } from '../lib/handle';
import { PASSWORD_MIN } from '../lib/password';
import { colors, font, type } from '../theme';
import type { Nav } from '../nav';

export default function SignUpScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { signUp, confirmSignUp, session } = useAuth();
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
  const [step, setStep] = useState<'form' | 'confirm' | 'taste'>('form');
  const [taste, setTaste] = useState<string[]>([]);
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
      // The taste step writes to `preferences`, which RLS scopes to the
      // signed-in account — so it can only come after a session exists.
      // Without confirmation `signUp` returns one; with it, the session
      // arrives at `verify` and the step waits there instead.
      if (needsConfirm) setStep('confirm');
      else {
        successHaptic();
        setStep('taste');
      }
    });

  const verify = () =>
    run(async () => {
      if (!cleanOtp(code)) throw new Error('need_code');
      await confirmSignUp(email.trim(), cleanOtp(code));
      successHaptic();
      setStep('taste');
    });

  /**
   * The last step, and the one that may be walked past.
   *
   * It is here rather than inside the form because the form is already
   * five fields and a code, and it is the screen an account is lost on.
   * By the time this shows, the account exists: whatever happens next,
   * including closing the app, the reader has one.
   *
   * So "Bỏ qua" is a real answer, not a smaller button. A skipped taste
   * costs nothing the app cannot recover — `taste.ts` scores four signals
   * and the other three come from what somebody does rather than what
   * they declare, so a reader who says nothing here is understood a
   * little later instead of not at all.
   */
  const finish = (chosen: readonly string[]) =>
    run(async () => {
      const uid = session?.user?.id;
      // No session is not an error the reader can act on — it means the
      // confirmation has not landed yet — and holding them on this screen
      // over an optional question would be the worst possible trade.
      if (uid && chosen.length) {
        // Swallowed: the account is made, the answer is a preference, and
        // a failed write here must not look like a failed sign-up.
        await savePreferences(uid, { ...NO_PREFERENCES, categories: [...chosen] }).catch(() => {});
      }
      successHaptic();
      navigation.popToTop();
    });

  if (step === 'taste') {
    return (
      <AuthScreen>
        {/* No back control: there is nothing behind this now — the form
            is spent and the account is made. A back arrow here would
            offer a door that leads nowhere. */}
        <Text style={s.tasteTitle}>
          {t('What are you into?', 'Bạn thích gì?', '好みを教えてください')}
        </Text>
        <Lede>{t(
            'Pick a few and Search and Explore will lean towards them. You can change this any time in your profile.',
            'Chọn vài mục, Tìm kiếm và Khám phá sẽ nghiêng về những thứ đó. Đổi lúc nào cũng được trong hồ sơ.',
            'いくつか選ぶと、検索と探索がその傾向に寄ります。プロフィールでいつでも変更できます。',
          )}</Lede>
        <TastePicker chosen={taste} onChange={setTaste} />
        {/* Said here, before anything is recorded, and that is the whole
            reason the default is allowed to be on. A default nobody is
            told about is the "lie told once at signup" the original
            migration refused; a default stated in the reader's own
            language, on the screen where the account begins, with the
            switch named, is a different thing.

            Under the picker rather than in the Lede above it: the Lede
            answers "what is this screen for", and a reader who skips
            straight past it to the chips would miss this. It sits with
            the button they have to reach either way. */}
        <Text style={s.privacyNote}>
          {t(
            'City Crew remembers the places you open, so a place you passed over stops coming back. Turn it off any time in Edit profile.',
            'City Crew ghi nhớ những nơi bạn mở, để chỗ bạn đã bỏ qua thôi quay lại. Tắt lúc nào cũng được trong Sửa hồ sơ.',
            'City Crew は開いた場所を記憶し、一度見送った場所が出にくくなります。プロフィール編集でいつでもオフにできます。',
          )}
        </Text>
        <PrimaryButton
          label={taste.length
            ? t('Done', 'Xong', '完了')
            : t('Skip for now', 'Bỏ qua', 'あとで')}
          onPress={() => finish(taste)}
          busy={busy}
        />
      </AuthScreen>
    );
  }

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
  // The one screen in this flow with no back control, so it carries the
  // title itself rather than through AuthHeader.
  tasteTitle: { color: colors.text, ...type.titleDetail, marginBottom: 2 },
  // Quieter than the Lede and above the button: a statement of fact the
  // reader should meet, not a second instruction competing with the one
  // the screen is actually asking.
  privacyNote: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 19, marginTop: 14, marginBottom: 4 },
  terms: { color: colors.textTertiary, ...type.meta, textAlign: 'center', lineHeight: 26, marginTop: 4 },
  // Only the colour and the weight change: a different size inside a
  // sentence would break the line's rhythm, and there is no underline
  // anywhere else in the app.
  termsLink: { color: colors.accent, fontWeight: font.medium },
});
