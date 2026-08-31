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
import { Lora_500Medium_Italic } from '@expo-google-fonts/lora';
import { AuthProvider } from './src/lib/auth';
import { CityProvider } from './src/lib/city';
import { I18nProvider, useI18n } from './src/lib/i18n';
import { ThemeProvider, useScheme } from './src/lib/theme';
import { holdingFirstFrame } from './src/lib/boot';
import { startupTrace } from './src/lib/trace';
import { CatalogProvider } from './src/lib/catalog';
import { CrewProvider } from './src/lib/crew';
import { InvitationsProvider } from './src/lib/invitations';
import { MyTripsProvider } from './src/lib/mytrips';
import { SaveProvider } from './src/lib/save';
import { colors } from './src/theme';
import { fireHaptic } from './src/components/ui';
import FloatingTabBar from './src/components/FloatingTabBar';
import WelcomeSheet from './src/components/WelcomeSheet';
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
import TripInvitationScreen from './src/screens/TripInvitationScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import DeleteAccountScreen from './src/screens/DeleteAccountScreen';
import CrewScreen from './src/screens/CrewScreen';
import ActivityScreen from './src/screens/ActivityScreen';

// The trace's own zero is when `lib/trace` evaluates, early in the bundle;
// this line runs once the whole import graph above has been evaluated, so
// the gap between the two is roughly what requiring the app costs.
startupTrace.mark('bundle:evaluated');

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
      <Stack.Screen name="TripInvitation" component={TripInvitationScreen} />
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
      {/* The last row on the profile, and its own screen — see the note
          at the top of it for why it is not the two alerts it replaced. */}
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
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
  // Display type and the quote face — see theme.ts. Until the faces are
  // ready the app holds on its own ground colour rather than rendering
  // titles in the system font and swapping them a frame later, which
  // reads as a glitch.
  // The same hold covers the stored scheme: a dark-mode reader seeing a
  // white flash on every launch would be a worse bug than having no setting.
  //
  // `fontError` is read, not discarded. It was discarded, and a font that
  // failed to load therefore left the hold in place forever — a white screen
  // on launch with nothing said about it. `holdingFirstFrame` is where that
  // decision lives now, and where a test can reach it.
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold,
    Lora_500Medium_Italic,
  });
  // Trace marks in a render body, deliberately: `mark` logs once per name
  // and ignores repeats, so a re-render costs an array scan and nothing
  // else. An effect would mark a frame later than the truth.
  if (ready) startupTrace.mark('theme:ready');
  if (fontsLoaded || fontError) startupTrace.mark('fonts:settled');
  if (holdingFirstFrame({ fontsLoaded, fontsFailed: !!fontError, themeReady: ready })) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }
  startupTrace.mark('first-frame:released');

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
                  {/* The crew above the navigators too, for the same
                      reason as the catalog: the tab-bar badge, Profile,
                      Activity and the Crew screen all read one copy
                      instead of fetching four. */}
                  <CrewProvider>
                    {/* And the invitations, for the third time the same
                        argument applies: the tab bar counts what is
                        waiting, the Trips screen splits the list by it,
                        and a trip's own screen draws its crew from it.
                        Inside the crew, because every invitation names a
                        friend and takes its face from that copy. */}
                    <InvitationsProvider>
                    {/* And the trips, the fourth time: the Trips tab, a
                        trip's own screen, the answer screen and Activity
                        all read the one list — and a delete on any of
                        them lands in the copy the others draw. */}
                    <MyTripsProvider>
                    <SaveProvider>
                      {/* The duck state sits above the navigator: screens
                          report scrolls into it, the bar animates out of it. */}
                      <TabBarDuckProvider>
                        <Tabs />
                      </TabBarDuckProvider>
                    </SaveProvider>
                    </MyTripsProvider>
                    </InvitationsProvider>
                  </CrewProvider>
                </CatalogProvider>
              </NavigationContainer>
              {/* The one-time welcome, belonging to no screen — the same
                  argument the save sheets make. It is a plain overlay
                  rather than a Modal (see the note in the file), so it
                  sits *after* the navigators: paint order is what puts it
                  on top. Timing needs nothing either: this whole tree
                  exists only once `holdingFirstFrame` has let go, so the
                  sheet cannot arrive over the blank ground frame. */}
              <WelcomeSheet />
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
