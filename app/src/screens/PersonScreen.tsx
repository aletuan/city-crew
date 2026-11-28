// A person's page — opened by pressing their face.
//
// ── what it is, and what it is the first step of (owner, 16 Nov 2026) ──
//
// The owner wants a page per person that grows the way a social profile
// does, with places at the middle of it: the lists someone publishes,
// then the photographs they add, where they have been, a moment at a
// table. This is the first step and it is deliberately the cheapest one:
// **only what was already public**. The profile, which the policy has
// always said other users can see (`lib/legal`), and the lists a person
// published. No table, no migration, no change to the policy — and so
// nothing here that a later step has to take back.
//
// What a later step adds, and what each costs, was written down before
// this one was built:
//
//   - photographs they contributed — naming the contributor is a change
//     to what the policy says;
//   - check-ins — a person's movements; needs a decision on who may see
//     them, most likely an opt-in, and the policy;
//   - moments — a new kind of content, with storage, reporting and a desk
//     to review it.
//
// One thing has been added to "only what was already public" since
// (owner, 17 Nov 2026): what this reader could already open. Your own
// page holds all your lists, and a friend's the ones they shared with
// you, each marked for who sees it — `usePageLists`. Still no table, no
// migration and no change to the policy, which already says a private
// collection is shown to its owner and to the friends it is shared with.
//
// So the body is built as sections stacked under a head, and a later
// step is a section added, not a page drawn again: "Collections" was the
// first, and "In common" (`InCommon`, 16 Nov 2026) the second, above it —
// built, and switched off the same day (`IN_COMMON_ON`).
//
// No count line. "11 collections" stood between the head and the
// sections until 16 Nov 2026, when the owner found it not needed: the
// collections are right under it, to be seen rather than counted.
//
// ── the head ──
//
// A cover across the top and the face overlapping its lower edge, as the
// owner asked. Until 21 Nov 2026 the page chose the cover — the newest
// public list's, else the city's — and on the owner's phone that put the
// same pastries twice, the cover over the first card. Now the owner
// chooses it, from a city, a collection's cover or one upload, and the
// page's own choice is kept as *automatic* for everyone who never does,
// skipping the first list for that reason: `person/Wall`, `lib/wall` and
// docs/wall-plan.md. The tint is left for a page with no photograph at
// all.
//
// Under the app's ordinary header, as a card, and not bled to the top of
// the screen behind floating buttons as the sketch drew it. `Screen`
// owns the safe area and the back control on every pushed page; a second
// way of doing both, for one screen, is more than a first step should
// carry. Rejected for now, not for good.
//
// The name beside the picture, then the handle under them with its
// `@`, quieter; then the bio, when they wrote one (owner, 16 Nov 2026).
//
// Name first here, though every row of people leads with the handle
// (15 Nov): the owner's exception, and the one their own Profile
// already makes — a page about one person is headed as that person's
// Profile is, "Tuan Anh" over "@tuananh". A row names somebody among
// many, where the handle is what tells two people apart.
//
// Beside the picture, not under it. The handle, the name and the count
// stood in three lines under the face with the width beside it empty,
// and the collections began a quarter of a screen lower for it.
//
// The handle right under the name, both beside the picture. For an
// evening the handle ran under the whole row instead, at the page's
// left edge: a second line beside the picture had been ruled out when
// that line was "name · 11 collections", too long for the room. With
// the count gone the line is a handle, which is short — and under the
// row it sat a picture's width to the left of the name it belongs to,
// which the owner read, rightly, as out of line.
//
// Somebody with no name is headed by their handle, `@` and all, and
// has no second line.
//
// ── the picture hangs lower, and the bio speaks from it (owner, 17 Nov
// 2026) ──
//
// The owner's reference for the head: the bio as a speech bubble under
// the handle, beside the picture, its tail reaching back to the face.
// The picture stood half over the cover until then, and the name and
// handle filled exactly the half under it, so anything a third line said
// began below the picture's foot and beside nothing. Now a little over a
// quarter of the picture was on the cover, the name starts just under
// the cover's edge, and the bubble's first line stood level with the
// picture's foot — where a tail can point at the face. Half again for an
// hour on 22 Nov 2026, and back.
//
// ── the head on the photograph (owner, 28 Nov 2026) ──
//
// All of it since: the picture whole on the cover, the name, the handle
// and the bio beside it in the photograph's ink, the counts under them,
// and the page a sheet risen over the cover's foot — the owner's
// reference, and the way Explore's cover already carries its words. The
// bubble went with it. `COVER_UNDER_CLOCK` has the measurements.
//
// ── the friend button ──
//
// The one a list's activity page draws (`useFriendButtons`), by the same
// rule (`rowButton`): nothing for yourself or across a block, Add friend,
// Accept, or the quiet word for what stands. In a row of its own under
// the head, beside a Message that is not built yet (`Acts`), and again,
// small, in the header once that row has scrolled away (`usePastRow`).
// A block is not otherwise
// read here: the lists on this page are public, and a block is a contact
// policy, not a content filter — the policy's own words.
//
// ── the ⋯ (16 Nov 2026) ──
//
// Report, block, and taking a block back: `usePersonMenu`, where the
// reasoning is. It came with the second door to this page — a press on
// the author's face at the head of a list — whose sheet used to hold
// the block.
//
// ── what was not measured ──
//
// Whether anybody presses a face. That is the question this step exists
// to answer, and nothing in it counts the press: the production build
// sends no usage analytics (`lib/legal`), so the answer will come from
// asking people.
import { PencilGlyph } from '../components/PencilGlyph';
import React, { useEffect, useRef, useState } from 'react';
import { useScrollToTop } from '@react-navigation/native';
import {
  Animated, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Avatar, EmptyState, GradientCta, PressableScale, Screen, Skeleton, useTabBarClearance,
} from '../components/ui';
import { INK_GAP_END, PHOTO_DISC } from '../components/ui/controls';
import { Glyph, ICON } from '../components/ui/glyph';
import { useFriendButtons } from '../components/FriendButton';
import { usePullControl } from '../lib/usePull';
import { useFreshNews } from '../lib/freshNews';
import { useInvitations } from '../lib/invitations';
import InCommon from '../components/InCommon';
import { usePersonMenu } from '../components/PersonMenu';
import PersonRole from '../components/RoleBadge';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { useProfile, useSession } from '../lib/auth';
import { useVisitCards } from './person/CheckinAct';
import Shared, { useReach } from './person/Shared';
import { Requests } from './person/Requests';
import { FindField, usePageFind } from './person/Find';
import { OwnTools, Search } from './person/Tools';
import { useWall } from './person/Wall';
import { BAR_H, CoverBar, fadeUnderBar, scrimOver, useHeadFade, usePastCover } from './person/Bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCardCopy } from './person/useCardCopy';
import { OwnFace, useOwnPicture } from './person/OwnFace';
import { Counts } from './profile/Counts';
import { useCollections, usePlaces } from '../lib/catalog';
import { useTourAnchor } from '../components/SignupTour';
import {
  type Collection, coverUriOf, type FriendProfile, membersOf, useMyListShares, useProfileByHandle, useSharedWithMe,
} from '../lib/data';
import { atHandle, normalizeHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { IN_COMMON_ON, listsBy, listsOn, seenOn, TOP_FRIEND_ON } from '../lib/person';
import { useMyLists } from '../lib/save';
import { sharesByList } from '../lib/shares';
import { colors, display, font, onPhoto, photoSheet, space, type } from '../theme';
import { toProfileRoom, type Nav, type RootRoute } from '../nav';

/** The face: 72, everyone's and your own (owner's recording, 28 Nov
 *  2026: "is the avatar too big?"). Measured on it, your own stood 103
 *  across with its ring — 24% of a 430pt screen, and taller than the
 *  name, handle and bio beside it together (about 69), so the eye went
 *  to the picture before the name. 72 is 82 across in the level's ring
 *  (`EngagementRing`, `onPhoto`) and 76 in everyone else's ring of 2.
 *
 *  It was 80 in a ring of page 4 wide, and your own 88 bare in the
 *  level's ring (19 Nov 2026) — on the page, under the cover. The
 *  Account page's picture is still 88 in the page's ring
 *  (`profile/Hero`); that one stands on the page. */
const FACE = 72;
/** Everyone else's ring: 2 of the photograph's light ink. It was 4 of
 *  the page, which on the cover is a band of cream. */
const FACE_RING = 2;
/** The cover before its photograph: the scrim's own ink, opaque. The
 *  bar's light glyphs and the clock stand on it as they will on the
 *  picture; on the page's cream they would be gone. */
const COVER_HOLD = '#1C1D1C';
/** The cover's height under the clock, running to the screen's edges:
 *  272, so with a 59pt clock the photograph is 331 and, the page's sheet
 *  risen 18 over its foot, about 313 of it shows — three quarters of
 *  Explore's cover on a 932pt phone (447).
 *
 *  It was 232 for a morning (28 Nov 2026), sized to hold the head and no
 *  more: on the owner's recording the bar ended 109 down and the face
 *  began at 107, so not a point of the photograph was free of something
 *  drawn on it, and it read as a header's ground. The 40 are the band of
 *  picture between the bar and the head, where the camera stands. Not
 *  more: on a 667pt phone this is already 44% of the screen (computed,
 *  not seen on one), and this page is a list to read.
 *
 *  It was 200 (22 Nov 2026) with the face a quarter over its foot and the
 *  name, the bio and the counts on the page under it: measured on the
 *  owner's screenshot the head ended 391pt down, and the first card began
 *  there. With the head on the photograph it ends where the cover does. */
const COVER_UNDER_CLOCK = 272;
/** The page's sheet over the cover's foot: `photoSheet`, Explore's too. */
const SHEET_RISE = photoSheet.rise;
const SHEET_ROUND = photoSheet.round;
/** The camera and the trial's label stand this far under the clock: the
 *  bar, and 4 clear of its glass. It was 8; the 4 are the camera's
 *  distance from the name's line when a bio runs to two lines. */
const UNDER_BAR = BAR_H + 4;
/** The camera's distance from the screen's edge: its middle under the
 *  middle of the settings glyph over it. That control is a 44 box hung
 *  past the page's margin by its glyph's empty edge (`INK_GAP_END`), so
 *  its middle is `page − gap + 22` in; the camera's 36 puts its own
 *  there from 4 less. On the recording of 28 Nov it stood at the margin
 *  itself, its middle 9 left of the gear's. */
const CAMERA_RIGHT = space.page - INK_GAP_END['settings-outline'] + (44 - PHOTO_DISC) / 2;
/** What the name's line keeps clear at its end on your own page: as far
 *  as the camera reaches in from the page's margin, and 8. With a bio of
 *  three lines the names' column is taller than the face, and the name's
 *  line rises into the camera's height — on the first recording of 28
 *  Nov the camera sat on the role's mark. */
const CAMERA_RESERVE = CAMERA_RIGHT + PHOTO_DISC - space.page + 8;
/**
 * The scrim the head's words stand on, from the bar's foot to the
 * cover's: clear at its top, 54% a fifth of the way down — where the
 * head begins — and 66% at the cover's foot.
 *
 * White on a photograph clears 4.5:1 once the photograph's own luminance
 * is under 0.18, which a pure white one reaches under 54% of this ink (by
 * the contrast formula, not measured on a phone).
 *
 * Until the owner's recording of 28 Nov 2026 it began 30% down the cover
 * and reached 50% at 45% of its run. Worked out against that recording,
 * the name stood where it was about 16% and the handle a little more: on
 * a bright river "@trang" was nearly gone. The words carry a soft shadow
 * as well (`ON_PHOTO_SHADOW`), for the letter on one bright spot.
 */
const FOOT_SCRIM = ['rgba(10,11,10,0)', 'rgba(10,11,10,0.54)', 'rgba(10,11,10,0.66)'] as const;
const ON_PHOTO_SHADOW = { textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 } as const;
/** How far the name shrinks to stay on its line beside the picture
 *  before it is cut: 22 to about 17, still the largest words on the
 *  page. */
const TITLE_SHRINK = 0.78;
/** The name's line, which the role's mark after it is centred on. */
const TITLE_LINE = 28;
/** The invitation's one 20pt line, grown to the 44 a thumb is owed. */
const BIO_ADD_SLOP = { top: 12, bottom: 12 };

/** The face at the head, on the cover's photograph: everyone's in a thin
 *  ring of its light ink; yours bare, in the level's ring dressed for a
 *  photograph (`OwnFace`, `EngagementRing`). Out of the screen for its
 *  ceiling. */
function Face({ own, url }: { own: boolean; url: string | null | undefined }) {
  // Yours is the picker itself, which draws your own picture (`OwnFace`).
  if (own) return <OwnFace size={FACE} />;
  return (
    <View style={s.faceRing}>
      <Avatar url={url || null} size={FACE} />
    </View>
  );
}

/** The tools' own row on the tab's first page, before the cover's bar
 *  can hold them — see the note where it is drawn. */
function HomeTools({ on, children }: { on: boolean; children: React.ReactNode }) {
  if (!on) return null;
  return <View style={s.homeTools} testID="person-home-tools">{children}</View>;
}

export default function PersonScreen({ navigation, route, home }: {
  navigation: Nav;
  route: RootRoute<'Person'>;
  /**
   * Drawn as the last tab's first page, your own (owner, 19 Nov 2026 —
   * docs/profile-home-plan.md): no way back, since there is nothing
   * under it, and no title, since the tab says whose page it is and the
   * owner found the line over the cover not needed.
   *
   * That is all it changes. What only you see — the counts and the
   * requests waiting — is on your own page wherever it opens (owner,
   * 19 Nov 2026: one page of you, not two). For one evening it was on
   * the tab's first page alone, handed in from `MeScreen`, because the
   * rooms its doors open are only in the last tab's stack; the doors go
   * through `toProfileRoom` now, which changes tab when it has to.
   */
  home?: boolean;
}) {
  const { t } = useI18n();
  const { session } = useSession();
  const me = session?.user?.id ?? null;
  const handle = normalizeHandle(route.params.handle);
  const who = useProfileByHandle(handle || null);
  // Your own picture as your profile has it now — `useOwnPicture`.
  const person = useOwnPicture(who.data, me);

  const places = usePlaces();
  // What of theirs this reader may see, and what everybody may —
  // `usePageLists`. The cover is asked of the second.
  const { lists, open, seenOf } = usePageLists(me, person?.id);
  const coverFor = (c: Collection) => coverUriOf(c, membersOf(c, places.data));

  const { friendButton, crew } = useFriendButtons(me, 'person', 'photo');
  // Report, block, unblock — `usePersonMenu`.
  const menu = usePersonMenu(me, person, crew);

  const personId = person?.id ?? null;
  const friend = friendButton(personId);
  // Your own page, come back to from the form its "Write a few words about you" opens:
  // read again — `useReloadOnReturn`.
  const own = !!me && personId === me;
  useReloadOnReturn(navigation, own, who.reload);
  // The cover: as its owner chose it, and on your own page the sheet
  // that changes it — `person/Wall`.
  const wall = useWall({ person, own, open, coverFor, places: places.data, reload: who.reload });
  const { news, log } = useFreshNews();
  const { invites } = useInvitations();
  // Their visits, as cards among the lists — `person/CheckinAct`.
  const seen = useVisitCards({ me, person, onPlace: (slug) => navigation.navigate('PlaceDetail', { slug }) });
  const refresh = usePullControl(own ? [who, crew.ships, crew.blocks, news, log, invites, seen.read] : [who, crew.ships, seen.read]);
  // The same button, small, for the header once the row has scrolled
  // away — a thing to do only (`actsOnly`): a fact is not worth the
  // header's room. Switched off for now: `TOP_FRIEND_ON`.
  const top = usePastRow(useDuckOnScroll());
  const topFriend = TOP_FRIEND_ON && top.past ? friendButton(personId, { size: 'row', prefix: 'person-top', actsOnly: true }) : null;

  // The feed's next cards, drawn before the reader reaches them —
  // `useReach`.
  const end = useReach();
  // The header's right end — `person/Tools`. On your own page the
  // search, the bell (Activity) and the gear (Account); Account was the
  // last tab's first page until 19 Nov 2026 and is a page under your own
  // now (docs/profile-home-plan.md), reached as `toProfileRoom` says. On
  // anybody else's, the search before the friend button and the ⋯.
  //
  // The search narrows this page's own feed in place — `person/Find`.
  const find = usePageFind(lists, places.data);
  // The copy button on each card — `person/useCardCopy`.
  const copyOf = useCardCopy(navigation);
  const search = () => { scroll.current?.scrollTo?.({ y: 0, animated: false }); find.open(); };
  const tools = own
    ? <OwnTools onSearch={search} onActivity={() => toProfileRoom(navigation, 'Activity')} onAccount={() => toProfileRoom(navigation, 'Account')} />
    : <View style={s.topRight}><Search onPress={search} />{topFriend}{menu.button}</View>;
  // The tab pressed again while this is its first page: back to the top,
  // as every tab's first page does (ExploreScreen's `tabPress` note). On
  // a pushed page React Navigation does nothing with it.
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useScrollToTop(scroll);

  const tabClearance = useTabBarClearance();
  // The cover to the screen's edges, under the clock, and the bar over it
  // — `person/Bar`. Not while searching: the box stands in the head's
  // place and the page wears its plain header again.
  const coverH = useSafeAreaInsets().top + COVER_UNDER_CLOCK;
  const bar = usePastCover(coverH, person, find.on, who.loading);
  const { bleed } = bar;
  const onBack = home ? undefined : () => navigation.goBack();

  const page = person ? (
    <>
      {/* Searching, the box takes the head's place over the same feed,
          narrowed — `person/Find`. */}
      {find.on
        ? <FindField find={find} name={own ? null : person.full_name || atHandle(person.handle)} />
        : <Head me={me} person={person} own={own} cover={wall.cover} coverH={coverH} scroll={bar.scroll} onCover={wall.onCover} trying={wall.trying} friend={friend} onRowLayout={top.onRowLayout} navigation={navigation} />}

      {/* What they have shared: what they did, newest first, and every
          — `person/Shared`. */}
      <Shared
        me={me}
        person={person}
        lists={find.on ? find.found : lists}
        visits={seen.visits(find.on)}
        holding={seen.holding(find.on)}
        visitCard={seen.card}
        reasonOf={find.on ? find.reasonOf : undefined}
        missed={find.on && find.none}
        copyOf={copyOf}
        seenOf={seenOf}
        coverFor={coverFor}
        onOpen={(c) => navigation.navigate('CollectionDetail', { slug: c.slug })}
        onComments={(c) => navigation.navigate('Comments', { subject: { kind: 'collection', id: c.id as string } })}
        reach={end.reach}
        onCreate={() => navigation.navigate('CollectionForm')}
      />
    </>
  ) : who.loading ? (
    <CoverHold coverH={coverH} />
  ) : who.error ? (
    <EmptyState
      icon="cloud-offline"
      title={t("Couldn't load this profile", 'Không tải được hồ sơ này', 'プロフィールを読み込めませんでした', '无法加载这个主页', '無法載入這個主頁')}
      body={t('Check your connection and try again.', 'Kiểm tra kết nối rồi thử lại.', '接続を確認して、もう一度お試しください。', '请检查网络连接后重试。', '請檢查網路連線後重試。')}
      testID="person-failed"
    >
      <GradientCta icon="refresh" label={t('Try again', 'Thử lại', '再試行', '重试', '重試')} onPress={who.reload} testID="person-retry" />
    </EmptyState>
  ) : (
    <EmptyState
      icon="person-outline"
      title={t('Nobody here', 'Không có ai ở đây', '該当するユーザーがいません', '这里没有人', '這裡沒有人')}
      body={t(
        'This account may have been removed, or the handle has changed.',
        'Tài khoản này có thể đã bị xoá, hoặc handle đã đổi.',
        'アカウントが削除されたか、ハンドルが変更された可能性があります。',
        '该账号可能已被删除，或已更改 handle。', '該帳號可能已被刪除，或已更改 handle。',
      )}
      testID="person-missing"
    />
  );

  return (
    <Screen
      title={t('Profile', 'Trang cá nhân', 'プロフィール', '主页', '主頁')}
      onBack={onBack}
      titleScrolls={!!home}
      backTestID="person-back"
      backBare
      compactTitle
      right={tools}
      bleed={bleed}
    >
      {/* The tab's first page has no header (`titleScrolls`), so the
          tools stand in a row of their own at the header's place and
          height: the same glyphs in the same spot whichever way the page
          was opened. Held 44 tall before the page has loaded, so the
          head does not drop when they arrive. Over the cover once it is
          there — `person/Bar`. */}
      <HomeTools on={!!home && !bleed}>{person ? tools : null}</HomeTools>
      <ScrollView
        ref={scroll}
        testID="person-scroll"
        onScroll={(e) => { top.onScroll(e); end.onScroll(e); bar.onScroll(e); }}
        scrollEventThrottle={16}
        contentContainerStyle={[s.content, { paddingBottom: tabClearance }]}
        showsVerticalScrollIndicator={false}
        refreshControl={refresh}
      >
        {page}
      </ScrollView>
      <CoverBar bar={bar} onBack={onBack} backTestID="person-back" tools={tools} />
      {menu.node}
      {wall.sheet}
      {seen.sheet}
    </Screen>
  );
}

/**
 * Whether the row of acts has scrolled out from under the header.
 *
 * The page's one act is under the name, and a page of collections is
 * long: three rows down, Add friend is a scroll back up. So once the row
 * has gone the header offers it again, small, beside the ⋯ — where
 * Instagram and Threads keep theirs — and takes it back when the row
 * returns.
 *
 * The row's foot in the scroller's content, from its layout; past it
 * when the offset is. State only on the crossing, not on every frame.
 * The tab bar's duck still hears every scroll.
 */
/**
 * The bio under the head — or, on your own page with none written, the
 * way to write one (owner, 16 Nov 2026).
 *
 * ── why here ──
 *
 * Measured on the live profiles that day: 14 of 126 have a bio, and of
 * the 16 people with a public list — the pages somebody else opens — 4
 * do. The Profile tab had gained its own door the same day (`BioRow`,
 * "Write a few words about you" at the head of About me). This is the other place the
 * absence can be seen by the one person able to mend it, and the better
 * one for seeing it: your page as a visitor meets it, a cover and a name
 * and then nothing before the lists.
 *
 * Only on your own page. A visitor to a page with no bio is shown
 * nothing there, as before: an invitation to write somebody else's
 * introduction is not theirs to take.
 *
 * Drawn as the collection card's "Add a description" is: a plus and the
 * words in the accent, the colour this app gives what a tap changes, at
 * the caption's size, where the words will go. The same words as the
 * Profile tab's door, so one act has one name; and it opens the same
 * form with the cursor already in the field (`{ focus: 'bio' }`).
 *
 * Your own bio is read off your own profile (`useProfile`) when it has
 * one, not only off the page's fetch: the form saves into that profile,
 * so the page says the new words the moment the form closes, with no
 * blink of the invitation while the page reads itself again.
 *
 * ── the words (owner, 17 Nov 2026) ──
 *
 * "Write a few words about you" for a day, then "Write a few words about you". The first
 * names a field, and 14 of 126 had filled it. The owner weighed two:
 * "Introduce yourself" ("Giới thiệu bản thân"), which reads as a set
 * task and invites putting it off until it can be done properly, and
 * "A line about you" ("Một dòng về bạn"), lighter and without a verb —
 * a label, not an invitation — and one line where the field takes 160
 * characters. This keeps the second's lightness, says what to do, and
 * asks for the amount the field holds. Both doors say it.
 *
 * ── how the bio stands (owner, 17 Nov 2026) ──
 *
 * A speech bubble under the handle, beside the picture, with a tail
 * toward the face — the owner's reference, followed as drawn.
 *
 * Three drawings came before it in a day. The handle's grey under the
 * acts, which read as a caption to the lists. Lucide's quote before it
 * in the page's ink: the mark was ugly and too large beside a short
 * line. A bubble under the picture at the page's inset, its upper left
 * corner tight in place of a tail: the owner set it beside the reference
 * and it was not the reference — under the picture, not beside it, and
 * joined to nothing.
 *
 *   - A tinted well (`surfaceGlassStrong`), no hairline: the reference's
 *     bubble is the page pressed a shade darker, not a white pill, and a
 *     well is what this app calls that.
 *   - A tail on its left edge, level with the first line's middle,
 *     pointing left and up at the picture's lower right, where a role's
 *     badge sits. Made of two views — a square turned 43° inside a
 *     9 × 11 window — and not an Svg path:
 *     the fill is a dynamic colour, which a view resolves against the
 *     app's look and a drawing may flatten against the phone's
 *     (`bgHex`'s note in `theme`). The window ends at the bubble's edge,
 *     so the two washes do not lie over each other and darken.
 *   - Four corners the same, 18. For an hour the upper left was 7, to
 *     give the tail a straight edge to leave from at the bubble's top:
 *     on the phone the owner saw one corner squarer than the rest, which
 *     is what it was. The tail moved down to the first line's middle
 *     instead — the point of a one-line bubble's left edge that stands
 *     furthest out, where the round edge is within half a point of
 *     straight over the tail's 11 (18 − √(18² − 4²) = 0.45), so the
 *     window laps 0.3 over the bubble to close it.
 *   - Slanted, as the reference. Said against it once: Vietnamese
 *     carries its tone marks less well on a slanted face. The owner
 *     chose the reference.
 *   - As wide as its words, up to the column's width. A bio at the
 *     field's limit is about seven lines there and carries the acts down
 *     with it; 13 bios in 14 are one line.
 *
 * Not taken from the reference: the small marks at the bubble's two
 * ends (a fork and spoon, a bowl). They belong to that one bio; a bio is
 * free text and the app has no way to choose a mark for it. An emoji
 * typed into the bio does that work.
 *
 * Weighed with it, and not taken:
 *   - the bio in a tinted box across the page, a "personal statement".
 *     13 of the 14 bios are one line, the longest 56 characters, and one
 *     line in a box the page's width is a text field to look at. (The
 *     bubble above is the answer to that objection, not a change of
 *     mind about it: it is as wide as its words.)
 *   - "Read more". The field stops at 160 (`BIO_MAX`), about four lines.
 *   - asking for a bio at the moment a first list is made public. The
 *     moment is the right one and the ask lands inside another act; left
 *     until the two doors have had time to show what they do.
 */
function Bio({ me, person, onAdd, focused }: { me: string | null; person: FriendProfile; onAdd: () => void; focused: () => boolean }) {
  const { profile } = useProfile();
  const mine = !!me && person.id === me;
  const bio = (mine && profile.bio) || person.bio;
  if (bio) {
    // No bubble since 28 Nov 2026 (owner): on the photograph it was a
    // second surface between the name and the picture behind it. Three
    // lines at most — 13 of the 14 bios measured are one.
    return <Text style={s.bio} numberOfLines={3} testID="person-bio">{bio}</Text>;
  }
  if (!mine) return null;
  return <BioInvite onAdd={onAdd} focused={focused} />;
}

/**
 * Your own page with no bio: the bubble a bio will stand in, already
 * drawn, holding the invitation, with a small yellow pencil beside the
 * words (owner, 21 Nov 2026). It replaced a "＋ Write a few words about
 * you" row in the accent, which read as one more button among the
 * page's; a bubble waiting for words reads as the page's own unfinished
 * line, and is a thing to come back to. The words faint and in the
 * bio's italic, so nobody mistakes them for a bio. The pencil in `sun`,
 * the app's one gold, which clears 3:1 on both grounds (see `theme`); a
 * pen here is meant to say "edit", the reason `glyph.tsx` keeps it off
 * rows that only hold words.
 *
 * Rejected the same day: a default bio written for the reader. Words
 * nobody wrote would stand on the page as theirs, read by visitors as
 * theirs, on 112 of 126 pages.
 *
 * Where the sign-up guide's fourth step rings (`SignupTour`, 'bio'): a
 * new reader always has this bubble. Pressing the ring opens the form.
 */
function BioInvite({ onAdd, focused }: { onAdd: () => void; focused: () => boolean }) {
  const { t } = useI18n();
  const anchor = useTourAnchor('bio', onAdd, focused);
  return (
    <PressableScale
      onPress={onAdd}
      scaleTo={0.96}
      haptic="selection"
      hitSlop={BIO_ADD_SLOP}
      accessibilityRole="button"
      anchorRef={anchor}
      contentStyle={s.bioAdd}
      testID="person-bio-add"
    >
      <Text style={s.bioAddText}>{t('Write a few words about you', 'Viết đôi dòng về bạn', '自分についてひとこと書く', '写几句介绍自己', '寫幾句介紹自己')}</Text>
      <PencilGlyph color={onPhoto.text} />
    </PressableScale>
  );
}

/**
 * Your own page, read again when you come back to it.
 *
 * The page keeps the answer it fetched on opening, and until 16 Nov 2026
 * nothing on it led anywhere that could change that answer. "Write a few words about you"
 * opens the profile's form, which changes the name and the picture as
 * readily as the bio; without this the page would greet the reader, on
 * the way back, with the name they had just replaced.
 *
 * On a return and not on arrival: a blur and then a focus, heard from
 * the navigation prop. Counting focuses instead would read twice on
 * opening wherever the first focus is announced, and never on a return
 * wherever it is not. Somebody else's page is left alone: nothing this
 * reader can do from it changes what it says.
 */
function useReloadOnReturn(navigation: Nav, on: boolean, reload: () => void) {
  const latest = useRef({ on, reload });
  latest.current = { on, reload };
  useEffect(() => {
    let away = false;
    const blur = navigation.addListener('blur', () => { away = true; });
    const focus = navigation.addListener('focus', () => {
      if (away && latest.current.on) latest.current.reload();
      away = false;
    });
    return () => { blur(); focus(); };
  }, [navigation]);
}

/**
 * Everything over the feed: the cover, the picture and the names, what
 * there is to do about this person, and what only you see on your own.
 * Its own function since 20 Nov 2026, when searching the page
 * (`person/Find`) put a box in its place.
 */
function Head({ me, person, own, cover, coverH, scroll, onCover, trying, friend, onRowLayout, navigation }: {
  me: string | null;
  /** The cover's whole height, the clock's inset with it. */
  coverH: number;
  /** How far the page has scrolled — the head fades under the bar. */
  scroll: Animated.Value;
  person: FriendProfile;
  own: boolean;
  cover: string | undefined;
  /** On your own page, the cover is a door to its sheet — `person/Wall`. */
  onCover?: () => void;
  /** The sheet has the cover trying on a picture not yet saved. */
  trying?: boolean;
  friend: React.ReactNode;
  onRowLayout: (e: LayoutChangeEvent) => void;
  navigation: Nav;
}) {
  const { t } = useI18n();
  const top = useSafeAreaInsets().top;
  const fade = useHeadFade(scroll);
  // The camera and the trial's label are 4 under the bar and go under
  // it at once: on the recording the camera rode up over the bell and
  // the gear while the head beside it was fading.
  const cameraFade = fadeUnderBar(scroll, UNDER_BAR - BAR_H, PHOTO_DISC);
  // The words' scrim, from just over the head down — `scrimOver`.
  const scrim = scrimOver(coverH, top + BAR_H, fade.top);
  return (
    <>
      {/* The head, whole, on the photograph (owner, 28 Nov 2026): the
          picture, the name and what they say, and on your own page your
          counts — then the page's sheet, risen over the cover's foot. The
          photograph is one press (its sheet, on your own page) and lies
          under the rest, beside it and not around it: a press inside a
          press is the inner one's on a phone and a warning on the web. */}
      <View style={[s.coverCard, { height: coverH }]} onLayout={onRowLayout} testID="person-head">
        <Pressable
          style={StyleSheet.absoluteFill}
          testID="person-cover"
          onPress={onCover}
          disabled={!onCover}
          accessibilityRole={onCover ? 'button' : undefined}
          accessibilityLabel={onCover ? t('Change cover', 'Đổi ảnh bìa', 'カバーを変更', '更换封面', '更換封面') : undefined}
        >
          {cover
            ? <Image source={{ uri: cover }} style={[s.coverPhoto, { height: coverH }]} contentFit="cover" transition={160} />
            : <View style={[s.coverPhoto, { height: coverH }, s.tint]} testID="person-cover-tint" />}
          {/* The clock's scrim: the photograph's top darkened, fading out,
              so the light clock and the bar's glass read on a pale sky. */}
          <LinearGradient colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0)']} style={s.scrim} pointerEvents="none" testID="person-cover-scrim" />
          {/* The words' scrim — see `footScrim`. */}
          <LinearGradient colors={FOOT_SCRIM} locations={[0, scrim.at, 1]} style={[s.footScrim, { top: scrim.top }]} pointerEvents="none" testID="person-cover-foot-scrim" />
          {/* The cover's camera, on your own page: it says the picture is
              a control, as the avatar's badge does, under the bar's tools
              in the band the head leaves free (`COVER_UNDER_CLOCK`). The
              whole cover is the press. */}
          {onCover ? (
            <Animated.View style={[s.coverEdit, { top: top + UNDER_BAR, opacity: cameraFade }]} testID="person-cover-edit">
              <Glyph name="camera-outline" size={ICON.action} color="#fff" />
            </Animated.View>
          ) : null}
          {/* Said on the picture itself, so a look is never taken for a
              change: nobody else sees it until Save. */}
          {trying ? (
            <Animated.View style={[s.trying, { top: top + UNDER_BAR + 6, opacity: cameraFade }]} testID="person-cover-trying">
              <Text style={s.tryingText}>{t('Trying it', 'Đang xem thử', '試しに表示中', '预览中', '預覽中')}</Text>
            </Animated.View>
          ) : null}
        </Pressable>
        {/* Faded as the page carries it under the bar — `useHeadFade`. */}
        <Animated.View style={[s.headRow, { opacity: fade.opacity }]} pointerEvents="box-none" onLayout={fade.onLayout} testID="person-head-row">
          {/* Your own in the level's ring — `person/OwnFace`. */}
          <Face own={own} url={person.avatar_url} />
          {/* The name, beside the picture, and the handle right under it
              — or the handle alone, for somebody who gave no name. The
              name shrinks before it is cut: see `title`.

              After whichever stands first, a local guide's star or an
              editor's medal, with the sheet that says what it means —
              `PersonRole`. */}
          <View style={s.names} pointerEvents="box-none">
            <PersonRole me={me} personId={person.id} line={TITLE_LINE} onPhoto reserve={onCover ? CAMERA_RESERVE : undefined}>
              {person.full_name
                ? <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={TITLE_SHRINK} testID="person-name">{person.full_name}</Text>
                : <Text style={s.title} numberOfLines={1} testID="person-handle">{atHandle(person.handle)}</Text>}
            </PersonRole>
            {person.full_name
              ? <Text style={s.handle} numberOfLines={1} testID="person-handle">{atHandle(person.handle)}</Text>
              : null}
            {/* What they say about themselves — `Bio`. */}
            <Bio me={me} person={person} onAdd={() => navigation.navigate('EditProfile', { focus: 'bio' })} focused={() => navigation.isFocused()} />
          </View>
          {/* What there is to do about this person, at the row's end
              (28 Nov 2026) — `FriendButton`'s `photo`. Not on your own
              page, nor signed out: no button, and the names keep the
              row. */}
          {friend ? <View testID="person-acts">{friend}</View> : null}
        </Animated.View>
        {/* Your counts, yours to see (`profile/Counts`), in the
            photograph's light ink. */}
        {own && me ? <Animated.View style={[s.counts, { opacity: fade.opacity }]} pointerEvents="box-none"><Counts navigation={navigation} light /></Animated.View> : null}
        {/* The page's sheet, risen over the cover's foot: its two round
            corners, and under them the page. */}
        <View style={s.sheet} pointerEvents="none" testID="person-sheet" />
      </View>
      {/* What the two of you have in common — `InCommon`. It took the
          "mutual saves" this line counted, for a friend only, until 16
          Nov 2026. Hidden the same day, not removed: `IN_COMMON_ON`. */}
      {IN_COMMON_ON ? <InCommon me={me} otherId={person.id} navigation={navigation} /> : null}
      {/* What only you see on your own page, wherever it opens: the
          requests waiting (`person/Requests`), its room through
          `toProfileRoom`. Your counts stood here until 28 Nov 2026; they
          are on the photograph now, in `Head`'s box above. */}
      {own && me ? <Requests me={me} onOpen={() => toProfileRoom(navigation, 'Crew')} /> : null}
    </>
  );
}

