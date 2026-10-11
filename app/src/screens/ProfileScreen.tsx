// Profile — two personas, per the reference screens.
//
// Guests get a hub: who-you-are hero with one big sign-in action, a
// preview of what an account unlocks, and a quiet exit to keep
// browsing. Signed-in users get their identity: avatar, name, bio, an
// About-me card and account actions. Champagne throughout — the
// reference's violet gradient is translated, not copied.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AmbientWarmth, Card, CountBadge, fireHaptic, PressableScale, Screen, successHaptic, useTabBarClearance } from '../components/ui';
import { resetTips } from '../components/TipBox';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { CitySwitcherModal } from '../components/CitySwitcher';
import { LanguageSwitcherModal } from '../components/LanguageSwitcher';
import { schemeIcon, schemeLabel, ThemeSwitcherModal } from '../components/ThemeSwitcher';
import { PrimaryButton } from '../components/authUi';
import LegalSheet from '../components/LegalSheet';
import AboutSheet from '../components/AboutSheet';
import AvatarPicker from '../components/AvatarPicker';
import EngagementRing from '../components/EngagementRing';
import { levelFromSaves } from '../lib/level';
import { useAuth } from '../lib/auth';
import { visitSummary } from '../lib/checkin';
import { useIsEditor, useIsGuideAnywhere } from '../lib/useGuideGrant';
import { useMyTrips } from '../lib/mytrips';
import { membersOf, useMyPreferences } from '../lib/data';
import { useMyCheckins } from '../lib/checkins';
import { useActivityCount } from '../lib/useActivityCount';
import { useCrew } from '../lib/crew';
import { splitFriendships } from '../lib/friends';
import { useSave } from '../lib/save';
import { CATEGORIES } from '../lib/categories';
import { useCity } from '../lib/city';
import type { LegalId } from '../lib/legal';
import { cleanTaste } from '../lib/tastepick';
import { Lang, useI18n } from '../lib/i18n';
import { useScheme } from '../lib/theme';
import { bgElevatedHex, colors, font, quoteFace, radius, space, type } from '../theme';
import { goTo, type Nav } from '../nav';

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function memberSinceLabel(d: Date, lang: Lang): string {
  if (lang === 'vi') return `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
  if (lang === 'ja') return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  return `${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * The glyph every row on this screen leads with: bare, 19pt, in the
 * tertiary ink, the way `PlaceDetailScreen` draws the address, the phone
 * and the hours.
 *
 * Until 5 Oct 2026 every row wore a 44pt coral well around a 20pt glyph,
 * and a second opinion the owner brought read the wells, not the glyphs,
 * as the thing competing with the words. The well came off the three
 * rows of facts first (About me), on the argument that a well could mean
 * "this row answers a tap" and a bare glyph "this row only tells you
 * something". The owner then asked for the rest of the screen to follow
 * (6 Oct): the settings rows and the crew card already carry a chevron,
 * which says "goes somewhere" on its own, so the well was saying it a
 * second time in colour. One treatment on the screen, then, and the
 * accent is left to what it marks here — the level ring, the request
 * dot, the values that are links.
 *
 * The slot keeps the well's 44pt, so the words column sits where it did
 * on every row of every card. The Delete account screen's download row
 * and the Activity screen's feed marks followed the same day, to these
 * figures; the well is gone from the Profile stack.
 */
function RowGlyph({ name, line }: {
  name: keyof typeof Ionicons.glyphMap;
  /** The height of the row's first line, when the glyph should sit level
   *  with it rather than with the row's middle — see `GLYPH_BOX`. */
  line?: number;
}) {
  const lift = line == null ? undefined : { height: GLYPH_BOX, marginTop: (line - GLYPH_BOX) / 2 };
  return (
    <View style={[s.rowGlyph, lift]} testID="row-glyph">
      <Ionicons name={name} size={19} color={colors.textTertiary} />
    </View>
  );
}

/**
 * Where the glyph sits on a two-line row: level with the first line, as
 * `PlaceDetailScreen` sets its own against a label. The owner caught the
 * difference the day the wells came off (6 Oct 2026): there the glyph
 * marks the label, here it had floated to the middle of label-plus-value,
 * so the same bare glyph read as two conventions one tab apart.
 *
 * The arithmetic is the detail screen's. The slot is `GLYPH_BOX` tall —
 * room for a 19pt glyph's whole line, where a box the height of the
 * label's line clipped it — and a margin of `(line − GLYPH_BOX) / 2`
 * puts the box's middle on the first line's middle, whatever the second
 * line does. The first lines are stated, not left to the platform: 15 for
 * the 12.5pt caption (the system face gives 14.9), 19 for the 16pt title
 * (19.1). A single-line row passes no line and lets the row centre it,
 * which lands in the same place.
 */
const GLYPH_BOX = 26;
const CAPTION_LINE = 15;
const TITLE_LINE = 19;

function FeatureRow({ icon, title, sub, onPress, last, count, testID = 'feature-row' }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
  last?: boolean;
  /** A number at the row's end — see `CountBadge`. */
  count?: number;
  /** The smoke flows' handle on one row; the unit tests read the shared one. */
  testID?: string;
}) {
  return (
    <PressableScale
      scaleTo={0.98}
      style={[s.twoLineRow, !last && s.featureRowDivider]}
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
    >
      <RowGlyph name={icon} line={TITLE_LINE} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.featureTitle}>{title}</Text>
        <Text style={s.featureSub}>{sub}</Text>
      </View>
      <CountBadge n={count ?? 0} style={s.rowEnd} />
      <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} style={s.rowEnd} />
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
function SettingRow({ icon, label, value, onPress, last, testID }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Absent on rows that are a destination rather than a setting. */
  value?: string;
  onPress: () => void;
  last?: boolean;
  testID?: string;
}) {
  return (
    <PressableScale
      scaleTo={0.98}
      style={[s.featureRow, !last && s.featureRowDivider]}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
    >
      <RowGlyph name={icon} />
      <Text style={s.settingLabel} numberOfLines={1}>{label}</Text>
      {/* The value takes what is left and truncates rather than wrapping:
          a settings row that grows a second line for one city and not
          another makes the card look uneven for a reason nobody can see.

          One line, and only the value. The city row has tried to say
          more here twice. "Hà Nội · theo vị trí của bạn" on the one line
          truncated on a 320pt window, and the half that went was the
          half that explained the city. A second, smaller line under the
          name ("Theo vị trí" / "Tự chọn", #795) kept the words but made
          this the one row in the card that was two lines tall, beside
          Language and Appearance at one — the thing the move to the
          right had been for was that the three rows read as one kind.
          Where the city came from is said in the sheet this row opens,
          under "Use my location", where there is room to say it in a
          sentence; the row names the city and leaves the rest to it.

          With no value it is still what holds the glyph against the right
          edge, so the empty case is a spacer rather than nothing. */}
      {value === undefined
        ? <View style={{ flex: 1 }} />
        : <Text style={s.settingValue} numberOfLines={1}>{value}</Text>}
      <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
    </PressableScale>
  );
}

