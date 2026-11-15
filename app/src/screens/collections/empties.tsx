import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Glyph } from '../../components/ui/glyph';
import { GradientCta, PressableScale } from '../../components/ui';
import { holdResume } from '../../lib/resume';
import { useSession } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { accentFade, colors, gradAI } from '../../theme';
import type { Nav } from '../../nav';
import { s } from './styles';

// The card sells signing in, so it leads with what you get rather than with
// what you are: "browsing as a guest" names a limitation and leaves the
// reader to work out the offer for themselves.
//
// The whole card is the target and the chip inside it is drawn, not pressed —
// a Pressable nested inside a Pressable gives one action two overlapping hit
// areas and two stops in VoiceOver, for no gain.
//
// Sign-in lives in the Profile tab's stack, not this one, so the jump goes
// through the tab navigator above us.
//
// ── one row, since 17 Oct 2026 ──
//
// It was a card of its own: a 40pt icon well beside a title and two lines
// of body, the button on a third row under them — about 150pt, which put
// the first row of lists at 380pt on a 430pt-wide phone. A guest's first
// screen was half invitation and half shelf. The owner chose a compact
// banner (the "after the first row" alternative was turned down: a card
// inside the photo grid reads as an ad, needs its own rule for the list
// view, a search and an empty shelf, and on a 667pt-tall phone falls
// below the fold, where a guest may never see it).
//
// Words and button on one row now, and the icon well gone. Measured
// before it went: with a 32pt well and the button, the text column on a
// 375–393pt phone is about 140pt, and the title at this size needs 155.
// The words say "collection", and the tab below is lit, so the glyph was
// the one thing on the card saying nothing new. The text may still wrap
// on the narrowest phones rather than end in an ellipsis: a cut-off
// invitation is worse than a line taller one.
//
// The line under the title is about collections, not places (owner, same
// day): "save and sort places" described the bookmark, and the card
// beside a shelf of lists invites a list. It said so in full first —
// "…bộ sưu tập riêng của bạn" — which repeated the title and took two
// full lines on a 430pt phone; the owner, seeing it there, cut it to
// the verbs. The title already names the thing they act on.
export function GuestNotice({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { session } = useSession();
  if (session) return null;
  return (
    <PressableScale
      style={s.noticeWrap}
      contentStyle={s.notice}
      onPress={() => {
        holdResume({
          tab: 'Collections', kind: 'collection', at: Date.now(),
          run: () => navigation.navigate('CollectionForm'),
        });
        navigation.getParent()?.navigate('Profile', { screen: 'SignIn', initial: false });
      }}
      accessibilityRole="button"
      accessibilityLabel={t(
        'Sign in to build your own collections',
        'Đăng nhập để tạo bộ sưu tập của riêng bạn',
        'サインインして自分のコレクションを作る',
        '登录后即可创建自己的合集', '登入後即可建立自己的合集',
      )}
    >
      <View style={s.noticeCopy}>
        <Text style={s.noticeTitle}>
          {t('Start a collection', 'Tạo bộ sưu tập riêng', 'コレクションを作る', '创建合集', '建立合集')}
        </Text>
        <Text style={s.noticeBody}>
          {t(
            'Sign in to create and sort.',
            'Đăng nhập để tạo và sắp xếp.',
            'サインインして作成・整理。',
            '登录后可创建和整理。', '登入後可建立和整理。',
          )}
        </Text>
      </View>
      {/* A rounded rectangle at chip scale, the sheet's primary button
          scaled down. Sized to its label rather than stretched: the card is
          already the target, so this names the action — it does not need to
          be the loudest object on the screen. At the row's end now, centred
          on the two lines beside it. */}
      <LinearGradient {...gradAI} style={s.noticeChip}>
        <Text style={s.noticeChipText}>{t('Sign in', 'Đăng nhập', 'サインイン', '登录', '登入')}</Text>
        <Glyph name="arrow-forward" size={15} color={colors.accentInk} />
      </LinearGradient>
    </PressableScale>
  );
}

/**
 * The cover slot of a list that has nothing in it yet.
 *
 * A flat grey square reads as a photo that failed to load — the eye has
 * seen too many broken images to read it any other way. A warm tinted well
 * with the tab's own glyph reads as a slot waiting to be filled, which is
 * what it is.
 */
export function EmptyCover() {
  return (
    <LinearGradient
      colors={[colors.accentSoft, accentFade]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.thumbFill, s.thumbEmpty]}
    >
      <Glyph name="bookmark-outline" size={26} color={colors.accentFaint} />
    </LinearGradient>
  );
}

/**
 * Signed in, nothing made yet. This is the one state with room to explain
 * what a collection is and why anyone would want one, so it takes the
 * whole card. The header's "New" pill stays above it (owner, 26 Oct
 * 2026): see the note on the pill.
 *
 * It mirrors the guest card one section up — same tinted well, same
 * gradient action — because they are the same argument aimed at two
 * states: sign in to make lists, and now make one.
 */