/**
 * The lists on this page for this reader, the public ones among them,
 * and who sees each that is not public (owner, 17 Nov 2026).
 *
 * `lists` is `person.listsOn`: all of yours on your own page, their
 * public ones and those they shared with you on another's. `open` is the
 * public ones alone, which the page's cover is still chosen from — a
 * cover off a private list would head your page with a photograph no
 * visitor is shown.
 *
 * Three reads the app already makes, and each only where it is used:
 * your library (`useMyLists`, the app's one copy), the lists lent to you
 * (asked on somebody else's page only) and who your lists are shared
 * with (asked on your own only, for the number beside the two heads).
 * The last two are remembered between launches, so a shared list of
 * yours opens with its two heads and not as a padlock that changes.
 */
function usePageLists(me: string | null, personId: string | undefined) {
  // A guest is `null` and a profile not yet here `undefined`: never equal.
  const own = personId === me;
  const shelf = useCollections();
  const mine = useMyLists();
  const shared = useSharedWithMe(own ? null : me);
  const myShares = useMyListShares(own ? me : null);
  const sharesOf = sharesByList(myShares.data);
  return {
    lists: listsOn(personId, me, { shelf: shelf.data, mine: mine.data, shared: shared.data }),
    open: listsBy(personId, shelf.data),
    seenOf: (c: Collection) => seenOn(c, own, (c.id ? sharesOf[c.id] ?? [] : []).length),
  };
}