/** Workspace settings, for guests and members alike: which city's
 *  catalog the app shows, which language it speaks, how it looks. The
 *  header carries no switchers — this card is the one place to change
 *  any of them. Its heading is written at each call site, beside the
 *  card, the way About me and Friends are.
 *
 *  The two public documents used to live at the bottom of this card,
 *  drawn without values to say they were not settings. They are their
 *  own card now: a reader looking for the terms was looking under a
 *  heading that said the app's behaviour was in there, and a drawing
 *  convention is a weaker signal than a heading. See `AppCard`. */
function SettingsCard() {
  const { t, lang } = useI18n();
  const { city } = useCity();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const { scheme, pref } = useScheme();
  const langLabel = { en: 'English', vi: 'Tiếng Việt', ja: '日本語' }[lang];
  // The same reader the collection screen keys its tips by: the session,
  // or nobody for a guest.
  const { session } = useAuth();
  // Said on the row itself once it has worked, until the reader leaves:
  // a row that changes nothing on screen reads as a tap that missed.
  const [tipsBack, setTipsBack] = useState(false);

  return (
    <>
      <Card style={s.featureCard}>
        <SettingRow
          icon="location-outline"
          // "City" alone read as a fact about the reader, sitting one card
          // below "Hometown", which is one. This is the catalog the app is
          // showing — it changes when you travel, and the label now says so.
          label={t('Current city', 'Thành phố hiện tại', '現在の都市')}
          value={city ? t(city.short_en, city.short_vi, city.short_ja) : '…'}
          onPress={() => setOpen(true)}
        />
        <SettingRow
          icon="language-outline"
          label={t('Language', 'Ngôn ngữ', '言語')}
          value={langLabel ?? 'English'}
          onPress={() => setLangOpen(true)}
          testID="profile-language"
        />
        {/* The glyph follows the ground showing, the words follow the
            setting: on Auto the row reads "Automatic" beside whichever of
            the moon or the sun the phone has chosen. Saying "Dark" there
            would hide that the choice is the phone's. Coffee and Rose
            wear their own mark (`schemeIcon`). */}
        <SettingRow
          icon={schemeIcon(pref, scheme)}
          label={t('Theme', 'Theme', 'テーマ')}
          value={schemeLabel(pref, t)}
          onPress={() => setThemeOpen(true)}
        />
        {/* The tips under a collection's title retire once read three
            times, closed or acted on (see `lib/tips`), and this is the way
            back to them. Under Preferences, with how the app speaks and
            looks: whether it offers tips is the same kind of choice. It
            first went under App, and read there as something about the
            build. "Tip", not "mẹo", in the Vietnamese: the word the owner
            reads it by. The glyph is "again", not the tips' own circled
            "i", which About wears. */}
        <SettingRow
          icon="refresh-outline"
          label={t('Show tips again', 'Hiện lại các tip', 'ヒントをもう一度表示')}
          value={tipsBack ? t('Done', 'Đã bật lại', 'オンにしました') : undefined}
          onPress={() => {
            void resetTips(session?.user?.id).then(() => {
              successHaptic();
              setTipsBack(true);
            });
          }}
          last
        />
      </Card>
      <CitySwitcherModal visible={open} onClose={() => setOpen(false)} />
      <LanguageSwitcherModal visible={langOpen} onClose={() => setLangOpen(false)} />
      <ThemeSwitcherModal visible={themeOpen} onClose={() => setThemeOpen(false)} />
    </>
  );
}

