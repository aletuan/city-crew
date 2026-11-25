// Every person-shaped menu on the crew page, and the confirmations
// behind its choices that cannot be undone.
//
// Out of `CrewScreen` on 25 Nov 2026, as the screens of the 22 Nov code
// review were (F1, F5): the reasoning moved with the code, unchanged.

import { useState } from 'react';
import { Alert } from 'react-native';
import type { PersonAction } from '../../components/PersonSheet';
import { useReport } from '../../components/reportFlow';
import type { FriendProfile } from '../../lib/data';
import { atHandle } from '../../lib/handle';
import type { useI18n } from '../../lib/i18n';
import type { CrewActions } from './useCrewActions';

export function useCrewSheets({ t, people, bar, cutEdge, answer, unblock }: {
  t: ReturnType<typeof useI18n>['t'];
  people: Record<string, FriendProfile>;
} & Pick<CrewActions, 'bar' | 'cutEdge' | 'answer' | 'unblock'>) {
  // ── the ⋯ sheet ──
  //
  // One component for every person-shaped menu on this screen, because
  // the alternative was four stacked Alerts whose rows were bare verbs
  // in identical red. A sheet can say who the menu is about and what
  // each choice will actually do; see PersonSheet.
  const [sheet, setSheet] = useState<{
    name: string; meta?: string; avatar?: string; actions: PersonAction[];
  } | null>(null);
  const { report, node: reportSheet } = useReport();

  /** Somebody whose profile may not have arrived. The actions below need
   *  only an id — withdrawing a request, lifting a block, unfriending — so
   *  a row whose profile is late, or will never come (an account gone, a
   *  profile RLS will not show), must still be able to act. The row used
   *  to guard each button with `p && …`: visible, tappable, and silent. */
  const known = (id: string): FriendProfile =>
    people[id] ?? { id, handle: '', full_name: '', avatar_url: '' };
  // The parts every sheet shares: how it names them, Report, Block and
  // the last-chance dialog (`personActions`, below the hook).
  const { tag, reportAction, askThen, blockAction } = personActions(t, report, bar);

  const openFriendSheet = (p: FriendProfile, saves?: number) => setSheet({
    name: p.full_name || tag(p),
    meta: [p.handle && atHandle(p.handle), savesLine(saves)].filter(Boolean).join(' · '),
    avatar: p.avatar_url || undefined,
    actions: [
      {
        key: 'unfriend',
        icon: 'person-remove-outline',
        title: t('Unfriend', 'Huỷ kết bạn', '友達をやめる', '删除好友', '刪除好友'),
        desc: t(
          'Take them out of your crew. They will not be told, and either of you can ask again later.',
          'Bỏ họ khỏi crew. Họ sẽ không được báo, và sau này ai cũng có thể mời lại.',
          'クルーから外します。相手に通知されず、あとでどちらからでも申請できます。',
          '把对方移出你的好友。对方不会收到通知，之后双方都可以重新发送请求。', '把對方移出你的好友。對方不會收到通知，之後雙方都可以重新傳送請求。',
        ),
        destructive: true,
        onPress: () => askThen(
          t(`Unfriend ${tag(p)}?`, `Huỷ kết bạn với ${tag(p)}?`, `${tag(p)} と友達をやめますか？`, `删除好友 ${tag(p)}？`, `刪除好友 ${tag(p)}？`),
          t('They will not be told.', 'Họ sẽ không được báo.', '相手に通知されません。', '对方不会收到通知。', '對方不會收到通知。'),
          t('Unfriend', 'Huỷ kết bạn', '友達をやめる', '删除好友', '刪除好友'),
          () => cutEdge(p.id, t('Could not unfriend', 'Không huỷ kết bạn được', '友達を解除できませんでした', '无法删除好友', '無法刪除好友')),
        ),
      },
      blockAction(
        p,
        t('Block', 'Chặn', 'ブロック', '屏蔽', '遮蔽'),
        t(
          'Ends the friendship and keeps it ended: no requests either way, and their likes leave your Activity.',
          'Huỷ kết bạn và giữ nguyên như vậy: không ai mời được ai, và lượt thích của họ rời khỏi Hoạt động.',
          '友達関係を解消し、以後どちらからも申請できません。相手のいいねもアクティビティから消えます。',
          '结束好友关系且不再恢复：双方都无法再发送请求，对方的点赞也会从你的动态中移除。', '結束好友關係且不再恢復：雙方都無法再傳送請求，對方的按讚也會從你的動態中移除。',
        ),
      ),
      ...(p.handle ? [reportAction(p)] : []),
    ],
  });

  const openRequestSheet = (requester: string, p?: FriendProfile) => setSheet({
    name: p ? (p.full_name || tag(p)) : t('This request', 'Lời mời này', 'このリクエスト', '这个请求', '這個請求'),
    meta: p ? atHandle(p.handle) : undefined,
    avatar: p?.avatar_url || undefined,
    actions: [
      {
        key: 'decline',
        icon: 'close-circle-outline',
        title: t('Decline', 'Từ chối', '拒否', '拒绝', '拒絕'),
        desc: t(
          'The request goes, silently. They can ask again another day.',
          'Lời mời biến mất, im lặng. Hôm khác họ vẫn có thể mời lại.',
          'リクエストは静かに消えます。相手はまた後日申請できます。',
          '请求会被悄悄移除。对方改天可以再次发送。', '請求會被悄悄移除。對方改天可以再次傳送。',
        ),
        onPress: () => answer(requester, false),
      },
      ...(p ? [
        blockAction(
          p,
          t('Decline and block', 'Từ chối và chặn', '拒否してブロック', '拒绝并屏蔽', '拒絕並遮蔽'),
          t(
            'Refuse it and stop them asking again.',
            'Từ chối và chặn họ mời lại.',
            '拒否して、今後の申請も止めます。',
            '拒绝请求，并阻止对方再次发送。', '拒絕請求，並阻止對方再次傳送。',
          ),
        ),
        reportAction(p),
      ] : []),
    ],
  });

  const openSentSheet = (p: FriendProfile) => setSheet({
    name: p.full_name || tag(p),
    meta: [p.handle && atHandle(p.handle), t('waiting on their answer', 'đang chờ trả lời', '返事待ち', '等待对方回复', '等待對方回覆')].filter(Boolean).join(' · '),
    avatar: p.avatar_url || undefined,
    actions: [
      {
        key: 'withdraw',
        icon: 'arrow-undo-outline',
        title: t('Cancel the request', 'Huỷ lời mời', 'リクエストを取り消す', '撤回请求', '撤回請求'),
        desc: t(
          'Take it back before they answer. They will not be told, and you can ask again.',
          'Rút lại trước khi họ trả lời. Họ sẽ không được báo, và bạn vẫn có thể mời lại.',
          '返事の前に取り消します。相手に通知されず、また申請できます。',
          '在对方回复前撤回。对方不会收到通知，你之后可以再次发送。', '在對方回覆前撤回。對方不會收到通知，你之後可以再次傳送。',
        ),
        onPress: () => cutEdge(p.id, t('Could not cancel the request', 'Không huỷ được lời mời', 'リクエストを取り消せませんでした', '无法撤回请求', '無法撤回請求')),
      },
      blockAction(
        p,
        t('Cancel and block', 'Huỷ và chặn', '取り消してブロック', '撤回并屏蔽', '撤回並遮蔽'),
        t(
          'Take the request back and bar the door in both directions.',
          'Rút lời mời và chặn cả hai chiều.',
          'リクエストを取り消し、双方向に連絡を止めます。',
          '撤回请求，并双向阻止联系。', '撤回請求，並雙向阻止聯絡。',
        ),
      ),
      ...(p.handle ? [reportAction(p)] : []),
    ],
  });

  const confirmUnblock = (p: FriendProfile) => askThen(
    t(`Unblock ${tag(p)}?`, `Bỏ chặn ${tag(p)}?`, `${tag(p)} のブロックを解除しますか？`, `取消屏蔽 ${tag(p)}？`, `取消遮蔽 ${tag(p)}？`),
    t('They will be able to send you requests again.', 'Họ sẽ có thể gửi lời mời cho bạn lại.', '相手は再びリクエストを送れるようになります。', '对方将可以再次向你发送请求。', '對方將可以再次向你傳送請求。'),
    t('Unblock', 'Bỏ chặn', '解除', '取消屏蔽', '取消遮蔽'),
    () => unblock(p.id),
  );

  const savesLine = (n?: number) => (n != null && n > 0
    ? (n === 1
      ? t('1 mutual save', '1 chỗ cùng lưu', '共通の保存1件', '1 个共同收藏', '1 個共同收藏')
      : t(`${n} mutual saves`, `${n} chỗ cùng lưu`, `共通の保存${n}件`, `${n} 个共同收藏`, `${n} 個共同收藏`))
    : '');

  return {
    sheet, setSheet, reportSheet, known, savesLine,
    openFriendSheet, openRequestSheet, openSentSheet, confirmUnblock,
  };
}

