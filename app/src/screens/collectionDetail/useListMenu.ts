// The ⋯'s sheet on a list: its rows, the two views, and the two presses
// the card shares with it (Add place, Edit).
//
// Out of `CollectionDetailScreen` on 23 Nov 2026, the second step of F1
// in the 22 Nov code review. What the rows do is decided elsewhere —
// copying and deleting in `useCopyRemove`, planning and reporting by the
// screen — and handed in, so this is the one place that says which rows
// a reader gets and in what order. The sheet itself is still drawn by
// the screen (`menuSheet`).
//
// The reasoning moved with the code unchanged.

import type { SheetAction } from '../../components/ActionSheet';
import type { useReport } from '../../components/reportFlow';
import type { Collection } from '../../lib/data';
import type { useI18n } from '../../lib/i18n';
import type { Nav } from '../../nav';
import { useCommentsSetting } from './CommentsSetting';

/** A menu's rows, less the ones that do not apply here. */
const present = (rows: (SheetAction | null | false)[]) => rows.filter((r): r is SheetAction => !!r);

export type ListMenuArgs = {
  col: Collection | null | undefined;
  owned: boolean;
  sharedToMe: boolean;
  /** The view in force, and the press that changes it. */
  grid: boolean;
  pickView: (v: 'list' | 'grid') => void;
  title: string;
  desc: string;
  navigation: Nav;
  t: ReturnType<typeof useI18n>['t'];
  canPlan: boolean;
  plan: () => void;
  canCopy: boolean;
  copy: () => void;
  remove: () => void;
  canReport: ReturnType<typeof useReport>['canReport'];
  report: ReturnType<typeof useReport>['report'];
};

