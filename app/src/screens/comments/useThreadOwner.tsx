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
// The ⋯ raises the app's own sheet (owner, on a phone, 19 Nov 2026):
// the first build raised the system's alert straight from the ⋯, and a
// ⋯ everywhere else in the app — a comment's own, a list's — raises a
// sheet, so the same mark did two different things on one page. The
// sheet is the one "who can see a list" uses: a choice between two
// states, each row saying what it means, a tick on the one that is true.
// So the reader sees where the thread stands before changing it, and
// there is nothing to ask twice — closing a thread deletes nothing, and
// the same sheet opens it again. The system's alert is left for what it
// is used for elsewhere: a failure, and a question before something that
// cannot be taken back.
//
// And in the list's own ⋯ menu as well, since 22 Nov 2026 (owner): a
// setting of the list among the list's other settings, which is also
// how the owner reaches it while the thread is empty — a press on the
// bubble then raises the field over the page for the owner as for
// anybody (`quickOrThread`), and never opens this page. Both places
// open the same sheet on the same state; neither moved.
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

import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import ActionSheet, { type SheetAction } from '../../components/ActionSheet';
import { PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import type { Subject } from '../../lib/comments';
import { commentsChanged } from '../../lib/commentsChanged';
import { setCommentsOff } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { colors, display, type } from '../../theme';

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

  const [open, setOpen] = useState(false);
  // A row for each state; the one that is true wears the tick and, chosen
  // again, changes nothing.
  const rows: SheetAction[] = [
    {
      key: 'on',
      icon: 'chatbubble-outline',
      title: t('Comments on', 'Bật bình luận', 'コメントをオン', '开启评论', '開啟評論'),
      desc: t('Anyone signed in can comment on this collection.', 'Ai đã đăng nhập cũng bình luận được về bộ sưu tập này.', 'ログインしていれば誰でもこのコレクションにコメントできます。', '登录的用户都可以评论这个合集。', '登入的使用者都可以評論這個合集。'),
      selected: !off,
      onPress: () => { if (off) set(false); },
    },
    {
      key: 'off',
      icon: 'close-circle-outline',
      title: t('Comments off', 'Tắt bình luận', 'コメントをオフ', '关闭评论', '關閉評論'),
      desc: t(
        'Comments already here stay readable. Nobody can add one until you turn them back on.',
        'Bình luận đang có vẫn đọc được. Không ai viết thêm được cho tới khi bạn bật lại.',
        '既存のコメントは引き続き読めます。再びオンにするまで、誰も新しく書き込めません。',
        '已有的评论仍可阅读。在你重新开启之前，没有人可以再发表评论。', '已有的評論仍可閱讀。在你重新開啟之前，沒有人可以再發表評論。',
      ),
      selected: off,
      onPress: () => { if (!off) set(true); },
    },
  ];

  return {
    /** The words that stand where the field would, or none on an open thread. */
    closed: !off ? undefined : mine
      ? t('You turned off comments on this collection.', 'Bạn đã tắt bình luận cho bộ sưu tập này.', 'このコレクションのコメントをオフにしました。', '你已关闭这个合集的评论。', '你已關閉這個合集的評論。')
      : t('The owner turned off comments.', 'Chủ bộ sưu tập đã tắt bình luận.', 'オーナーがコメントをオフにしました。', '合集主人已关闭评论。', '合集主人已關閉評論。'),
    /** The owner's ⋯ for the header, or nothing for anybody else. */
    right: mine ? (
      <PressableScale
        onPress={() => setOpen(true)}
        haptic="selection"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={t('Comment settings', 'Cài đặt bình luận', 'コメント設定', '评论设置', '評論設定')}
        testID="comments-owner"
      >
        <Glyph name="ellipsis-horizontal" size={ICON.nav} color={colors.text} />
      </PressableScale>
    ) : undefined,
    /** Opens the owner's sheet from elsewhere: the list's own ⋯ menu
     *  (`collectionDetail/CommentsSetting`). */
    show: () => setOpen(true),
    /** The owner's sheet. Drawn for anybody, opened only by the ⋯, which
     *  only the owner has. */
    node: (
      <ActionSheet
        visible={open}
        onClose={() => setOpen(false)}
        actions={rows}
        header={(
          <View style={s.head}>
            <Text style={s.title} accessibilityRole="header">{t('Comments', 'Bình luận', 'コメント', '评论', '評論')}</Text>
            <Text style={s.ask}>
              {t('Who can comment on your collection?', 'Ai bình luận được về bộ sưu tập của bạn?', 'あなたのコレクションにコメントできるのは？', '谁可以评论你的合集？', '誰可以評論你的合集？')}
            </Text>
          </View>
        )}
      />
    ),
  };
}

// The share sheet's own heading (`collectionDetail/styles`), so the two
// sheets that ask "who can…" of a list read as the same kind of thing.
const s = StyleSheet.create({
  head: { gap: 4 },
  title: { color: colors.text, fontSize: 18, fontFamily: display.semibold, paddingHorizontal: 4 },
  ask: { color: colors.textTertiary, ...type.meta, paddingHorizontal: 4 },
});
