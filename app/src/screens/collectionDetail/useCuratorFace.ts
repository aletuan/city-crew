// The face at the head of somebody else's list, and whether to keep its
// place while it is being looked up.
//
// Out of `CollectionDetailScreen` on 23 Nov 2026, the fourth step of F1
// in the 22 Nov code review. The reasoning moved with the code unchanged.

import { useCuratorAvatar } from '../../lib/catalog';
import { useProfileByHandle, type Collection } from '../../lib/data';
import { normalizeHandle } from '../../lib/handle';

export function useCuratorFace(owned: boolean, col: Collection | null | undefined) {
  /**
   * The curator's face, for a list somebody else made.
   *
   * `normalizeHandle` before the lookup, and it is not belt-and-braces:
   * `profileByHandle` matches with `ilike`, and the editorial rows were
   * seeded with the `@` written into the value — `@hanoicrew` — so the
   * raw column would find nothing and find it silently. `lib/handle`
   * states the rule this follows: never trust the stored form.
   *
   * Null for your own list, which is not an optimisation but the correct
   * answer: the byline below says nothing about you either, and asking
   * would spend a request to be told what `useAuth` already holds.
   *
   * Nothing here has a failure state to draw. A handle with no profile
   * behind it is the normal case, not an error — every editorial list is
   * one, their handles living in `reserved_handles` with no `profiles`
   * row anywhere — and a request that fails leaves the byline exactly as
   * it reads today. So the face is the only thing conditional on this,
   * and it simply does not appear.
   */
  const curatorHandle = !owned && col?.curator_handle
    ? normalizeHandle(col.curator_handle) || null
    : null;
  /*
   * The shelf already fetched this, so the common path spends no request
   * at all and the face is there on the first paint. The lookup stays for
   * the cold one — a deep link into a list whose shelf has not loaded —
   * and is skipped entirely when the map already answered.
   */
  const cachedAvatar = useCuratorAvatar(curatorHandle);
  const lookup = useProfileByHandle(cachedAvatar ? null : curatorHandle);
  const curatorAvatar = cachedAvatar ?? (lookup.data?.avatar_url || null);
  /*
   * Whether the byline holds a place for a face.
   *
   * While the answer is still coming, yes — so the line is laid out once
   * and the face lands in a slot that was already there, rather than
   * pushing the handle sideways as it arrives. Once the lookup has come
   * back empty, no: an editorial handle has no person behind it, and a
   * permanent grey disc there would be the screen inventing one.
   */
  const holdForFace = !!curatorAvatar || (!!curatorHandle && !cachedAvatar && lookup.loading);
  // A profile behind the handle is an account, so a page to open.
  return { curatorAvatar, holdForFace, found: !!lookup.data };
}
