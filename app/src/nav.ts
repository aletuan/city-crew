import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createNavigationContainerRef, type RouteProp } from '@react-navigation/native';

/**
 * What the wizard asked, in the shape the two screens after it need.
 *
 * `where` and `district` are not a duplication. Only the wizard knows
 * whether the reader picked an area or dropped a pin, and the screens
 * after it have no business re-deciding that — so `where` is the sentence
 * to print, already resolved, and `district` is the datum to plan with,
 * null when there was no area to name.
 */
export type PlanAsk = {
  company: string | null;
  categories: string[];
  /** What to *print* for where the day starts — a district name, "a pin
   *  you dropped", or "near me". A label and nothing else: only the wizard
   *  knows which of the three the reader chose, and the screens after it
   *  have no business re-deciding that. It is not a location. */
  where: string | null;
  district: string | null;
  /**
   * Where the day starts, when the reader dropped a pin.
   *
   * Absent until this was added, which was a real bug rather than a gap:
   * `where` carried the *words* "A pin you dropped" while the coordinate
   * behind them had nowhere to ride, so every screen after the wizard
   * rebuilt the draft with `at: null` and the planner chose a first stop
   * as though the reader had said nothing. A pin on 29 Liễu Giai returned
   * three plans in Hoàn Kiếm, four kilometres away, past cafés three
   * hundred metres from the pin.
   *
   * Two numbers rather than a point, matching `startMin` here and
   * `at_lat`/`at_lng` on the `trips` table. Both or neither — see
   * `draftFrom`.
   */
  atLat?: number;
  atLng?: number;
  date: string;
  when: 'day' | 'evening';
  /**
   * What time the outing begins, minutes past midnight — resolved once, in
   * the wizard, by `startMinFor`.
   *
   * It rides here rather than being recomputed on each screen because all
   * three of them rebuild the same plan from these answers, and a value
   * read off the clock three times is three slightly different values. Two
   * minutes' drift across a quarter-hour boundary is enough to move a start
   * from 18:15 to 18:30, change which places are open, and hand the reader
   * a different evening from the card they tapped.
   *
   * Optional so a plan reached without the wizard still means something:
   * absent is "the hour this shape normally starts at".
   */
  startMin?: number;
  /** Collection slugs the reader chose to build from. */
  from: string[];
};

// Detail screens live inside each tab's own stack (Explore, Collections),
// so the bottom tab bar stays visible everywhere.
export type RootStackParamList = {
  ExploreHome: undefined;
  Search: undefined;
  /** `tab` lands the screen on a specific half — Explore's "See all"
   *  points at the community shelf, not at your library. */
  CollectionsHome: { tab?: 'community' } | undefined;
  /** One screen for three verbs: params absent means "new", `slug` means
   *  "rename this one", `copyFrom` means "save a copy of somebody else's". */
  CollectionForm: {
    slug?: string;
    title?: string;
    desc?: string;
    /** Set when the form was reached from a place's bookmark: the new
     *  collection takes this place as its first member. */
    addPlaceSlug?: string;
    /** Set when the form is a copy being edited before it exists: the
     *  source list's facts, carried whole because the source belongs to
     *  somebody else and no query of "mine" can resolve it. The copy is
     *  created on submit; backing out creates nothing. */
    copyFrom?: { cityId: string; title: string; desc: string; placeSlugs: string[] };
  } | undefined;
  PlaceDetail: { slug: string };
  /** Search Google for a place the catalog is missing, and suggest it.
   *  Reached from Explore's footer and its scroll offer; Search asks
   *  Google in place now rather than sending anyone here. */
  AddPlace: undefined;
  CollectionDetail: { slug: string };
  IdeasHome: undefined;
  /** The screen that does the work. Carries the answers rather than
   *  re-reading the draft, because the draft lives in the screen behind
   *  this one and a plan should be built from what was asked at the
   *  moment it was asked. */
  Sketching: PlanAsk;
  /** The three drafts, and the button that asks for three more. Takes the
   *  same answers plus the draw, so the plans are rebuilt from pure inputs
   *  rather than carried through navigation as objects. */
  PlanOptions: PlanAsk & { seed: number };
  /** One of those drafts, opened for nudging. Named by the lens that
   *  produced it rather than by an index, so the plan the reader tapped is
   *  the plan they get even if a thin catalog returned fewer than three.
   *
   *  `avoid` rides along for the same reason the seed does: the next screen
   *  rebuilds the plan from pure inputs, and after Regenerate the slugs
   *  already shown are one of those inputs. Without it the rebuild is a
   *  different draw wearing the same lens. */
  PlanEdit: PlanAsk & { seed: number; lens: string; title?: string; avoid?: string[] };
  TripsHome: undefined;
  /** A saved trip, whole. Carries only the id: the row is already in
   *  memory from the list, and re-reading it there rather than serialising
   *  it through navigation is what keeps one copy of a trip in the app —
   *  the same rule `SaveProvider` follows for collections. */
  TripDetail: { id: string };
  /** An invitation, whole, before it is answered. Carries only the trip id
   *  for the same reason `TripDetail` does — the row is already in memory,
   *  from the same `useMyTrips` list, because an invitee can read the trip
   *  from the moment they are asked.
   *
   *  A separate route rather than a mode on `TripDetail`: that screen is
   *  for a plan you are on, with a crew row and a delete button, and
   *  neither means anything for a day nobody has agreed to yet. */
  TripInvitation: { id: string };
  ProfileHome: undefined;
  /** The crew list, and the screen that answers what happened while you
   *  were away. Both live in the Profile stack: friends are a fact about
   *  the account, not about any city. */
  Crew: undefined;
  Activity: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  EditProfile: undefined;
};

export type Nav = NativeStackNavigationProp<RootStackParamList>;
export type RootRoute<T extends keyof RootStackParamList> = RouteProp<RootStackParamList, T>;

/**
 * The container ref, for navigating from outside a screen.
 *
 * `SaveProvider` sits above the navigators — it has to, because its sheets
 * belong to no one screen — so it has no `navigation` prop to use. This is
 * the supported way out of that, not a shortcut around passing props.
 */
export const navRef = createNavigationContainerRef<RootStackParamList>();

/** Jump to a screen inside another tab's stack. Silently does nothing
 *  before the container has mounted, which is only ever true at launch.
 *
 *  A caller naming a screen that is not the stack's first must also pass
 *  `initial: false` beside `screen`. Without it, React Navigation makes
 *  the named screen the *initial* route of a stack that has not mounted
 *  yet — nothing beneath it to go back to, and the tab keeps showing it.
 *  That is how a bookmark tapped before the Collections tab was ever
 *  opened left the tab stuck on "Name your list" with every list
 *  seemingly gone. */
export function goTo(tab: string, params: object) {
  if (!navRef.isReady()) return;
  // The tab route names are not in RootStackParamList — that type covers
  // the screens inside the stacks, which is what every other caller needs.
  (navRef.navigate as (name: string, params: object) => void)(tab, params);
}
