// Profile for a signed-in reader: who they are, their counts, About me,
// and the account's ways out.

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, CountBadge, fireHaptic, PressableScale } from '../../components/ui';
import { useFocusEffect } from '@react-navigation/native';
import AvatarPicker from '../../components/AvatarPicker';
import EngagementRing from '../../components/EngagementRing';
import { levelFromSaves } from '../../lib/level';
import { useAuthActions, useProfile, useSession } from '../../lib/auth';
import { visitSummary } from '../../lib/checkin';
import { useIsEditor, useIsGuideAnywhere } from '../../lib/useGuideGrant';
import { useMyTrips } from '../../lib/mytrips';
import { membersOf, useMyPreferences } from '../../lib/data';
import { useMyCheckins } from '../../lib/checkins';
import { useActivityCount } from '../../lib/useActivityCount';
import { useCrew } from '../../lib/crew';
import { splitFriendships } from '../../lib/friends';
import { useMyLists } from '../../lib/save';
import { CATEGORIES } from '../../lib/categories';
import { cleanTaste } from '../../lib/tastepick';
import { Lang, useI18n } from '../../lib/i18n';
import { useScheme } from '../../lib/theme';
import { bgElevatedHex, colors } from '../../theme';
import { goTo, type Nav } from '../../nav';
import { RowGlyph, FeatureRow, AboutRow } from './rows';
import { SettingsCard } from './SettingsCard';
import { AppCard, Tagline } from './AppCard';
import { TITLE_LINE, s } from './styles';

export const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function memberSinceLabel(d: Date, lang: Lang): string {
  if (lang === 'vi') return `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
  if (lang === 'ja') return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  return `${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * One number and its word, a door into the tab that holds them.
 *
 * `null` is "not known yet", and it is drawn as a dash, never as 0. The
 * tiles used to read `data.length` straight off fetches still in flight,
 * so a reader with 11 lists, 48 places and 55 trips signed in to three
 * zeros — the same figures an empty account shows, and read as one
 * (UX-14, 17 Oct 2026). A zero here is now only ever an answer.
 */
export function StatTile({ n, label, onPress }: { n: number | null; label: string; onPress: () => void }) {
  const { t } = useI18n();
  return (
    <PressableScale
      scaleTo={0.96}
      style={{ flex: 1 }}
      contentStyle={s.stat}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={n === null
        ? `${label}, ${t('loading', 'đang tải', '読み込み中')}`
        : `${n} ${label}`}
    >
      <Text style={[s.statN, n === null && s.statPending]}>{n ?? '—'}</Text>
      <Text style={s.statLabel} numberOfLines={1}>{label}</Text>
    </PressableScale>
  );
}

export function AccountProfile({ navigation }: { navigation: Nav }) {
  const { t, lang } = useI18n();
  // For the one border here that must resolve in JS — see `reqDot`.
  const { scheme } = useScheme();
  const { email, session } = useSession();
  const { profile, memberSince } = useProfile();
  const { signOut } = useAuthActions();
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
  const mine = useMyLists();
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
  //
  // To the tab's list, at its top, every time — not to wherever the tab
  // was last left. A bare `navigate(tab)` restored that tab's stack, so
  // "48 Saved places" opened whichever collection the reader had been in
  // (UX-09, 17 Oct 2026): a door whose room depended on history. `pop`
  // closes what was open above the list — React Navigation 7's
  // `navigate` no longer goes back to a screen already in the stack on
  // its own — `at` is a fresh param the list reads as "scroll to the
  // top", and Collections is aimed at Yours, the half these counts are of.
  const hop = (tab: 'Collections' | 'Trips', first: 'CollectionsHome' | 'TripsHome') => {
    fireHaptic('selection');
    const at = Date.now();
    const params = {
      screen: first,
      params: tab === 'Collections' ? { tab: 'yours', at } : { at },
      pop: true,
    };
    const parent = navigation.getParent();
    if (parent) parent.navigate(tab, params);
    else goTo(tab, params);
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
                contentStyle={[s.roleDisc, role.dress]}
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
              contentStyle={s.editBtn}
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
        <StatTile n={mine.loaded ? mine.data.length : null} label={t('Collections', 'Bộ sưu tập', 'コレクション')} onPress={() => hop('Collections', 'CollectionsHome')} />
        <View style={s.statDivider} />
        <StatTile n={mine.loaded ? saved : null} label={t('Saved places', 'Địa điểm đã lưu', '保存した場所')} onPress={() => hop('Collections', 'CollectionsHome')} />
        <View style={s.statDivider} />
        <StatTile n={trips.loaded ? trips.data.length : null} label={t('Trips', 'Chuyến đi', 'トリップ')} onPress={() => hop('Trips', 'TripsHome')} />
      </View>
      {/* A dash that stays a dash is a question the screen cannot answer,
          and it says so — only for a count still unknown: a fetch that
          fails over figures already on screen (a cached copy) leaves
          those standing, and they are not wrong enough to interrupt. */}
      {((!mine.loaded && mine.error) || (!trips.loaded && trips.error)) ? (
        <View style={s.statsFailed} testID="stats-failed">
          <Text style={s.statsFailedText}>
            {t("Couldn't load your counts.", 'Không tải được số liệu.', '件数を読み込めませんでした。')}
          </Text>
          <PressableScale
            onPress={() => {
              if (!mine.loaded) mine.reload();
              if (!trips.loaded) trips.reload();
            }}
            accessibilityRole="button"
            hitSlop={10}
          >
            <Text style={s.statsRetry}>{t('Try again', 'Thử lại', '再試行')}</Text>
          </PressableScale>
        </View>
      ) : null}

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
          contentStyle={[s.twoLineRow, s.featureRowDivider]}
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
        contentStyle={s.signOutBtn}
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
        contentStyle={s.deleteBtn}
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
