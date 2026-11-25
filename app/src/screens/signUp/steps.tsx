// Out of `SignUpScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.
// The three steps after the form, each drawn inside the screen's
// `AuthScreen`.

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  AuthHeader, FieldRow, FormError, Lede, PrimaryButton, StepDots, useFailText,
} from '../../components/authUi';
import { useSignupTour } from '../../components/SignupTour';
import TastePicker from '../../components/TastePicker';
import { FloatingPlane, HeartDoodle } from '../../components/welcomeArt';
import { useI18n } from '../../lib/i18n';
import { cleanOtp, OTP_MAX } from '../../lib/otp';
import { hasResume, peekResume } from '../../lib/resume';
import { leaveAuth, type Nav } from '../../nav';
import welcomePlane from '../../../assets/welcome-plane.png';
import { s } from './styles';
import type { SignUp } from './useSignUp';

/** What are you into: the step that makes the account. */
export function TasteStep({ f }: { f: SignUp }) {
  const { t } = useI18n();
  const failText = useFailText();
  const { dotTotal, setStep, taste, setTaste, error, finish, busy } = f;
  return (
    <>
      <StepDots step={2} total={dotTotal} />
      {/* A back control, which this screen used to refuse — "there is
          nothing behind this now: the form is spent and the account is
          made". Both halves of that are false since the account moved
          to the end. The form is still editable and nothing has been
          created, so a reader who mistyped their address can go and fix
          it instead of finding out after the code fails to arrive. */}
      <AuthHeader
        onBack={() => setStep('form')}
        backBare
        title={t('What are you into?', 'Bạn thích gì?', '好みを教えてください', '你喜欢什么？', '你喜歡什麼？')}
      />
      <Lede>{t(
          'Choose up to 5 interests for suggestions that suit you. You can change them later in your profile.',
          'Chọn tối đa 5 sở thích để nhận gợi ý phù hợp. Bạn có thể thay đổi sau trong hồ sơ.',
          'あなたに合った提案を受け取るために、興味のあるものを5つまで選んでください。あとからプロフィールで変更できます。',
          '最多选择 5 个兴趣，获取适合你的推荐。之后可以在个人主页中修改。', '最多選擇 5 個興趣，取得適合你的推薦。之後可以在個人檔案中修改。',
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
          'City Crew uses your interests, trips and activity history to suggest more relevant content. You can turn off activity recording in Account → Edit profile.',
          'City Crew sử dụng sở thích, hành trình và lịch sử hoạt động để gợi ý nội dung phù hợp hơn. Bạn có thể tắt việc ghi nhớ hoạt động trong Tài khoản → Sửa hồ sơ.',
          'City Crew は好みや旅程、アクティビティ履歴をもとに、あなたに合ったコンテンツを提案します。アクティビティの記録は「アカウント」→「プロフィール編集」でオフにできます。',
          'City Crew 会根据你的兴趣、行程和活动记录推荐更相关的内容。你可以在“账号 → 编辑个人资料”中关闭活动记录。', 'City Crew 會根據你的興趣、行程和活動記錄推薦更相關的內容。你可以在「帳號 → 編輯個人資料」中關閉活動記錄。',
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
        label={t('Continue', 'Tiếp tục', '続ける', '继续', '繼續')}
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
        testID="signup-taste-skip"
      >
        <Text style={s.skip}>{t('Skip for now', 'Bỏ qua', 'あとで', '暂时跳过', '暫時跳過')}</Text>
      </Pressable>
    </>
  );
}

/** The emailed code, when the project asks for one. */
export function ConfirmStep({ f }: { f: SignUp }) {
  const { t } = useI18n();
  const failText = useFailText();
  const { setStep, email, code, setCode, verify, error, busy } = f;
  return (
    <>
      {/* A literal three: reaching this screen IS the proof the flow
          has three steps, whatever the up-front ask believed — and
          `finish` has already written that fact into `needsCode`, so
          going back to fix the address shows three on the form too. */}
      <StepDots step={3} total={3} />
      <AuthHeader
        onBack={() => setStep('form')}
        backBare
        title={t('Check your email', 'Kiểm tra email', 'メールをご確認ください', '请查收邮件', '請查看電子郵件')}
      />
      <Lede>{t(
          `We sent a confirmation code to ${email.trim()}. Enter it below to activate your account.`,
          `Mã xác nhận đã được gửi tới ${email.trim()}. Nhập mã bên dưới để kích hoạt tài khoản.`,
          `${email.trim()} に確認コードを送信しました。以下に入力してアカウントを有効化してください。`,
          `我们已向 ${email.trim()} 发送了验证码。请在下方输入以激活账号。`, `我們已向 ${email.trim()} 傳送了驗證碼。請在下方輸入以啟用帳號。`,
        )}</Lede>
      <FieldRow
        icon="key-outline"
        label={t('Confirmation code', 'Mã xác nhận', '確認コード', '验证码', '驗證碼')}
        placeholder={t('Paste the code from the email', 'Dán mã trong email', 'メールのコードを貼り付け', '粘贴邮件中的验证码', '貼上郵件中的驗證碼')}
        value={code}
        onChangeText={(v) => setCode(cleanOtp(v))}
        keyboardType="number-pad"
        maxLength={OTP_MAX}
        onSubmitEditing={verify}
        returnKeyType="done"
      />
      {error ? <FormError>{failText(error)}</FormError> : null}
      <PrimaryButton label={t('Verify & continue', 'Xác nhận & tiếp tục', '確認して続行', '验证并继续', '驗證並繼續')} onPress={verify} busy={busy} />
    </>
  );
}

/** The arrival. */
export function WelcomeStep({ f, navigation }: { f: SignUp; navigation: Nav }) {
  const { t } = useI18n();
  const tour = useSignupTour();
  const { name, hadPending, session } = f;
  const pending = peekResume(Date.now());
  const continueLabel = pending?.kind === 'save'
    ? t('Continue saving place', 'Tiếp tục lưu địa điểm', '場所の保存を続ける', '继续保存地点', '繼續儲存地點')
    : pending?.kind === 'collection'
      ? t('Continue creating collection', 'Tiếp tục tạo bộ sưu tập', 'コレクションの作成を続ける', '继续创建合集', '繼續建立合集')
      : pending
        ? t('Return to what you were doing', 'Quay lại việc đang làm', '続きに戻る', '返回刚才的操作', '返回剛才的操作')
        : t('Start exploring', 'Bắt đầu khám phá', '探索をはじめる', '开始探索', '開始探索');
  return (
    <>
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
            `欢迎你，${name.trim()}`, `歡迎你，${name.trim()}`,
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
          '一切就绪。保存喜欢的地点，创建合集，发现下一个想去的地方。', '一切就緒。儲存喜歡的地點，建立合集，發現下一個想去的地方。',
        )}</Text>
      <PrimaryButton
        arrow
        label={continueLabel}
        onPress={() => {
          const eligible = !hadPending.current && !hasResume();
          leaveAuth(navigation);
          if (eligible && session?.user.id) tour.start(session.user.id);
        }}
        testID="signup-welcome-continue"
      />
    </>
  );
}
