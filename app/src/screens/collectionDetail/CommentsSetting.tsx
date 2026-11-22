// Comments on or off, as a row in your own list's ⋯ menu (owner, 22 Nov
// 2026). The thread's own ⋯ keeps its switch; this opens the same sheet
// (`useThreadOwner`), so the setting is where the list's other settings
// are as well as where its comments are. It is the way to the switch
// while nobody has commented: the bubble then raises the field over the
// page for the owner as for anybody (`quickOrThread`).
//
// A row only where a thread can be: the `comments` flag on, a public
// list, yours. Its line under the title says where the thread stands.

import type { SheetAction } from '../../components/ActionSheet';
import { usePreviewsQuery } from '../../lib/data';
import { useFlag } from '../../lib/useFlag';
import { useI18n } from '../../lib/i18n';
import { useThreadOwner } from '../comments/useThreadOwner';

export function useCommentsSetting(
  list: { id?: string | null; is_public?: boolean | null } | null | undefined,
  owned: boolean,
) {
  const { t } = useI18n();
  const on = useFlag('comments');
  const listId = on && owned && list?.is_public ? list.id ?? null : null;
  // Nothing asked for a row that is not drawn.
  const previews = usePreviewsQuery(listId ? [listId] : []);
  const off = previews.data[listId ?? '']?.off ?? false;
  const owner = useThreadOwner({ kind: 'collection', id: listId ?? '' }, { off, mine: true }, previews.reload);
  const row: SheetAction | null = listId ? {
    key: 'comments',
    icon: off ? 'close-circle-outline' : 'chatbubble-outline',
    title: t('Comments', 'Bình luận', 'コメント', '评论', '評論'),
    desc: off ? t('Off', 'Đang tắt', 'オフ', '已关闭', '已關閉') : t('On', 'Đang bật', 'オン', '已开启', '已開啟'),
    onPress: owner.show,
    testID: 'collection-menu-comments',
  } : null;
  return { row, node: owner.node };
}
