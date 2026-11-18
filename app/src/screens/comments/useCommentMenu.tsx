// What a reader can do about one comment, behind the ⋯ at its end (C4b
// of `docs/comments-plan.md`): take back their own, or report somebody
// else's. One sheet with one row — which row is who wrote the comment.
//
// ── your own ──
//
// "Delete comment", which asks once in an Alert and then calls
// `delete_comment`. What goes with it is said before it is done: the
// replies under it (20261118150000 — for a day an answered comment left
// "This comment was deleted" for its answers to hang from, and on a
// phone that was two empty lines over a stray word). There is no edit
// (decision 5): a comment that can change after it was answered makes a
// liar of whoever answered it.
//
// Deleted, the app is told (`commentsChanged`) and the thread, the
// card's count and the door's figure each ask again. A failure says so
// and changes nothing on the page.
//
// ── somebody else's ──
//
// "Report comment", which hands over to the app's one report flow
// (`components/reportFlow`): the same four reasons, the same thanks, and
// a row in the same queue the desk already reads, as `kind = 'comment'`.
// Guideline 1.2's "a mechanism to report offensive content" is this row.
//
// The owner of the list deleting a comment on it is C6, and is not
// offered here yet although the server would allow it: a row that
// appears on one PR and is explained on another is how a reader deletes
// something by accident.
//
// Signed out, there is no ⋯ at all (`menuOf` answers nothing): neither
// act can be done as nobody, and a menu of things to sign in for is not
// a menu.
//
// A hook that returns the sheet to render and the press that raises it,
// as `useReport` does, so the thread's page does not grow by a state, a
// sheet and two handlers.

import React, { useState } from 'react';
import { Alert } from 'react-native';
import PersonSheet, { type PersonAction } from '../../components/PersonSheet';
import { useReport } from '../../components/reportFlow';
import type { Placed } from '../../lib/comments';
import { commentsChanged } from '../../lib/commentsChanged';
import { deleteComment } from '../../lib/data';
import { normalizeHandle } from '../../lib/handle';
import { useI18n } from '../../lib/i18n';

export function useCommentMenu(me: string | null) {
  const { t } = useI18n();
  const { report, node: reportSheet } = useReport();
  const [about, setAbout] = useState<Placed | null>(null);

  const nameOf = (c: Placed) => (c.handle ? normalizeHandle(c.handle) : c.full_name || t('Someone', 'Ai đó', '誰か', '有人', '有人'));

  const remove = (c: Placed) => Alert.alert(
    t('Delete this comment?', 'Xoá bình luận này?', 'このコメントを削除しますか？', '删除这条评论？', '刪除這條評論？'),
    t(
      'Any replies under it will be deleted too.',
      'Các trả lời bên dưới cũng sẽ bị xoá.',
      'このコメントへの返信も削除されます。',
      '它下面的回复也会被删除。', '它下面的回覆也會被刪除。',
    ),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消'), style: 'cancel' },
      {
        text: t('Delete', 'Xoá', '削除', '删除', '刪除'),
        style: 'destructive',
        onPress: () => {
          deleteComment(c.id)
            .then(commentsChanged)
            .catch(() => Alert.alert(
              t('Could not delete', 'Không xoá được', '削除できませんでした', '无法删除', '無法刪除'),
              t('Please try again later.', 'Vui lòng thử lại sau.', '後でもう一度お試しください。', '请稍后再试。', '請稍後再試。'),
            ));
        },
      },
    ],
  );

  const actions = (c: Placed): PersonAction[] => (c.author === me
    ? [{
      key: 'delete',
      icon: 'trash-outline',
      title: t('Delete comment', 'Xoá bình luận', 'コメントを削除', '删除评论', '刪除評論'),
      destructive: true,
      onPress: () => remove(c),
    }]
    : [{
      key: 'report',
      icon: 'flag-outline',
      title: t('Report comment', 'Báo cáo bình luận', 'コメントを報告', '举报评论', '舉報評論'),
      onPress: () => report({ kind: 'comment', id: c.id, ownerId: c.author, name: nameOf(c), avatarUrl: c.avatar_url ?? undefined }),
    }]);

  return {
    /** The press that raises the menu for a comment, or none where there
     *  is nothing to offer: nobody signed in. */
    menuOf: (c: Placed): (() => void) | undefined => (me ? () => setAbout(c) : undefined),
    /** Render once, anywhere in the screen. */
    node: (
      <>
        <PersonSheet
          visible={about !== null}
          name={about ? nameOf(about) : ''}
          // What was said, so the reader sees which comment the row is about.
          meta={about?.body}
          avatarUrl={about?.avatar_url ?? undefined}
          actions={about ? actions(about) : []}
          onClose={() => setAbout(null)}
        />
        {reportSheet}
      </>
    ),
  };
}
