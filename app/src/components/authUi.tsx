// Shared pieces for the form screens: the list-row field with icon and
// label, the big accented primary button, the header — a back control
// with the title on its line, then a lede each screen places for itself —
// and the two halves of what a failure looks like here: the banner that
// carries a whole form's problem, and the table that turns the names
// `lib/auth` throws into sentences.

import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, TextInputProps, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BackButton, CONTROL_H, fireHaptic, PressableScale, useTabBarClearance } from './ui';
import { useI18n } from '../lib/i18n';
import { PASSWORD_MIN, passwordStrength } from '../lib/password';
import { sentenceCase, type AuthFail } from '../lib/authfail';
import { colors, font, gradAI, radius, space, type } from '../theme';

export function AuthScreen({ children }: { children: React.ReactNode }) {
  const tabClearance = useTabBarClearance();
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: space.page, paddingBottom: tabClearance, gap: space.cardGap }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Back control and title on one line.
 *
 * These are screens for doing something and leaving, and iOS gives that
 * shape an inline title — the large title stacked under the back button is
 * for places you stay in, which is where the tab roots still use it. On a
 * form it was costing about 60pt at the top of a screen whose lower half
 * the keyboard takes.
 *
 * `titleDetail`, not `title`: at 34pt beside a 44pt control, "Sign in"
 * fits and "Đặt tên danh sách" does not. It still wraps to two lines if a
 * translation needs it, which is why the row aligns to the top rather than
 * centring on a control whose height it cannot assume.
 *
 * The eyebrow that used to sit above the title is gone. It was a device
 * for introducing a large title; below an inline one it would be read
 * after the thing it was introducing.
 */
export function AuthHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={s.header}>
      <BackButton onPress={onBack} />
      <Text style={s.title}>{title}</Text>
    </View>
  );
}

/**
 * The sentence under the title — now placed by each screen rather than
 * bolted to the header, because it belongs immediately above the fields it
 * introduces. On the profile form that means below the avatar, which sits
 * between the two.
 */
export function Lede({ children }: { children: string }) {
  return <Text style={s.lede}>{children}</Text>;
}

/**
 * A labelled input, and the place its own error is allowed to appear.
 *
 * `error` belongs here rather than at the foot of the form because that
 * is where the eye already is. A message under the Save button leaves
 * the reader to work out which of five fields it is about — and the one
 * this was written for named a value three fields further up.
 */
export function FieldRow({ icon, label, secure, strength, error, ...input }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  secure?: boolean;
  /** Score the value as a password being invented. Sign-up and reset
   *  only — grading a password that already exists helps nobody. */
  strength?: boolean;
  error?: string | null;
} & TextInputProps) {
  const [hidden, setHidden] = useState(true);
  return (
    <View>
      <View style={[s.field, !!error && s.fieldBad]}>
        {/* The glyph turns with the border. Colour alone should never
            carry a message, which is why the sentence below exists — but
            two signals agreeing is what makes the field findable in a
            scroll. */}
        <Ionicons name={icon} size={22} color={error ? colors.bad : colors.accent} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.fieldLabel}>{label}</Text>
          <TextInput
            style={s.fieldInput}
            placeholderTextColor={colors.textTertiary}
            secureTextEntry={secure && hidden}
            {...input}
          />
        </View>
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel="Toggle password visibility">
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={21} color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      {strength ? <PasswordStrengthMeter password={input.value ?? ''} /> : null}
      {error ? (
        <Text style={s.fieldError} accessibilityLiveRegion="polite">{error}</Text>
      ) : null}
    </View>
  );
}

/**
 * The verdict at Good. The ring sweep's terminal lime (see `ringSweep`),
 * literal for `gradAI`'s reason: these segments are fills, never type,
 * and the sweep already puts this exact value on both grounds.
 */
const METER_GOOD = '#A9C46A';

