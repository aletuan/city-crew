// Saving a copy of somebody's list, and deleting your own.
//
// Out of `CollectionDetailScreen` on 23 Nov 2026, the second step of F1
// in the 22 Nov code review. The two travel together because they are
// the two presses on this page that end with the list being somewhere
// else: a copy goes to the form and becomes yours, a deletion takes the
// list away and the page with it. Neither draws anything; the screen
// and `useListMenu` decide where their doors are.
//
// The reasoning moved with the code unchanged.

import { useRef } from 'react';
import { Alert } from 'react-native';
import { deleteCollection, type Collection } from '../../lib/data';
import type { useCollections } from '../../lib/catalog';
import type { useI18n } from '../../lib/i18n';
import type { useMyLists, useSaveActions } from '../../lib/save';
import type { useNoteEvent } from '../../lib/tasteProfile';
import type { Place } from '../../lib/types';
import type { Nav } from '../../nav';

export type CopyRemoveArgs = {
  col: Collection | null | undefined;
  uid: string | undefined;
  /** The city on screen, which a list with no city of its own is filed under. */
  tabCityId: string | undefined;
  sharedToMe: boolean;
  /** The list's places in the order on screen. */
  members: Place[];
  title: string;
  mine: ReturnType<typeof useMyLists>;
  cols: ReturnType<typeof useCollections>;
  note: ReturnType<typeof useNoteEvent>;
  askToSignIn: ReturnType<typeof useSaveActions>['askToSignIn'];
  navigation: Nav;
  t: ReturnType<typeof useI18n>['t'];
};

export function useCopyRemove({
  col, uid, tabCityId, sharedToMe, members, title, mine, cols, note, askToSignIn, navigation, t,
}: CopyRemoveArgs) {
  /**
   * Take this list into your own collections.
   *
   * The answer to a question the app could not answer before: you find a
   * list you like, and the only things you can do with it are like it and
   * leave. Liking is a compliment. This is the one that lets you use it —
   * your copy, your order, your additions, and the original untouched.
   *
   * ── through the form, not on the spot ──
   *
   * Nothing is created here. The row hands the source's facts to the
   * collection form — the title (which the form offers back as "Copy of
   * X", editable before anything exists), the description as the curator
   * wrote it, the members in the curator's order — and the copy is
   * born only when the reader saves there. Backing out of the form
   * creates nothing, so a curious tap costs nothing to undo.
   *
   * ── the credit, kept out of the text ──
   *
   * The copy used to carry a "Copied from @curator" line appended to its
   * description, back when that was the only record of where a copy came
   * from. It no longer is: the form writes `copied_from` onto the new row
   * (see `CollectionFormScreen`), and the curator hears about the copy in
   * Activity through `copies_of_mine`. The line had become a stamp in
   * somebody else's words — the copier's first edit was to delete it, it
   * was written in whichever language the copier happened to read, and
   * the form saved that one string into every language column. So the
   * description now carries only what the curator wrote, and where the
   * copy came from lives in the data, not on the screen (owner, 15 Oct
   * 2026).
   *
   * ── the city, from the list rather than from the tab ──
   *
   * `col.city_id`, falling back to the city on screen. The fallback
   * exists for the legacy select that omits the column. The public query
   * is no longer city-scoped (a list appears in every city it has a place
   * in — see `fetchCollections`), so the stamp can differ from the tab;
   * the copy takes the original's stamp, not the tab's.
   */
  const copyCityId = col?.city_id || tabCityId;
  // Where the copy's doors open — the ⋯'s sheet, the dock's pill and,
  // since 20 Nov 2026, the activity row with its figure
  // (`collectionDetail/CopyDoor`; the card's corner held one until 13
  // Nov): with a city to file it under, and never on a list lent to you
  // (`sharedToMe`).
  const canCopy = !!copyCityId && !sharedToMe;
  const copyRef = useRef<() => void>(() => {});
  const copy = () => {
    if (!col) return;
    // Signed out this is the sheet, not an error: wanting somebody's list
    // is a good moment to be offered an account, and a disabled row would
    // have explained nothing.
    // Signed in, the copy is finished on the reader's return: the form
    // opens and waits for them, so nothing is written unasked. Through
    // the ref because the `copy` that runs must be a render that knows
    // the reader is signed in — this one does not.
    if (!uid) { askToSignIn('copy', () => copyRef.current()); return; }
    const cityId = copyCityId;
    if (!cityId) return;
    const sourceDesc = t(col.desc_en, col.desc_vi, col.desc_ja)?.trim() || '';
    navigation.navigate('CollectionForm', {
      copyFrom: {
        sourceId: col.id,
        cityId,
        title,
        desc: sourceDesc,
        // The order on screen, which is `sort_order` already resolved by
        // `membersOf` — copying the list means copying the sequence the
        // curator chose, not the order the rows happen to come back in.
        placeSlugs: members.map((p) => p.slug),
      },
    });
  };
  copyRef.current = copy;

  const remove = () => Alert.alert(
    t('Delete this collection?', 'Xoá bộ sưu tập này?', 'このコレクションを削除しますか？', '删除这个合集？', '刪除這個合集？'),
    t(`"${title}" will be gone for good.`, `"${title}" sẽ mất hẳn.`, `「${title}」は完全に削除されます。`, `“${title}”将被永久删除。`, `「${title}」將被永久刪除。`),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消'), style: 'cancel' },
      {
        text: t('Delete', 'Xoá', '削除', '删除', '刪除'),
        style: 'destructive',
        onPress: () => {
          if (!col) return;
          deleteCollection(col.slug)
            // Leaving first: the screen is about a row that no longer
            // exists, and the list behind it is where the outcome shows.
            //
            // The members left the saved set with the list, and the taste
            // profile has to hear it — without these, their last recorded
            // verb stays `save` forever and a thrown-away list keeps
            // counting as liked (#315). After the delete, never before:
            // a failed delete must not leave false events behind.
            .then(() => {
              for (const m of members) note(m.slug, 'unsave');
              navigation.goBack();
              // Both catalogs, as publish and reorder do: a public list
              // also lives in the public query, and without this it stays
              // on the Explore shelf and in search after it is gone.
              mine.reload();
              cols.reload();
            })
            .catch((e: Error) => Alert.alert(t('Could not delete', 'Không xoá được', '削除できませんでした', '无法删除', '無法刪除'), e.message));
        },
      },
    ],
  );

  return { canCopy, copy, remove };
}
