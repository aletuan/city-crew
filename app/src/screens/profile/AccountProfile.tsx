// Profile for a signed-in reader: who they are, their counts, About me,
// and the account's ways out.

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { Glyph } from '../../components/ui/glyph';
import { Card, fireHaptic, PressableScale } from '../../components/ui';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthActions, useProfile, useSession } from '../../lib/auth';
import { visitSummary } from '../../lib/checkin';
import { useMyTrips } from '../../lib/mytrips';
import { membersOf, useMyPreferences } from '../../lib/data';
import { useMyCheckins } from '../../lib/checkins';
import { useActivityCount } from '../../lib/useActivityCount';
import { useCrew } from '../../lib/crew';
import { splitFriendships } from '../../lib/friends';
import { useMyLists } from '../../lib/save';
import { CATEGORIES } from '../../lib/categories';
import { cleanTaste, ruleAfter } from '../../lib/tastepick';
import { Lang, useI18n } from '../../lib/i18n';
import { useScheme } from '../../lib/theme';
import { bgElevatedHex, colors } from '../../theme';
import { goTo, type Nav } from '../../nav';
import { HeroFace } from './HeroFace';
import { HeroName } from './HeroName';
import { RowGlyph, FeatureRow, AboutRow, BioRow } from './rows';
import { SettingsCard } from './SettingsCard';
import { AppCard, Tagline } from './AppCard';
import { ROW_GLYPH, TITLE_LINE, s } from './styles';