/**
 * Four segments and a word, under the field where a password is being
 * invented.
 *
 * Every filled segment takes the current verdict's colour rather than
 * each segment keeping its own — the count says how far along, the
 * colour says where that lands, and the two must not disagree. The ramp
 * runs bad → sun → lime → ok: red for a password that will be guessed,
 * through the sweep's own warm-to-cool, to green.
 *
 * The word is there because colour alone should never carry a message —
 * the rule the field's own error state already follows — and it stays
 * `textSecondary` rather than taking the verdict's colour: `sun` was
 * measured for glyphs at 3:1, not for 13.5pt type, and a label that
 * fails on paper is worse than a quiet one. Under the minimum it says
 * "Too short", which is an instruction, where "Weak" is only a verdict.
 *
 * Nothing renders until something is typed: a meter reading an empty
 * field is noise on a form five fields tall.
 */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const { t } = useI18n();
  const level = passwordStrength(password);
  if (level === 0) return null;
  const label = password.length < PASSWORD_MIN
    ? t('Too short', 'Quá ngắn', '短すぎます')
    : [
        t('Weak', 'Yếu', '弱い'),
        t('Fair', 'Trung bình', '普通'),
        t('Good', 'Khá', '良い'),
        t('Strong', 'Mạnh', '強い'),
      ][level - 1];
  const fill = [colors.bad, colors.sun, METER_GOOD, colors.ok][level - 1];
  return (
    <View
      style={s.meter}
      accessibilityLabel={`${t('Password strength', 'Độ mạnh mật khẩu', 'パスワードの強度')}: ${label}`}
    >
      <View style={s.meterTrack} accessible={false}>
        {[1, 2, 3, 4].map((n) => (
          <View key={n} style={[s.meterSeg, n <= level && { backgroundColor: fill }]} />
        ))}
      </View>
      <Text style={s.meterLabel} accessibilityLiveRegion="polite">{label}</Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  return (
    <PressableScale onPress={busy ? undefined : onPress} accessibilityRole="button">
      <LinearGradient {...gradAI} style={s.primary}>
        {busy
          ? <ActivityIndicator color={colors.accentInk} />
          : <Text style={s.primaryText}>{label}</Text>}
      </LinearGradient>
    </PressableScale>
  );
}

