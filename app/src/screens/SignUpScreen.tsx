// Sign up — name, email, password and confirmation, per the reference.
// When Supabase requires email confirmation the flow falls back to a
// emailed code (links in the email can't open Expo Go). Its length is
// a project setting, so nothing here assumes one — see `lib/otp.ts`.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AuthHeader, AuthScreen, FieldRow, FormError, Lede, PrimaryButton, StepDots, SwitchRow, useFailText,
} from '../components/authUi';
import LegalSheet from '../components/LegalSheet';
import TastePicker from '../components/TastePicker';
import { successHaptic } from '../components/ui';
import { FloatingPlane, HeartDoodle } from '../components/welcomeArt';
import { isHandleFree, useAuth } from '../lib/auth';
import { fixedOnForm } from '../lib/authfail';
import { cleanEmail, emailShapeOk } from '../lib/email';
import { useI18n } from '../lib/i18n';
import type { LegalId } from '../lib/legal';
import { NO_PREFERENCES, savePreferences } from '../lib/data';
import { cleanOtp, OTP_MAX } from '../lib/otp';
import { HANDLE_MAX, handleProblem, normalizeHandle, suggestHandle } from '../lib/handle';
import { PASSWORD_MIN } from '../lib/password';
import { colors, font, type } from '../theme';
import { leaveAuth, type Nav } from '../nav';
import welcomePlane from '../../assets/welcome-plane.png';

/**
 * How long a username has to stop changing before the app asks about it.
 *
 * Long enough that typing a name does not fire a query per keystroke —
 * `suggestHandle` rewrites the field on every letter of the display name,
 * so "Thai Thi Hoa" would otherwise be twelve — and short enough that the
 * answer arrives while the reader is still looking at the field rather
 * than three fields further down.
 */
export const HANDLE_CHECK_MS = 500;

