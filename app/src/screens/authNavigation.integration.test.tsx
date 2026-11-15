// @vitest-environment jsdom
import React from 'react';
import {
  BaseNavigationContainer, createNavigatorFactory, StackRouter, TabRouter,
  useNavigationBuilder, useRoute,
} from '@react-navigation/core';
import { afterEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import { focusedTab, dropResume } from '../lib/resume';
import { goTo, navRef } from '../nav';
import { SaveProvider, useSaveActions, useSaveSheets } from '../lib/save';
import SignInScreen from './SignInScreen';

// Use the real container ref and routers in this file only. Native transitions
// and the network are outside this test; the sign-in form and leaveAuth are not.
vi.mock('@react-navigation/native', async () => import('@react-navigation/core'));
const TestSession = React.createContext({
  signedIn: false,
  setSignedIn: (_value: boolean): void => { throw new Error('TestSession provider missing'); },
});
vi.mock('../lib/auth', () => ({
  useSession: () => ({ session: React.useContext(TestSession).signedIn ? { user: { id: 'reader' } } : null }),
  useAuthActions: () => {
    const { setSignedIn } = React.useContext(TestSession);
    return { signIn: async () => { setSignedIn(true); } };
  },
}));
vi.mock('../lib/i18n', () => ({ useI18n: () => ({ t: (en: string) => en, lang: 'en' }) }));

vi.mock('../lib/data', () => ({
  useMyCollections: () => ({ data: [], loaded: true }),
  useMyPreferences: () => ({ loaded: false }),
}));
vi.mock('../lib/city', () => ({ useCurrentCity: () => ({ city: null }) }));

type Children = { children: React.ReactNode };
function StackView({ children }: Children) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(StackRouter, { children });
  return <NavigationContent>{descriptors[state.routes[state.index].key].render()}</NavigationContent>;
}
function TabsView({ children }: Children) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(TabRouter, { children });
  // Tabs retain their nested stacks when blurred, as they do in the app.
  return <NavigationContent>{state.routes.map((route, index) => (
    <section key={route.key} hidden={index !== state.index}>{descriptors[route.key].render()}</section>
  ))}</NavigationContent>;
}
const Stack = createNavigatorFactory(StackView)();
const Tabs = createNavigatorFactory(TabsView)();
const Home = () => <h1>{useRoute().name}</h1>;
function Explore() {
  return <Stack.Navigator><Stack.Screen name="ExploreHome" component={Home} /></Stack.Navigator>;
}
function Profile() {
  return <Stack.Navigator>
    <Stack.Screen name="ProfileHome" component={Home} />
    <Stack.Screen name="SignIn" component={SignInScreen} />
  </Stack.Navigator>;
}
// Small screen fixtures expose the guest action and its result; the provider
// owns capturing the return tab, redirecting to auth, and closing the prompt.
function CollectionDetail() {
  const { key, params } = useRoute<{ key: string; name: 'CollectionDetail'; params: { slug: string } }>();
  const { askToSignIn } = useSaveActions();
  const [copies, setCopies] = React.useState(0);
  const [openedOn, setOpenedOn] = React.useState<string>();
  const openCopy = () => {
    setOpenedOn(navRef.getCurrentRoute()?.key);
    setCopies(count => count + 1);
  };
  return <>
    <h1>{params.slug}</h1>
    <button onClick={() => askToSignIn('copy', openCopy)}>Copy collection</button>
    <output>Copy prompts opened: {copies}{openedOn && openedOn !== key ? ' on wrong route' : ''}</output>
  </>;
}
function Collections() {
  return <Stack.Navigator>
    <Stack.Screen name="CollectionsHome" component={Home} />
    <Stack.Screen name="CollectionDetail" component={CollectionDetail} />
  </Stack.Navigator>;
}
function AuthPrompt() {
  const { authSheet, signIn } = useSaveSheets();
  return authSheet ? <button onClick={signIn}>Continue to sign in</button> : null;
}
function Harness() {
  const [signedIn, setSignedIn] = React.useState(false);
  return (
    <TestSession.Provider value={{ signedIn, setSignedIn }}>
      <SaveProvider>
        <BaseNavigationContainer ref={navRef}>
          <Tabs.Navigator>
            <Tabs.Screen name="Explore" component={Explore} />
            <Tabs.Screen name="Collections" component={Collections} />
            <Tabs.Screen name="Profile" component={Profile} />
          </Tabs.Navigator>
        </BaseNavigationContainer>
        <AuthPrompt />
      </SaveProvider>
      {signedIn && <button onClick={() => setSignedIn(false)}>Sign out</button>}
    </TestSession.Provider>
  );
}
function openOrdinarySignIn() {
  act(() => goTo('Profile', { screen: 'SignIn', initial: false }));
}
async function submitSignIn() {
  fireEvent.change(await screen.findByPlaceholderText('Enter your email'), { target: { value: 'reader@example.com' } });
  fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'password' } });
  expect(focusedTab(navRef.getRootState())).toBe('Profile');
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

afterEach(dropResume);

it('ordinary sign-in from Profile selects Explore and shows ExploreHome', async () => {
  render(<Harness />);
  openOrdinarySignIn();
  await submitSignIn();
  await screen.findByRole('heading', { name: 'ExploreHome' });
  expect(focusedTab(navRef.getRootState())).toBe('Explore');
});

it('returns to the original collection and opens its copy prompt exactly once', async () => {
  render(<Harness />);
  act(() => goTo('Collections', { screen: 'CollectionDetail', params: { slug: 'coffee-42' }, initial: false }));
  fireEvent.click(await screen.findByRole('button', { name: 'Copy collection' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue to sign in' }));
  await submitSignIn();

  await screen.findByRole('heading', { name: 'coffee-42' });
  expect(focusedTab(navRef.getRootState())).toBe('Collections');
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Copy prompts opened: 1'));

  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  openOrdinarySignIn();
  await submitSignIn();
  await screen.findByRole('heading', { name: 'ExploreHome' });
  act(() => goTo('Collections', {}));
  await screen.findByRole('heading', { name: 'coffee-42' });
  expect(screen.getByRole('status').textContent).toBe('Copy prompts opened: 1');
});
