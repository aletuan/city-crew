// The way into a list's comments, at the card's foot beside the heart
// (C3 of `docs/comments-plan.md`) — before Share since 19 Nov 2026; the
// page has why.
//
// A chat bubble, the glyph a person's page already wears for a message's
// sibling, at the row's own size and ink, with how many there are after
// it once there is one — the figure the feed card shows, from the same
// function (`comment_previews`), so the two cannot disagree. Asked only
// when the door is drawn.
//
// A press on it opens the thread — or, while nobody has commented yet,
// raises the field over this page so the first comment is written here
// (`components/CommentQuick`, owner, 18 Nov 2026).
//
// It draws itself or nothing, so the page that holds it does not grow a
// branch: nothing while the `comments` flag is off, and nothing on a
// list that is not public — the server keeps a thread for public lists
// alone (`comment_subject_visible`), and a door onto "No comments yet"
// that can never be otherwise is a door to remove.

import React from 'react';
import { Text } from 'react-native';
import { PressableScale } from '../../components/ui';
import { Glyph } from '../../components/ui/glyph';
import { quickOrThread, useQuickComment } from '../../components/CommentQuick';
import { useSession } from '../../lib/auth';
import { usePreviewsQuery } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { useFlag } from '../../lib/useFlag';
import { colors } from '../../theme';
import { ACT_GLYPH, s } from './styles';

export function CommentsDoor({ list, about, onPress }: {
  /** The list on the page, or none while it is being found. Its id may
   *  be missing on a row from the launch cache. Taken whole so the page
   *  hands it over without reading into it. */
  list: { id?: string | null; is_public?: boolean | null; owner_id?: string | null } | null | undefined;
  /** The list's name, said above the field when the first comment is
   *  written here on the page. */
  about?: string;
  /** Opens the list's thread. */
  onPress: (listId: string) => void;
}) {
  const { t } = useI18n();
  const on = useFlag('comments');
  const { session } = useSession();
  const listId = on && list?.is_public ? list.id : null;
  // Nothing drawn asks nothing: no ids, no request.
  const previews = usePreviewsQuery(listId ? [listId] : []);
  const n = previews.data[listId ?? '']?.n ?? 0;
  const off = previews.data[listId ?? '']?.off ?? false;
  const me = session?.user?.id ?? null;
  const mine = !!me && list?.owner_id === me;
  // The first comment is written here, over the page; a thread with
  // something in it is opened — `quickOrThread`.
  const quick = useQuickComment();
  // Closed with nothing in it: nothing to read and nothing may be
  // written, so no way in — except for the owner, whose way to open it
  // again is on the thread's page.
  if (!listId || (off && n === 0 && !mine)) return null;
  const press = () => (quick && quickOrThread({
    me, n, loaded: previews.loaded, loading: previews.loading, off, mine,
  }) === 'quick'
    ? quick({ kind: 'collection', id: listId }, about)
    : onPress(listId));
  return (
    <PressableScale
      contentStyle={s.like}
      scaleTo={0.82}
      haptic="selection"
      // Share's slop, value for value: the two sit side by side.
      hitSlop={{ top: 14, bottom: 14, left: 12, right: 14 }}
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={[t('Comments', 'Bình luận', 'コメント', '评论', '評論'), ...(n > 0 ? [String(n)] : [])].join(', ')}
      testID="collection-comments"
    >
      <Glyph name="chatbubble-outline" size={ACT_GLYPH} color={colors.textSecondary} />
      {n > 0 ? <Text style={s.act} testID="collection-comments-count">{n}</Text> : null}
    </PressableScale>
  );
}
