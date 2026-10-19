// Profile for a guest: what an account unlocks, and the way in.

import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, fireHaptic } from '../../components/ui';
import { PrimaryButton } from '../../components/authUi';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../theme';
import { goTo, type Nav } from '../../nav';
import { FeatureRow } from './rows';
import { SettingsCard } from './SettingsCard';
import { AppCard, Tagline } from './AppCard';
import { s } from './styles';

export function GuestHub({ navigation }: { navigation: Nav }) {
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
