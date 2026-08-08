import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider } from './src/lib/auth';
import { CityProvider } from './src/lib/city';
import { I18nProvider, useI18n } from './src/lib/i18n';
import { colors, font } from './src/theme';
import { fireHaptic, TAB_BAR_HEIGHT } from './src/components/ui';
import type { RootStackParamList } from './src/nav';
import ExploreScreen from './src/screens/ExploreScreen';
import PlaceDetailScreen from './src/screens/PlaceDetailScreen';
import CollectionsScreen from './src/screens/CollectionsScreen';
import CollectionDetailScreen from './src/screens/CollectionDetailScreen';
import ComingSoonScreen from './src/screens/ComingSoonScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const stackOptions = { headerShown: false, contentStyle: { backgroundColor: colors.bg } } as const;

// Each tab owns its stack, so detail screens keep the bottom tab bar visible.
function ExploreStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="ExploreHome" component={ExploreScreen} />
      <Stack.Screen name="PlaceDetail" component={PlaceDetailScreen} />
      {/* The Explore shelf opens collections in place, keeping the tab. */}
      <Stack.Screen name="CollectionDetail" component={CollectionDetailScreen} />
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

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    </Stack.Navigator>
  );
}

// [inactive, active]. Thin monochrome glyphs, and the selected tab takes
// the solid variant in champagne — the iOS convention. No selection pill.
const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Ideas: ['sparkles-outline', 'sparkles'],
  Explore: ['compass-outline', 'compass'],
  Trips: ['calendar-outline', 'calendar'],
  Collections: ['bookmark-outline', 'bookmark'],
  Profile: ['person-outline', 'person'],
};

/** True translucent material: dark blur with a smoky overlay on top, so
 *  content scrolling beneath the floating bar reads through it. */
function TabBarMaterial() {
  return (
    <BlurView intensity={42} tint="dark" style={StyleSheet.absoluteFill}>
      <View style={{ flex: 1, backgroundColor: 'rgba(12,13,12,0.62)' }} />
    </BlurView>
  );
}

function Tabs() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const labels: Record<string, string> = {
    Ideas: t('Ideas', 'Ý tưởng', 'アイデア'),
    Explore: t('Explore', 'Khám phá', '探索'),
    Trips: t('Trips', 'Chuyến đi', '旅程'),
    Collections: t('Collections', 'Bộ sưu tập', 'コレクション'),
    Profile: t('Profile', 'Cá nhân', 'プロフィール'),
  };
  return (
    <Tab.Navigator
      initialRouteName="Explore"
      screenListeners={{ tabPress: () => fireHaptic('selection') }}
      screenOptions={({ route }) => ({
        headerShown: false,
        // Apple-style bar: full-width, square, a single top hairline, and
        // true blur material. Content flows (and blurs) underneath;
        // screens clear it via useTabBarClearance().
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: TAB_BAR_HEIGHT + insets.bottom,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.borderGlass,
          backgroundColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
        },
        tabBarBackground: TabBarMaterial,
        tabBarActiveTintColor: colors.champagne,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabel: ({ color, focused }) => (
          <Text style={{ color, fontSize: 11.5, fontWeight: focused ? font.semibold : font.regular }}>
            {labels[route.name]}
          </Text>
        ),
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons name={ICONS[route.name][focused ? 1 : 0]} size={size - 2} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Ideas">{() => <ComingSoonScreen titleEn="Ideas" titleVi="Ý tưởng" titleJa="アイデア" />}</Tab.Screen>
      <Tab.Screen name="Explore" component={ExploreStack} />
      <Tab.Screen name="Trips">{() => <ComingSoonScreen titleEn="Trips" titleVi="Chuyến đi" titleJa="旅程" />}</Tab.Screen>
      <Tab.Screen name="Collections" component={CollectionsStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bgElevated, text: colors.text },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <I18nProvider>
          <CityProvider>
            <NavigationContainer theme={navTheme}>
              <StatusBar style="light" />
              <Tabs />
            </NavigationContainer>
          </CityProvider>
        </I18nProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