export function FirstCollection({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <View style={s.firstWrap}>
      <View style={s.first}>
        <View style={s.firstIcon}>
          <Glyph name="bookmark" size={27} color={colors.accent} />
        </View>
        <Text style={s.firstTitle}>
          {t('No collections yet', 'Chưa có bộ sưu tập nào', 'コレクションはまだありません', '还没有合集', '還沒有合集')}
        </Text>
        {/* The owner's words (25 Oct 2026), with the app's own category
            names in place of "cafe, ăn uống, cảnh vật hay địa điểm": it
            says what a list is for — sharing, and planning a day from it,
            both of which the app does — where it used to give occasions. */}
        <Text style={s.firstBody}>
          {t(
            'Group the places you love into lists by theme — cafés, eats, views. Share them, or use one to plan a day worth having.',
            'Nhóm địa điểm yêu thích thành bộ sưu tập theo chủ đề — cà phê, ăn uống, ngắm cảnh. Chia sẻ, hoặc dùng để lên kế hoạch cho một ngày ý nghĩa.',
            'お気に入りのスポットをテーマ別にリストにまとめましょう — カフェ、食事、景色。シェアしたり、特別な一日のプランに使ったり。',
            '把喜欢的地点按主题整理成清单 — 咖啡、美食、风景。分享出去，或用来规划有意义的一天。', '把喜歡的地點按主題整理成清單 — 咖啡、美食、風景。分享出去，或用來規劃有意義的一天。',
          )}
        </Text>
        {/* A pill here, where the sheet's primary is a rounded rectangle:
            that one runs the full width, where end caps as tall as the
            button read as a lozenge. This one is sized to its label, which
            is exactly where a pill belongs. */}
        <GradientCta
          icon="add"
          label={t('Create your first collection', 'Tạo bộ sưu tập đầu tiên', '最初のコレクションを作る', '创建你的第一个合集', '建立你的第一個合集')}
          onPress={onPress}
        />
        {/* Private by default, said so that it does not contradict the
            "share" above it: it read "Only you can see your lists." */}
        <Text style={s.firstFoot}>
          {t('Only you can see them until you choose to share.', 'Mặc định chỉ mình bạn thấy — chia sẻ khi bạn muốn.', '共有するまで、あなただけに表示されます。', '默认仅你可见 — 想分享时再分享。', '預設僅你可見 — 想分享時再分享。')}
        </Text>
      </View>
    </View>
  );
}

/**
 * The community shelf, before anybody has stocked it.
 *
 * It used to say "Nothing from the community yet." and stop there, which
 * is a dead end in the one place a dead end costs most: a city the desk
 * has just opened has no public lists at all, and the morning this was
 * written the owner read that honest emptiness as data loss. Emptiness
 * here is a state, not a fault, and the sentence that
 * says so can also hand the reader the way to end it — the same shape
 * `FirstCollection` uses one section up.
 *
 * It named the city while the shelf was scoped to one. The shelf shows
 * every city now, so empty means empty everywhere, and says so plainly.
 */
export function CommunityEmpty({ signedIn, onCreate, onExplore }: {
  signedIn: boolean;
  onCreate: () => void;
  onExplore: () => void;
}) {
  const { t } = useI18n();
  return (
    <View style={s.firstWrap}>
      <View style={s.first}>
        <View style={s.firstIcon}>
          <Glyph name="globe" size={27} color={colors.accent} />
        </View>
        <Text style={s.firstTitle}>
          {t('No public lists yet', 'Chưa có bộ sưu tập công khai nào', 'まだ公開コレクションはありません', '还没有公开的清单', '還沒有公開的清單')}
        </Text>
        {/* True now that a curator's own public list is on this shelf; it
            promised the same thing while the shelf filtered them out. */}
        <Text style={s.firstBody}>
          {t(
            'Yours can be the first — make a list, set it to Public, and it shows up here for everyone.',
            'Bộ sưu tập của bạn có thể là đầu tiên — tạo một bộ sưu tập và đặt Công khai, nó sẽ hiện ở đây cho mọi người.',
            '最初の一つはあなたかも — リストを作って「公開」にすると、ここにみんなの目に並びます。',
            '你的可以成为第一个 — 创建清单并设为公开，所有人都能在这里看到。', '你的可以成為第一個 — 建立清單並設為公開，所有人都能在這裡看到。',
          )}
        </Text>
        {/* Signed out, "make a list" is not yet an offer this reader can
            take, so the button points at the shelf that is already full. */}
        {signedIn
          ? (
            <GradientCta
              icon="add"
              label={t('Create a collection', 'Tạo bộ sưu tập', 'コレクションを作る', '创建合集', '建立合集')}
              onPress={onCreate}
            />
          )
          : (
            <GradientCta
              icon="compass"
              label={t('Explore places', 'Khám phá địa điểm', 'スポットを見る', '探索地点', '探索地點')}
              onPress={onExplore}
            />
          )}
      </View>
    </View>
  );
}
