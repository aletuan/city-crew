import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold, useFonts,
} from '@expo-google-fonts/space-grotesk';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider } from './src/lib/auth';
import { CityProvider } from './src/lib/city';
import { I18nProvider, useI18n } from './src/lib/i18n';
import { ThemeProvider, useScheme } from './src/lib/theme';
import { CatalogProvider } from './src/lib/catalog';
import { SaveProvider } from './src/lib/save';
import { colors, font } from './src/theme';
import { fireHaptic, GlassMaterial, TAB_BAR_HEIGHT } from './src/components/ui';
import { navRef, type RootStackParamList } from './src/nav';
import ExploreScreen from './src/screens/ExploreScreen';
import SearchScreen from './src/screens/SearchScreen';
import AddPlaceScreen from './src/screens/AddPlaceScreen';
import PlaceDetailScreen from './src/screens/PlaceDetailScreen';
import CollectionsScreen from './src/screens/CollectionsScreen';
import CollectionFormScreen from './src/screens/CollectionFormScreen';
import CollectionDetailScreen from './src/screens/CollectionDetailScreen';
import IdeasScreen from './src/screens/IdeasScreen';
import SketchingScreen from './src/screens/SketchingScreen';
import PlanOptionsScreen from './src/screens/PlanOptionsScreen';
import PlanEditScreen from './src/screens/PlanEditScreen';
import TripsScreen from './src/screens/TripsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const stackOptions = { headerShown: false, contentStyle: { backgroundColor: colors.bg } } as const;

// Each tab owns its stack, so detail screens keep the bottom tab bar visible.
// Ideas got a stack of its own when the sketching screen arrived: it is a
// screen the reader can back out of, not a modal, and the tab bar stays.
function IdeasStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="IdeasHome" component={IdeasScreen} />
      <Stack.Screen name="Sketching" component={SketchingScreen} />
      <Stack.Screen name="PlanOptions" component={PlanOptionsScreen} />
      <Stack.Screen name="PlanEdit" component={PlanEditScreen} />
    </Stack.Navigator>
  );
}

function ExploreStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="ExploreHome" component={ExploreScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="AddPlace" component={AddPlaceScreen} />
      <Stack.Screen name="PlaceDetail" component={PlaceDetailScreen} />
      {/* The Explore shelf opens collections in place, keeping the tab. */}
      <Stack.Screen name="CollectionDetail" component={CollectionDetailScreen} />
      {/* Registered here only because CollectionDetail is: a screen that
          lives in two stacks can only navigate to screens both of them
          have. Its owner actions should never fire from this side — the
          Explore shelf shows public lists — but "should never" is not a
          thing to leave a crash behind. */}
      <Stack.Screen name="CollectionForm" component={CollectionFormScreen} />
    </Stack.Navigator>
  );
}

function CollectionsStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="CollectionsHome" component={CollectionsScreen} />
      <Stack.Screen name="CollectionForm" component={CollectionFormScreen} />
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

// [inactive, active]. Thin monochrome glyphs when idle; the selected tab
// takes the solid variant, reversed out of an accent disc.
const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Ideas: ['bulb-outline', 'bulb'],
  Explore: ['compass-outline', 'compass'],
  Trips: ['calendar-outline', 'calendar'],
  Collections: ['bookmark-outline', 'bookmark'],
  Profile: ['person-outline', 'person'],
};

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
  const light = useScheme().scheme === 'light';
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
          // The active icon wears a 28pt disc, so the row above the label is
          // taller than a bare glyph — trim the top padding to keep both
          // inside the bar's height rather than growing the bar.
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
        tabBarBackground: GlassMaterial,
        // React Navigation types these as `string`, so they cannot take a
        // dynamic pair — the scheme picks them instead. Same coral, same
        // gray, chosen here rather than resolved by UIKit.
        //
        // Light stays on the accent's darker red where the glyph inside the
        // disc has moved to a warmer one: at 11.5pt this is small text, held
        // to 4.5:1, and the glyph's colour only reaches 3.64. See
        // `colors.badgeInk`.
        tabBarActiveTintColor: light ? '#C4402C' : '#FF6F5B',
        tabBarInactiveTintColor: light ? '#6E695E' : '#6E706D',
        // The label needs air the old bare glyph did not: a filled disc has
        // visual mass right down to its edge, where an outline icon's ink
        // stops well short of its bounding box, so the same gap now reads
        // as crowding.
        tabBarLabel: ({ color, focused }) => (
          <Text style={{
            color, fontSize: 11.5, marginTop: 4,
            fontWeight: focused ? font.semibold : font.regular,
          }}>
            {labels[route.name]}
          </Text>
        ),
        // The selected tab wears a disc, not just a tinted glyph: at 22pt
        // an outline and a solid of the same shape read alike in peripheral
        // vision, and the disc says which tab you are on without anyone
        // having to compare five icons. What fills the disc is the one
        // thing that flips with the theme — solid coral on charcoal, a
        // coral tint on paper. See `colors.badge`.
        tabBarIcon: ({ color, size, focused }) => (
          focused
            ? (
              <View style={{
                width: 28, height: 28, borderRadius: 14,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: colors.badge,
              }}>
                <Ionicons name={ICONS[route.name][1]} size={size - 7} color={colors.badgeInk} />
              </View>
            )
            : <Ionicons name={ICONS[route.name][0]} size={size - 2} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Ideas" component={IdeasStack} />
      <Tab.Screen name="Explore" component={ExploreStack} />
      <Tab.Screen name="Trips" component={TripsScreen} />
      <Tab.Screen name="Collections" component={CollectionsStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

// React Navigation types its palette as strings, so the dynamic pairs go
// in through a cast. They land in ordinary style props, which resolve a
// dynamic colour the same as any other.
const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg as string,
    card: colors.bgElevated as string,
    text: colors.text as string,
  },
};

/** Everything below the theme, so the scheme is readable from here down. */
function Root() {
  const { scheme, ready } = useScheme();
  // Hold the first frame until the stored choice is in. A dark-mode user
  // seeing a white flash on every launch would be a worse bug than having
  // no setting at all.
  // Display type only — see theme.ts. Until the faces are ready the app
  // holds on its own ground colour rather than rendering titles in the
  // system font and swapping them a frame later, which reads as a glitch.
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold,
  });
  // The same hold covers the stored scheme: a dark-mode user seeing a white
  // flash on every launch would be a worse bug than having no setting.
  if (!fontsLoaded || !ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    // Gesture handler wants to own the root view: swipe-to-reveal on the
    // collection rows is its gesture, and on Android nothing outside this
    // wrapper receives one at all.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <I18nProvider>
            <CityProvider>
              <NavigationContainer theme={navTheme} ref={navRef}>
                {/* Dark type on paper, light type on charcoal — the one
                    thing the window's interface style does not carry. */}
                <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
                {/* Both above the navigators: the catalog because five
                    screens read the same two lists, the save sheets
                    because they belong to no single screen — a card on
                    Explore, Search or a collection all raise the same one. */}
                <CatalogProvider>
                  <SaveProvider>
                    <Tabs />
                  </SaveProvider>
                </CatalogProvider>
              </NavigationContainer>
            </CityProvider>
          </I18nProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  // The theme sits above everything, including the frame that waits for it.
  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}
