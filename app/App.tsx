import React from 'react';
import { View } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold, useFonts,
} from '@expo-google-fonts/space-grotesk';
import { AuthProvider } from './src/lib/auth';
import { CityProvider } from './src/lib/city';
import { I18nProvider, useI18n } from './src/lib/i18n';
import { ThemeProvider, useScheme } from './src/lib/theme';
import { CatalogProvider } from './src/lib/catalog';
import { SaveProvider } from './src/lib/save';
import { colors } from './src/theme';
import { fireHaptic } from './src/components/ui';
import FloatingTabBar from './src/components/FloatingTabBar';
import { TabBarDuckProvider } from './src/components/tabBarDuck';
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
import TripDetailScreen from './src/screens/TripDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import CrewScreen from './src/screens/CrewScreen';
import ActivityScreen from './src/screens/ActivityScreen';

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
      {/* The editor names a place on every card and opens it. Without this
          the navigate finds no handler here, bubbles up to the tabs, and
          lands in whichever stack does have it — so tapping a stop in your
          plan switched to the Explore tab, and Back returned there instead
          of to the plan you were still editing. Same rule the Explore
          stack states about CollectionForm: a screen can only navigate to
          screens its own stack has. */}
      <Stack.Screen name="PlaceDetail" component={PlaceDetailScreen} />
    </Stack.Navigator>
  );
}

function TripsStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="TripsHome" component={TripsScreen} />
      <Stack.Screen name="TripDetail" component={TripDetailScreen} />
      {/* And here for the same reason: a saved trip lists places and each
          one opens. */}
      <Stack.Screen name="PlaceDetail" component={PlaceDetailScreen} />
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
      {/* Friends live under Profile: they are a fact about the account,
          not about any city, and the card that opens them sits here. */}
      <Stack.Screen name="Crew" component={CrewScreen} />
      <Stack.Screen name="Activity" component={ActivityScreen} />
      {/* Activity's applause rows open the list that earned the like,
          so the stack needs the detail — and the rule the Explore stack
          states follows it here: a screen registered in several stacks
          can only navigate to screens all of them have, so the detail
          brings its form and its place screen with it. */}
      <Stack.Screen name="CollectionDetail" component={CollectionDetailScreen} />
      <Stack.Screen name="CollectionForm" component={CollectionFormScreen} />
      <Stack.Screen name="PlaceDetail" component={PlaceDetailScreen} />
    </Stack.Navigator>
  );
}

function Tabs() {
  const { t } = useI18n();
  // Five names into five cells about 70pt wide, now that the island shows
  // them rather than only speaking them. Latin script fits: "Collections"
  // and "Bộ sưu tập" both set to roughly 55pt at 11. Japanese does not,
  // because a CJK glyph is close to a full em — コレクション and
  // プロフィール are six characters each, near enough 66pt, and would
  // have been the two captions that clipped.
  //
  // So those two shortened rather than the type shrinking, which would
  // have cost every language a point of legibility to rescue one. 保存 is
  // what a Japanese app calls what sits behind a bookmark and マイページ
  // is what it calls the account tab; neither is a translation of the
  // English so much as the word that was already there.
  const labels: Record<string, string> = {
    Ideas: t('Ideas', 'Ý tưởng', 'アイデア'),
    Explore: t('Explore', 'Khám phá', '探索'),
    Trips: t('Trips', 'Chuyến đi', '旅程'),
    Collections: t('Collections', 'Bộ sưu tập', '保存'),
    Profile: t('Profile', 'Cá nhân', 'マイページ'),
  };
  return (
    <Tab.Navigator
      initialRouteName="Explore"
      screenListeners={{ tabPress: () => fireHaptic('selection') }}
      // The bar itself is a component now — a floating island that ducks
      // while you scroll. `title` is the one string it needs: the caption
      // it draws and the name it reads to VoiceOver are the same word,
      // which is the point.
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        title: labels[route.name],
      })}
    >
      <Tab.Screen name="Ideas" component={IdeasStack} />
      <Tab.Screen name="Explore" component={ExploreStack} />
      <Tab.Screen name="Trips" component={TripsStack} />
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
                    {/* The duck state sits above the navigator: screens
                        report scrolls into it, the bar animates out of it. */}
                    <TabBarDuckProvider>
                      <Tabs />
                    </TabBarDuckProvider>
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
