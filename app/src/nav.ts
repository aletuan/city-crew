import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

export type RootStackParamList = {
  Tabs: undefined;
  PlaceDetail: { slug: string };
  CollectionDetail: { slug: string };
};

export type Nav = NativeStackNavigationProp<RootStackParamList>;
export type RootRoute<T extends keyof RootStackParamList> = RouteProp<RootStackParamList, T>;