export default function SignUpScreen({ navigation }: { navigation: Nav }) {
  const { t, lang } = useI18n();
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
  const [step, setStep] = useState<'form' | 'taste' | 'confirm' | 'welcome'>('form');
  const [taste, setTaste] = useState<string[]>([]);
  /**
   * The taste, waiting for an account to belong to.
   *
   * It is collected before one exists now, and `preferences` is scoped by
   * RLS to the signed-in reader — so the write cannot happen where the
   * answer is given. This holds it from the moment `signUp` is called
   * until a session actually lands, which is either that call returning
   * one or `confirmSignUp` landing it a step later.
   *
   * Null once written, and a ref guards the write besides: a session
   * object changes identity on every token refresh, and rewriting there
   * would overwrite a preference the reader may have edited since.
   */
  const [pendingTaste, setPendingTaste] = useState<string[] | null>(null);
  const wrote = useRef(false);
  /**
   * Whose session was here before we asked for a new one, so the write
   * can tell "the account we just made" from "an account that was
   * already signed in".
   *
   * Without it the effect fires on the session that happens to be
   * present, which on a screen reached while already signed in would
   * mean writing this taste onto somebody else's account — and doing it
   * before `signUp` had even returned.
   */
  const before = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // Which document is open over the form, if any. State rather than a
  // navigate: a Modal renders inside this screen, so nothing here
  // unmounts and every field the reader has already filled in survives
  // the round trip with no work at all.
  const [legal, setLegal] = useState<LegalId | null>(null);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || uid === before.current || !pendingTaste || wrote.current) return;
    wrote.current = true;
    const chosen = pendingTaste;
    setPendingTaste(null);
    // Swallowed, exactly as before: the account is made, the answer is a
    // preference, and a failed write here must not look like a failed
    // sign-up. An empty list writes nothing rather than writing empty.
    if (chosen.length) {
      void savePreferences(uid, { ...NO_PREFERENCES, categories: [...chosen] }).catch(() => {});
    }
  }, [session, pendingTaste]);

  // `onFail` exists for one caller: `finish` fires the request a step
  // after the fields it can complain about, and uses this to walk the
  // reader back to them. See `fixedOnForm`.
  const run = async (fn: () => Promise<void>, onFail?: (fail: string) => void) => {
    setBusy(true);
    setError(null);
    setNameError(null);
    try {
      await fn();
    } catch (err) {
      const fail = (err as Error).message;
      setError(fail);
      onFail?.(fail);
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

  const takenMessage = (h: string) => t(
    `@${h} is taken. Try another.`,
    `@${h} đã có người dùng. Chọn tên khác.`,
    `@${h} は使用されています。別の名前をお試しください。`,
  );

  /**
   * Whether the username is free, asked while it is being typed.
   *
   * It used to be asked at submit, after both password fields — so the
   * reader filled in everything and *then* learned the name was taken.
   * Worse, the name is usually not theirs: `suggestHandle` proposes it
   * from the display name and `handleTouched` stays false, so the app was
   * making a suggestion, taking the rest of the form, and only then
   * withdrawing its own suggestion.
   *
   * Nothing is asked about a handle the shape rules already reject —
   * there is no point asking the server about `ab`, and a sentence about
   * length while somebody is on their second letter is nagging. Those
   * still surface at submit, where the reader has finished typing.
   *
   * `live` is latest-wins. Every change tears this effect down, so a slow
   * answer about a handle that has since been edited cannot land on the
   * new one — which is the bug this shape of check usually ships with.
   */
  useEffect(() => {
    // Whatever was showing was about a value that is no longer in the
    // field. Cleared here rather than in `onChangeText` because the
    // display name rewrites this field too, and one place is enough.
    setNameError(null);
    const chosen = normalizeHandle(handle);
    if (handleProblem(chosen)) return undefined;

    let live = true;
    const id = setTimeout(() => {
      isHandleFree(chosen)
        .then((free) => { if (live && !free) setNameError(takenMessage(chosen)); })
        // Swallowed on purpose. This is a courtesy, not the decision: the
        // unique index decides, submit asks again, and a reader offline
        // for a moment should not be told their name is taken.
        .catch(() => {});
    }, HANDLE_CHECK_MS);

    return () => { live = false; clearTimeout(id); };
    // `t` is stable for a language and the message is rebuilt per run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, lang]);

  const submit = () =>
    run(async () => {
      // IN THE ORDER THE FIELDS ARE IN. They were not: the username was
      // checked after both password fields, so a form with a short
      // password and a taken name took two submits to learn both
      // problems, and named the lower field first.
      //
      // The two that nothing downstream would name properly stay as they
      // are — an empty name reaches the server as valid metadata and
      // makes a nameless account, and an empty address comes back as
      // "missing email or phone". The handle needs neither, because
      // `handleProblem` already names its own empty case.
      if (!name.trim()) throw new Error('need_name');
      const chosen = normalizeHandle(handle);
      const bad = handleProblem(chosen);
      if (bad) { setNameError(handleMessage(bad)); return; }
      if (!email.trim()) throw new Error('need_email');
      // Shaped like an address at all — the field already strips the
      // whitespace case as it is typed, so what this catches is the
      // missing `@` and the dotless domain. Named now, on the screen
      // with the field, instead of by the server one step later with a
      // sentence that names no field. `bad_email` is the same name the
      // server's own refusal arrives under, so the wording cannot drift
      // apart between the two moments it can be said.
      if (!emailShapeOk(email.trim())) throw new Error('bad_email');
      if (password.length < PASSWORD_MIN) {
        throw new Error(t('Password must be at least 8 characters.', 'Mật khẩu cần ít nhất 8 ký tự.', 'パスワードは8文字以上にしてください。'));
      }
      if (password !== confirm) {
        throw new Error(t("Passwords don't match.", 'Mật khẩu nhập lại không khớp.', 'パスワードが一致しません。'));
      }
      // Last of the six, and out of screen order on purpose: it is the
      // only one that costs a round trip, and making every submit wait on
      // the network before it will name a mistyped password would be a
      // worse form than the one this is fixing.
      //
      // Still here at all because the check above can be outrun — somebody
      // who types quickly and submits inside `HANDLE_CHECK_MS` never gave
      // it time to answer. The database is what actually decides, and
      // losing that race falls back to a generated handle rather than to a
      // failed sign-up.
      if (!(await isHandleFree(chosen))) {
        setNameError(takenMessage(chosen));
        return;
      }
      // Nothing is created here any more. The form is checked and the
      // reader moves on; `signUp` runs at the end of the next step, so
      // an account exists only for somebody who went the whole way.
      //
      // The handle was just checked free and will be claimed a little
      // later than it used to be, which widens the window somebody else
      // can take it in. That race already had its answer: the
      // `handle_new_user` trigger "falls back to a generated one rather
      // than failing the account into existence".
      setStep('taste');
    });

  const verify = () =>
    run(async () => {
      if (!cleanOtp(code)) throw new Error('need_code');
      await confirmSignUp(email.trim(), cleanOtp(code));
      successHaptic();
      setStep('welcome');
    });

  /**
   * The step that makes the account.
   *
   * It did not use to. The form created it and this asked an optional
   * question afterwards, on the reasoning that an account already made is
   * an account that cannot be lost — "whatever happens next, including
   * closing the app, the reader has one". The trade has been made the
   * other way: nobody gets a row until they have finished, so a form
   * abandoned here leaves nothing behind to collide with the email when
   * they come back and try again.
   *
   * What that reasoning was really defending is still defended, and by
   * the same thing it always was: **"Bỏ qua" is a real answer.** A
   * skipped taste costs nothing the app cannot recover — `taste.ts`
   * scores four signals and three of them come from what somebody does
   * rather than what they declare — so skipping still makes the account,
   * it just makes it without an answer. Both buttons here go forward.
   * They differ only in what they carry.
   */
  const finish = (chosen: readonly string[]) =>
    run(async () => {
      // Held for the effect above: with confirmation on there is no
      // session yet, so the write waits for one rather than being lost.
      before.current = session?.user?.id ?? null;
      setPendingTaste([...chosen]);
      const { needsConfirm } = await signUp(name.trim(), normalizeHandle(handle), email.trim(), password);
      if (needsConfirm) { setStep('confirm'); return; }
      successHaptic();
      setStep('welcome');
    // The request fires here, one screen after the fields it can
    // complain about. A failure the reader fixes by editing one of them
    // walks them back to it, banner and field on the same screen; the
    // chips survive in state, so Continue costs nothing but the walk.
    // What no field fixes — the rate limiter, a dead network — stays
    // here, beside the button worth pressing again.
    }, (fail) => { if (fixedOnForm(fail)) setStep('form'); });

  if (step === 'taste') {
    return (
      <AuthScreen>
        <StepDots step={2} total={3} />
        {/* A back control, which this screen used to refuse — "there is
            nothing behind this now: the form is spent and the account is
            made". Both halves of that are false since the account moved
            to the end. The form is still editable and nothing has been
            created, so a reader who mistyped their address can go and fix
            it instead of finding out after the code fails to arrive. */}
        <AuthHeader
          onBack={() => setStep('form')}
          title={t('What are you into?', 'Bạn thích gì?', '好みを教えてください')}
        />
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
        {/* The account is made here now, so this is where its failures
            land — an address already registered, a password the server
            refuses. The back control above is what makes that message
            actionable rather than a dead end. */}
        {error ? <FormError>{failText(error)}</FormError> : null}
        {/* Two answers, both visible. The button used to be one control
            wearing two words — "Xong" once something was picked, "Bỏ
            qua" until then — which meant the largest, warmest thing on
            the screen invited the reader to leave at the exact moment
            they arrived. Skipping is still a real answer and still makes
            the account; it is now a real answer that does not have to
            hide the other one to be offered. */}
        <PrimaryButton
          label={t('Continue', 'Tiếp tục', '続ける')}
          onPress={() => finish(taste)}
          busy={busy}
        />
        {/* Not disabled with nothing picked. A grey button is a riddle —
            the reader has to guess what would unlock it — and there is
            nothing to unlock: continuing with no answer is exactly what
            the line below it offers. */}
        <Pressable
          onPress={() => { if (!busy) finish([]); }}
          accessibilityRole="button"
          hitSlop={10}
        >
          <Text style={s.skip}>{t('Skip for now', 'Bỏ qua', 'あとで')}</Text>
        </Pressable>
      </AuthScreen>
    );
  }

  if (step === 'confirm') {
    return (
      <AuthScreen>
        {/* The third mark, not a fourth. Whether this screen happens at
            all is a project setting `signUp` only reveals once it has
            run, so it shares the last step with finishing rather than
            making the bar grow a mark halfway through the flow. */}
        <StepDots step={3} total={3} />
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

  if (step === 'welcome') {
    return (
      <AuthScreen>
        {/* No marks here. The bar answers "how much longer", and the
            answer has stopped being interesting. */}
        {/* The one drawing in this flow, and its hero. `WelcomeSheet`
            states the house rule — "deliver the value, don't describe it;
            there is no tour, no carousel" — and a picture on a screen
            that is asking for something would be arguing with it. This
            screen asks for nothing. It is the moment of arrival, and the
            app already allows itself a mark in exactly that kind of
            moment: the orb that turns while a plan is being drawn. It
            drifts now, too — `FloatingPlane` holds the motion and the
            Reduce Motion answer.

            The ONE drawing, and that is a decision with a receipt: a
            line-art skyline sat along the bottom of this screen for one
            release and was taken back out — against the phone it crowded
            the arrival it was meant to ground, and the reference's lower
            half is empty on purpose. Whoever is next tempted to fill
            that space: it was tried.

            Shipped at 768×512 from a 1536×1024 original — 1.1MB down to
            66KB, and still twice the density of the ~374×250 it draws
            at. Everyone downloads this file, and nobody looks at it
            twice. */}
        <FloatingPlane source={welcomePlane} style={s.plane} />
        {/* The whole display name, not a first name. Which part of a name
            somebody is addressed by differs by language — Vietnamese
            reaches for the last word, English the first — and a greeting
            that gets it wrong is worse than one that is merely formal.

            Centred, like everything else on the screen: the reference's
            composition is symmetric around the plane, and the one step
            of this flow that is not a form does not need a form's left
            edge. A row rather than an inline glyph, because the heart is
            a drawing now — `HeartDoodle` says what the glyph got wrong —
            and SVG cannot ride inside a `Text`. On a name long enough to
            wrap, the heart holds the title's top right corner, which is
            where a doodle would land anyway. */}
        <View style={s.welcomeTitleRow}>
          <Text style={s.welcomeTitle} numberOfLines={2}>
            {t(
              `Welcome, ${name.trim()}`,
              `Chào mừng, ${name.trim()}`,
              `${name.trim()} さん、ようこそ`,
            )}
          </Text>
          <HeartDoodle style={s.welcomeHeart} />
        </View>
        {/* Three short clauses, ending on the button's own word, so "Start
            exploring" reads as the sentence finishing itself. The planner
            goes unmentioned on purpose — the house rule above again: the
            plan button is one tab away, and this screen's job is to open
            the door, not to read out the brochure. Its own style rather
            than `Lede`, for the centring alone. */}
        <Text style={s.welcomeLede}>{t(
            'You’re all set. Save places you love, build collections, and find your next place to explore.',
            'Xong hết rồi. Lưu những nơi bạn thích, gom thành bộ sưu tập, và tìm nơi tiếp theo để khám phá.',
            '準備完了です。気に入った場所を保存し、コレクションにまとめて、次の探索先を見つけましょう。',
          )}</Text>
        <PrimaryButton
          arrow
          label={t('Start exploring', 'Bắt đầu khám phá', '探索をはじめる')}
          onPress={() => leaveAuth(navigation)}
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <StepDots step={1} total={3} />
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
      {/* Whitespace never belongs in an address, and the iOS keyboard
          loves inserting a space after an autocomplete — "name@ gmail.com"
          was a real sign-up, refused a step later by the server with a
          sentence that named no field. Stripped as it is typed, so the
          mistake cannot be made rather than being caught. */}
      <FieldRow
        icon="mail-outline"
        label={t('Email address', 'Địa chỉ email', 'メールアドレス')}
        placeholder={t("We'll never share your email.", 'Email của bạn được giữ kín.', 'メールアドレスは公開されません。')}
        value={email}
        onChangeText={(v) => setEmail(cleanEmail(v))}
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
  // The other answer, offered rather than hidden. Centred under the
  // button it is an alternative to, and underlined because it is the one
  // piece of running text on these screens that is a control — the app
  // underlines nothing else, which is exactly what makes it read as
  // something to press here.
  skip: {
    color: colors.textSecondary, ...type.meta, textAlign: 'center',
    textDecorationLine: 'underline', paddingVertical: 6,
  },
  // The hero's box: taller than it was, and bled past the page padding —
  // no explicit width, so the column stretches it and the negative
  // margins count. `contain` inside the fixed height keeps the title's
  // position steady whatever the screen's width. The top margin is the
  // reference's air: with the lower half deliberately empty, the drawing
  // sits down into the screen instead of hanging off the status bar.
  plane: { height: 250, marginHorizontal: -14, marginTop: 40 },
  // The greeting, one size up from the step titles: this screen has one
  // thing to say and the room to say it. `flexShrink` so the name, not
  // the heart, is what gives when the row runs out of room.
  welcomeTitleRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 6, marginTop: 10 },
  welcomeTitle: { color: colors.text, ...type.titleDetail, textAlign: 'center', flexShrink: 1 },
  // Nudged toward the cap height, where a hand would draw it.
  welcomeHeart: { marginTop: 3 },
  welcomeLede: { color: colors.textSecondary, ...type.body, lineHeight: 24, textAlign: 'center', marginBottom: 2 },
  terms: { color: colors.textTertiary, ...type.meta, textAlign: 'center', lineHeight: 26, marginTop: 4 },
  // Only the colour and the weight change: a different size inside a
  // sentence would break the line's rhythm, and there is no underline
  // anywhere else in the app.
  termsLink: { color: colors.accent, fontWeight: font.medium },
});
