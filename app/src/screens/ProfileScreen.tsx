// Profile — two personas, per the reference screens.
//
// Guests get a hub: who-you-are hero with one big sign-in action, a
// preview of what an account unlocks, and a quiet exit to keep
// browsing. Signed-in users get their identity: avatar, name, bio, an
// About-me card and account actions. Champagne throughout — the
// reference's violet gradient is translated, not copied.

import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AmbientWarmth, Card, fireHaptic, PressableScale, Screen, useTabBarClearance } from '../components/ui';
import { CitySwitcherModal } from '../components/CitySwitcher';
import { PrimaryButton } from '../components/authUi';
import { useAuth } from '../lib/auth';
import { useCity } from '../lib/city';
import { Lang, useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';
import type { Nav } from '../nav';

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function memberSinceLabel(d: Date, lang: Lang): string {
  return lang === 'vi' ? `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}` : `${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`;
}

function RoundIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={s.roundIcon}>
      <Ionicons name={name} size={20} color={colors.champagne} />
    </View>
  );
}

function FeatureRow({ icon, title, sub, onPress, last }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <PressableScale scaleTo={0.98} style={[s.featureRow, !last && s.featureRowDivider]} onPress={onPress}>
      <RoundIcon name={icon} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.featureTitle}>{title}</Text>
        <Text style={s.featureSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
    </PressableScale>
  );
}

/** Which city's catalog the app shows — available to guests and members. */
function CityCard() {
  const { t } = useI18n();
  const { city, mode } = useCity();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card style={s.featureCard}>
        <FeatureRow
          icon="location-outline"
          title={t('City', 'Thành phố')}
          sub={
            (city ? t(city.name_en, city.name_vi) : '…')
            + (mode === 'auto' ? t(' · from your location', ' · theo vị trí của bạn') : '')
          }
          onPress={() => setOpen(true)}
          last
        />
      </Card>
      <CitySwitcherModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ComingSoonPill() {
  const { t } = useI18n();
  return (
    <View style={s.soonPill}>
      <Text style={s.soonPillText}>{t('Coming soon', 'Sắp ra mắt')}</Text>
    </View>
  );
}

function Tagline() {
  const { t } = useI18n();
  return (
    <View style={s.tagline}>
      <Text style={{ fontSize: 18 }}>✨</Text>
      <Text style={s.taglineText}>
        {t(
          'Collect moments, not things.\nShare adventures, not plans.',
          'Góp nhặt khoảnh khắc, không phải đồ vật.\nChia sẻ hành trình, không chỉ kế hoạch.',
        )}
      </Text>
    </View>
  );
}

function GuestHub({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const goSignIn = () => navigation.navigate('SignIn');
  return (
    <>
      <View style={s.heroRow}>
        <View style={s.avatarBig}>
          <Ionicons name="person-outline" size={40} color={colors.champagne} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={s.heroTitle}>{t("You're browsing as a guest", 'Bạn đang xem với tư cách khách')}</Text>
          <Text style={s.heroBody}>
            {t(
              'Sign in to save places, build collections and plan trips with your crew.',
              'Đăng nhập để lưu địa điểm, tạo bộ sưu tập và lên kế hoạch cùng hội của bạn.',
            )}
          </Text>
        </View>
      </View>
      <PrimaryButton label={t('Sign in / Sign up', 'Đăng nhập / Đăng ký')} onPress={goSignIn} />
      <Pressable
        style={s.guestLink}
        onPress={() => { fireHaptic('selection'); navigation.getParent()?.navigate('Explore'); }}
      >
        <Text style={s.guestLinkText}>{t('Explore as guest', 'Khám phá với tư cách khách')}</Text>
        <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
      </Pressable>

      <Card style={s.featureCard}>
        <FeatureRow
          icon="bookmark-outline"
          title={t('Saved places', 'Địa điểm đã lưu')}
          sub={t('Sign in to save your favorite places.', 'Đăng nhập để lưu địa điểm yêu thích.')}
          onPress={goSignIn}
        />
        <FeatureRow
          icon="folder-open-outline"
          title={t('Collections', 'Bộ sưu tập')}
          sub={t('Create and organize your collections.', 'Tạo và sắp xếp bộ sưu tập của riêng bạn.')}
          onPress={goSignIn}
        />
        <FeatureRow
          icon="calendar-outline"
          title={t('Trips', 'Chuyến đi')}
          sub={t('Plan trips and invite your friends.', 'Lên kế hoạch và mời bạn bè cùng đi.')}
          onPress={goSignIn}
          last
        />
      </Card>

      <CityCard />

      <Card style={s.friendsCard}>
        <RoundIcon name="people-outline" />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.featureTitle}>{t('Connect with friends', 'Kết nối bạn bè')}</Text>
          <Text style={s.featureSub}>
            {t('Find friends and plan unforgettable adventures together.', 'Tìm bạn bè và cùng nhau lên những chuyến đi đáng nhớ.')}
          </Text>
        </View>
        <ComingSoonPill />
      </Card>

      <Tagline />
    </>
  );
}

function AboutRow({ icon, label, value, last }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[s.featureRow, !last && s.featureRowDivider]}>
      <RoundIcon name={icon} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.aboutLabel}>{label}</Text>
        <Text style={s.aboutValue}>{value}</Text>
      </View>
    </View>
  );
}

