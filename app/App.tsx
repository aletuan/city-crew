import React from 'react';
import { Text } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import {
  Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold,
  Figtree_700Bold, Figtree_800ExtraBold, useFonts,
} from '@expo-google-fonts/figtree';
import { I18nProvider, useI18n } from './src/lib/i18n';
import { colors, font } from './src/theme';
import type { RootStackParamList } from './src/nav';
import ExploreScreen from './src/screens/ExploreScreen';
import PlaceDetailScreen from './src/screens/PlaceDetailScreen';
import CollectionsScreen from './src/screens/CollectionsScreen';
import CollectionDetailScreen from './src/screens/CollectionDetailScreen';
import ComingSoonScreen from './src/screens/ComingSoonScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const stackOptions = { headerShown: false, contentStyle: { backgroundColor: colors.bg } } as const;

// Each tab owns its stack, so detail screens keep the bottom tab bar visible.
function ExploreStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="ExploreHome" component={ExploreScreen} />
      <Stack.Screen name="PlaceDetail" component={PlaceDetailScreen} />
    </Stack.Navigator>
  );
}

function CollectionsStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="CollectionsHome" component={CollectionsScreen} />
      <Stack.Screen name="CollectionDetail" component={CollectionDetailScreen} />
      <Stack.Screen name="PlaceDetail" component={PlaceDetailScreen} />
    </Stack.Navigator>
  );
}

// [inactive, active] — the focused tab uses the filled glyph.
const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Ideas: ['sparkles-outline', 'sparkles'],
  Explore: ['compass-outline', 'compass'],
  Trips: ['calendar-outline', 'calendar'],
  Collections: ['bookmark-outline', 'bookmark'],
  Profile: ['person-outline', 'person'],
};

function Tabs() {
  const { t } = useI18n();
  const labels: Record<string, string> = {
    Ideas: t('Ideas', 'Ý tưởng'),
    Explore: t('Explore', 'Khám phá'),
    Trips: t('Trips', 'Chuyến đi'),
    Collections: t('Collections', 'Bộ sưu tập'),
    Profile: t('Profile', 'Cá nhân'),
  };
  return (
    <Tab.Navigator
      initialRouteName="Explore"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(13,10,16,0.96)',
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
        },
        tabBarActiveTintColor: colors.aiAmber,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.5)',
        tabBarLabel: ({ color, focused }) => (
          <Text style={{ color, fontSize: 11, fontFamily: focused ? font.semibold : font.medium }}>
            {labels[route.name]}
          </Text>
        ),
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons name={ICONS[route.name][focused ? 1 : 0]} size={size - 2} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Ideas">{() => <ComingSoonScreen titleEn="Ideas" titleVi="Ý tưởng" />}</Tab.Screen>
      <Tab.Screen name="Explore" component={ExploreStack} />
      <Tab.Screen name="Trips">{() => <ComingSoonScreen titleEn="Trips" titleVi="Chuyến đi" />}</Tab.Screen>
      <Tab.Screen name="Collections" component={CollectionsStack} />
      <Tab.Screen name="Profile">{() => <ComingSoonScreen titleEn="Profile" titleVi="Cá nhân" />}</Tab.Screen>
    </Tab.Navigator>
  );
}

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bgElevated, text: colors.text },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold,
    Figtree_700Bold, Figtree_800ExtraBold,
  });
  if (!fontsLoaded) return null;
  return (
    <I18nProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <Tabs />
      </NavigationContainer>
    </I18nProvider>
  );
}
