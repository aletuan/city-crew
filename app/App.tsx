import React from 'react';
import { Text } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { I18nProvider, useI18n } from './src/lib/i18n';
import { colors, font, radius } from './src/theme';
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

// Thin monochrome glyphs throughout — the selected state is carried by
// champagne tint alone, never by a filled or highlighted shape.
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Ideas: 'sparkles-outline',
  Explore: 'compass-outline',
  Trips: 'calendar-outline',
  Collections: 'bookmark-outline',
  Profile: 'person-outline',
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
          // A rounded, almost-black translucent container with a single
          // hairline of warmth along its top edge.
          backgroundColor: 'rgba(12,13,12,0.94)',
          borderTopColor: colors.borderGlassSoft,
          borderTopWidth: 1,
          borderTopLeftRadius: radius.tabBar,
          borderTopRightRadius: radius.tabBar,
          height: 88,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.champagne,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabel: ({ color, focused }) => (
          <Text style={{ color, fontSize: 11.5, fontWeight: focused ? font.semibold : font.regular }}>
            {labels[route.name]}
          </Text>
        ),
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name]} size={size - 2} color={color} />
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
  return (
    <I18nProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <Tabs />
      </NavigationContainer>
    </I18nProvider>
  );
}
