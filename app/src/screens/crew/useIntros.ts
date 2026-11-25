// The introductions on the Requests tab: who to suggest, the faces and
// list names their reasons need, and the ones put away this visit.
//
// Out of `CrewScreen` on 25 Nov 2026, as the screens of the 22 Nov code
// review were (F1, F5): the reasoning moved with the code, unchanged.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchListTitles, fetchProfilesById, fetchSuggestedFriends, type ListTitle } from '../../lib/data';
import type { useCrew } from '../../lib/crew';
import { openSuggestions, type Suggestion } from '../../lib/friends';

type Crew = ReturnType<typeof useCrew>;

export function useIntros({ me, ships, blocks, absorb }: {
  me: string | null;
  ships: Crew['ships'];
  blocks: Crew['blocks'];
  absorb: Crew['absorb'];
}) {
  // ── introductions ──
  //
  // Asked once per visit and then trusted: the list is stable between
  // visits, and every action taken since is applied by `openSuggestions`
  // rather than by asking the server again. So a tapped row disappears
  // at the speed of the tap.
  //
  // A pull asks once more, and that answer is trusted the same way.
  // `suggesting` counts the asks out, for the pull's spinner to wait on
  // and for a pull to join rather than double. Counted as the ask is
  // made, in the pull's own handler: counted in an effect after it, the
  // spinner's disarm — which runs in the same pass — would see nothing
  // out and put the spinner away before it was ever drawn.
  const [suggested, setSuggested] = useState<Suggestion[]>([]);
  const [suggesting, setSuggesting] = useState(0);
  const askSuggestions = useCallback(() => {
    if (!me) { setSuggested([]); return; }
    setSuggesting((n) => n + 1);
    // Introductions are an extra: a failure shows none, which is how
    // the screen reads for anybody with no overlap yet — or, on a pull,
    // keeps the ones already shown.
    fetchSuggestedFriends().then(setSuggested).catch(() => {})
      .finally(() => setSuggesting((n) => n - 1));
  }, [me]);
  useEffect(askSuggestions, [askSuggestions]);
  useEffect(() => {
    const ids = suggested.map((sg) => sg.other);
    if (!ids.length) return;
    // Absorbed into the provider rather than held here, so the face a
    // suggestion earned survives into the crew when the reader adds them.
    fetchProfilesById(ids).then(absorb).catch(() => {});
  }, [suggested, absorb]);
  // The lists a like or copy was about, for the row to name. Anybody's,
  // in any city, so not on any shelf this screen holds; a failed read
  // leaves the rows saying the same thing without the name.
  const [titles, setTitles] = useState<Record<string, ListTitle>>({});
  useEffect(() => {
    const ids = [...new Set(suggested.map((sg) => sg.collectionId).filter((id): id is string => !!id))];
    if (!ids.length) return;
    fetchListTitles(ids).then(setTitles).catch(() => {});
  }, [suggested]);
  // Put away with the ×, this visit. The server leaves them out from the
  // next one; until then this is what keeps the row gone.
  const [dismissed, setDismissed] = useState<string[]>([]);
  const intros = useMemo(
    () => openSuggestions(suggested, me ?? '', ships.data, [...blocks.data, ...dismissed]),
    [suggested, me, ships.data, blocks.data, dismissed],
  );
  return { intros, titles, suggesting, askSuggestions, setDismissed };
}
