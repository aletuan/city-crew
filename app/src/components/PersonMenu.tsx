// The ⋯ on a person's page: report them, block them, or take a block back.
//
// ── why it is here (owner, 16 Nov 2026) ──
//
// Until this day the way to block the author of a list was a sheet on
// the list's own page, opened by pressing their face: "Report this list"
// and "Block". Pressing a face opens the person's page now, as it does
// on every app that has one, so the sheet went and its two rows needed
// somewhere to stand:
//
//   - reporting the *list* was already a row in the list's own ⋯, and
//     stays there;
//   - blocking is an act about a person, and stands on the person's page.
//
// And one row the old sheet did not have: reporting the *person*. Their
// page shows a name, a photograph and a bio they wrote, which is content
// a reader must be able to report apart from any list (and which the App
// Store asks of an app that shows it). Crew already reports a person
// from a request's sheet; this is the same report, by the same flow
// (`useReport`), with Crew's words.
//
// The cost, written down: blocking a list's author was one press from
// the list and is two now — their face, then ⋯.
//
// ── what a block does, and does not ──
//
// What it has always done (`block_user`): ends the friendship, stops new
// requests, and keeps their likes and copies off your pages. It does not
// hide their page or their public lists from you — the policy calls a
// block "a contact policy, not a content filter" (`lib/legal`) — so the
// page stays open after it, with no friend button, and this menu offers
// to take the block back. Threads and Instagram hide everything; that
// would be a change to the policy, and it is not made here.
//
// A hook that returns the button and the sheets apart, because they
// stand in different places: the button in the header's right-hand slot,
// the sheets at the foot of the screen.
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Glyph } from './ui/glyph';
import { PressableScale } from './ui';
import PersonSheet, { type PersonAction } from './PersonSheet';
import { useReport } from './reportFlow';
import { blockUser, type FriendProfile, unblockUser } from '../lib/data';
import { atHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { colors } from '../theme';

export function usePersonMenu(
  me: string | null,
  person: FriendProfile | null,
  /** The crew the app holds: the blocks to read, and both to read again
   *  after a block, which also ends a friendship. */
  crew: { ships: { reload: () => void }; blocks: { data: string[]; reload: () => void } },
) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { report, node: reportSheet } = useReport();

  // Nobody signed in has nothing to report as or block for; your own
  // page has nobody to report or block.
  if (!me || !person || person.id === me) return { button: null, node: null };

  const tag = atHandle(person.handle);
  const blocked = crew.blocks.data.includes(person.id);
  const later = t('Please try again later.', 'Vui lòng thử lại sau.', '後でもう一度お試しください。', '请稍后再试。', '請稍後再試。');

  /** The moment of no return asks once more, in a native dialog, after
   *  the sheet has gone — as Crew does. */
  const askThen = (title: string, body: string, verb: string, run: () => void) => Alert.alert(title, body, [
    { text: t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消'), style: 'cancel' },
    { text: verb, style: 'destructive', onPress: run },
  ]);

  const block = () => askThen(
    t(`Block ${tag}?`, `Chặn ${tag}?`, `${tag} をブロックしますか？`, `屏蔽 ${tag}？`, `遮蔽 ${tag}？`),
    t(
      'They will not be told. You can undo this here or from Blocked.',
      'Họ sẽ không được báo. Bạn có thể bỏ chặn ở đây hoặc trong mục Đã chặn.',
      '相手に通知されません。ここ、またはブロック中から解除できます。',
      '对方不会收到通知。你可以在这里或“已屏蔽”中撤销。', '對方不會收到通知。你可以在這裡或「已遮蔽」中取消。',
    ),
    t('Block', 'Chặn', 'ブロック', '屏蔽', '遮蔽'),
    () => {
      blockUser(person.id)
        .then(() => { crew.ships.reload(); crew.blocks.reload(); })
        .catch(() => Alert.alert(t('Could not block', 'Không chặn được', 'ブロックできませんでした', '无法屏蔽', '無法遮蔽'), later));
    },
  );

  const unblock = () => askThen(
    t(`Unblock ${tag}?`, `Bỏ chặn ${tag}?`, `${tag} のブロックを解除しますか？`, `取消屏蔽 ${tag}？`, `取消遮蔽 ${tag}？`),
    t(
      'They will be able to send you requests again.',
      'Họ sẽ có thể gửi lời mời cho bạn lại.',
      '相手は再びリクエストを送れるようになります。',
      '对方将可以再次向你发送请求。', '對方將可以再次向你傳送請求。',
    ),
    t('Unblock', 'Bỏ chặn', '解除', '取消屏蔽', '取消遮蔽'),
    () => {
      unblockUser(me, person.id)
        .then(() => crew.blocks.reload())
        .catch(() => Alert.alert(t('Could not unblock', 'Không bỏ chặn được', 'ブロックを解除できませんでした', '无法取消屏蔽', '無法取消遮蔽'), later));
    },
  );

  const actions: PersonAction[] = [
    {
      key: 'report',
      icon: 'flag-outline',
      title: t('Report', 'Báo cáo', '報告する', '举报', '舉報'),
      desc: t(
        'Tell the desk about their name, photo or bio. They are not told who reported them.',
        'Báo cho desk về tên, ảnh hoặc tiểu sử của họ. Họ không biết ai đã báo cáo.',
        '名前・写真・自己紹介についてデスクに報告します。誰が報告したかは相手に伝わりません。',
        '向编辑团队举报对方的名字、头像或简介。对方不会知道是谁举报的。', '向編輯團隊舉報對方的名字、大頭貼或簡介。對方不會知道是誰舉報的。',
      ),
      onPress: () => report({
        kind: 'profile',
        id: person.id,
        name: person.full_name || tag,
        avatarUrl: person.avatar_url || undefined,
      }),
      testID: 'person-menu-report',
    },
    blocked
      ? {
        key: 'unblock',
        icon: 'checkmark-circle-outline',
        title: t(`Unblock ${tag}`, `Bỏ chặn ${tag}`, `${tag} のブロックを解除`, `取消屏蔽 ${tag}`, `取消遮蔽 ${tag}`),
        desc: t('You blocked them.', 'Bạn đã chặn người này.', 'ブロック中です。', '你已屏蔽对方。', '你已遮蔽對方。'),
        onPress: unblock,
        testID: 'person-menu-unblock',
      }
      : {
        key: 'block',
        icon: 'ban-outline',
        title: t(`Block ${tag}`, `Chặn ${tag}`, `${tag} をブロック`, `屏蔽 ${tag}`, `遮蔽 ${tag}`),
        desc: t(
          'They will not be told, and can no longer reach you.',
          'Họ sẽ không được báo, và không thể liên hệ bạn nữa.',
          '相手に通知されず、あなたに連絡できなくなります。',
          '对方不会收到通知，也无法再联系你。', '對方不會收到通知，也無法再聯絡你。',
        ),
        destructive: true,
        onPress: block,
        testID: 'person-menu-block',
      },
  ];

  const button = (
    <PressableScale
      onPress={() => setOpen(true)}
      scaleTo={0.85}
      hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={t('More', 'Tùy chọn khác', 'その他', '更多', '更多')}
      testID="person-more"
    >
      <Glyph name="ellipsis-horizontal" size={22} color={colors.text} />
    </PressableScale>
  );
  const node = (
    <>
      <PersonSheet
        visible={open}
        name={person.full_name || tag}
        meta={person.full_name ? tag : undefined}
        avatarUrl={person.avatar_url || undefined}
        actions={actions}
        onClose={() => setOpen(false)}
      />
      {reportSheet}
    </>
  );
  return { button, node };
}