export type CrewSheets = ReturnType<typeof useCrewSheets>;

/** What the sheets are built from. Outside the hook to keep it under its
 *  ceiling; it reads nothing the hook holds but the three it is handed. */
function personActions(
  t: ReturnType<typeof useI18n>['t'],
  report: ReturnType<typeof useReport>['report'],
  bar: CrewActions['bar'],
) {
  /** How a sentence names them: the handle when there is one. */
  const tag = (p: FriendProfile) => (p.handle ? atHandle(p.handle) : t('this person', 'người này', 'この人', '此人', '此人'));

  /** The row every person-shaped sheet ends with. Last, and not red:
   *  reporting is not a thing done to somebody you know, it is a thing
   *  said to the desk, and it belongs where a reader looks when the
   *  other choices were not the point. */
  const reportAction = (p: FriendProfile): PersonAction => ({
    key: 'report',
    icon: 'flag-outline',
    // The verb alone: the sheet's header names them — see `ActionSheet`.
    title: t('Report', 'Báo cáo', '報告する', '举报', '舉報'),
    desc: t(
      'Tell the desk about their name, photo or bio. They are not told who reported them.',
      'Báo cho desk về tên, ảnh hoặc tiểu sử của họ. Họ không biết ai đã báo cáo.',
      '名前・写真・自己紹介についてデスクに報告します。誰が報告したかは相手に伝わりません。',
      '向编辑团队举报对方的名字、头像或简介。对方不会知道是谁举报的。', '向編輯團隊舉報對方的名字、大頭貼或簡介。對方不會知道是誰舉報的。',
    ),
    onPress: () => report({
      kind: 'profile',
      id: p.id,
      name: p.full_name || tag(p),
      avatarUrl: p.avatar_url || undefined,
    }),
  });

  /** The one place a native dialog is still right: the moment of no
   *  return, after the sheet has gone. */
  const askThen = (title: string, body: string, verb: string, run: () => void) => Alert.alert(
    title,
    body,
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消'), style: 'cancel' },
      { text: verb, style: 'destructive', onPress: run },
    ],
  );


  const blockAction = (p: FriendProfile, title: string, desc: string): PersonAction => ({
    key: 'block',
    icon: 'ban-outline',
    title,
    desc,
    destructive: true,
    onPress: () => askThen(
      t(`Block ${tag(p)}?`, `Chặn ${tag(p)}?`, `${tag(p)} をブロックしますか？`, `屏蔽 ${tag(p)}？`, `遮蔽 ${tag(p)}？`),
      t('They will not be told. You can undo this from Blocked.', 'Họ sẽ không được báo. Bạn có thể bỏ chặn trong mục Đã chặn.', '相手に通知されません。ブロック中から解除できます。', '对方不会收到通知。你可以在“已屏蔽”中撤销。', '對方不會收到通知。你可以在「已遮蔽」中取消。'),
      t('Block', 'Chặn', 'ブロック', '屏蔽', '遮蔽'),
      () => bar(p.id),
    ),
  });
  return { tag, reportAction, askThen, blockAction };
}
