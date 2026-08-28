// Profile — two personas, per the reference screens.
//
// Guests get a hub: who-you-are hero with one big sign-in action, a
// preview of what an account unlocks, and a quiet exit to keep
// browsing. Signed-in users get their identity: avatar, name, bio, an
// About-me card and account actions. Champagne throughout — the
// reference's violet gradient is translated, not copied.

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AmbientWarmth, Card, fireHaptic, PressableScale, Screen, useTabBarClearance } from '../components/ui';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { CitySwitcherModal } from '../components/CitySwitcher';
import { LanguageSwitcherModal } from '../components/LanguageSwitcher';
import { schemeLabel, ThemeSwitcherModal } from '../components/ThemeSwitcher';
import { PrimaryButton } from '../components/authUi';
import AvatarPicker from '../components/AvatarPicker';
import EngagementRing from '../components/EngagementRing';
import { levelFromSaves } from '../lib/level';
import { useAuth } from '../lib/auth';
import { membersOf } from '../lib/data';
import { useCrew } from '../lib/crew';
import { splitFriendships } from '../lib/friends';
import { useSave } from '../lib/save';
import { useCity } from '../lib/city';
import { Lang, useI18n } from '../lib/i18n';
import { useScheme } from '../lib/theme';
import { colors, font, quoteFace, radius, space, type } from '../theme';
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

/**
 * A setting and what it is currently set to.
 *
 * Not `FeatureRow`, though it was for a while and the difference is
 * what the second line holds. Under a feature it is a sentence —
 * "Sign in to save your favorite places" — and a sentence needs a
 * heading above it, which is why that row's title is the loud half.
 * Under a setting it is a *value*, and a value does not want a heading,
 * it wants to sit next to the thing it is the value of.
 *
 * So it moves to the right, by the chevron, the way every settings row
 * on the platform puts it — and the label drops to regular weight,
 * because nothing on iOS's own Settings screen is semibold either. What
 * made the label shout was never a decision about settings; it was
 * inherited from a card built to sell features to a signed-out visitor.
 *
 * The point of the move is not only the weight. Stacked under About me,
 * two cards of round-icon-plus-two-lines were reading as one kind of
 * thing with its typography flipped at random: quiet label over loud
 * value in the first, loud label over quiet value in the second. Putting
 * the value on the right makes them plainly two different rows, and the
 * question of which hierarchy is "right" stops being asked.
 */
function SettingRow({ icon, label, value, onPress, last }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <PressableScale scaleTo={0.98} style={[s.featureRow, !last && s.featureRowDivider]} onPress={onPress}>
      <RoundIcon name={icon} />
      <Text style={s.settingLabel} numberOfLines={1}>{label}</Text>
      {/* The value takes what is left and truncates rather than wrapping:
          "Hà Nội · theo vị trí của bạn" is long, and a settings row that
          grows a second line for one city and not another makes the card
          look uneven for a reason nobody can see. */}
      <Text style={s.settingValue} numberOfLines={1}>{value}</Text>
      <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
    </PressableScale>
  );
}

/** Workspace settings, for guests and members alike: which city's
 *  catalog the app shows, which language it speaks, how it looks. The
 *  header carries no switchers — this card is the one place to change
 *  any of them. Its heading is written at each call site, beside the
 *  card, the way About me and Friends are. */
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
        <SettingRow
          icon="location-outline"
          // "City" alone read as a fact about the reader, sitting one card
          // below "Hometown", which is one. This is the catalog the app is
          // showing — it changes when you travel, and the label now says so.
          label={t('Current city', 'Thành phố hiện tại', '現在の都市')}
          value={
            (city ? t(city.short_en, city.short_vi, city.short_ja) : '…')
            + (mode === 'auto' ? t(' · from your location', ' · theo vị trí của bạn', ' · 現在地から') : '')
          }
          onPress={() => setOpen(true)}
        />
        <SettingRow
          icon="language-outline"
          label={t('Language', 'Ngôn ngữ', '言語')}
          value={langLabel ?? 'English'}
          onPress={() => setLangOpen(true)}
        />
        <SettingRow
          icon={scheme === 'light' ? 'sunny-outline' : 'moon-outline'}
          label={t('Appearance', 'Giao diện', '外観')}
          value={schemeLabel(scheme, t)}
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