function usePastRow(duck: ((e: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined) {
  const [foot, setFoot] = useState<number | null>(null);
  const [past, setPast] = useState(false);
  return {
    past,
    onRowLayout: (e: LayoutChangeEvent) => setFoot(e.nativeEvent.layout.y + e.nativeEvent.layout.height),
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      duck?.(e);
      const now = foot !== null && e.nativeEvent.contentOffset.y > foot;
      if (now !== past) setPast(now);
    },
  };
}

/**
 * The cover's place, held while the profile is on its way: its height,
 * dark to the screen's edges as a photograph is, with the face's disc
 * and two bars where the name and handle will stand, and the page's
 * sheet over its foot. The bar is already over it (`usePastCover`'s
 * `holding`), so the way back does not move when the page arrives.
 *
 * A spinner under the plain "Profile" header until 28 Nov 2026: on the
 * owner's recording the page opened as one layout and became another.
 */
function CoverHold({ coverH }: { coverH: number }) {
  return (
    <View style={[s.coverCard, { height: coverH }]} testID="person-loading">
      <View style={s.headRow}>
        <Skeleton style={s.holdFace} />
        <View style={s.holdNames}>
          <Skeleton style={s.holdName} />
          <Skeleton style={s.holdHandle} />
        </View>
      </View>
      <View style={s.sheet} />
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: space.page },
  // The tools' row on the tab's first page: `Screen`'s inline header
  // (`headerInline`) without its way back or title — 6 over, 14 under,
  // the page's margins — so the cover starts where it does on a pushed
  // page. It replaced the 8 the cover stood under the safe area while
  // the page had nothing over it.
  homeTools: {
    flexDirection: 'row', justifyContent: 'flex-end', minHeight: 44,
    paddingHorizontal: space.page, paddingTop: 6, paddingBottom: 14,
  },
  // The accent's tint: a cover with no photograph to wear.
  tint: { backgroundColor: colors.accentSoft },
  // A disc of the photograph's own dark: it reads on a light sky. The
  // target is the whole cover. It was 30pt with a 13pt glyph, the size of
  // a caption's icon, and on a dark photograph it went under altogether —
  // the owner's cover, a street under trees, showed a speck of white and
  // no disc (24 Nov 2026). Now the photograph disc every other control on
  // a picture is (`PHOTO_DISC`, with the action glyph), and a hairline of
  // white that draws its edge where the dark fill cannot: on a night
  // street the ring is the disc, on a pale sky the fill is.
  coverEdit: {
    position: 'absolute', right: CAMERA_RIGHT, width: PHOTO_DISC, height: PHOTO_DISC, borderRadius: PHOTO_DISC / 2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.45)',
  },
  // The cover's corner, opposite the face: what the sheet is trying on.
  // Beside the camera at the foot: the cover's top is the bar's now.
  trying: {
    position: 'absolute', right: CAMERA_RIGHT + PHOTO_DISC + 6, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)',
  },
  tryingText: { color: '#fff', fontSize: 12, fontWeight: font.medium },
  // To the screen's edges and under the clock (owner, 22 Nov 2026): the
  // page's margins taken back, no rounding. See `person/Bar`. The head
  // stands at its foot (28 Nov 2026), over the sheet's rise.
  // Dark under the photograph (`COVER_HOLD`): what shows while it is
  // held, and in the 160ms a photograph takes to come in.
  coverCard: { backgroundColor: COVER_HOLD, marginHorizontal: -space.page, overflow: 'hidden', justifyContent: 'flex-end' },
  coverPhoto: { width: '100%' },
  // 120 of the photograph's top: the clock and the bar's 50 under it,
  // and as far again to fade over.
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  // From the bar's foot (`top`, inline: it owes the clock its inset) to
  // the photograph's, darkening — see `FOOT_SCRIM`.
  footScrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // The face and the names in a row, at the page's margin, their middles
  // level: the face is the taller, so the names sit beside it.
  // 18 to the counts under it, from 12: the level's pill hangs off the
  // face's foot and stood 4 over the first figure (recording, 28 Nov).
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.page, paddingBottom: 18 },
  // What parts the face from the photograph — see `FACE_RING`. A plain
  // hex: a dynamic colour on a border can come back stale (`bgHex`).
  faceRing: { borderWidth: FACE_RING, borderRadius: FACE / 2 + FACE_RING, borderColor: onPhoto.text },
  // The name over the handle over the bio, one column beside the picture.
  names: { flex: 1 },
  counts: { paddingHorizontal: space.page },
  sheet: {
    height: SHEET_RISE, backgroundColor: colors.bg,
    borderTopLeftRadius: SHEET_ROUND, borderTopRightRadius: SHEET_ROUND,
  },
  // The display face at 22, the size the page's own Profile heads its
  // sections in. It has the row to itself beside the picture — about
  // 240pt on a 390pt phone, by arithmetic — since the friend button left
  // for a row of its own; it still shrinks to `TITLE_SHRINK` before it
  // is cut, for the name that is longer than that.
  title: {
    color: onPhoto.text, fontSize: 22, lineHeight: TITLE_LINE, fontFamily: display.bold,
    letterSpacing: 0.2, ...ON_PHOTO_SHADOW,
  },
  // The held cover's marks: the face's 76 and two lines' worth of bar,
  // in the light ink at a strength that reads as "not yet", on the dark.
  holdFace: { width: FACE + FACE_RING * 2, height: FACE + FACE_RING * 2, borderRadius: FACE / 2 + FACE_RING, backgroundColor: onPhoto.line },
  holdNames: { flex: 1, gap: 10 },
  holdName: { width: 140, height: 18, borderRadius: 9, backgroundColor: onPhoto.line },
  holdHandle: { width: 90, height: 12, borderRadius: 6, backgroundColor: onPhoto.line },
  // The header's end: the small friend button, when it is there, then
  // the ⋯.
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // The handle, right under the name: an address, quieter.
  // The photograph's full ink, not its second: the handle is the
  // smallest line on the picture, and it is quiet by its size.
  handle: { color: onPhoto.text, ...type.meta, lineHeight: 20, ...ON_PHOTO_SHADOW },
  // What they say, in the photograph's ink and the bio's italic, 2 under
  // the handle. A bubble with a tail toward the face until 28 Nov 2026.
  bio: { color: onPhoto.text, ...type.meta, lineHeight: 20, fontStyle: 'italic', marginTop: 2, ...ON_PHOTO_SHADOW },
  // The invitation in the bio's place — see `BioInvite`: its words and
  // the pencil in a row, 6 apart, fainter than a bio.
  bioAdd: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 2 },
  bioAddText: { color: onPhoto.textSecondary, ...type.meta, lineHeight: 20, fontStyle: 'italic', flexShrink: 1, ...ON_PHOTO_SHADOW },
});
