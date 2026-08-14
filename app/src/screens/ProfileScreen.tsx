// Profile — two personas, per the reference screens.
//
// Guests get a hub: who-you-are hero with one big sign-in action, a
// preview of what an account unlocks, and a quiet exit to keep
// browsing. Signed-in users get their identity: avatar, name, bio, an
// About-me card and account actions. Champagne throughout — the
// reference's violet gradient is translated, not copied.

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AmbientWarmth, Card, fireHaptic, PressableScale, Screen, useTabBarClearance } from '../components/ui';
import { CitySwitcherModal } from '../components/CitySwitcher';
import { LanguageSwitcherModal } from '../components/LanguageSwitcher';
import { schemeLabel, ThemeSwitcherModal } from '../components/ThemeSwitcher';
import { PrimaryButton } from '../components/authUi';
import AvatarPicker from '../components/AvatarPicker';
import EngagementRing from '../components/EngagementRing';
import { levelFromSaves } from '../lib/level';
import { useAuth } from '../lib/auth';
import { membersOf } from '../lib/data';
import { useSave } from '../lib/save';
import { useCity } from '../lib/city';
import { Lang, useI18n } from '../lib/i18n';
import { useScheme } from '../lib/theme';
import { colors, font, radius, space, type } from '../theme';
import type { Nav } from '../nav';

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function memberSinceLabel(d: Date, lang: Lang): string {
  if (lang === 'vi') return `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
  if (lang === 'ja') return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  return `${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`;
}

function RoundIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={s.roundIcon}>
      <Ionicons name={name} size={20} color={colors.accent} />
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

/** Workspace settings, for guests and members alike: which city's
 *  catalog the app shows and which language it speaks. The header
 *  carries no switchers — this card is the one place to change both. */
function SettingsCard() {
  const { t, lang } = useI18n();
  const { city, mode } = useCity();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const { scheme } = useScheme();
  const langLabel = { en: 'English', vi: 'Tiếng Việt', ja: '日本語' }[lang];
  return (
    <>
      <Card style={s.featureCard}>
        <FeatureRow
          icon="location-outline"
          title={t('City', 'Thành phố', '都市')}
          sub={
            (city ? t(city.short_en, city.short_vi, city.short_ja) : '…')
            + (mode === 'auto' ? t(' · from your location', ' · theo vị trí của bạn', ' · 現在地から') : '')
          }
          onPress={() => setOpen(true)}
        />
        <FeatureRow
          icon="language-outline"
          title={t('Language', 'Ngôn ngữ', '言語')}
          sub={langLabel ?? 'English'}
          onPress={() => setLangOpen(true)}
        />
        <FeatureRow
          icon={scheme === 'light' ? 'sunny-outline' : 'moon-outline'}
          title={t('Appearance', 'Giao diện', '外観')}
          sub={schemeLabel(scheme, t)}
          onPress={() => setThemeOpen(true)}
          last
        />
      </Card>
      <CitySwitcherModal visible={open} onClose={() => setOpen(false)} />
      <LanguageSwitcherModal visible={langOpen} onClose={() => setLangOpen(false)} />
      <ThemeSwitcherModal visible={themeOpen} onClose={() => setThemeOpen(false)} />
    </>
  );
}

function ComingSoonPill() {
  const { t } = useI18n();
  return (
    <View style={s.soonPill}>
      <Text style={s.soonPillText}>{t('Coming soon', 'Sắp ra mắt', '近日公開')}</Text>
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
          'モノより思い出を集めよう。\n計画より冒険を分かち合おう。',
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
          <Ionicons name="person-outline" size={40} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={s.heroTitle}>{t("You're browsing as a guest", 'Bạn đang xem với tư cách khách', 'ゲストとして閲覧中です')}</Text>
          <Text style={s.heroBody}>
            {t(
              'Sign in to save places, build collections and plan trips with your crew.',
              'Đăng nhập để lưu địa điểm, tạo bộ sưu tập và lên kế hoạch cùng hội của bạn.',
              'サインインして、お気に入りの場所を保存し、コレクションを作り、仲間と旅を計画しましょう。',
            )}
          </Text>
        </View>
      </View>
      <PrimaryButton label={t('Sign in / Sign up', 'Đăng nhập / Đăng ký', 'サインイン / 登録')} onPress={goSignIn} />
      <Pressable
        style={s.guestLink}
        onPress={() => { fireHaptic('selection'); navigation.getParent()?.navigate('Explore'); }}
      >
        <Text style={s.guestLinkText}>{t('Explore as guest', 'Khám phá với tư cách khách', 'ゲストのまま探索')}</Text>
        <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
      </Pressable>

      <Card style={s.featureCard}>
        <FeatureRow
          icon="bookmark-outline"
          title={t('Saved places', 'Địa điểm đã lưu', '保存した場所')}
          sub={t('Sign in to save your favorite places.', 'Đăng nhập để lưu địa điểm yêu thích.', 'サインインしてお気に入りを保存。')}
          onPress={goSignIn}
        />
        <FeatureRow
          icon="folder-open-outline"
          title={t('Collections', 'Bộ sưu tập', 'コレクション')}
          sub={t('Create and organize your collections.', 'Tạo và sắp xếp bộ sưu tập của riêng bạn.', '自分のコレクションを作成・整理。')}
          onPress={goSignIn}
        />
        <FeatureRow
          icon="calendar-outline"
          title={t('Trips', 'Chuyến đi', '旅程')}
          sub={t('Plan trips and invite your friends.', 'Lên kế hoạch và mời bạn bè cùng đi.', '旅を計画して友達を招待。')}
          onPress={goSignIn}
          last
        />
      </Card>

      <SettingsCard />

      <Card style={s.friendsCard}>
        <RoundIcon name="people-outline" />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.featureTitle}>{t('Connect with friends', 'Kết nối bạn bè', '友達とつながる')}</Text>
          <Text style={s.featureSub}>
            {t('Find friends and plan unforgettable adventures together.', 'Tìm bạn bè và cùng nhau lên những chuyến đi đáng nhớ.', '友達を見つけて、忘れられない冒険を一緒に。')}
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
  // Distinct places, not rows: a place saved into two of your lists is
  // one place you have found, and counting it twice would turn the ring
  // into a measure of tidying rather than of exploring.
  //
  // The empty catalog is not an oversight. Your own collections arrive
  // carrying their members, so `membersOf` returns them without
  // consulting anything — passing the real catalog would mean this
  // screen waiting on a fetch it otherwise has no use for.
  const { mine } = useSave();
  const saved = useMemo(() => {
    const seen = new Set<string>();
    for (const c of mine.data) for (const p of membersOf(c, [])) seen.add(p.slug);
    return seen.size;
  }, [mine.data]);
  const { level, progress } = levelFromSaves(saved);

  return (
    <>
      <View style={s.heroRow}>
        {/* No camera badge here: the level badge takes that corner, and
            Edit profile shows the same picker with its badge intact. */}
        <EngagementRing size={88} level={level} progress={progress}>
          <AvatarPicker showCamera={false} />
        </EngagementRing>
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
            <Text style={s.editBtnText}>{t('Edit profile', 'Sửa hồ sơ', 'プロフィール編集')}</Text>
          </PressableScale>
        </View>
      </View>

      <Text style={s.section}>{t('About me', 'Về tôi', '自己紹介')}</Text>
      <Card style={s.featureCard}>
        <AboutRow
          icon="mail-outline"
          label={t('Email', 'Email', 'メール')}
          value={email ?? ''}
        />
        {profile.location ? (
          <AboutRow icon="location-outline" label={t('From', 'Đến từ', '出身地')} value={profile.location} />
        ) : null}
        {memberSince ? (
          <AboutRow
            icon="calendar-outline"
            label={t('Member since', 'Thành viên từ', '登録日')}
            value={memberSinceLabel(memberSince, lang)}
          />
        ) : null}
        <AboutRow
          icon="heart-outline"
          label={t('Interests', 'Sở thích', '興味')}
          value={profile.interests || t('Add your interests in Edit profile.', 'Thêm sở thích trong phần Sửa hồ sơ.', '「プロフィール編集」で興味を追加。')}
          last
        />
      </Card>

      <SettingsCard />

      <Text style={s.section}>{t('Friends', 'Bạn bè', '友達')}</Text>
      <Card style={s.friendsCard}>
        <RoundIcon name="people-outline" />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.featureTitle}>{t('Connect with friends', 'Kết nối bạn bè', '友達とつながる')}</Text>
          <Text style={s.featureSub}>
            {t('Find and connect with friends to plan trips together.', 'Tìm và kết nối bạn bè để cùng lên kế hoạch.', '友達を見つけて一緒に旅を計画。')}
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
          : <Text style={s.signOutText}>{t('Sign out', 'Đăng xuất', 'サインアウト')}</Text>}
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
    <Screen title={t('Profile', 'Cá nhân', 'プロフィール')}>
      <View style={{ flex: 1 }}>
        <AmbientWarmth />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: tabClearance, gap: space.cardGap }}
          showsVerticalScrollIndicator={false}
        >
          {!ready
            ? <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
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
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
  featureTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  featureSub: { color: colors.textTertiary, fontSize: 13.5, fontWeight: font.regular, lineHeight: 19 },

  friendsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: space.cardPadding,
  },
  soonPill: {
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.accentLine,
    backgroundColor: colors.accentSoft, paddingHorizontal: 10, paddingVertical: 4,
  },
  soonPillText: { color: colors.accent, fontSize: 11.5, fontWeight: font.semibold },

  section: { color: colors.text, ...type.section, marginTop: 10 },

  accountName: { color: colors.text, fontSize: 23, fontWeight: font.bold, letterSpacing: 0.2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { color: colors.textSecondary, fontSize: 14, fontWeight: font.regular },
  // The card surface, not the glass tint: on paper the tint is a grey
  // smudge on a warm page, where the About-me card sitting inches below
  // it is white. Matching that card makes the button read as part of the
  // same set of objects rather than a hole in the background.
  editBtn: {
    alignSelf: 'flex-start', marginTop: 4,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderGlassSoft,
    backgroundColor: colors.surfaceCard, paddingHorizontal: 16, paddingVertical: 8,
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