function Tagline() {
  const { t } = useI18n();
  return (
    <View style={s.tagline}>
      <Text style={{ fontSize: 18 }}>✨</Text>
      <Text style={s.taglineText}>
        {t(
          '“We do not remember days,\nwe remember moments.”',
          '“Ta không nhớ những ngày,\nta nhớ những khoảnh khắc.”',
          '「私たちが覚えているのは日々ではなく、\n瞬間なのだ。」',
        )}
      </Text>
      {/* A borrowed sentence wears its author's name — and a name is
          quoted, not translated, so it sits outside t(). */}
      <Text style={s.taglineBy}>— Cesare Pavese</Text>
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
          {/* A promise, not a status. "You're browsing as a guest" was a
              true sentence about what the reader lacks; the apps that do
              this well lead with what signing in opens. And the body
              stops listing features — the three rows below are the list,
              so the one thing said here is the one thing they don't say:
              what you keep is kept under your name. */}
          <Text style={s.heroTitle}>{t('Your next trip starts here', 'Chuyến đi tiếp theo bắt đầu từ đây', '次の旅は、ここから')}</Text>
          <Text style={s.heroBody}>
            {t(
              'Sign in to keep the places you love and the crew you go with — ready whenever you come back.',
              'Đăng nhập để giữ những nơi bạn thích và hội cùng đi — luôn sẵn khi bạn quay lại.',
              'サインインすれば、お気に入りの場所も一緒に行く仲間も、戻ってきたときそのままに。',
            )}
          </Text>
        </View>
      </View>
      <PrimaryButton label={t('Sign in / Sign up', 'Đăng nhập / Đăng ký', 'サインイン / 登録')} onPress={goSignIn} />
      <Pressable
        style={s.guestLink}
        onPress={() => { fireHaptic('selection'); navigation.getParent()?.navigate('Explore'); }}
      >
        {/* Shorter, and the word "guest" appears nowhere on the screen
            now — the hero stopped saying it, and this line saying it
            twice-removed was the last echo. */}
        <Text style={s.guestLinkText}>{t('Keep exploring', 'Tiếp tục khám phá', '探索を続ける')}</Text>
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

      {/* Real now, so it behaves like every other locked row here:
          the tap leads to signing in, which is where friends begin.
          The Card stays inside the pressable — `friendsCard` is only
          the row's inner layout, and without the Card around it the
          block lost its surface and sat bare on the page. */}
      <PressableScale onPress={goSignIn}>
        <Card style={s.friendsCard}>
          <RoundIcon name="people-outline" />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={s.featureTitle}>{t('Connect with friends', 'Kết nối bạn bè', '友達とつながる')}</Text>
            <Text style={s.featureSub}>
              {t('Find friends and plan unforgettable adventures together.', 'Tìm bạn bè và cùng nhau lên những chuyến đi đáng nhớ.', '友達を見つけて、忘れられない冒険を一緒に。')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
        </Card>
      </PressableScale>

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
  const { email, profile, memberSince, signOut, deleteAccount, session } = useAuth();
  const [busy, setBusy] = useState(false);
  // The number on the friends card and the dot beside it. Sorted by the
  // pure half in lib/friends; the fetch itself is scoped by RLS to edges
  // this account is on.
  const { ships } = useCrew();
  const crew = useMemo(
    () => splitFriendships(ships.data, session?.user?.id ?? ''),
    [ships.data, session?.user?.id],
  );
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
          {/* Two lines, two things: the name you are called, then the
              name you are found by.

              These shared a line, separated by the app's own dot, with
              the name set to yield and the handle set to hold its width —
              on the argument that a handle cut to "@tra…" is not an
              address while "Tran Thi Tra…" is still a person. Both halves
              of that were true and the conclusion was still wrong: what
              it produced was "Le Nguy…  ·  @lenguyenngocminh", a screen
              that hides your name to protect an address nobody reads off
              their own profile.

              Stacked, neither has to yield. The measure here is about
              247pt beside the 88pt ring, which fits most display names
              whole on one line — the handle was what pushed them over,
              not the width. A name long enough to need two takes two and
              truncates after that; the dot goes with the shared line that
              made it a separator. */}
          <View style={s.nameBlock}>
            <Text style={s.accountName} numberOfLines={2}>{name}</Text>
            {profile.handle ? (
              <Text style={s.handle} numberOfLines={1}>{`@${profile.handle}`}</Text>
            ) : null}
          </View>
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
          <AboutRow icon="location-outline" label={t('Hometown', 'Quê quán', '出身地')} value={profile.location} />
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

      {/* Friends above Preferences, deliberately: this row is the one
          thing on the screen that changes without you — the dot is a
          person waiting on an answer — and an inbox filed under the
          language switcher is an inbox hidden. City, language and
          appearance are set once and left, so they keep the quiet end.
          The order reads as a story: who you are, who you go with, how
          the app behaves, and then the ways out. */}
      <Text style={s.section}>{t('Friends', 'Bạn bè', '友達')}</Text>
      {/* The pill said "Coming soon" from the day this screen shipped;
          the card opens the crew now. The number is friends, the dot is
          requests — two different facts, and neither borrows the other's
          mark. */}
      <PressableScale onPress={() => navigation.navigate('Crew')}>
        <Card style={s.friendsCard}>
          <View>
            <RoundIcon name="people-outline" />
            {crew.incoming.length > 0 ? <View style={s.reqDot} /> : null}
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={s.featureTitle}>{t('Connect with friends', 'Kết nối bạn bè', '友達とつながる')}</Text>
            <Text style={s.featureSub}>
              {t('Find friends and plan trips together.', 'Tìm bạn bè và cùng lên kế hoạch.', '友達を見つけて一緒に旅を計画。')}
            </Text>
          </View>
          {crew.friends.length > 0 ? <Text style={s.friendCount}>{crew.friends.length}</Text> : null}
          <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
        </Card>
      </PressableScale>

      {/* Named the way About me and Friends are, so this screen reads
          as three sections rather than two and a stray card between
          them. Only here: the guest view's cards carry no headings at
          all, and one heading among them would be the odd thing out in
          the other direction. */}
      <Text style={s.section}>{t('Preferences', 'Tuỳ chọn', '設定')}</Text>
      <SettingsCard />

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

      {/* The way out, whole. The store requires it (5.1.1(v)) and it was
          owed anyway: an account you can open but not close is a trap
          with good manners. Two asks, because the second is the only
          protection a destructive tap has — the server deliberately asks
          nothing (see delete-account). Quiet type, not a red button: it
          must be findable by someone looking and invisible to someone
          scrolling.

          Last on the page, below the tagline, and not a point nearer:
          it sat directly under Sign out — the button this screen is
          actually visited for — and two taps that close together must
          not have consequences that far apart. The tagline in between
          is the buffer a thumb needs. */}
      <PressableScale
        style={s.deleteBtn}
        onPress={() => Alert.alert(
          t('Delete your account?', 'Xoá tài khoản của bạn?', 'アカウントを削除しますか？'),
          t(
            'Your profile, collections, likes, trips and friends will be gone for good. Places you added stay in the catalog, no longer linked to you.',
            'Hồ sơ, bộ sưu tập, lượt thích, chuyến đi và bạn bè sẽ mất hẳn. Địa điểm bạn đã thêm vẫn ở lại catalog, không còn gắn với bạn.',
            'プロフィール・コレクション・いいね・旅程・友達は完全に削除されます。追加したスポットはカタログに残り、あなたとの関連は消えます。',
          ),
          [
            { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
            {
              text: t('Delete', 'Xoá', '削除'),
              style: 'destructive',
              onPress: () => Alert.alert(
                t('This cannot be undone', 'Không thể hoàn tác', '元に戻せません'),
                t('Delete the account now?', 'Xoá tài khoản ngay bây giờ?', '今すぐアカウントを削除しますか？'),
                [
                  { text: t('Keep my account', 'Giữ tài khoản', 'アカウントを残す'), style: 'cancel' },
                  {
                    text: t('Delete for good', 'Xoá vĩnh viễn', '完全に削除'),
                    style: 'destructive',
                    onPress: async () => {
                      setBusy(true);
                      try {
                        await deleteAccount();
                      } catch (e) {
                        Alert.alert(
                          t('Could not delete the account', 'Không xoá được tài khoản', 'アカウントを削除できませんでした'),
                          (e as Error).message,
                        );
                      } finally {
                        setBusy(false);
                      }
                    },
                  },
                ],
              ),
            },
          ],
        )}
      >
        <Text style={s.deleteText}>{t('Delete account', 'Xoá tài khoản', 'アカウントを削除')}</Text>
      </PressableScale>
    </>
  );
}

export default function ProfileScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { ready, session } = useAuth();
  const tabClearance = useTabBarClearance();
  const duckScroll = useDuckOnScroll();

  return (
    <Screen title={t('Profile', 'Cá nhân', 'プロフィール')}>
      <View style={{ flex: 1 }}>
        <AmbientWarmth />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: tabClearance, gap: space.cardGap }}
          showsVerticalScrollIndicator={false}
          onScroll={duckScroll}
          scrollEventThrottle={16}
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
  // Regular, not semibold: a settings label names a row, it does not head
  // a paragraph. The value takes the rest of the line and is pushed right
  // by its own flex rather than by a spacer view.
  settingLabel: { color: colors.text, fontSize: 16, fontWeight: font.regular },
  settingValue: {
    flex: 1, marginLeft: 10, textAlign: 'right',
    color: colors.textTertiary, fontSize: 15, fontWeight: font.regular,
  },
  featureSub: { color: colors.textTertiary, fontSize: 13.5, fontWeight: font.regular, lineHeight: 19 },

  reqDot: {
    position: 'absolute', top: -2, right: -2,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 2, borderColor: colors.bgElevated,
  },
  friendCount: { color: colors.textTertiary, fontSize: 15.5, fontWeight: font.semibold },
  friendsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: space.cardPadding,
  },

  section: { color: colors.text, ...type.section, marginTop: 10 },

  // 2, not the 5 the column around it uses: a name and the handle under
  // it are one identity read top to bottom, and at the column's gap they
  // read as two separate facts that happen to be adjacent. Everything
  // below — the bio, the button — keeps the wider spacing.
  nameBlock: { gap: 2 },
  // No `flexShrink` on either any more: on their own lines neither is
  // competing for width with the other, and each wraps or truncates
  // against the column instead.
  accountName: {
    color: colors.text, fontSize: 23, fontWeight: font.bold, letterSpacing: 0.2,
    lineHeight: 28,
  },
  handle: { color: colors.textTertiary, ...type.meta },
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
  deleteBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 22 },
  deleteText: { color: colors.bad, fontSize: 14, fontWeight: font.medium },

  tagline: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  // Lora's italic — see `quoteFace` in theme.ts. A face means no
  // fontWeight here, and a serif at this size wants a step more body
  // and air than the system meta type the two mottos used to wear.
  taglineText: { color: colors.textTertiary, fontFamily: quoteFace, fontSize: 16, textAlign: 'center', lineHeight: 25, letterSpacing: 0.2 },
  // Half a step under the quote, in the quote's own hand: the words
  // carry the weight, the name just signs them.
  taglineBy: { color: colors.textTertiary, fontFamily: quoteFace, fontSize: 12.5, letterSpacing: 0.4, marginTop: -2 },
});
