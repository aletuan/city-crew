// The search box over the shelf: the words, the kind, whether the box is
// open and its panel up, and the terms it remembers.
//
// Out of CollectionsScreen since 24 Nov 2026, with its reasons: the state
// was a fifth of the screen's one function and nothing in it reads the
// shelf. What the words find is still the screen's (`siftCollections`,
// beside the sections it fills). The lines were moved, not retyped.
import type React from 'react';
import { useRef, useState } from 'react';
import { Keyboard, type TextInput } from 'react-native';
import { COLLECTION_RECENTS_KEY, RECENTS_SHOWN, rememberSearch } from '../../lib/recents';
import { NO_RECENTS, RECENTS, useStored } from '../../lib/stored';

export function useShelfSearch() {
  // The search over what is already here. Everything it reads — both
  // lists, every member — is in memory, so this is a filter that runs on
  // the keystroke, offline, with no query behind it. It answers by a
  // list's own words, by the places inside it, by their city, and by
  // @handle; the arithmetic lives in `siftCollections`, under the gate,
  // beside the rules it shares with the search box on Explore.
  //
  // It was a glyph in the header and a field that existed only while
  // wanted. The owner's review (14 Oct 2026): the check-ins screen had
  // meanwhile grown a box under its title with a panel of chips behind
  // it, and a reader who had learned that screen looked for the same
  // thing here. So this is that box, with that panel — recent searches,
  // then the cities, then the kinds of place — opened by focus, folded by
  // a choice (see `answered`) and let go of by Cancel. One city and one
  // kind at a time, a chosen chip tapped again lets go.
  //
  // What the panel adds that the words could not: a chip asks about the
  // *places* in a list. Under "Cafés" a list is listed for the cafés in
  // it, and the card says how many of its places those are, because a
  // list of eight with three cafés and a list of three cafés are
  // different answers to the same chip.
  //
  // Since 25 Oct 2026 the cities and the kinds are two `UnderlineChoice`
  // rows, each with "All" first, where they were two wraps of chips (the
  // owner, on the review board that took Explore's boxes away). With
  // seven cities and nine kinds the wraps were five lines of chips; the
  // rows are two, and scroll, so the panel is a band under the box rather
  // than a sheet over the shelf.
  //
  // And later that day the owner moved them out of the panel altogether:
  // the city and the kind are a sheet from below now, opened by Explore's
  // filter glyph beside the title (a filter sheet), so the box was for
  // words and the glyph for narrowing, on both screens. On 7 Nov 2026 the
  // kinds came back under the box and the sheet went — see `searching`.
  const [query, setQuery] = useState('');
  const q = query.trim();
  const [panel, setPanel] = useState(false);
  const [kind, setKind] = useState<string | null>(null);
  // One way in for words and kinds since 7 Nov 2026 (owner): the box is
  // not on the page at rest. The dock opens it — a reader is offered the
  // search once they have scrolled into the shelf, and the 🔍 that stood
  // beside the title went the same day (owner: fewer things at the top;
  // a shelf too short to scroll is one read at a glance) — where it stood — under the tabs — with the kinds as a row under it
  // and what was searched before; results keep the shelf's own layout.
  // The filter glyph and its sheet went: a city was three ways in (the
  // sheet, the box, and Mosaic's blocks with their ▾), and the kind was a
  // second door to the same answer. A city is typed now — the sift
  // already reads members' cities — and Mosaic is drawn by city anyway.
  // The 25 Oct move of the filters out of the box is undone in part.
  // Open from the dock until Cancel, which also lets go of
  // the words and the kind: so while anything narrows the shelf, the box
  // that holds it is on the page.
  const [searching, setSearching] = useState(false);
  const open = searching;
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  // Cancel is the box's: it lets go of the words and the kind, and puts
  // the box away (7 Nov 2026 — they are one tool again).
  //
  // Before: Cancel let go of the words and closed the panel.
  // It let go of the city and the kind too while they were chosen in the
  // panel; since they moved to the sheet (25 Oct 2026) they are the
  // sheet's, shown under the box with a ✕ each, and outlive a search.
  const cancel = () => {
    setPanel(false); setQuery(''); setKind(null); setSearching(false);
    inputRef.current?.blur();
    Keyboard.dismiss();
  };
  // A chip is an answer, and the keyboard asks for words. Tapped, it
  // puts the keyboard away (the owner, 14 Oct 2026: the keyboard stood
  // over the results of every chip) — and since 24 Oct the panel folds
  // with it, down to the chips that are on.
  //
  // It used to stay up until Cancel, for the reason VisitedScreen gives:
  // closing it on a blur would take the chips out from under the reader
  // mid-choice. Here that left the reader with no way to read the shelf.
  // The panel was not in the list then, as VisitedScreen's is, so it did
  // not scroll away; with seven cities and nine kinds it stood over all but
  // a fifth of the screen, and the only way out was Cancel, which let go
  // of the chips it was meant to keep (the owner's screenshot, 24 Oct
  // 2026). Folded, what it chose stays in sight under the box, so a
  // filter is never one nobody can see; the shelf gets the screen, and
  // the box opens the panel again for a second choice. Dragging the shelf
  // folds it too: that is the reader asking to read.
  //
  // The folded row was chips, each with a ✕, behind a "Filters" chip.
  // Since 25 Oct 2026 it is the review board's: Explore's filter glyph,
  // with no word beside it (the owner: the glyph says it), then what is
  // chosen as words with no ground, each a tap back into the panel and
  // each with its own ✕. Left from the board: its "Clear all", which
  // turned letting go of one of two choices into two taps (it shipped in
  // a draft and came out the same day — the owner asked why the ✕ had
  // gone; with two choices at most, a ✕ each is enough, and Cancel lets
  // go of everything); its filter sheet, a fourth way of choosing beside
  // the underline rows Explore, this panel and the visits panel now
  // share; and several cities at once, which the owner took out of every
  // filter on 24 Oct.
  const answered = () => { inputRef.current?.blur(); Keyboard.dismiss(); setPanel(false); };
  const fold = () => { if (panel) answered(); };
  // The dock: open the box (it takes focus as it mounts — see
  // `autoFocus` on it), or, open already, put the keyboard back in it.
  const openSearch = () => {
    if (open) inputRef.current?.focus();
    else setSearching(true);
  };

  // What this box remembered, in its own drawer — the visits screen's
  // mechanism, for its reasons: kept when a search *worked* (a card
  // opened, or the return key), never on a keystroke.
  const [recents, keepRecents] = useStored(COLLECTION_RECENTS_KEY, NO_RECENTS, RECENTS);
  const noteSearch = () => {
    const next = rememberSearch(recents, query);
    if (next !== recents) keepRecents(next);
  };
  const suggestions = recents
    .filter((term) => term.toLowerCase().includes(q.toLowerCase()) && term.trim() !== q)
    .slice(0, RECENTS_SHOWN);

  return {
    query, setQuery, q, panel, setPanel, kind, setKind, open, inputRef,
    cancel, answered, fold, openSearch, noteSearch, suggestions, keepRecents,
  };
}
