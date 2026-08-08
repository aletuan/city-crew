import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

// Detail screens live inside each tab's own stack (Explore, Collections),
// so the bottom tab bar stays visible everywhere.
export type RootStackParamList = {
  ExploreHome: undefined;
  Search: undefined;
  CollectionsHome: undefined;
  PlaceDetail: { slug: string };
  CollectionDetail: { slug: string };
  ProfileHome: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  EditProfile: undefined;
};

export type Nav = NativeStackNavigationProp<RootStackParamList>;
export type RootRoute<T extends keyof RootStackParamList> = RouteProp<RootStackParamList, T>;
