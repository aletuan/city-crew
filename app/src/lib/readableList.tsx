// A list the reader can open, by its slug, from wherever the app holds it.
//
// A list's page finds its list in three places — the reader's own
// (`useMyLists`), the ones lent to them (`useSharedWithMe`) and the public
// shelf (`useCollections`) — and since 15 Nov 2026 so do the two pages
// behind it, Activity and Statistics, which until then looked in the
// first alone because only an owner could open them. The same three, in
// the same order, so the page behind names the list the page in front
// showed: shared before public, since a list that is both is the same
// row either way and the shared copy names its owner.
//
// Each screen that draws shared lists holds its own copy of them (see
// `useSharedWithMe`), and this is one more: it reads what the list's page
// just fetched, off the phone, before it asks again.

import { useMemo } from 'react';
import { useSession } from './auth';
import { useCollections } from './catalog';
import { useSharedWithMe, type Collection } from './data';
import { useMyLists } from './save';

export function useReadableList(slug: string): {
  col: Collection | null;
  /** The reader's account, or null for a guest. */
  me: string | null;
  /** Whether the list is the reader's own. */
  owned: boolean;
  /** Still asking, with nothing found yet. */
  loading: boolean;
} {
  const { session, userId } = useSession();
  const me = session?.user?.id ?? null;
  const mine = useMyLists();
  const shared = useSharedWithMe(me ?? userId);
  const cols = useCollections();
  const col = useMemo(
    () => [...mine.data, ...shared.data, ...cols.data].find((c) => c.slug === slug) ?? null,
    [mine.data, shared.data, cols.data, slug],
  );
  return {
    col,
    me,
    owned: !!me && !!col?.owner_id && col.owner_id === me,
    loading: !col && (mine.loading || shared.loading || cols.loading),
  };
}