/** "Don't have an account?  Sign up" — quiet text with an accented link. */
export function SwitchRow({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  return (
    <View style={s.switchRow}>
      <Text style={s.switchPrompt}>{prompt}</Text>
      <Pressable onPress={() => { fireHaptic('selection'); onPress(); }} hitSlop={8}>
        <Text style={s.switchAction}>{action}</Text>
      </Pressable>
    </View>
  );
}

/**
 * What went wrong with the form as a whole, in its own soft ground.
 *
 * This is the red twin of the banner on a collection going public
 * (`CollectionDetailScreen`), built to the same recipe on purpose: a wash
 * rather than a filled bar, a neutral hairline, a glyph and a sentence.
 * `theme.ts` matched `badSoft` and `okSoft` for weight — 1.13:1 and
 * 1.11:1 against paper — precisely so bad news and good news sit the same
 * distance off the page, and this is the half of that pair that had never
 * been used.
 *
 * It used to be a bare red line of text, which was the one place in this
 * file that broke the rule the rest of it states twice: colour alone must
 * never carry a message. A sentence in `bad` between a coral link and a
 * coral button is, to a reader who cannot separate the two hues, a
 * sentence. The icon and the ground are what make it a problem.
 *
 * WHY THE TEXT IS NOT RED. `bad` on `badSoft` measures 3.50:1 — past the
 * 3:1 a glyph owes, and under the 4.5:1 that 15pt type owes. So the icon
 * takes the red and the sentence takes `text`, at 14.4:1. That is also
 * what the green banner does, and on a screen whose accent is already
 * coral it keeps the count of red things from going up by one.
 */
export function FormError({ children }: { children: string }) {
  return (
    <View style={s.formError} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle" size={20} color={colors.bad} />
      <Text style={s.formErrorText}>{children}</Text>
    </View>
  );
}

/**
 * The failures this app finds for itself, as opposed to the ones
 * `authfail` reads off a Supabase code.
 *
 * Most are empty required fields, checked before anything is sent. That
 * ordering is the point rather than an optimisation: the server's answer
 * to an empty sign-in form is "missing email or phone" — English, lower
 * case, and naming a `phone` this app has never asked for — and no
 * mapping after the fact can put that in the reader's language as well as
 * simply not asking. `handle.ts` states the same doctrine for the rule it
 * mirrors: what a client-side check buys is a legible message before a
 * round trip.
 *
 * The last two are raised by `lib/auth` rather than by a screen, for the
 * same reason everything else here travels as a name: that module cannot
 * call `t`.
 */
export type FormFail =
  | 'need_email'
  | 'need_password'
  | 'need_code'
  | 'need_name'
  | 'not_signed_in'
  | 'bad_image'
  | 'slow_prepare'
  | 'slow_upload'
  | 'slow_save';

/**
 * The failure `lib/auth` threw, as a sentence in the reader's language.
 *
 * The names come across as the `Error`'s message (see `asAuthFail`), and
 * this is where they become words — here rather than in `lib/auth`,
 * because `t` is a hook and the provider's methods are not components.
 *
 * Anything not in this table is returned unchanged, which is how a
 * failure nobody has named yet still reaches the reader in the server's
 * own words. That is worth more than it sounds: "Invalid login
 * credentials" and "Email not confirmed" are different problems, and
 * English that distinguishes them beats Vietnamese that does not.
 *
 * Typed `Record<AuthFail, string>` so the exhaustiveness is the compiler's
 * job: name a new failure in `lib/authfail` and this stops building until
 * somebody writes the sentence for it.
 */
export function useFailText(): (raw: string) => string {
  const said = useFailSentences();
  return (raw) => (said as Record<string, string>)[raw] ?? sentenceCase(raw);
}

/**
 * The table itself, which `useFailText` looks names up in.
 *
 * Split out and exported for the test, and worth the extra export: a test
 * that held its own copy of the names could only check the ones somebody
 * remembered to copy, and the failure it exists to catch — a name whose
 * sentence was written in English only — is exactly the kind that arrives
 * with a name nobody has copied yet. Reading the real table means a new
 * entry is covered the moment it is added.
 */
export function useFailSentences(): Record<AuthFail | FormFail, string> {
  const { t } = useI18n();
  return {
    // Not "wrong password". The server will not say which of the two it
    // was — deliberately, so that a stranger cannot use this form to
    // discover which addresses have accounts — and a message that picked
    // one would be guessing in front of the person who knows.
    credentials: t(
      'Email or password is incorrect.',
      'Email hoặc mật khẩu không đúng.',
      'メールアドレスまたはパスワードが正しくありません。',
    ),
    // The one that most needs its own sentence: this person typed the
    // right password, and the fix is in their inbox rather than in the
    // form.
    unconfirmed: t(
      "This email hasn't been confirmed yet. Check your inbox for the code.",
      'Email này chưa được xác nhận. Kiểm tra hộp thư để lấy mã.',
      'このメールアドレスはまだ確認されていません。受信トレイのコードをご確認ください。',
    ),
    email_taken: t(
      'An account already uses this email. Sign in instead.',
      'Email này đã có tài khoản. Hãy đăng nhập.',
      'このメールアドレスは登録済みです。サインインしてください。',
    ),
    // `PASSWORD_MIN` rather than the number, so this cannot drift from
    // the check that fires first on the way in.
    weak_password: t(
      `Pick a longer password — at least ${PASSWORD_MIN} characters.`,
      `Chọn mật khẩu dài hơn — ít nhất ${PASSWORD_MIN} ký tự.`,
      `もっと長いパスワードを選んでください。${PASSWORD_MIN}文字以上必要です。`,
    ),
    // Wrong and expired are one sentence because the answer is the same
    // either way, and because the server does not tell them apart.
    bad_code: t(
      'That code is wrong or has expired. Ask for a new one.',
      'Mã không đúng hoặc đã hết hạn. Hãy yêu cầu mã mới.',
      'コードが正しくないか、有効期限が切れています。新しいコードを取得してください。',
    ),
    rate_limit: t(
      'Too many attempts. Wait a moment and try again.',
      'Thử quá nhiều lần. Đợi một lát rồi thử lại.',
      '試行回数が多すぎます。少し待ってからもう一度お試しください。',
    ),
    bad_email: t(
      "That email address doesn't look right.",
      'Địa chỉ email không hợp lệ.',
      'メールアドレスの形式が正しくありません。',
    ),
    same_password: t(
      'The new password is the same as the current one.',
      'Mật khẩu mới trùng với mật khẩu cũ.',
      '新しいパスワードが現在のものと同じです。',
    ),
    // Named separately from every refusal above because the action is
    // different: nothing about what was typed is wrong.
    offline: t(
      'No connection. Check your network and try again.',
      'Không có kết nối. Kiểm tra mạng rồi thử lại.',
      '接続できません。ネットワークを確認してもう一度お試しください。',
    ),
    // Names no field, on purpose. `validation_failed` covers a bad
    // address and a missing password alike, and the empty cases it used
    // to arrive for are caught before the request now.
    bad_input: t(
      'Check the details you entered.',
      'Kiểm tra lại thông tin bạn đã nhập.',
      '入力内容をご確認ください。',
    ),

    // ── found here, before anything is sent ──
    need_email: t(
      'Enter your email address.',
      'Nhập địa chỉ email của bạn.',
      'メールアドレスを入力してください。',
    ),
    need_password: t(
      'Enter your password.',
      'Nhập mật khẩu của bạn.',
      'パスワードを入力してください。',
    ),
    need_code: t(
      'Enter the code from the email.',
      'Nhập mã trong email.',
      'メールに記載のコードを入力してください。',
    ),
    need_name: t(
      'Tell us what to call you.',
      'Cho chúng tôi biết tên của bạn.',
      'お名前を教えてください。',
    ),

    // ── raised by `lib/auth`, which cannot call `t` ──
    not_signed_in: t(
      'Sign in to do that.',
      'Hãy đăng nhập để làm điều đó.',
      'この操作にはサインインが必要です。',
    ),
    bad_image: t(
      "That picture could not be read. Try another.",
      'Không đọc được ảnh này. Hãy chọn ảnh khác.',
      'この画像を読み込めませんでした。別の画像をお試しください。',
    ),
    // Three names for one shape, because which step stalled is the whole
    // information a stall carries — see `withTimeout`.
    slow_prepare: t(
      'Preparing the photo is taking too long. Check your connection and try again.',
      'Chuẩn bị ảnh mất quá lâu. Kiểm tra kết nối rồi thử lại.',
      '画像の準備に時間がかかっています。接続を確認してもう一度お試しください。',
    ),
    slow_upload: t(
      'Uploading the photo is taking too long. Check your connection and try again.',
      'Tải ảnh lên mất quá lâu. Kiểm tra kết nối rồi thử lại.',
      '画像のアップロードに時間がかかっています。接続を確認してもう一度お試しください。',
    ),
    slow_save: t(
      'Saving the photo is taking too long. Check your connection and try again.',
      'Lưu ảnh mất quá lâu. Kiểm tra kết nối rồi thử lại.',
      '画像の保存に時間がかかっています。接続を確認してもう一度お試しください。',
    ),
  };
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  // Top-aligned, not centred: the title may wrap to two lines and the
  // control must stay level with the first of them.
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    marginBottom: 2,
  },
  // `paddingTop` optically centres a 26pt line against the 44pt control
  // without pinning either to the other's height.
  title: { flex: 1, color: colors.text, ...type.titleDetail, paddingTop: 7 },
  lede: { color: colors.textSecondary, ...type.body, lineHeight: 24, marginBottom: 2 },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card, paddingHorizontal: space.cardPadding, paddingVertical: 12,
  },
  // The border carries the state; the fill stays as it was. A tinted
  // field reads as a different kind of field rather than as this field
  // with something wrong.
  fieldBad: { borderColor: colors.bad },
  fieldLabel: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
  // Tucked under the field it belongs to, indented to its text column.
  fieldError: {
    color: colors.bad, fontSize: 13.5, lineHeight: 18,
    marginTop: 6, marginBottom: 2, paddingHorizontal: space.cardPadding,
  },
  fieldInput: { color: colors.text, fontSize: 15.5, paddingVertical: 2, paddingHorizontal: 0 },

  // Indented like `fieldError`: this is the same under-field zone, and
  // the two must line up on the one screen that can show both.
  meter: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 8, paddingHorizontal: space.cardPadding,
  },
  meterTrack: { flex: 1, flexDirection: 'row', gap: 5 },
  // Empty segments sit on the tinted well, not on a colour: the track is
  // what has not happened yet, and the ring already settled that it
  // stays neutral so the colour is spent on progress alone.
  meterSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surfaceGlassStrong },
  meterLabel: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 18, fontWeight: font.medium },

  primary: {
    borderRadius: radius.pill, minHeight: CONTROL_H, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center', marginTop: 6,
  },
  primaryText: { color: colors.accentInk, fontSize: 17, fontWeight: font.semibold },

  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 10 },
  switchPrompt: { color: colors.textSecondary, ...type.meta },
  switchAction: { color: colors.accent, fontSize: 15, fontWeight: font.semibold },

  // The collection banner's recipe, in red. Same radius, same padding,
  // same hairline — the two are the same object saying opposite things,
  // and they should not be two shapes.
  formError: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 14,
    borderRadius: radius.input,
    backgroundColor: colors.badSoft,
    // Neutral, not red. A red-tinted edge is the thing `badSoft`'s own
    // note warns about: against the dark ground it comes out near black
    // and outlines the one element that should read soft.
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  // `text`, not `bad` — see the note on FormError for the measurement.
  formErrorText: { flex: 1, color: colors.text, ...type.meta, fontWeight: font.medium, lineHeight: 21 },
});
