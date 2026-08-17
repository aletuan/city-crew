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
  where: string | null;
  district: string | null;
  date: string;
  when: 'day' | 'evening';
  /** Collection slugs the reader chose to build from. */
  from: string[];
};

// Detail screens live inside each tab's own stack (Explore, Collections),
// so the bottom tab bar stays visible everywhere.
export type RootStackParamList = {
  ExploreHome: undefined;
  Search: undefined;
  CollectionsHome: undefined;
  /** One screen for both verbs: params absent means "new", params present
   *  means "rename this one". */
  CollectionForm: {
    slug?: string;
    title?: string;
    desc?: string;
    /** Set when the form was reached from a place's bookmark: the new
     *  collection takes this place as its first member. */
    addPlaceSlug?: string;
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
   *  the plan they get even if a thin catalog returned fewer than three. */
  PlanEdit: PlanAsk & { seed: number; lens: string; title?: string };
  ProfileHome: undefined;
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
 *  before the container has mounted, which is only ever true at launch. */
export function goTo(tab: string, params: object) {
  if (!navRef.isReady()) return;
  // The tab route names are not in RootStackParamList — that type covers
  // the screens inside the stacks, which is what every other caller needs.
  (navRef.navigate as (name: string, params: object) => void)(tab, params);
}
