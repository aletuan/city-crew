// Reporting, as a thing any screen can raise.
//
// The control belongs beside the content — a report you have to go and
// find is a report nobody files — so the reason sheet lives in a hook
// rather than on a screen: a caller renders `node` once and calls
// `report(...)` from wherever the ⋯ is. The crew rows, the request
// cards and a public collection all reach the same four reasons in the
// same words.
//
// It reuses PersonSheet because a reason list is the same shape as an
// action list: a thing named at the top, then rows that each say what
// they mean. What it does not reuse is the confirmation — filing needs
// none. The choice *is* the confirmation, the act is reversible by
// nobody and harmful to no one, and an extra dialog between a person
// and reporting abuse is a dialog on the wrong side of the scale.

import React, { useState } from 'react';
import { Alert } from 'react-native';
import PersonSheet, { type PersonAction } from './PersonSheet';
import { useSession } from '../lib/auth';
import { submitReport } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { reportable, REPORT_REASONS, type ReportReason } from '../lib/report';

export type ReportTarget = {
  kind: 'collection' | 'profile';
  /** collections.id or profiles.id — what the row will point at. */
  id: string;
  /** Whose it is, for a collection. Your own is not reportable; see
   *  `reportable`. */
  ownerId?: string | null;
  /** What to call it in the sheet's header. */
  name: string;
  avatarUrl?: string;
};

const ICONS: Record<ReportReason, PersonAction['icon']> = {
  spam: 'megaphone-outline',
  offensive: 'warning-outline',
  impersonation: 'person-circle-outline',
  other: 'help-circle-outline',
};

export function useReport() {
  const { t } = useI18n();
  const { session } = useSession();
  const me = session?.user?.id ?? null;
  const [target, setTarget] = useState<ReportTarget | null>(null);

  const label = (r: ReportReason): { title: string; desc: string } => {
    if (r === 'spam') {
      return {
        title: t('Spam or advertising', 'Spam hoặc quảng cáo', 'スパム・宣伝', '垃圾信息或广告', '垃圾資訊或廣告'),
        desc: t(
          'Adverts, links, or the same thing over and over.',
          'Quảng cáo, đường dẫn, hoặc lặp đi lặp lại một nội dung.',
          '広告やリンク、同じ内容の繰り返し。',
          '广告、链接，或反复发布相同内容。', '廣告、連結，或反覆發布相同內容。',
        ),
      };
    }
    if (r === 'offensive') {
      return {
        title: t('Offensive or hateful', 'Phản cảm hoặc thù ghét', '不快・差別的', '冒犯或仇恨内容', '冒犯或仇恨內容'),
        desc: t(
          'Hateful, violent, sexual, or otherwise not for this app.',
          'Thù ghét, bạo lực, tình dục, hoặc không phù hợp với ứng dụng này.',
          '差別的・暴力的・性的など、このアプリにふさわしくない内容。',
          '仇恨、暴力、色情，或其他不适合本应用的内容。', '仇恨、暴力、色情，或其他不適合本 App的內容。',
        ),
      };
    }
    if (r === 'impersonation') {
      return {
        title: t('Pretending to be someone', 'Mạo danh người khác', 'なりすまし', '冒充他人', '冒充他人'),
        desc: t(
          'Using a name, a face, or a business that is not theirs.',
          'Dùng tên, ảnh, hoặc thương hiệu không phải của họ.',
          '他人の名前・写真・店名を使っている。',
          '使用不属于自己的名字、照片或商家名称。', '使用不屬於自己的名字、照片或商家名稱。',
        ),
      };
    }
    return {
      title: t('Something else', 'Chuyện khác', 'その他', '其他', '其他'),
      desc: t(
        'Anything the desk should look at that the others do not cover.',
        'Bất cứ điều gì cần desk xem mà các mục trên chưa nói tới.',
        '上記に当てはまらない、確認してほしいこと。',
        '以上未涵盖、但需要编辑团队查看的问题。', '以上未涵蓋、但需要編輯團隊檢視的問題。',
      ),
    };
  };

  const file = (reason: ReportReason, tgt: ReportTarget) => {
    if (!me) return;
    submitReport({ reporter: me, kind: tgt.kind, targetId: tgt.id, reason })
      .then(() => Alert.alert(
        t('Thanks for telling us', 'Cảm ơn bạn đã báo', 'ご報告ありがとうございます', '感谢你的反馈', '感謝你的回饋'),
        t(
          'The desk will take a look. You will not hear back about it, and nobody is told who reported what.',
          'Desk sẽ xem lại. Bạn sẽ không nhận phản hồi riêng, và không ai biết ai đã báo cáo.',
          'デスクが確認します。個別のご返信はなく、誰が報告したかは誰にも伝わりません。',
          '编辑团队会查看。我们不会单独回复，也不会透露是谁举报的。', '編輯團隊會檢視。我們不會單獨回覆，也不會透露是誰舉報的。',
        ),
      ))
      // Neutral on purpose: the ways this fails are the day's cap and a
      // policy refusal, and neither is worth spelling out to somebody
      // who is in the middle of reporting something.
      .catch(() => Alert.alert(
        t('Could not send this report', 'Không gửi được báo cáo', '報告を送信できませんでした', '无法发送举报', '無法傳送舉報'),
        t('Please try again later.', 'Vui lòng thử lại sau.', '後でもう一度お試しください。', '请稍后再试。', '請稍後再試。'),
      ));
  };

  const node = (
    <PersonSheet
      visible={target !== null}
      name={target?.name ?? ''}
      meta={t('What is wrong with this?', 'Vấn đề ở đây là gì?', '何が問題ですか？', '这里有什么问题？', '這裡有什麼問題？')}
      avatarUrl={target?.avatarUrl}
      actions={target
        ? REPORT_REASONS.map((r): PersonAction => ({
          key: r,
          icon: ICONS[r],
          ...label(r),
          onPress: () => file(r, target),
        }))
        : []}
      onClose={() => setTarget(null)}
    />
  );

  return {
    /** Raise the reason sheet for one thing. */
    report: setTarget,
    /** Whether this thing may be reported at all — see `reportable`. */
    canReport: (tgt: Pick<ReportTarget, 'kind' | 'id' | 'ownerId'>) => reportable(tgt, me),
    /** Render once, anywhere in the screen. */
    node,
  };
}
