// Sign in — email + password: inline title beside the back control,
// list-row fields, forgot-password link and one big accented action.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthHeader, AuthScreen, FieldRow, FormError, Lede, PrimaryButton, SwitchRow, useFailText } from '../components/authUi';
import { successHaptic } from '../components/ui';
import { useAuth } from '../lib/auth';
import { cleanEmail, emailShapeOk } from '../lib/email';
import { useI18n } from '../lib/i18n';
import { colors, font } from '../theme';
import { leaveAuth, type Nav } from '../nav';

export default function SignInScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const failText = useFailText();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    // Asked here rather than at the server, which answers an empty form
    // with "missing email or phone" — English, lower case, and naming a
    // `phone` this app does not have. Email first: it is the field above.
    if (!email) { setError('need_email'); return; }
    // And shaped like an address at all — the check the sign-up form has
    // made since the space incident, which this form had not.
    //
    // That asymmetry was the worse half of the same bug. The address that
    // earned `cleanEmail` its file was typed on the way *in*; the reader
    // who mistypes it here is somebody who already has an account, and
    // what they got was the server's `validation_failed`, arriving as
    // "Check the details you entered." — a sentence that names no field,
    // about an address that looks right to the eye. Locked out, with
    // nothing to go on. Every keyboard that can slip a space into the
    // sign-up field serves this one too.
    if (!emailShapeOk(email)) { setError('bad_email'); return; }
    if (!password) { setError('need_password'); return; }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      successHaptic();
      leaveAuth(navigation);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen>
      <AuthHeader
        onBack={() => navigation.goBack()}
        title={t('Sign in', 'Đăng nhập', 'サインイン')}
      />
      {/* Neutral on purpose. "Glad to see you again" greeted a returning
          reader — and this screen is also the first thing a brand-new one
          reaches through "Sign in / Sign up", where being welcomed back
          somewhere you have never been reads as a form letter. The switch
          row below already carries "no account yet", so the lede says the
          one thing both readers are here for. */}
      <Lede>{t(
          'Sign in to keep your saved places, collections and trips together in one account.',
          'Đăng nhập để giữ địa điểm đã lưu, bộ sưu tập và chuyến đi trong cùng một tài khoản.',
          'サインインすると、保存した場所・コレクション・旅程がひとつのアカウントにまとまります。',
        )}</Lede>
      <FieldRow
        icon="mail-outline"
        label={t('Email address', 'Địa chỉ email', 'メールアドレス')}
        placeholder={t('Enter your email', 'Nhập email của bạn', 'メールアドレスを入力')}
        value={email}
        // Whitespace stripped as it is typed, not trimmed at submit: the
        // space the iOS keyboard adds after an autocomplete lands after
        // the `@`, where no trim reaches. See `lib/email`.
        onChangeText={(v) => setEmail(cleanEmail(v))}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      <FieldRow
        icon="lock-closed-outline"
        label={t('Password', 'Mật khẩu', 'パスワード')}
        placeholder={t('Enter your password', 'Nhập mật khẩu', 'パスワードを入力')}
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
          <Text style={s.forgot}>{t('Forgot password?', 'Quên mật khẩu?', 'パスワードをお忘れですか？')}</Text>
        </Pressable>
      </View>
      {error ? <FormError>{failText(error)}</FormError> : null}
      <PrimaryButton label={t('Sign in', 'Đăng nhập', 'サインイン')} onPress={submit} busy={busy} />
      <SwitchRow
        prompt={t("Don't have an account?", 'Chưa có tài khoản?', 'アカウントをお持ちでない方は')}
        action={t('Sign up', 'Đăng ký', '登録')}
        onPress={() => navigation.replace('SignUp')}
      />
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  forgot: { color: colors.accent, fontSize: 14, fontWeight: font.medium },
});
