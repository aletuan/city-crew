// Profile for a guest: what an account unlocks, and the way in.

import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, fireHaptic } from '../../components/ui';
import { PrimaryButton } from '../../components/authUi';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../theme';
import type { Nav } from '../../nav';
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
          <Text style={s.heroTitle}>{t('Keep the places you love', 'Lưu lại những nơi bạn yêu thích', 'お気に入りの場所を残しておく', '留住你喜欢的地点', '留住你喜歡的地點')}</Text>
          <Text style={s.heroBody}>
            {t(
              'Sign in to save places, build collections, and plan your trips',
              'Đăng nhập để lưu địa điểm, tạo bộ sưu tập và lên kế hoạch cho những chuyến đi',
              'サインインして、場所を保存し、コレクションを作り、旅を計画しましょう',
              '登录后即可保存地点、创建合集、规划行程', '登入後即可儲存地點、建立合集、規劃行程',
            )}
          </Text>
        </View>
      </View>
      {/* One button, one link, two doors (owner, 20 Oct 2026). The
          button was "Sign in / Sign up" and led to Sign in, so somebody
          new read a slash, tapped, and still had to find "Don't have an
          account?" on the next screen. Now the button says the one thing
          it does, and the line under it opens Sign up straight away.

          That line used to be "Keep exploring", which led to Explore —
          one tap from the tab bar under it on every screen, so the place
          it held is worth more as the way in for somebody new. Rejected:
          two buttons side by side. Filled and outlined in one capsule they
          read as a switch between tabs, not as two actions. */}
      <PrimaryButton label={t('Sign in', 'Đăng nhập', 'サインイン', '登录', '登入')} onPress={goSignIn} testID="profile-sign-in" />
      <Pressable
        style={s.guestLink}
        accessibilityRole="button"
        testID="profile-sign-up"
        onPress={() => {
          fireHaptic('selection');
          navigation.navigate('SignUp');
        }}
      >
        <Text style={s.guestLinkText}>{t('Create a new account', 'Tạo tài khoản mới', '新しいアカウントを作成', '创建新账号', '建立新帳號')}</Text>
        <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
      </Pressable>

      {/* Headed like the member view's sections, and the same headings
          where the card is the same card. This view used to carry no
          headings at all, on the argument that one heading among bare
          cards would be the odd one out. That held for one screen read
          alone. Read beside the member view, which is how anyone who signs
          in meets it, the same Preferences card with a heading on one side
          and none on the other was the odd one out. */}
      <Text style={s.section}>{t('With an account', 'Khi có tài khoản', 'アカウントでできること', '有了账号，你可以', '有了帳號，你可以')}</Text>
      <Card style={s.featureCard}>
        <FeatureRow
          icon="bookmark-outline"
          title={t('Saved places', 'Địa điểm đã lưu', '保存した場所', '已保存的地点', '已儲存的地點')}
          sub={t('Sign in to save your favorite places.', 'Đăng nhập để lưu địa điểm yêu thích.', 'サインインしてお気に入りを保存。', '登录后保存你喜欢的地点。', '登入後儲存你喜歡的地點。')}
          onPress={goSignIn}
        />
        <FeatureRow
          icon="folder-open-outline"
          title={t('Collections', 'Bộ sưu tập', 'コレクション', '合集', '合集')}
          sub={t('Create and organize your collections.', 'Tạo và sắp xếp bộ sưu tập của riêng bạn.', '自分のコレクションを作成・整理。', '创建和整理你的合集。', '建立和整理你的合集。')}
          onPress={goSignIn}
        />
        <FeatureRow
          icon="calendar-outline"
          title={t('Trips', 'Chuyến đi', '旅程', '行程', '行程')}
          sub={t('Plan trips and invite your friends.', 'Lên kế hoạch và mời bạn bè cùng đi.', '旅を計画して友達を招待。', '规划行程并邀请好友。', '規劃行程並邀請好友。')}
          onPress={goSignIn}
        />
        {/* A fourth row here rather than a card of its own at the foot of
            the screen, where it sat after the documents: it is one more
            thing an account opens, and a locked row like the three above
            it. The tap leads to signing in, which is where friends begin. */}
        <FeatureRow
          icon="people-outline"
          title={t('Connect with friends', 'Kết nối bạn bè', '友達とつながる', '与好友联系', '與好友聯絡')}
          sub={t('Find friends and share unforgettable trips.', 'Tìm kiếm bạn bè và chia sẻ những chuyến đi đáng nhớ.', '友達を探して、忘れられない旅を共有。', '寻找好友，分享难忘的旅行。', '尋找好友，分享難忘的旅行。')}
          onPress={goSignIn}
          last
        />
      </Card>

      <Text style={s.section}>{t('Preferences', 'Tuỳ chọn', '設定', '偏好设置', '偏好設定')}</Text>
      <SettingsCard />
      {/* The documents matter most to exactly this reader, the one who
          has not signed up yet. */}
      <Text style={s.section}>{t('App', 'Ứng dụng', 'アプリ', '应用', 'App')}</Text>
      <AppCard />

      <Tagline />
    </>
  );
}
