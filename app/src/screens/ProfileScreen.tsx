// Account — two personas, per the reference screens.
//
// Guests get a hub: who-you-are hero with one big sign-in action, a
// preview of what an account unlocks, and a quiet exit to keep
// browsing. Signed-in users get their identity: avatar, name, bio, an
// About-me card and account actions. Champagne throughout — the
// reference's violet gradient is translated, not copied.
//
// ── where it stands (owner, 19 Nov 2026) ──
//
// This was the last tab's first page. It is the `Account` page now,
// pushed over your own person page, which the tab opens instead
// (`MeScreen`, docs/profile-home-plan.md). The guest's hub is still the
// tab's first page — a guest has no page of their own — and is drawn
// here, by `MeScreen`, as it always was.

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { AmbientWarmth, Screen, useTabBarClearance } from '../components/ui';
import { useScrollToTop } from '@react-navigation/native';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { useSession } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useScheme } from '../lib/theme';
import { colors, space } from '../theme';
import { type Nav } from '../nav';
import { GuestHub } from './profile/GuestHub';
import { AccountProfile } from './profile/AccountProfile';
import { ProfileReturn } from './profile/ProfileReturn';

export default function ProfileScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { ready, session } = useSession();
  const tabClearance = useTabBarClearance();
  const duckScroll = useDuckOnScroll();
  // Its tab, pressed again here, scrolls back to the top — the last step
  // of the walk back that ExploreScreen's `tabPress` note describes.
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  useScrollToTop(scrollRef);
  // Where the restart left the reader, taken once on this screen's first
  // render of the run (see `claimResume`): the sheet reopens from its first
  // frame, and the page goes back to where it was.
  const { claimResume } = useScheme();
  const [back] = useState(claimResume);
  const landing = useRef(back?.y ?? 0);
  const y = useRef(0);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    y.current = e.nativeEvent.contentOffset.y;
    duckScroll?.(e);
  }, [duckScroll]);
  // Back to where the page was, once the content is tall enough to hold
  // it: a scroll asked of a page still drawing clamps to what is there,
  // and the content below the fold arrives over a few frames.
  const land = (height: number) => {
    if (landing.current > 0 && height > landing.current) {
      scrollRef.current?.scrollTo({ y: landing.current, animated: false });
      landing.current = 0;
    }
  };
  // The sheet to reopen, which the card below spends on its first read —
  // see `SettingsCard`. State rather than a ref so the spending is a
  // render the card's next incarnation sees, not a mutation of a value
  // handed out through context.
  const [sheet, setSheet] = useState<'theme' | null>(back?.sheet ?? null);
  const spendSheet = useCallback(() => setSheet(null), []);
  // Down by `dy` from where the page is, for a card that needs something
  // of its own kept in view (the guide switch, under its invitation).
  const scrollBy = useCallback((dy: number) => scrollRef.current?.scrollTo({ y: y.current + dy, animated: true }), []);
  // Pushed: the account's page over your own (19 Nov 2026,
  // docs/profile-home-plan.md). Not pushed: the guest's, which is still
  // the tab's first page. Read once — a page does not move in its stack.
  const [pushed] = useState(() => navigation.canGoBack());
  const stack = useMemo(() => (pushed ? ['ProfileHome', 'Account'] : undefined), [pushed]);
  const returning = useMemo(() => ({ sheet, spendSheet, y, scrollBy, stack }), [sheet, spendSheet, scrollBy, stack]);
  // Signed out from here — the last rows of this page — there is no
  // account for it to be the page of: back to the tab's first page, which
  // is the guest's now.
  useEffect(() => {
    if (pushed && ready && !session) navigation.popToTop();
  }, [pushed, ready, session, navigation]);

  return (
    <Screen
      title={t('Account', 'Tài khoản', 'アカウント', '账号', '帳號')}
      onBack={pushed ? () => navigation.goBack() : undefined}
      compactTitle={pushed}
      backBare
      backTestID="account-back"
    >
      <View style={{ flex: 1 }}>
        <AmbientWarmth />
        <ScrollView
          ref={scrollRef}
          testID="profile-scroll"
          contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: tabClearance, gap: space.cardGap }}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          onContentSizeChange={(_, height) => land(height)}
          scrollEventThrottle={16}
        >
          <ProfileReturn.Provider value={returning}>
            {!ready
              ? <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
              : session
                ? <AccountProfile navigation={navigation} />
                : <GuestHub navigation={navigation} />}
          </ProfileReturn.Provider>
        </ScrollView>
      </View>
    </Screen>
  );
}