export const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function memberSinceLabel(d: Date, lang: Lang): string {
  if (lang === 'vi') return `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
  if (lang === 'ja' || lang === 'zh' || lang === 'zh-Hant') return `${d.getFullYear()}年${d.getMonth() + 1}月`;
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
        ? `${label}, ${t('loading', 'đang tải', '読み込み中', '加载中', '載入中')}`
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
  // The interests' measured tops, for the rule between them (`ruleAfter`).
  const [tasteYs, setTasteYs] = useState<(number | undefined)[]>([]);
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
  // What the level is made of — the ring is `HeroFace`'s, below.
  const trips = useMyTrips();

  // The four doors under the hero. Each is a count the reader made and a
  // tap into the place that holds it — a number on a profile earns its place
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
  //
  // Collections and Trips are tabs, and hop. Check-ins and Friends are
  // pages pushed over this one (`Visited`, `Crew`), opened as the rows
  // further down open them.
  // The four fetches behind them, for the one line that says a count
  // could not be loaded and the one press that asks again.
  const counts = [mine, visits, ships, trips];
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
        {/* The picture, its ring and the level's pill on it — `HeroFace`. */}
        <HeroFace saved={saved} />
        <View style={{ flex: 1, gap: 5 }}>
          {/* The name you are called, the role's mark after it, then the
              name you are found by — `HeroName`. */}
          <HeroName name={name} handle={profile.handle} />
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
              <Text style={s.editBtnText}>{t('Edit profile', 'Sửa hồ sơ', 'プロフィール編集', '编辑个人资料', '編輯個人資料')}</Text>
            </PressableScale>
          </View>
        </View>
      </View>

      {/* Bare numbers over a hairline, not boxed tiles: four filled boxes
          beside a title read as a second toolbar (the desk learned this in
          #634), where the number alone is the thing being read. No review
          count: there is no review feature, and a count with no data
          behind it is the one number that must not appear.

          Collections, Check-ins, Friends, Trips (owner, 16 Nov 2026). It
          was Collections, Saved places, Trips. "Saved places" went: the
          places are the ones in the collections beside it — a detail of
          that number, not a fourth thing — and it had no door of its
          own, opening the same list Collections does. The one other
          place for it, Places filtered to saved, shows one city where
          the number counts every city. The figure still sets the level
          (`saved`, below the ring); it is only not drawn.

          Check-ins and Friends took the room: each is a thing the reader
          did and each has a page that lists exactly what is counted —
          `Visited` spans every city, as its number does. They were
          numbers at the ends of their rows further down, and a figure
          said twice on one page is one of them wasted, so those rows
          keep their words and lose their pills. Four short words fit
          where three with a long one did. */}
      <View style={s.stats}>
        <StatTile n={mine.loaded ? mine.data.length : null} label={t('Collections', 'Bộ sưu tập', 'コレクション', '合集', '合集')} onPress={() => hop('Collections', 'CollectionsHome')} />
        <View style={s.statDivider} />
        {/* Distinct places, not visits: three evenings at one bar is one
            place been to — the figure the row below carried. */}
        <StatTile n={visits.loaded ? visitSummary(visits.data).places : null} label={t('Check-ins', 'Check-in', 'チェックイン', '打卡', '打卡')} onPress={() => navigation.navigate('Visited')} />
        <View style={s.statDivider} />
        <StatTile n={ships.loaded ? crew.friends.length : null} label={t('Friends', 'Bạn bè', '友達', '好友', '好友')} onPress={() => navigation.navigate('Crew')} />
        <View style={s.statDivider} />
        <StatTile n={trips.loaded ? trips.data.length : null} label={t('Trips', 'Chuyến đi', 'トリップ', '行程', '行程')} onPress={() => hop('Trips', 'TripsHome')} />
      </View>
      {/* A dash that stays a dash is a question the screen cannot answer,
          and it says so — only for a count still unknown: a fetch that
          fails over figures already on screen (a cached copy) leaves
          those standing, and they are not wrong enough to interrupt. */}
      {counts.some((c) => !c.loaded && c.error) ? (
        <View style={s.statsFailed} testID="stats-failed">
          <Text style={s.statsFailedText}>
            {t("Couldn't load your counts.", 'Không tải được số liệu.', '件数を読み込めませんでした。', '无法加载统计数据。', '無法載入統計資料。')}
          </Text>
          <PressableScale
            onPress={() => counts.forEach((c) => { if (!c.loaded) c.reload(); })}
            accessibilityRole="button"
            hitSlop={10}
          >
            <Text style={s.statsRetry}>{t('Try again', 'Thử lại', '再試行', '重试', '重試')}</Text>
          </PressableScale>
        </View>
      ) : null}

      <Text style={s.section}>{t('About me', 'Về tôi', '自己紹介', '关于我', '關於我')}</Text>
      <Card style={s.featureCard}>
        {/* What you say about yourself, before what the account knows
            about you — or, while there is nothing, the way to say it.
            See `BioRow`. */}
        <BioRow bio={profile.bio} onAdd={() => navigation.navigate('EditProfile', { focus: 'bio' })} />
        <AboutRow
          icon="mail-outline"
          label={t('Email', 'Email', 'メール', '邮箱', '電子郵件')}
          value={email ?? ''}
          valueTestID="profile-email"
        />
        {/* "City", not "Hometown" (owner, 29 Oct 2026). The field asks
            where you are — its placeholder is the city you have chosen —
            and "Quê quán" reads as where your family is from, which for
            most people in a big city is somewhere else. */}
        {profile.location ? (
          <AboutRow
            icon="location-outline"
            label={t('City', 'Thành phố', '都市', '城市', '城市')}
            value={profile.location}
            last={!memberSince}
          />
        ) : null}
        {memberSince ? (
          <AboutRow
            icon="calendar-outline"
            label={t('Member since', 'Thành viên từ', '登録日', '加入时间', '加入時間')}
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
          to the same place on one screen is one too many.

          ── on the facts card's column (owner, 3 Nov 2026) ──
          The chips sat on their own grid: a 15pt glyph 14pt into a faint
          glass pill, so the first one stood left of the column the
          envelope, the pin and the calendar make in the card above, and
          the pills read as smudges on the white card. Each interest is now
          a bare 19pt glyph — the About rows' size, in their tertiary ink —
          and its name 8pt after it, the first glyph centred on that column.
          Not the category's hue: one column in two colours read as two
          kinds of thing, and Search and Explore draw the same glyphs
          neutral, keeping colour for a choice.

          A day in between, each glyph took the About rows' whole 44pt slot
          and its name started at the value column, 26.5pt off: in a row of
          names that read as a gap, and the glyph as nobody's (owner, the
          same day). The name sits by its glyph now, as on the reference,
          and a faint rule stands between two interests on one line, as
          the reference has it; only the first glyph keeps the column. */}
      <Text style={s.section}>{t('Interests', 'Sở thích', '興味', '兴趣', '興趣')}</Text>
      <Card style={s.featureCard}>
        {taste.length ? (
          <View style={s.tasteChips}>
            {taste.map((k, i) => (
              <View
                key={k}
                style={s.tasteItem}
                testID={`interest-${k}`}
                onLayout={(e) => {
                  const y = Math.round(e.nativeEvent.layout.y);
                  setTasteYs((ys) => (ys[i] === y ? ys : Object.assign([...ys], { [i]: y })));
                }}
              >
                <Glyph name={CATEGORIES[k].icon} size={ROW_GLYPH} color={colors.textTertiary} />
                <Text style={s.aboutValue}>
                  {t(CATEGORIES[k].en, CATEGORIES[k].vi, CATEGORIES[k].ja, CATEGORIES[k].zh, CATEGORIES[k].hant)}
                </Text>
                {/* The faint rule between two interests on one line
                    (owner, 3 Nov 2026), part of the interest before it so
                    the room it takes never moves; see `ruleAfter`. */}
                {i < taste.length - 1 ? (
                  <View
                    style={[s.tasteRule, !ruleAfter(tasteYs, i, taste.length) && s.tasteRuleOff]}
                    testID="interest-rule"
                  />
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text style={[s.aboutValue, s.tasteEmpty]}>
            {t(
              'Edit profile to add your interests.',
              'Sửa hồ sơ để cập nhật sở thích của bạn.',
              '「プロフィール編集」で興味を追加できます。',
              '在“编辑个人资料”中添加你的兴趣。', '在「編輯個人資料」中新增你的興趣。',
            )}
          </Text>
        )}
      </Card>

      {/* Where you have been, after what you like: both are facts about
          who you are, and they read in that order — taste, then the
          evidence. Its number is a stat tile under the hero since 16 Nov
          2026 and not on the row. A section of its
          own rather than a row in Interests, because the chips there are
          a picker at rest and a navigation row under a picker is two
          kinds of thing in one card. */}
      <Text style={s.section}>{t('Check-ins', 'Check-in', 'チェックイン', '打卡', '打卡')}</Text>
      <Card style={s.featureCard}>
        <FeatureRow
          icon="location-outline"
          title={t('Places you checked in at', 'Địa điểm check-in', 'チェックインした場所', '你打过卡的地点', '你打過卡的地點')}
          sub={t("A record of the places you've been.", 'Ghi lại những nơi bạn đã đi qua.', '訪れた場所の記録。', '你去过的地方的记录。', '你去過的地方的記錄。')}
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
      <Text style={s.section}>{t('Friends', 'Bạn bè', '友達', '好友', '好友')}</Text>
      {/* The pill said "Coming soon" from the day this screen shipped;
          the row opens the crew now. The dot is requests. The number of
          friends was a pill at the row's end until 16 Nov 2026; it is a
          stat tile under the hero now, and not said twice. */}
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
            <Text style={s.featureTitle}>{t('Connect with friends', 'Kết nối bạn bè', '友達とつながる', '与好友联系', '與好友聯絡')}</Text>
            <Text style={s.featureSub}>
              {t('Make friends and plan together.', 'Kết bạn để cùng lên kế hoạch.', '友達になって、一緒に計画。', '结交好友，一起规划。', '結交好友，一起規劃。')}
            </Text>
          </View>
          <Glyph name="chevron-forward" size={17} color={colors.textTertiary} style={s.rowEnd} />
        </PressableScale>
        {/* The door to Activity, re-hung. The feed's one entry used to be
            the "N requests waiting" banner on Crew, and when Crew grew a
            Requests tab (#309, 23 Aug 2026) the banner came down with the
            requests it pointed at — nobody meant to close the feed, but
            the applause on your lists was left behind a route nothing
            navigated to, for six weeks.

            Under the friends row rather than a bell in the header: who
            liked or copied your collections is this section's subject,
            and a header bell would be the one control on the screen
            outside a card. Since 28 Oct 2026 the screen is a log of your
            own acts too (the owner's subtitle); the count is still news
            only, what others did. Requests are not counted here any more: they
            left Activity on 20 Oct 2026 and are the dot on the friends row
            above, so one request is one mark on this screen, not two. */}
        <FeatureRow
          icon="notifications-outline"
          title={t('Activity', 'Hoạt động', 'アクティビティ', '动态', '動態')}
          count={feed}
          sub={t('A log of your activity on City Crew.', 'Nhật ký hoạt động trên hệ thống.', 'City Crew でのあなたのアクティビティの記録。', '你在 City Crew 上的动态记录。', '你在 City Crew 上的動態記錄。')}
          onPress={() => navigation.navigate('Activity')}
          last
        />
      </Card>

      {/* Named the way About me and Friends are, so this screen reads
          as sections rather than a stray card between them. The guest
          view uses the same heading over the same card. */}
      <Text style={s.section}>{t('Preferences', 'Tuỳ chọn', '設定', '偏好设置', '偏好設定')}</Text>
      <SettingsCard />

      {/* Last section, and last on purpose. The order this screen reads
          in — who you are, who you go with, how the app behaves — ends on
          the things that are true whether you read them or not, and then
          the way out. Under Preferences the documents were filed as
          settings by position while being drawn as not-settings; a
          heading of their own costs one line and stops the screen arguing
          with itself. */}
      <Text style={s.section}>{t('App', 'Ứng dụng', 'アプリ', '应用', 'App')}</Text>
      <AppCard />

      <PressableScale
        contentStyle={s.signOutBtn}
        accessibilityRole="button"
        // The label stays while the spinner stands in for the word, so the
        // control keeps its name for a screen reader mid-request.
        accessibilityLabel={t('Sign out', 'Đăng xuất', 'サインアウト', '退出登录', '登出')}
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
              t('Could not sign out', 'Không đăng xuất được', 'サインアウトできませんでした', '无法退出登录', '無法登出'),
              (e as Error).message,
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? <ActivityIndicator color={colors.textSecondary} />
          : <Text style={s.signOutText}>{t('Sign out', 'Đăng xuất', 'サインアウト', '退出登录', '登出')}</Text>}
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
        <Glyph name="trash-outline" size={15} color={colors.bad} />
        <Text style={s.deleteText}>{t('Delete account', 'Xoá tài khoản', 'アカウントを削除', '删除账号', '刪除帳號')}</Text>
      </PressableScale>
    </>
  );
}
