// Account for a signed-in reader: Edit profile, About me, interests,
// check-ins, friends, preferences, and the account's ways out. What stood
// over them — your picture in the level's ring, your name, four counts —
// and the Activity row are on your own person page since 19 Nov 2026
// (`OwnFace`, `Counts`, `Bell`; docs/profile-home-plan.md).

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { Glyph, ICON } from '../../components/ui/glyph';
import { Card, PressableScale } from '../../components/ui';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthActions, useProfile, useSession } from '../../lib/auth';
import { useMyPreferences } from '../../lib/data';
import { useCrew } from '../../lib/crew';
import { splitFriendships } from '../../lib/friends';
import { CATEGORIES } from '../../lib/categories';
import { cleanTaste, tasteInOrder } from '../../lib/tastepick';
import { Lang, useI18n } from '../../lib/i18n';
import { useScheme } from '../../lib/theme';
import { bgElevatedHex, colors } from '../../theme';
import { type Nav } from '../../nav';
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

export function AccountProfile({ navigation }: { navigation: Nav }) {
  const { t, lang } = useI18n();
  // For the one border here that must resolve in JS — see `reqDot`.
  const { scheme } = useScheme();
  const { email, session } = useSession();
  const { profile, memberSince } = useProfile();
  const { signOut } = useAuthActions();
  const [busy, setBusy] = useState(false);
  // Read once. This page is drawn only for a session (`ProfileScreen`),
  // so the empty case is a formality the hooks' types ask for.
  const me = session?.user?.id ?? null;
  // The number on the friends card and the dot beside it. Sorted by the
  // pure half in lib/friends; the fetch itself is scoped by RLS to edges
  // this account is on.
  const { ships } = useCrew();
  const crew = useMemo(
    () => splitFriendships(ships.data, me ?? ''),
    [ships.data, me],
  );
  // Cleaned on the way in for the same reason `useBrowseTaste` cleans
  // it: the column is a bare text[] and holds words written before any
  // picker existed.
  const prefs = useMyPreferences(me);
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
    // Kept as stored, shown in the picker's order (`tasteInOrder`).
    () => tasteInOrder(cleanTaste(prefs.data.categories, Object.keys(CATEGORIES)), Object.keys(CATEGORIES)),
    [prefs.data.categories],
  );

  return (
    <>
      {/* Edit profile, by itself, at the top. Your picture, its ring and
          your name stood beside it until 19 Nov 2026; they are on your
          own person page now, the last tab's first page (`OwnFace`,
          docs/profile-home-plan.md P3), and the owner kept this button
          here, on the page of what you set. Words only: it wore a pencil
          for a while, and the owner did not care for it — a glyph beside
          two words that already say "change" was one more thing to read. */}
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
          the reference has it; only the first glyph keeps the column.

          ── two columns (owner, 18 Nov 2026) ──
          That flowed: each interest stood where the one before it ended,
          so with four chosen the second line's second name ("Culture")
          began nowhere near the first line's ("Views"), and the owner saw
          it as crooked. Two columns of equal width now, each interest at
          its column's left: the second column is a column. The faint
          rule is gone with the flow it punctuated — two columns need no
          line between them — and no rule between the rows either, which
          the reference for this had: the About card above is ruled, and
          two ruled cards in a row would make the interests one more
          table of facts.

          In the picker's order, not the order pressed (`tasteInOrder`).

          ── three to a row, the glyph over the name (owner, 18 Nov
          2026, an hour later) ──
          He saw the two columns on his phone and sent a drawing of what
          he wanted instead: thirds, centred, the glyph above its name —
          the picker's own shape, the one weighed below and not taken.
          What was said against it stands and he chose it knowing: the
          card is taller, a fourth and fifth interest make a second row
          with a gap beside it, and the first glyph leaves the About
          rows' column. What it buys is the thing he had asked for all
          along: the card reads as what was chosen on the picker.

          Weighed: the picker's own shape here, three columns with the
          glyph over the name. Twice the height, a second row of one or
          two with a hole beside it, and the first glyph off the About
          rows' column. And three columns of this shape: a third of the
          card is some 100pt, and "Thiên nhiên" with its glyph needs
          about 112. */}
      <Text style={s.section}>{t('Interests', 'Sở thích', '興味', '兴趣', '興趣')}</Text>
      <Card style={s.featureCard}>
        {taste.length ? (
          <View style={s.tasteChips}>
            {taste.map((k) => (
              <View key={k} style={s.tasteItem} testID={`interest-${k}`}>
                <Glyph name={CATEGORIES[k].icon} size={ROW_GLYPH} color={colors.textTertiary} />
                <Text style={[s.aboutValue, s.tasteName]} numberOfLines={1}>
                  {t(CATEGORIES[k].en, CATEGORIES[k].vi, CATEGORIES[k].ja, CATEGORIES[k].zh, CATEGORIES[k].hant)}
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
              '在“编辑个人资料”中添加你的兴趣。', '在「編輯個人資料」中新增你的興趣。',
            )}
          </Text>
        )}
      </Card>

      {/* Where you have been, after what you like: both are facts about
          who you are, and they read in that order — taste, then the
          evidence. Its number is a count on your own page (`Counts`;
          under this page's hero from 16 to 19 Nov 2026) and not on the
          row. A section of its
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
          count on your own page now (`Counts`), and not said twice.

          Alone in its card since 19 Nov 2026: Activity, the row under
          it, is the bell on your own page now (`person/Bell`). */}
      <Card style={s.featureCard}>
        <PressableScale
          contentStyle={s.twoLineRow}
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
          <Glyph name="chevron-forward" size={ICON.action} color={colors.textTertiary} style={s.rowEnd} />
        </PressableScale>
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
        <Glyph name="trash-outline" size={ICON.text} color={colors.bad} />
        <Text style={s.deleteText}>{t('Delete account', 'Xoá tài khoản', 'アカウントを削除', '删除账号', '刪除帳號')}</Text>
      </PressableScale>
    </>
  );
}
