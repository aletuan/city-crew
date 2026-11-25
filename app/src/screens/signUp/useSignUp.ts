// Out of `SignUpScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.
// The flow's state: the fields, the step, and the three requests.

import { useEffect, useRef, useState } from 'react';
import { successHaptic } from '../../components/ui';
import { isHandleFree, useAuthActions, useSession } from '../../lib/auth';
import { fixedOnForm } from '../../lib/authfail';
import { NO_PREFERENCES, savePreferences } from '../../lib/data';
import { emailShapeOk } from '../../lib/email';
import { handleProblem, normalizeHandle } from '../../lib/handle';
import { useI18n } from '../../lib/i18n';
import { cleanOtp } from '../../lib/otp';
import { PASSWORD_MIN } from '../../lib/password';
import { hasResume } from '../../lib/resume';
import { fetchSignUpNeedsConfirm, signUpTotal } from '../../lib/signup';

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

/** The username's two kinds of complaint, and the check made while it is
 *  typed. */
function useHandleCheck(handle: string, setNameError: (message: string | null) => void) {
  const { t, lang } = useI18n();
  const handleMessage = (bad: NonNullable<ReturnType<typeof handleProblem>>) => ({
    empty: t('Choose a username.', 'Hãy chọn một tên người dùng.', 'ユーザー名を選んでください。', '请选择用户名。', '請選擇使用者名稱。'),
    short: t('At least 3 characters.', 'Ít nhất 3 ký tự.', '3文字以上にしてください。', '至少 3 个字符。', '至少 3 個字元。'),
    long: t('20 characters at most.', 'Tối đa 20 ký tự.', '20文字以内にしてください。', '最多 20 个字符。', '最多 20 個字元。'),
    chars: t('Letters, numbers and _ only.', 'Chỉ gồm chữ, số và dấu _.', '英数字と _ のみ使えます。', '只能使用字母、数字和 _。', '只能使用字母、數字和 _。'),
  }[bad]);

  const takenMessage = (h: string) => t(
    `@${h} is taken. Try another.`,
    `@${h} đã có người dùng. Chọn tên khác.`,
    `@${h} は使用されています。別の名前をお試しください。`,
    `@${h} 已被使用，请换一个。`, `@${h} 已被使用，請換一個。`,
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
  return { handleMessage, takenMessage };
}

export function useSignUp() {
  const { t } = useI18n();
  const { session } = useSession();
  const { signUp, confirmSignUp } = useAuthActions();
  const hadPending = useRef(hasResume());
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

  /**
   * Whether this flow ends with an emailed code — the server's answer,
   * asked for at mount so the step bar promises the right count from
   * its first frame. See `lib/signup` for the endpoint and the default.
   *
   * `null` until it answers, and if it never does: the bar reads that
   * as two marks, the steps every configuration has. `finish` overwrites
   * it with the fact the moment `signUp` reveals one — the only case
   * the bar grows late, and it grows on the screen that proves it must.
   */
  const [needsCode, setNeedsCode] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void fetchSignUpNeedsConfirm().then((v) => { if (live && v !== null) setNeedsCode(v); });
    return () => { live = false; };
  }, []);
  const dotTotal = signUpTotal(needsCode);

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

  const { handleMessage, takenMessage } = useHandleCheck(handle, setNameError);

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
        throw new Error(t('Password must be at least 8 characters.', 'Mật khẩu cần ít nhất 8 ký tự.', 'パスワードは8文字以上にしてください。', '密码至少需要 8 个字符。', '密碼至少需要 8 個字元。'));
      }
      if (password !== confirm) {
        throw new Error(t("Passwords don't match.", 'Mật khẩu nhập lại không khớp.', 'パスワードが一致しません。', '两次输入的密码不一致。', '兩次輸入的密碼不一致。'));
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
      hadPending.current ||= hasResume();
      before.current = session?.user?.id ?? null;
      setPendingTaste([...chosen]);
      const { needsConfirm } = await signUp(name.trim(), normalizeHandle(handle), email.trim(), password);
      // The fact, wherever the up-front ask had landed: kept in state so
      // a reader who goes back to fix their address sees three marks on
      // the form too, now that three is known to be the truth.
      if (needsConfirm) { setNeedsCode(true); setStep('confirm'); return; }
      successHaptic();
      setStep('welcome');
    // The request fires here, one screen after the fields it can
    // complain about. A failure the reader fixes by editing one of them
    // walks them back to it, banner and field on the same screen; the
    // chips survive in state, so Continue costs nothing but the walk.
    // What no field fixes — the rate limiter, a dead network — stays
    // here, beside the button worth pressing again.
    }, (fail) => { if (fixedOnForm(fail)) setStep('form'); });

  return {
    session, hadPending, name, setName, handle, setHandle, handleTouched, setHandleTouched,
    email, setEmail, password, setPassword, confirm, setConfirm, code, setCode,
    step, setStep, taste, setTaste, busy, error, setError, nameError, setNameError,
    dotTotal, submit, verify, finish,
  };
}

export type SignUp = ReturnType<typeof useSignUp>;
