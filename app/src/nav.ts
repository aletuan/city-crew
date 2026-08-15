import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createNavigationContainerRef, type RouteProp } from '@react-navigation/native';

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
  /** Search Google for a place the catalog is missing, and suggest it. */
  AddPlace: undefined;
  CollectionDetail: { slug: string };
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