/**
 * The app itself: its two public documents, and which copy of it this is.
 *
 * The documents were the last two rows of `SettingsCard`, drawn without a
 * value on the right so the shape would say they were not settings. That
 * was too quiet: a reader hunting for the terms reads the heading first,
 * and the heading said the app's behaviour lived there. A section says it
 * outright.
 *
 * "About City Crew" joined them here, under a heading that names what all
 * three are about. It was briefly a card of its own under "Legal", where
 * it read as a stray; filed under "Legal" it would have been a document it
 * is not. "App" holds both without either being mislabelled.
 *
 * Drawn for guests as well as members, and that is the point rather than
 * a courtesy: the only other link to the documents is under the Sign up
 * button, on a screen an account holder can never reach again, and
 * somebody still deciding whether to sign up should be able to read the
 * terms without starting the form.
 *
 * The heading is written at each call site, the way every other section
 * on this screen is.
 */
function AppCard() {
  const { t } = useI18n();
  // Which document is open, if any. The same sheet the sign-up screen
  // raises, so the two ways into these documents behave identically —
  // which they did not while one of them left for a browser.
  const [legal, setLegal] = useState<LegalId | null>(null);
  const [about, setAbout] = useState(false);

  return (
    <>
      <Card style={s.featureCard}>
        {/* No value on the right, still: these are a destination, not a
            setting. The version is not written on the About row either:
            it is one of four answers, and the one that settles "did the
            update arrive?" is the update's date, which is too long for a
            value column. See `AboutSheet`. */}
        <SettingRow
          icon="document-text-outline"
          label={t('Terms of Service', 'Điều khoản sử dụng', '利用規約')}
          onPress={() => { fireHaptic('selection'); setLegal('terms'); }}
        />
        <SettingRow
          icon="shield-checkmark-outline"
          label={t('Privacy Policy', 'Chính sách quyền riêng tư', 'プライバシーポリシー')}
          onPress={() => { fireHaptic('selection'); setLegal('privacy'); }}
        />
        <SettingRow
          icon="information-circle-outline"
          label={t('About City Crew', 'Giới thiệu City Crew', 'City Crewについて')}
          onPress={() => { fireHaptic('selection'); setAbout(true); }}
          last
        />
      </Card>
      <LegalSheet id={legal} onClose={() => setLegal(null)} />
      <AboutSheet visible={about} onClose={() => setAbout(false)} />
    </>
  );
}

function Tagline() {
  const { t } = useI18n();
  return (
    <View style={s.tagline}>
      {/* The app's own mark, not a sparkle. An emoji here was whatever
          the reader's platform drew — a different sparkle on iOS, on
          Android and on the web, none of them ours, and none of them
          taking the theme's colour. A glyph does both: one shape
          everywhere, in the accent, and it turns with the theme.
          `accessibilityElementsHidden` because it says nothing the
          quote under it does not; a screen reader should reach the
          words, not "paw". */}
      <Ionicons
        name="paw"
        size={18}
        color={colors.accent}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
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
              this well lead with what signing in opens.

              The title now names the one act this screen is asking for
              rather than the destination it leads to — saving a place is
              the first thing anybody does here, and the trip is what that
              becomes. The body says the three in order, which does repeat
              the rows below: read as a sentence they are a reason, read
              as rows they are the doors.

              It ends on the plain noun. "The trips that come next" and
              its paw were both reaching for warmth the sentence did not
              need, and the qualifier was doing nothing besides — every
              trip you plan comes next. */}
          <Text style={s.heroTitle}>{t('Keep the places you love', 'Lưu lại những nơi bạn yêu thích', 'お気に入りの場所を残しておく')}</Text>
          <Text style={s.heroBody}>
            {t(
              'Sign in to save places, build collections, and plan your trips',
              'Đăng nhập để lưu địa điểm, tạo bộ sưu tập và lên kế hoạch cho những chuyến đi',
              'サインインして、場所を保存し、コレクションを作り、旅を計画しましょう',
            )}
          </Text>
        </View>
      </View>
      <PrimaryButton label={t('Sign in / Sign up', 'Đăng nhập / Đăng ký', 'サインイン / 登録')} onPress={goSignIn} testID="profile-sign-in" />
      <Pressable
        style={s.guestLink}
        accessibilityRole="button"
        onPress={() => {
          fireHaptic('selection');
          // Through the tab navigator when there is one. `getParent()?.`
          // alone was a tap that did nothing, silently, whenever this screen
          // was mounted without one — so the root ref is the way out then,
          // naming Explore's first screen rather than trusting a tab that
          // may never have mounted to pick it.
          const parent = navigation.getParent();
          if (parent) parent.navigate('Explore');
          else goTo('Explore', { screen: 'ExploreHome' });
        }}
      >
        {/* Shorter, and the word "guest" appears nowhere on the screen
            now — the hero stopped saying it, and this line saying it
            twice-removed was the last echo. */}
        <Text style={s.guestLinkText}>{t('Keep exploring', 'Tiếp tục khám phá', '探索を続ける')}</Text>
        <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
      </Pressable>

      {/* Headed like the member view's sections, and the same headings
          where the card is the same card. This view used to carry no
          headings at all, on the argument that one heading among bare
          cards would be the odd one out. That held for one screen read
          alone. Read beside the member view, which is how anyone who signs
          in meets it, the same Preferences card with a heading on one side
          and none on the other was the odd one out. */}
      <Text style={s.section}>{t('With an account', 'Khi có tài khoản', 'アカウントでできること')}</Text>
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
        />
        {/* A fourth row here rather than a card of its own at the foot of
            the screen, where it sat after the documents: it is one more
            thing an account opens, and a locked row like the three above
            it. The tap leads to signing in, which is where friends begin. */}
        <FeatureRow
          icon="people-outline"
          title={t('Connect with friends', 'Kết nối bạn bè', '友達とつながる')}
          sub={t('Find friends and share unforgettable trips.', 'Tìm kiếm bạn bè và chia sẻ những chuyến đi đáng nhớ.', '友達を探して、忘れられない旅を共有。')}
          onPress={goSignIn}
          last
        />
      </Card>

      <Text style={s.section}>{t('Preferences', 'Tuỳ chọn', '設定')}</Text>
      <SettingsCard />
      {/* The documents matter most to exactly this reader, the one who
          has not signed up yet. */}
      <Text style={s.section}>{t('App', 'Ứng dụng', 'アプリ')}</Text>
      <AppCard />

      <Tagline />
    </>
  );
}

