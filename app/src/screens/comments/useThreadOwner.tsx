// What a list's owner may do about its thread, and what everybody else
// is told when the owner has done it (C6 of `docs/comments-plan.md`).
//
// The server has had both rules from the start: a thread can be closed
// to new comments (`collections.comments_off`; `post_comment` refuses
// with `comment:off`), and the owner may take down anybody's comment on
// their list (`delete_comment`). This is the first of them reaching a
// screen; the second is a row in `useCommentMenu`.
//
// ── where the switch is ──
//
// On the thread itself, behind a ⋯ in its header that only the owner is
// shown — where Instagram and Threads keep theirs, on the post and not
// in its edit form. The plan had it in the collection's edit form. Not
// there: that form saves on a button and this is a switch that should
// take at once, and the form's function is at its ceiling
// (`app/oversize.js`), so the row would have been paid for by moving
// something else out for no reason of its own.
//
// One alert is both the menu and the question: it says what the switch
// does before it is thrown, in the direction it would be thrown. Closing
// is not undone by accident — nothing is deleted, and the same ⋯ opens
// it again.
//
// ── what the others see ──
//
// Where the field would be, a line: comments are off. No field to type
// into and lose on Send, and no reply bubbles — the same reason a guest
// gets an invitation and not a field (`CommentComposer`). Hearts stay:
// liking what is there is not writing. The owner reads the same line in
// the first person, and is the one with the ⋯.
//
// Whether the thread is closed and whose list it is come with the answer
// the field already asks for (`comment_taggable`, read by the page); a
// switch thrown asks that again, and tells the cards (`commentsChanged`),
// whose bubbles hide on a closed thread with nothing in it.

import React from 'react';
import { Alert } from 'react-native';
import { PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import type { Subject } from '../../lib/comments';
import { commentsChanged } from '../../lib/commentsChanged';
import { setCommentsOff } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../theme';

export function useThreadOwner(
  subject: Subject,
  /** The field's answer about this subject. */
  told: { off: boolean; mine: boolean },
  /** Ask that answer again. */
  ask: () => void,
) {
  const { t } = useI18n();
  const { off, mine } = told;

  const set = (to: boolean) => {
    setCommentsOff(subject, to)
      .then(() => { ask(); commentsChanged(); })
      .catch(() => Alert.alert(
        t('Could not change that', 'Không đổi được', '変更できませんでした', '无法更改', '無法更改'),
        t('Please try again later.', 'Vui lòng thử lại sau.', '後でもう一度お試しください。', '请稍后再试。', '請稍後再試。'),
      ));
  };

  const choose = () => Alert.alert(
    off
      ? t('Turn comments back on?', 'Bật lại bình luận?', 'コメントを再びオンにしますか？', '重新开启评论？', '重新開啟評論？')
      : t('Turn off comments?', 'Tắt bình luận?', 'コメントをオフにしますか？', '关闭评论？', '關閉評論？'),
    off
      ? t(
        'People will be able to comment on this collection again.',
        'Mọi người sẽ lại bình luận được về bộ sưu tập này.',
        'このコレクションに再びコメントできるようになります。',
        '大家将可以再次评论这个合集。', '大家將可以再次評論這個合集。',
      )
      : t(
        'Comments already here stay readable. Nobody can add one until you turn them back on.',
        'Bình luận đang có vẫn đọc được. Không ai viết thêm được cho tới khi bạn bật lại.',
        '既存のコメントは引き続き読めます。再びオンにするまで、誰も新しく書き込めません。',
        '已有的评论仍可阅读。在你重新开启之前，没有人可以再发表评论。', '已有的評論仍可閱讀。在你重新開啟之前，沒有人可以再發表評論。',
      ),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消'), style: 'cancel' },
      off
        ? { text: t('Turn on', 'Bật', 'オンにする', '开启', '開啟'), onPress: () => set(false) }
        : { text: t('Turn off', 'Tắt', 'オフにする', '关闭', '關閉'), style: 'destructive', onPress: () => set(true) },
    ],
  );

  return {
    /** The words that stand where the field would, or none on an open thread. */
    closed: !off ? undefined : mine
      ? t('You turned off comments on this collection.', 'Bạn đã tắt bình luận cho bộ sưu tập này.', 'このコレクションのコメントをオフにしました。', '你已关闭这个合集的评论。', '你已關閉這個合集的評論。')
      : t('The owner turned off comments.', 'Chủ bộ sưu tập đã tắt bình luận.', 'オーナーがコメントをオフにしました。', '合集主人已关闭评论。', '合集主人已關閉評論。'),
    /** The owner's ⋯ for the header, or nothing for anybody else. */
    right: mine ? (
      <PressableScale
        onPress={choose}
        haptic="selection"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={t('Comment settings', 'Cài đặt bình luận', 'コメント設定', '评论设置', '評論設定')}
        testID="comments-owner"
      >
        <Glyph name="ellipsis-horizontal" size={ICON.nav} color={colors.text} />
      </PressableScale>
    ) : undefined,
  };
}