export function useListMenu({
  col, owned, sharedToMe, grid, pickView, title, desc, navigation, t,
  canPlan, plan, canCopy, copy, remove, canReport, report,
}: ListMenuArgs) {
  /*
   * The two views, in either menu: how a list is looked at is the
   * reader's, whoever made the list. A choice of two under its own name,
   * the one in force ticked, as iOS's own Files does it (owner, 22 Oct
   * 2026, from the reference). It was one row naming where it went —
   * "List view" while in the grid — which said nothing about where you
   * were.
   *
   * In the sheet since 13 Nov 2026 they are a card of their own under
   * the name, between the acts above and below them: a tick among verbs
   * would read as one more thing done, and `SheetAction.selected` is for
   * a choice between states, which these two are and the rest are not.
   *
   * ── the grid notice, removed (owner, 12 Nov 2026) ──
   * From 22 Oct a banner under the card said lists now open as a grid
   * and pointed here, with a ring pulsing round ⋯, until the reader
   * closed it. Three weeks on it was news to almost nobody it reached:
   * 59 of 107 accounts had joined after the grid became the default and
   * never knew the cards as one, and 55 of the 61 active in the last
   * fortnight had never closed it, so it stood over the photographs on
   * every list. The way back to the cards is still here, in this menu.
   * `preferences.grid_notice_closed_at` stays in the table: dropping it
   * is a live migration that would change nothing a reader sees.
   */
  const viewRows: SheetAction[] = [
    {
      key: 'grid',
      icon: 'grid-outline',
      title: t('Grid', 'Dạng lưới', 'グリッド', '网格', '網格'),
      selected: grid,
      onPress: () => pickView('grid'),
      testID: 'collection-menu-grid',
    },
    {
      key: 'list',
      icon: 'list-outline',
      title: t('List', 'Dạng danh sách', 'リスト', '列表', '列表'),
      selected: !grid,
      onPress: () => pickView('list'),
      testID: 'collection-menu-list',
    },
  ];

  // Search, opened for this list (owner, 23 Oct 2026). It used to be the
  // Explore tab, where saving a place offered this list by name: a trip
  // out of the list, a sheet per place, and a way back that was not the
  // one the reader came by. Search in this tab's own stack puts a ⊕ for
  // this list on every place it finds, and back is back to the list.
  const addPlace = () => {
    if (col) navigation.navigate('Search', { addTo: col.slug });
  };

  const edit = () => {
    if (!col) return;
    navigation.navigate('CollectionForm', { slug: col.slug, title, desc });
  };

  /* Report, a row in the ⋯. Never on a shared list: see `sharedToMe`. */
  const reportRow: SheetAction | null = col && !sharedToMe
    && canReport({ kind: 'collection', id: col.id ?? '', ownerId: col.owner_id })
    ? {
      key: 'report',
      icon: 'flag-outline',
      title: t('Report this list', 'Báo cáo bộ sưu tập này', 'このリストを報告', '举报这个清单', '舉報這個清單'),
      desc: t(
        'Tell the desk something here is wrong.',
        'Báo cho desk biết có điều gì không ổn ở đây.',
        'ここに問題があることをデスクに伝えます。',
        '告诉编辑团队这里有问题。', '告訴編輯團隊這裡有問題。',
      ),
      onPress: () => report({ kind: 'collection', id: col.id ?? '', ownerId: col.owner_id, name: title }),
    }
    : null;

  /* ── the ⋯'s sheet (owner, 13 Nov 2026) ──
     The sheet the other ⋯s in the app open — `ActionSheet`, as
     who-can-see-it beside it, Visited's ⋯ and the curator's face do — so
     that every pop-up in the app rises from the bottom the same way and
     is closed the same way: the backdrop, the grabber, or a row. That is
     the owner's reason, and the whole of it.

     Rejected, and removed that day: the popover it was. A `Modal` hung
     under the header's ⋯ from a measure of the button, with a lighter
     scrim and a shadow, on the argument that a menu anchored to its
     control is visibly that control's menu. It was the one menu in the
     app that did not rise from the bottom, so a reader met two shapes of
     menu and two ways out of them. What the anchor said — this is the
     list's menu — the sheet's header says in words, and the sheet needs
     no measure of anything.

     The header is the list's name, the way Visited's ⋯ heads its sheet
     with the visit's: the thing the menu is about, above the rows
     (`ActionSheet`). The rows are their names alone (owner, 13 Nov 2026):
     this is a menu of acts, and "Edit collection" or "Delete collection"
     says what it does. Rejected the same day, before it shipped: a
     sentence under every row, as the sheets that are choices wear them
     ("Only you can see it" under Private). Here they repeated the names —
     "Its name, description and categories" under Edit — and made the
     sheet twice as tall to read for nothing. Report keeps its sentence
     in the curator's sheet, where it stands beside Block; here it is the
     one red row among plain ones, and its name is enough.

     The rows are the popover's, on its conditions, in three cards:
     what you do with the list, the two views under their name
     (`viewRows`), and the one row in red. A card with nothing in it is
     not drawn (`SheetRows`), which is how a list lent to you, with
     nothing to plan from, opens on the views.

     ── the order (owner, 16 Nov 2026) ──
     Every act on the list in the first card, the views under it, the red
     row alone at the foot. Until then the sheet kept the popover's
     order, which nobody had argued for: two acts, the views, then the
     other two with the red row closing their card. The views cut what
     you do with a list in half, and Delete stood one row under Share in
     the same card. Deleting asks first (`remove`), so the row apart is
     not what saves a list from a slipped thumb; it is that a card of
     plain verbs ending in a red one reads as four of a kind, and the
     red row is not one of them. What it costs is the views two rows
     further down, and which view a reader looks at is kept for them
     (`LIST_OR_GRID`), so that row is pressed once and rarely again. The
     sheet is as tall as it was: the same rows in the same three cards.

     Both sheets, yours and a visitor's, so the menu is one shape
     whoever's list it is on.

     ── yours ──
     Add place, Plan a trip, Edit collection, Share; the views; Delete.
     No publish row: who can see the list is changed where it is said,
     under your handle at the card's head — see `visibility`.

     ── somebody else's ──
     The things you can do to a thing you do not own: plan from it,
     take it, pass it on, say something is wrong with it. No Edit, no
     Delete, no publish switch — not because they are kept from you but
     because they are not yours to press, and a menu listing what the
     database will refuse lies twice.

     "Save a copy" and not "Follow", and the wording is the promise.
     Following would leave the curator in charge of what you see — they
     drop a place, you lose it — and the reason to want this list was to
     make it yours: reorder it, cut the two you have been to, add the
     four you know. It copies, and the row's name says so before the
     tap rather than after it. Only with a city to file the copy under (`canCopy`):
     without one the row could only close the sheet and do nothing.

     Plan a trip, Save a copy, Share; the views; Report. Report last,
     alone and in red, because it is the row that is about a person
     rather than about the list — and never on your own, which is yours
     to delete.

     A friend's list shared with you keeps only the reading half: Plan a
     trip and the two views. See `sharedToMe`. */
  const planRow: SheetAction | null = canPlan ? {
    key: 'plan',
    icon: 'paw-outline',
    title: t('Plan a trip', 'Lên kế hoạch', 'プランを立てる', '规划行程', '規劃行程'),
    onPress: plan,
    testID: 'collection-menu-plan',
  } : null;
  const commentsSetting = useCommentsSetting(col, owned);
  const [actsBefore, actsAfter]: SheetAction[][] = owned
    ? [
      present([
        {
          key: 'add',
          icon: 'add-circle-outline',
          title: t('Add place', 'Thêm địa điểm', 'スポットを追加', '添加地点', '新增地點'),
          onPress: addPlace,
          testID: 'collection-menu-add',
        },
        planRow,
        {
          key: 'edit',
          icon: 'create-outline',
          title: t('Edit collection', 'Sửa bộ sưu tập', 'コレクションを編集', '编辑合集', '編輯合集'),
          onPress: edit,
          testID: 'collection-menu-edit',
        },
        commentsSetting.row,
      ]),
      [
        {
          key: 'delete',
          icon: 'trash-outline',
          title: t('Delete collection', 'Xoá bộ sưu tập', 'コレクションを削除', '删除合集', '刪除合集'),
          destructive: true,
          onPress: remove,
          testID: 'collection-menu-delete',
        },
      ],
    ]
    : [
      present([
        planRow,
        canCopy && {
          key: 'copy',
          icon: 'copy-outline',
          title: t('Save a copy', 'Lưu bản sao', 'コピーを保存', '保存副本', '儲存副本'),
          onPress: copy,
          testID: 'collection-menu-copy',
        },
      ]),
      present([
        reportRow && { ...reportRow, desc: undefined, destructive: true, testID: 'collection-menu-report' },
      ]),
    ];

  return { viewRows, addPlace, edit, actsBefore, actsAfter, commentsSetting };
}