function AccountProfile({ navigation }: { navigation: Nav }) {
  const { t, lang } = useI18n();
  const { email, profile, memberSince, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const name = profile.full_name || (email ?? '').split('@')[0];
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <>
      <View style={s.heroRow}>
        <View style={s.avatarBig}>
          <Text style={s.avatarInitial}>{initial}</Text>
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={s.accountName} numberOfLines={1}>{name}</Text>
          {profile.location ? (
            <View style={s.locationRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={s.locationText}>{profile.location}</Text>
            </View>
          ) : null}
          {profile.bio ? <Text style={s.heroBody} numberOfLines={2}>{profile.bio}</Text> : null}
          <PressableScale scaleTo={0.94} style={s.editBtn} onPress={() => navigation.navigate('EditProfile')}>
            <Text style={s.editBtnText}>{t('Edit profile', 'Sửa hồ sơ')}</Text>
          </PressableScale>
        </View>
      </View>

      <Text style={s.section}>{t('About me', 'Về tôi')}</Text>
      <Card style={s.featureCard}>
        <AboutRow
          icon="mail-outline"
          label={t('Email', 'Email')}
          value={email ?? ''}
        />
        {profile.location ? (
          <AboutRow icon="location-outline" label={t('From', 'Đến từ')} value={profile.location} />
        ) : null}
        {memberSince ? (
          <AboutRow
            icon="calendar-outline"
            label={t('Member since', 'Thành viên từ')}
            value={memberSinceLabel(memberSince, lang)}
          />
        ) : null}
        <AboutRow
          icon="heart-outline"
          label={t('Interests', 'Sở thích')}
          value={profile.interests || t('Add your interests in Edit profile.', 'Thêm sở thích trong phần Sửa hồ sơ.')}
          last
        />
      </Card>

      <CityCard />

      <Text style={s.section}>{t('Friends', 'Bạn bè')}</Text>
      <Card style={s.friendsCard}>
        <RoundIcon name="people-outline" />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.featureTitle}>{t('Connect with friends', 'Kết nối bạn bè')}</Text>
          <Text style={s.featureSub}>
            {t('Find and connect with friends to plan trips together.', 'Tìm và kết nối bạn bè để cùng lên kế hoạch.')}
          </Text>
        </View>
        <ComingSoonPill />
      </Card>

      <PressableScale
        style={s.signOutBtn}
        onPress={async () => {
          setBusy(true);
          try { await signOut(); } finally { setBusy(false); }
        }}
      >
        {busy
          ? <ActivityIndicator color={colors.textSecondary} />
          : <Text style={s.signOutText}>{t('Sign out', 'Đăng xuất')}</Text>}
      </PressableScale>

      <Tagline />
    </>
  );
}

export default function ProfileScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { ready, session } = useAuth();
  const tabClearance = useTabBarClearance();

  return (
    <Screen title={t('Profile', 'Cá nhân')}>
      <View style={{ flex: 1 }}>
        <AmbientWarmth />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: tabClearance, gap: space.cardGap }}
          showsVerticalScrollIndicator={false}
        >
          {!ready
            ? <ActivityIndicator color={colors.champagne} style={{ marginTop: 48 }} />
            : session
              ? <AccountProfile navigation={navigation} />
              : <GuestHub navigation={navigation} />}
        </ScrollView>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 4 },
  avatarBig: {
    width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass, borderWidth: 1.5, borderColor: colors.borderGlass,
  },
  avatarInitial: { color: colors.champagne, fontSize: 34, fontWeight: font.semibold },
  heroTitle: { color: colors.text, fontSize: 19, fontWeight: font.bold, letterSpacing: 0.1 },
  heroBody: { color: colors.textSecondary, ...type.meta, lineHeight: 21 },

  guestLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 3, paddingVertical: 4,
  },
  guestLinkText: { color: colors.textSecondary, fontSize: 15, fontWeight: font.medium },

  featureCard: { paddingHorizontal: space.cardPadding },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  featureRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderGlassSoft },
  roundIcon: {
    width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(232,212,155,0.10)', borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
  featureTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  featureSub: { color: colors.textTertiary, fontSize: 13.5, fontWeight: font.regular, lineHeight: 19 },

  friendsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: space.cardPadding,
  },
  soonPill: {
    borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(232,212,155,0.26)',
    backgroundColor: 'rgba(232,212,155,0.08)', paddingHorizontal: 10, paddingVertical: 4,
  },
  soonPillText: { color: colors.champagne, fontSize: 11.5, fontWeight: font.semibold },

  section: { color: colors.text, ...type.section, marginTop: 10 },

  accountName: { color: colors.text, fontSize: 23, fontWeight: font.bold, letterSpacing: 0.2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { color: colors.textSecondary, fontSize: 14, fontWeight: font.regular },
  editBtn: {
    alignSelf: 'flex-start', marginTop: 4,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderGlassSoft,
    backgroundColor: colors.surfaceGlass, paddingHorizontal: 16, paddingVertical: 8,
  },
  editBtnText: { color: colors.text, fontSize: 14, fontWeight: font.semibold },

  aboutLabel: { color: colors.textTertiary, fontSize: 12.5, fontWeight: font.medium },
  aboutValue: { color: colors.text, fontSize: 15.5, fontWeight: font.regular, lineHeight: 21 },

  signOutBtn: {
    borderRadius: radius.input, paddingVertical: 13, alignItems: 'center', marginTop: 6,
    borderWidth: 1, borderColor: colors.borderGlassSoft, backgroundColor: colors.surfaceGlass,
  },
  signOutText: { color: colors.textSecondary, fontSize: 15, fontWeight: font.medium },

  tagline: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  taglineText: { color: colors.textTertiary, ...type.meta, textAlign: 'center', lineHeight: 22 },
});