/** One number and its word, a door into the tab that holds them. */
function StatTile({ n, label, onPress }: { n: number; label: string; onPress: () => void }) {
  return (
    <PressableScale
      scaleTo={0.96}
      containerStyle={{ flex: 1 }}
      style={s.stat}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${n} ${label}`}
    >
      <Text style={s.statN}>{n}</Text>
      <Text style={s.statLabel} numberOfLines={1}>{label}</Text>
    </PressableScale>
  );
}

function AboutRow({ icon, label, value, children, last }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** The plain answer. Omitted by the one row that draws its own. */
  value?: string;
  /** Drawn in the value's place — the taste row's chips, today. Kept as a
   *  slot rather than a `kind` prop so the row stays a row: it still owns
   *  the glyph, the label and the divider, and only the answer changes
   *  shape. */
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[s.twoLineRow, !last && s.featureRowDivider]} testID="about-row">
      <RowGlyph name={icon} line={CAPTION_LINE} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.aboutLabel}>{label}</Text>
        {children ?? <Text style={s.aboutValue}>{value}</Text>}
      </View>
    </View>
  );
}

function AccountProfile({ navigation }: { navigation: Nav }) {
  const { t, lang } = useI18n();
  // For the one border here that must resolve in JS — see `reqDot`.
  const { scheme } = useScheme();
  const { email, profile, memberSince, signOut, session } = useAuth();
  const [busy, setBusy] = useState(false);
  // The visits, for the one number the row below shows — the app's one
  // copy, so a check-in made a moment ago on a place's screen is already
  // in this count. Its own copy here said 2 under a list of 29 once.
  const visits = useMyCheckins();
  // How much the feed holds — likes and copies in its window, plus the
  // requests waiting, which the feed lists first. A total, as the other
  // rows' numbers are; see `lib/useActivityCount` for the "unseen"
  // reading that was tried and read as nothing.
  const feed = useActivityCount(session?.user?.id ?? null);
  // The number on the friends card and the dot beside it. Sorted by the
  // pure half in lib/friends; the fetch itself is scoped by RLS to edges
  // this account is on.
  const { ships } = useCrew();
  const crew = useMemo(
    () => splitFriendships(ships.data, session?.user?.id ?? ''),
    [ships.data, session?.user?.id],
  );
  // Cleaned on the way in for the same reason `useBrowseTaste` cleans
  // it: the column is a bare text[] and holds words written before any
  // picker existed.
  const prefs = useMyPreferences(session?.user?.id ?? null);
  // Edit profile is pushed *over* this screen, so coming back reveals it
  // rather than remounting it — and `useFetch` loads once per mount.
  // Without this, saving your interests and pressing back left the row
  // below still reading "Edit profile to add your interests": the one
  // sentence guaranteed to be wrong at the moment it is most likely to be
  // read. Every focus reloads, including the first — see TripsScreen for
  // why a skipped first focus is a bet that can be lost, not a safe one.
  useFocusEffect(useCallback(() => {
    prefs.reload();
  // `prefs.reload` is stable; `prefs` is a new object on every load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.reload]));
  // The reader's standing in the catalog, for the badge under their name.
  // Editor outranks guide and is shown alone: the desk's hand keeps every
  // gallery, which includes the ones a guide keeps.
  const editor = useIsEditor();
  const guide = useIsGuideAnywhere();
  const role = editor
    ? {
      icon: 'medal' as const, color: colors.accent, dress: s.roleEditor,
      name: t('Super User', 'Super User', 'スーパーユーザー'),
      says: t(
        'You can edit, and add photos to, every place in the app — new or already listed.',
        'Bạn có thể chỉnh sửa, thêm ảnh cho tất cả các địa điểm, mới hoặc đã có trong ứng dụng.',
        'アプリ内のすべての場所（新規・既存）を編集し、写真を追加できます。',
      ),
    }
    : guide
      ? {
        icon: 'star' as const, color: colors.ok, dress: s.roleGuide,
        name: t('Local Guide', 'Local Guide', 'ローカルガイド'),
        says: t(
          'You can edit, and add photos to, places in your collections and places you imported.',
          'Bạn có thể chỉnh sửa và thêm ảnh cho các địa điểm trong bộ sưu tập của mình hoặc các địa điểm đã nhập.',
          '自分のコレクションの場所や、自分が追加した場所を編集し、写真を追加できます。',
        ),
      }
      : null;
  const taste = useMemo(
    () => cleanTaste(prefs.data.categories, Object.keys(CATEGORIES)),
    [prefs.data.categories],
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
  const trips = useMyTrips();

  // The three doors under the hero. Each is a count the reader made and a
  // tap into the tab that holds it — a number on a profile earns its place
  // only as a door (the ring already says "how far"; these say "how many"
  // and "where"). A tab navigator is the parent when the screen is in the
  // app; the root ref is the way out when it is not, naming each tab's
  // first screen (see the guest link's note on `getParent()?.`).
  const hop = (tab: 'Collections' | 'Trips', first: 'CollectionsHome' | 'TripsHome') => {
    fireHaptic('selection');
    const parent = navigation.getParent();
    if (parent) parent.navigate(tab);
    else goTo(tab, { screen: first });
  };

  return (
    <>
      <View style={s.heroRow}>
        {/* No camera badge here: the level badge takes that corner, and
            Edit profile shows the same picker with its badge intact.

            The reader's standing, on the picture. A guide, and an editor
            (the desk's hand), may keep galleries the panel would otherwise
            refuse; it used to be said in a pill under the name, beside
            Edit profile, and the owner found the pill loud for what it
            is — a mark, not a message. So: a small disc on the ring's
            top-right corner, the level's own halo at the opposite corner,
            with the role's glyph in the role's colour. Editor outranks
            guide and is the one disc shown; a reader with neither wears
            none. A tap still says what the grant lets them do, in the
            desk's words, and VoiceOver reads the role as the disc's name.

            And because the disc lies on the picture, its arriving a
            round-trip late moves nothing else on the page — which is
            what the pill's held room was for. */}
        <View style={s.avatarBox} testID="avatar-box">
          <EngagementRing size={88} level={level} progress={progress}>
            <AvatarPicker showCamera={false} />
          </EngagementRing>
          {role && (
            <View style={s.roleHalo}>
              <PressableScale
                scaleTo={0.9}
                style={[s.roleDisc, role.dress]}
                accessibilityRole="button"
                accessibilityLabel={role.name}
                accessibilityHint={t('Explains what this lets you do', 'Giải thích quyền này', 'この権限でできることを説明します')}
                onPress={() => Alert.alert(role.name, role.says)}
                testID="role-badge"
              >
                <Ionicons name={role.icon} size={13} color={role.color} />
              </PressableScale>
            </View>
          )}
        </View>
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
              truncates after that.

              The dot came back one line down. The handle and the bio each
              had a line of their own under the name, and three stacked
              lines of small grey type beside the ring read as a form; the
              bio is a tagline — "Food lover", "Coffee first." — and a
              tagline sits after the address the way it does on every
              profile the reader has seen: "@trang · Food lover". One
              line, two lines at most for a long tagline, and the handle
              is never what gets cut because it comes first. Three Text
              runs rather than one string, so each keeps its own colour
              and a test can still find each on its own. */}
          <View style={s.nameBlock}>
            <Text style={s.accountName} numberOfLines={2}>{name}</Text>
            {profile.handle || profile.bio ? (
              <Text style={s.handleLine} numberOfLines={2}>
                {profile.handle ? <Text style={s.handle}>{`@${profile.handle}`}</Text> : null}
                {profile.handle && profile.bio ? <Text style={s.handle}>{' · '}</Text> : null}
                {profile.bio ? <Text style={s.heroBody}>{profile.bio}</Text> : null}
              </Text>
            ) : null}
          </View>
          {/* Edit profile, by itself, under the name. Words only: it wore a
              pencil for a while, and the owner did not care for it — a
              glyph beside two words that already say "change" was one more
              thing to read. */}
          <View style={s.heroActions}>
            <PressableScale
              scaleTo={0.94}
              style={s.editBtn}
              onPress={() => navigation.navigate('EditProfile')}
              accessibilityRole="button"
            >
              <Text style={s.editBtnText}>{t('Edit profile', 'Sửa hồ sơ', 'プロフィール編集')}</Text>
            </PressableScale>
          </View>
        </View>
      </View>

      {/* Bare numbers over a hairline, not boxed tiles: four filled boxes
          beside a title read as a second toolbar (the desk learned this in
          #634), where the number alone is the thing being read. Three, not
          the reference's four: there is no review feature, and a count
          with no data behind it is the one number that must not appear. */}
      <View style={s.stats}>
        <StatTile n={mine.data.length} label={t('Collections', 'Bộ sưu tập', 'コレクション')} onPress={() => hop('Collections', 'CollectionsHome')} />
        <View style={s.statDivider} />
        <StatTile n={saved} label={t('Saved places', 'Địa điểm đã lưu', '保存した場所')} onPress={() => hop('Collections', 'CollectionsHome')} />
        <View style={s.statDivider} />
        <StatTile n={trips.data?.length ?? 0} label={t('Trips', 'Chuyến đi', 'トリップ')} onPress={() => hop('Trips', 'TripsHome')} />
      </View>

      <Text style={s.section}>{t('About me', 'Về tôi', '自己紹介')}</Text>
      <Card style={s.featureCard}>
        <AboutRow
          icon="mail-outline"
          label={t('Email', 'Email', 'メール')}
          value={email ?? ''}
        />
        {profile.location ? (
          <AboutRow
            icon="location-outline"
            label={t('Hometown', 'Quê quán', '出身地')}
            value={profile.location}
            last={!memberSince}
          />
        ) : null}
        {memberSince ? (
          <AboutRow
            icon="calendar-outline"
            label={t('Member since', 'Thành viên từ', '登録日')}
            value={memberSinceLabel(memberSince, lang)}
            last
          />
        ) : null}
      </Card>

      {/* The interests, as a section of their own. They were the last row
          of the card above, behind a heart glyph and a caption, and three
          chips crammed into the value column of a facts table read as one
          more fact — where they are the one thing on this screen the
          reader chose, and the one thing they might want to change. So:
          a heading, and the chips with the width of the card. The chips
          are the picker's own, glyph and hue, at rest. No "Edit" beside
          the heading: it was there for one build and opened the same
          screen as the Edit profile button four lines up, and two ways
          to the same place on one screen is one too many. */}
      <Text style={s.section}>{t('Interests', 'Sở thích', '興味')}</Text>
      <Card style={s.featureCard}>
        {taste.length ? (
          <View style={s.tasteChips}>
            {taste.map((k) => (
              <View key={k} style={s.tasteChip} testID={`interest-${k}`}>
                <Ionicons name={CATEGORIES[k].icon} size={15} color={CATEGORIES[k].color} />
                <Text style={s.tasteChipText}>
                  {t(CATEGORIES[k].en, CATEGORIES[k].vi, CATEGORIES[k].ja)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[s.aboutValue, s.tasteEmpty]}>
            {t(
              'Edit profile to add your interests.',
              'Sửa hồ sơ để cập nhật sở thích của bạn.',
              '「プロフィール編集」で興味を追加できます。',
            )}
          </Text>
        )}
      </Card>

      {/* Where you have been, after what you like: both are facts about
          who you are, and they read in that order — taste, then the
          evidence. Not a fourth stat tile: the row of three carries its
          own note on why four boxes read as a toolbar. A section of its
          own rather than a row in Interests, because the chips there are
          a picker at rest and a navigation row under a picker is two
          kinds of thing in one card. */}
      <Text style={s.section}>{t('Check-ins', 'Check-in', 'チェックイン')}</Text>
      <Card style={s.featureCard}>
        <FeatureRow
          icon="location-outline"
          title={t('Places you checked in at', 'Địa điểm check-in', 'チェックインした場所')}
          sub={t('By month, newest first.', 'Theo tháng, mới nhất trước.', '月ごと、新しい順。')}
          count={visitSummary(visits.data).places}
          onPress={() => navigation.navigate('Visited')}
          last
          testID="profile-visited"
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
          the row opens the crew now. The number is friends, the dot is
          requests — two different facts, and neither borrows the other's
          mark. */}
      <Card style={s.featureCard}>
        <PressableScale
          style={[s.twoLineRow, s.featureRowDivider]}
          onPress={() => navigation.navigate('Crew')}
          accessibilityRole="button"
          testID="feature-row"
        >
          <View>
            <RowGlyph name="people-outline" line={TITLE_LINE} />
            {crew.incoming.length > 0 ? <View style={[s.reqDot, { borderColor: bgElevatedHex[scheme] }]} /> : null}
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={s.featureTitle}>{t('Connect with friends', 'Kết nối bạn bè', '友達とつながる')}</Text>
            <Text style={s.featureSub}>
              {t('Find friends and share your plans.', 'Tìm kiếm bạn bè và chia sẻ kế hoạch.', '友達を探して、計画を共有。')}
            </Text>
          </View>
          <CountBadge n={crew.friends.length} style={s.rowEnd} />
          <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} style={s.rowEnd} />
        </PressableScale>
        {/* The door to Activity, re-hung. The feed's one entry used to be
            the "N requests waiting" banner on Crew, and when Crew grew a
            Requests tab (#309, 23 Aug 2026) the banner came down with the
            requests it pointed at — nobody meant to close the feed, but
            the applause on your lists was left behind a route nothing
            navigated to, for six weeks.

            Under the friends row rather than a bell in the header: what
            the feed holds is who liked your lists and who wants to join
            your crew, which is this section's subject, and a header bell
            would be the one control on the screen outside a card. The
            request dot stays on the friends row — Crew is the inbox since
            #309; Activity answers requests too, but as news. */}
        <FeatureRow
          icon="notifications-outline"
          title={t('Activity', 'Hoạt động', 'アクティビティ')}
          count={feed + crew.incoming.length}
          sub={t('Likes and copies of your lists, and friend requests.', 'Lượt thích và bản sao list của bạn, và lời mời kết bạn.', 'リストへのいいねやコピーと、友達リクエスト。')}
          onPress={() => navigation.navigate('Activity')}
          last
        />
      </Card>

      {/* Named the way About me and Friends are, so this screen reads
          as sections rather than a stray card between them. The guest
          view uses the same heading over the same card. */}
      <Text style={s.section}>{t('Preferences', 'Tuỳ chọn', '設定')}</Text>
      <SettingsCard />

      {/* Last section, and last on purpose. The order this screen reads
          in — who you are, who you go with, how the app behaves — ends on
          the things that are true whether you read them or not, and then
          the way out. Under Preferences the documents were filed as
          settings by position while being drawn as not-settings; a
          heading of their own costs one line and stops the screen arguing
          with itself. */}
      <Text style={s.section}>{t('App', 'Ứng dụng', 'アプリ')}</Text>
      <AppCard />

      <PressableScale
        style={s.signOutBtn}
        accessibilityRole="button"
        // The label stays while the spinner stands in for the word, so the
        // control keeps its name for a screen reader mid-request.
        accessibilityLabel={t('Sign out', 'Đăng xuất', 'サインアウト')}
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        testID="profile-sign-out"
        onPress={async () => {
          // A second tap while the first is in flight would ask the server
          // to end the same session twice; `disabled` covers the render,
          // this covers a tap that lands before it.
          if (busy) return;
          setBusy(true);
          try {
            await signOut();
          } catch (e) {
            // Without this the failure escaped as an unhandled rejection
            // and the button simply came back — which reads as "signed
            // out" until the next screen says otherwise.
            Alert.alert(
              t('Could not sign out', 'Không đăng xuất được', 'サインアウトできませんでした'),
              (e as Error).message,
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? <ActivityIndicator color={colors.textSecondary} />
          : <Text style={s.signOutText}>{t('Sign out', 'Đăng xuất', 'サインアウト')}</Text>}
      </PressableScale>

      <Tagline />

      {/* The way out, whole. The store requires it (5.1.1(v)) and it was
          owed anyway: an account you can open but not close is a trap
          with good manners. Quiet, not a red button: it must be findable
          by someone looking and invisible to someone scrolling. It wears
          the trip's delete control — a small outlined pill, a bin, red
          type, centred — so a destructive act looks the same wherever the
          app offers one, and never has the breadth of an offer (see the
          note on `delete` in TripDetailScreen).

          Last on the page, below the tagline, and not a point nearer:
          it sat directly under Sign out — the button this screen is
          actually visited for — and two taps that close together must
          not have consequences that far apart. The tagline in between
          is the buffer a thumb needs.

          A screen, not the two alerts this used to open. What made a
          destructive tap deliberate was supposed to be asking twice, and
          the second ask said nothing the first had not — the theatre
          `delete-account` refuses to perform on the server, performed
          here instead. Worse, a native alert positions its own buttons
          from the width of their titles, so which side the destructive
          one landed on changed with the language. The reasoning is at
          the top of `DeleteAccountScreen`. */}
      <PressableScale
        style={s.deleteBtn}
        accessibilityRole="button"
        onPress={() => navigation.navigate('DeleteAccount')}
        testID="profile-delete-account"
      >
        <Ionicons name="trash-outline" size={15} color={colors.bad} />
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
  // Its tab, pressed again here, scrolls back to the top — the last step
  // of the walk back that ExploreScreen's `tabPress` note describes.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  return (
    <Screen title={t('Profile', 'Cá nhân', 'プロフィール')}>
      <View style={{ flex: 1 }}>
        <AmbientWarmth />
        <ScrollView
          ref={scrollRef}
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
  // The picker's chip, at rest: same glyph and hue, no press state and no
  // border — this card is a page of answers, not a set of controls. A
  // size up from when they sat in a table's value column: with the card's
  // width to themselves, 13.5pt chips read as leftovers.
  //
  // 44 tall, from the 37 its padding made: the same category chip is 44
  // on Search, Places and a place's own facts row, and a Cafés pill at
  // two heights across the app reads as two different things. Still no
  // border and no press state — the height is for the family, not a tap.
  tasteChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 14 },
  tasteChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceGlass, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 9, minHeight: 44,
  },
  tasteChipText: { color: colors.text, fontSize: 15, fontWeight: font.medium },
  tasteEmpty: { paddingVertical: 14 },
  // The role badge and the Edit profile button, one row under the name.
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  // The ring with its two corners: the level's pill at bottom-right (the
  // ring's own), the role's disc at top-right (this screen's). Shrunk to
  // the ring, so "top-right" is the ring's corner and not the row's.
  avatarBox: { alignSelf: 'flex-start' },
  // The level pill's halo, mirrored to the top: the page's ground around
  // the disc, so the arc plainly runs underneath it (see EngagementRing).
  roleHalo: {
    position: 'absolute', right: -4, top: 0,
    backgroundColor: colors.bg, borderRadius: 999, padding: 2.5,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  // 24pt: the level pill's height, so the two corners read as a pair.
  roleDisc: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  roleGuide: { borderColor: colors.ok, backgroundColor: colors.okSoft },
  roleEditor: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
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
  // A row of two lines: the glyph is lifted to the first (see `GLYPH_BOX`),
  // and the chevron at the far end keeps the middle through `rowEnd`.
  twoLineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
  rowEnd: { alignSelf: 'center' },
  featureRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderGlassSoft },
  // The old well's footprint without the well — see `RowGlyph`.
  rowGlyph: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold, lineHeight: TITLE_LINE },
  // Regular, not semibold: a settings label names a row, it does not head
  // a paragraph. The value takes the rest of the line and is pushed right
  // by its own flex rather than by a spacer view.
  // `flexShrink: 1` is what keeps the row's right-hand control on the
  // screen. Without it the label is rigid: on a 320pt window (an iPhone SE,
  // or an iPhone 15 with Display Zoom on) the switch row's label plus the
  // icon and the switch came to more than the card's 244pt, and the switch
  // was pushed past the card's edge and clipped. The value rows never
  // clipped, because their value has `flex: 1` and gives way first — the
  // label still takes the line ahead of it, and only shrinks once it is
  // the label alone that does not fit.
  settingLabel: { flexShrink: 1, color: colors.text, fontSize: 16, fontWeight: font.regular },
  // No margin of its own: the row's 14pt gap already separates it from
  // the label, and the 10 this used to add was a quarter of the value's
  // room on a narrow screen — "Automatic" truncated to "Automa…" with the
  // gap it did not need.
  settingValue: {
    flex: 1, textAlign: 'right',
    color: colors.textTertiary, fontSize: 15, fontWeight: font.regular,
  },
  featureSub: { color: colors.textTertiary, fontSize: 14, fontWeight: font.regular, lineHeight: 19 },

  // On the glyph's shoulder. It sat on the well's corner (−2, −2) while
  // there was a well; on a bare 19pt glyph centred in a 44pt slot the
  // glyph spans 12.5–31.5, so a 10pt dot at 8 from the top and the right
  // (26–36) overlaps its top-right corner the way a badge sits on an
  // icon, rather than floating in the slot's empty corner 13pt away.
  reqDot: {
    position: 'absolute', top: 8, right: 8,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.accent,
    // The ring is the card's own colour, cut round the dot. Resolved in
    // JS at the call site (`bgElevatedHex[scheme]`): a `dyn` pair on a
    // border follows the phone's appearance, not the app's — `bgHex`.
    borderWidth: 2,
  },
  // The pill: 22pt tall so it sits inside the 44pt row without touching
  // its edges, the radius half the height for a true capsule. `minWidth`
  // 32 is two digits of 13pt semibold plus the padding — so "6", "30"
  // and "99" are one width, and the pills down a card line up.
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
  // The shared line's own box; the runs inside carry their colours.
  handleLine: { ...type.meta, lineHeight: 21 },
  // The card surface, not the glass tint: on paper the tint is a grey
  // smudge on a warm page, where the About-me card sitting inches below
  // it is white. Matching that card makes the button read as part of the
  // same set of objects rather than a hole in the background.
  // Under the hero, over a hairline: the width is split three ways and
  // the numbers centre in their thirds, with a short rule between.
  stats: {
    flexDirection: 'row', alignItems: 'center', marginTop: 14,
    paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderGlassSoft,
  },
  stat: { alignItems: 'center', gap: 2, paddingVertical: 6 },
  statN: { color: colors.text, fontSize: 22, fontWeight: font.bold, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textTertiary, fontSize: 13, fontWeight: font.medium },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.borderGlassSoft },
  editBtn: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderGlassSoft,
    backgroundColor: colors.surfaceCard, paddingHorizontal: 16, paddingVertical: 8,
    // 44, not the 33 the padding alone made: it is a button.
    minHeight: 44, justifyContent: 'center',
  },
  editBtnText: { color: colors.text, fontSize: 14, fontWeight: font.semibold },

  aboutLabel: { color: colors.textTertiary, fontSize: 13, fontWeight: font.medium, lineHeight: CAPTION_LINE },
  aboutValue: { color: colors.text, fontSize: 16, fontWeight: font.regular, lineHeight: 21 },

  signOutBtn: {
    borderRadius: radius.input, paddingVertical: 13, alignItems: 'center', marginTop: 6,
    borderWidth: 1, borderColor: colors.borderGlassSoft, backgroundColor: colors.surfaceGlass,
  },
  signOutText: { color: colors.textSecondary, fontSize: 15, fontWeight: font.medium },
  // TripDetailScreen's `delete`, measure for measure. The top margin is
  // this screen's own: the buffer below the tagline, see the note above.
  deleteBtn: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderGlassSoft,
    paddingVertical: 11, paddingHorizontal: 20, marginTop: 22,
  },
  deleteText: { color: colors.bad, fontSize: 13, fontWeight: font.semibold },

  tagline: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  // Lora's italic — see `quoteFace` in theme.ts. A face means no
  // fontWeight here, and a serif at this size wants a step more body
  // and air than the system meta type the two mottos used to wear.
  taglineText: { color: colors.textTertiary, fontFamily: quoteFace, fontSize: 16, textAlign: 'center', lineHeight: 25, letterSpacing: 0.2 },
  // Half a step under the quote, in the quote's own hand: the words
  // carry the weight, the name just signs them.
  taglineBy: { color: colors.textTertiary, fontFamily: quoteFace, fontSize: 13, letterSpacing: 0.4, marginTop: -2 },
});
