// The last tab's first page: your own person page, or the guest's hub.
//
// ── why (owner, 19 Nov 2026) ──
//
// The tab opened Account — your face, four counts, settings — and your
// own person page was a second page "of you", reached only by pressing
// your face on a card. The owner chose the model of Instagram and
// Threads: the tab *is* your page, and Account is a page under it
// ("Account ›", beside the activity heading). The decisions, the rule
// for the tab's dot and the four steps are in docs/profile-home-plan.md.
//
// The route keeps its name, `ProfileHome`: `leaveAuth`, the badge
// banner and Delete account all land on it, and each lands on the right
// page without a change.
//
// ── waiting for the handle ──
//
// The page is found by handle, and your handle comes with your profile
// (`useProfile`), from the launch cache first and then the row. Until it
// is there, the spinner the page itself shows while it loads. A profile
// that never arrives — read before the sign-up trigger commits — is
// fetched again on the next session event (`lib/auth`); there is no
// second way to find the page without it.

import { ActivityIndicator } from 'react-native';
import { Screen } from '../components/ui';
import { useProfile, useSession } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { colors } from '../theme';
import { type Nav, type RootRoute } from '../nav';
import PersonScreen, { type Home } from './PersonScreen';
import { Requests } from './person/Requests';
import { Counts } from './profile/Counts';
import ProfileScreen from './ProfileScreen';

export default function MeScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'ProfileHome'> }) {
  const { t } = useI18n();
  const { ready, session } = useSession();
  const { profile } = useProfile();
  if (!ready || !session) return <ProfileScreen navigation={navigation} />;
  if (!profile.handle) {
    return (
      <Screen title={t('Profile', 'Trang cá nhân', 'プロフィール', '主页', '主頁')}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} testID="me-loading" />
      </Screen>
    );
  }
  const page = { key: route.key, name: 'Person', params: { handle: profile.handle } } as RootRoute<'Person'>;
  const home: Home = {
    toAccount: () => navigation.navigate('Account'),
    owner: (
      <>
        <Counts navigation={navigation} />
        <Requests me={session.user.id} onOpen={() => navigation.navigate('Crew')} />
      </>
    ),
  };
  return <PersonScreen navigation={navigation} route={page} home={home} />;
}
