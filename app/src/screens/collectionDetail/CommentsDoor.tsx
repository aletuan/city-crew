// The way into a list's comments, at the card's foot beside Share (C3 of
// `docs/comments-plan.md`).
//
// A chat bubble, the glyph a person's page already wears for a message's
// sibling, at the row's own size and ink. No count yet: the count is the
// feed card's first (`comment_previews`), and a figure here that the
// card beside it did not show would be two answers to one question.
//
// It draws itself or nothing, so the page that holds it does not grow a
// branch: nothing while the `comments` flag is off, and nothing on a
// list that is not public — the server keeps a thread for public lists
// alone (`comment_subject_visible`), and a door onto "No comments yet"
// that can never be otherwise is a door to remove.

import React from 'react';
import { PressableScale } from '../../components/ui';
import { Glyph } from '../../components/ui/glyph';
import { useI18n } from '../../lib/i18n';
import { useFlag } from '../../lib/useFlag';
import { colors } from '../../theme';
import { ACT_GLYPH, s } from './styles';

export function CommentsDoor({ list, onPress }: {
  /** The list on the page, or none while it is being found. Its id may
   *  be missing on a row from the launch cache. Taken whole so the page
   *  hands it over without reading into it. */
  list: { id?: string | null; is_public?: boolean | null } | null | undefined;
  onPress: (listId: string) => void;
}) {
  const { t } = useI18n();
  const on = useFlag('comments');
  const listId = list?.id;
  if (!on || !list?.is_public || !listId) return null;
  return (
    <PressableScale
      contentStyle={s.like}
      scaleTo={0.82}
      haptic="selection"
      // Share's slop, value for value: the two sit side by side.
      hitSlop={{ top: 14, bottom: 14, left: 12, right: 14 }}
      onPress={() => onPress(listId)}
      accessibilityRole="button"
      accessibilityLabel={t('Comments', 'Bình luận', 'コメント', '评论', '評論')}
      testID="collection-comments"
    >
      <Glyph name="chatbubble-outline" size={ACT_GLYPH} color={colors.textSecondary} />
    </PressableScale>
  );
}
