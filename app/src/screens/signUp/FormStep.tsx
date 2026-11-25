// Out of `SignUpScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import React, { useState } from 'react';
import { Text } from 'react-native';
import {
  AuthHeader, FieldRow, FormError, Lede, PrimaryButton, StepDots, SwitchRow, useFailText,
} from '../../components/authUi';
import LegalSheet from '../../components/LegalSheet';
import { afterEmailEdit, cleanEmail } from '../../lib/email';
import { HANDLE_MAX, normalizeHandle, suggestHandle } from '../../lib/handle';
import { useI18n } from '../../lib/i18n';
import type { LegalId } from '../../lib/legal';
import type { Nav } from '../../nav';
import { s } from './styles';
import type { SignUp } from './useSignUp';

/** The first step: who, the username, the address and the password. */
export function FormStep({ f, navigation }: { f: SignUp; navigation: Nav }) {
  const { t } = useI18n();
  const failText = useFailText();
  const {
    dotTotal, name, setName, error, setError, handleTouched, setHandleTouched, handle, setHandle,
    nameError, setNameError, email, setEmail, password, setPassword, confirm, setConfirm, submit, busy,
  } = f;
  // Which document is open over the form, if any. State rather than a
  // navigate: a Modal renders inside this screen, so nothing here
  // unmounts and every field the reader has already filled in survives
  // the round trip with no work at all.
  const [legal, setLegal] = useState<LegalId | null>(null);
  return (
    <>
      <StepDots step={1} total={dotTotal} />
      <AuthHeader
        onBack={() => navigation.goBack()}
        backBare
        title={t('Sign up', 'Đăng ký', '新規登録', '注册', '註冊')}
      />
      <Lede>{t(
          'Join City Crew to save places, build collections and plan unforgettable trips with your crew.',
          'Tham gia City Crew để lưu địa điểm, tạo bộ sưu tập và lên kế hoạch cho những chuyến đi đáng nhớ.',
          'City Crewに参加して、場所を保存し、コレクションを作り、忘れられない旅を計画しましょう。',
          '加入 City Crew，保存地点、创建合集，和朋友一起规划难忘的旅行。', '加入 City Crew，儲存地點、建立合集，和朋友一起規劃難忘的旅行。',
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
        label={t('Display name', 'Tên hiển thị', '表示名', '显示名称', '顯示名稱')}
        placeholder={t('What should we call you?', 'Bạn muốn được gọi là gì?', '何とお呼びすればよいですか？', '我们该怎么称呼你？', '我們該怎麼稱呼你？')}
        value={name}
        error={error === 'need_name' ? failText(error) : null}
        onChangeText={(v) => {
          setName(v);
          if (v.trim()) setError((current) => current === 'need_name' ? null : current);
          if (!handleTouched) setHandle(suggestHandle(v));
        }}
        autoComplete="name"
        testID="signup-name"
      />
      {/* Below the name because it is proposed from it. The @ is drawn
          rather than typed — it is not part of the value, and a field
          that silently eats a character you typed is worse than one that
          never asked for it. */}
      <FieldRow
        icon="at-outline"
        label={t('Username', 'Tên người dùng', 'ユーザー名', '用户名', '使用者名稱')}
        placeholder="yourname"
        value={handle}
        error={nameError}
        onChangeText={(v) => { setNameError(null); setHandleTouched(true); setHandle(normalizeHandle(v)); }}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={HANDLE_MAX}
      />
      {/* Whitespace never belongs in an address, and the iOS keyboard
          loves inserting a space after an autocomplete — "name@ gmail.com"
          was a real sign-up, refused a step later by the server with a
          sentence that named no field. Stripped as it is typed, so the
          mistake cannot be made rather than being caught. */}
      <FieldRow
        icon="mail-outline"
        label={t('Email address', 'Địa chỉ email', 'メールアドレス', '电子邮箱', '電子郵件')}
        placeholder={t('Enter your email address', 'Nhập địa chỉ email', 'メールアドレスを入力', '输入你的电子邮箱', '輸入你的電子郵件')}
        value={email}
        invalid={error === 'need_email' || error === 'bad_email' || error === 'email_taken'}
        // The error this edit fixes goes with it, and the red with it —
        // "enter your email" stood over qa@example.com until the next
        // press (19 Oct 2026). The message stays where it is shown.
        onChangeText={(v) => {
          const next = cleanEmail(v);
          setEmail(next);
          setError((current) => afterEmailEdit(current, next));
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        testID="signup-email"
      />
      <FieldRow
        icon="lock-closed-outline"
        label={t('Password', 'Mật khẩu', 'パスワード', '密码', '密碼')}
        placeholder={t('Use at least 8 characters', 'Ít nhất 8 ký tự', '8文字以上', '至少 8 个字符', '至少 8 個字元')}
        value={password}
        onChangeText={setPassword}
        secure
        strength
        autoCapitalize="none"
        autoComplete="new-password"
        testID="signup-password"
      />
      <FieldRow
        icon="lock-closed-outline"
        label={t('Confirm password', 'Nhập lại mật khẩu', 'パスワード（確認）', '确认密码', '確認密碼')}
        placeholder={t('Type your password again', 'Gõ lại mật khẩu của bạn', 'もう一度入力してください', '再次输入密码', '再次輸入密碼')}
        value={confirm}
        onChangeText={setConfirm}
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        onSubmitEditing={submit}
        returnKeyType="done"
        testID="signup-confirm"
      />
      {error && error !== 'need_name' ? <FormError>{failText(error)}</FormError> : null}
      <PrimaryButton label={t('Sign up', 'Đăng ký', '登録', '注册', '註冊')} onPress={submit} busy={busy} testID="signup-submit" />
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
          '注册即表示你同意 City Crew 的', '註冊即表示你同意 City Crew 的',
        )}
        <Text style={s.termsLink} onPress={() => setLegal('terms')} accessibilityRole="link">
          {t('Terms of Service', 'Điều khoản sử dụng', '利用規約', '服务条款', '服務條款')}
        </Text>
        {t(' and ', ' và ', 'と', '和', '和')}
        <Text style={s.termsLink} onPress={() => setLegal('privacy')} accessibilityRole="link">
          {t('Privacy Policy', 'Chính sách quyền riêng tư', 'プライバシーポリシー', '隐私政策', '隱私權政策')}
        </Text>
        {t('.', ' của City Crew.', 'に同意したことになります。', '。', '。')}
      </Text>
      <SwitchRow
        prompt={t('Already have an account?', 'Đã có tài khoản?', 'すでにアカウントをお持ちの方は', '已有账号？', '已有帳號？')}
        action={t('Sign in', 'Đăng nhập', 'サインイン', '登录', '登入')}
        onPress={() => navigation.replace('SignIn')}
      />
      <LegalSheet id={legal} onClose={() => setLegal(null)} />
    </>
  );
}
