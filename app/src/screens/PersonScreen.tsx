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
// owner asked. The cover is **the cover of their newest list that has
// one** (`coverAmong`), not a picture they upload: it says where this
// person goes, the desk has already seen it, and there is no upload to
// build or moderate. Somebody with no list has the accent's tint for a
// cover — the ground the Statistics row and the "add a photo" offer
// stand on — so a page with nothing on it still reads as meant. Most
// pages are that page today: the live project has about ninety profiles
// and fewer public lists than that.
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
// quarter of the picture is on the cover (`FACE_OVER`), the name starts
// just under the cover's edge, and the bubble's first line stands level
// with the picture's foot — where a tail can point at the face. The
// geometry was drawn to scale beside the reference before it was built;
// it has not been measured on a phone.
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
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Avatar, EmptyState, GradientCta, PressableScale, Screen, SECONDARY_CONTROL_H, useTabBarClearance,
} from '../components/ui';
import { Glyph, ICON } from '../components/ui/glyph';
import { useFriendButtons } from '../components/FriendButton';
import InCommon from '../components/InCommon';
import { usePersonMenu } from '../components/PersonMenu';
import PersonRole from '../components/RoleBadge';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { useProfile, useSession } from '../lib/auth';
import Shared, { useReach } from './person/Shared';
import { useCollections, usePlaces } from '../lib/catalog';
import {
  type Collection, coverUriOf, type FriendProfile, membersOf, useMyListShares, useProfileByHandle, useSharedWithMe,
} from '../lib/data';
import { atHandle, normalizeHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { coverAmong, IN_COMMON_ON, listsBy, listsOn, seenOn, TOP_FRIEND_ON } from '../lib/person';
import { useMyLists } from '../lib/save';
import { sharesByList } from '../lib/shares';
import { useScheme } from '../lib/theme';
import { bgHex, colors, display, font, radius, space, type } from '../theme';
import type { Nav, RootRoute } from '../nav';

/** The face: 88, the size Edit profile draws your own at. */
const FACE = 88;
/** The cover's height. Not measured on a phone: a little under the 16:9
 *  of a 346pt card, so the face and the handle are on the first screen. */
const COVER_H = 148;
/** How much of the ringed picture lies over the cover: 28 of its 96,
 *  the reference's proportion (87 of 290px), where it was half. */
const FACE_OVER = 28;
/** The name starts this far under the cover's edge. */
const NAME_DROP = 6;
/** How far the name shrinks to stay on its line beside the picture
 *  before it is cut: 22 to about 17, still the largest words on the
 *  page. */
const TITLE_SHRINK = 0.78;
/** The name's line, which the role's mark after it is centred on. */
const TITLE_LINE = 28;
/** What "Write a few words about you" adds above and below its 24pt row to make the button
 *  scale's 44 for the thumb (`SECONDARY_CONTROL_H`). */
const BIO_ADD_SLOP = { top: (SECONDARY_CONTROL_H - 24) / 2, bottom: (SECONDARY_CONTROL_H - 24) / 2 };

export default function PersonScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'Person'>;
}) {
  const { t } = useI18n();
  const { session } = useSession();
  const me = session?.user?.id ?? null;
  const handle = normalizeHandle(route.params.handle);
  const who = useProfileByHandle(handle || null);
  const person = who.data;

  const places = usePlaces();
  // What of theirs this reader may see, and what everybody may —
  // `usePageLists`. The cover is asked of the second.
  const { lists, open, seenOf } = usePageLists(me, person?.id);
  const coverFor = (c: Collection) => coverUriOf(c, membersOf(c, places.data));
  const cover = coverAmong(open, coverFor);

  const { friendButton, crew } = useFriendButtons(me, 'person', 'page');
  // Report, block, unblock — `usePersonMenu`.
  const menu = usePersonMenu(me, person, crew);

  const personId = person?.id ?? null;
  const friend = friendButton(personId);
  // Your own page, come back to from the form its "Write a few words about you" opens:
  // read again — `useReloadOnReturn`.
  useReloadOnReturn(navigation, !!me && personId === me, who.reload);
  // The same button, small, for the header once the row has scrolled
  // away — a thing to do only (`actsOnly`): a fact is not worth the
  // header's room. Switched off for now: `TOP_FRIEND_ON`.
  const top = usePastRow(useDuckOnScroll());
  const topFriend = TOP_FRIEND_ON && top.past ? friendButton(personId, { size: 'row', prefix: 'person-top', actsOnly: true }) : null;

  // The feed's next cards, drawn before the reader reaches them —
  // `useReach`.
  const end = useReach();

  const tabClearance = useTabBarClearance();
  // A ring is a border, and a dynamic colour on a border flattens against
  // the phone's appearance rather than the app's (`bgHex`).
  const { scheme } = useScheme();
  const ring = { borderColor: bgHex[scheme] };

  const page = person ? (
    <>
      <View style={s.coverCard} testID="person-cover">
        {cover
          ? <Image source={{ uri: cover }} style={s.coverPhoto} contentFit="cover" transition={160} />
          : <View style={[s.coverPhoto, s.tint]} testID="person-cover-tint" />}
      </View>
      <View style={s.headRow}>
        <View style={[s.faceRing, ring]}>
          <Avatar url={person.avatar_url || null} size={FACE} />
        </View>
        {/* The name, beside the picture, and the handle right under it
            — or the handle alone, for somebody who gave no name. The
            name shrinks before it is cut: see `title`.

            After whichever stands first, a local guide's star or an
            editor's medal, with the sheet that says what it means —
            `PersonRole`. On the picture's corner for a day; after the
            name since 17 Nov 2026 (owner), for the reasons written
            there. */}
        <View style={s.names}>
          <PersonRole me={me} personId={person.id} line={TITLE_LINE}>
            {person.full_name
              ? <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={TITLE_SHRINK} testID="person-name">{person.full_name}</Text>
              : <Text style={s.title} numberOfLines={1} testID="person-handle">{atHandle(person.handle)}</Text>}
          </PersonRole>
          {person.full_name
            ? <Text style={s.handle} numberOfLines={1} testID="person-handle">{atHandle(person.handle)}</Text>
            : null}
          {/* What they say about themselves, as a bubble from the picture
              — `Bio`. */}
          <Bio me={me} person={person} onAdd={() => navigation.navigate('EditProfile', { focus: 'bio' })} />
        </View>
      </View>
      {/* What there is to do about this person, in a row of its own —
          `Acts`. Not on your own page, nor signed out: no friend button,
          no row. */}
      {friend ? <Acts friend={friend} onLayout={top.onRowLayout} /> : null}
      {/* What the two of you have in common — `InCommon`. It took the
          "mutual saves" this line counted, for a friend only, until 16
          Nov 2026. Hidden the same day, not removed: `IN_COMMON_ON`. */}
      {IN_COMMON_ON ? <InCommon me={me} otherId={person.id} navigation={navigation} /> : null}

      {/* What they have shared: what they did, newest first, and every
          — `person/Shared`. */}
      <Shared
        me={me}
        person={person}
        lists={lists}
        seenOf={seenOf}
        coverFor={coverFor}
        onOpen={(c) => navigation.navigate('CollectionDetail', { slug: c.slug })}
        onComments={(c) => navigation.navigate('Comments', { subject: { kind: 'collection', id: c.id as string } })}
        onProfile={me && person.id === me ? () => navigation.navigate('EditProfile') : undefined}
        reach={end.reach}
      />
    </>
  ) : who.loading ? (
    <ActivityIndicator color={colors.accent} style={s.spinner} testID="person-loading" />
  ) : who.error ? (
    <EmptyState
      icon="cloud-offline"
      title={t("Couldn't load this profile", 'Không tải được hồ sơ này', 'プロフィールを読み込めませんでした', '无法加载这个主页', '無法載入這個主頁')}
      body={t('Check your connection and try again.', 'Kiểm tra kết nối rồi thử lại.', '接続を確認して、もう一度お試しください。', '请检查网络后重试。', '請檢查網路後重試。')}
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
      onBack={() => navigation.goBack()}
      backTestID="person-back"
      backBare
      compactTitle
      right={<View style={s.topRight}>{topFriend}{menu.button}</View>}
    >
      <ScrollView
        onScroll={(e) => { top.onScroll(e); end.onScroll(e); }}
        scrollEventThrottle={16}
        contentContainerStyle={[s.content, { paddingBottom: tabClearance }]}
        showsVerticalScrollIndicator={false}
      >
        {page}
      </ScrollView>
      {menu.node}
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
function Bio({ me, person, onAdd }: { me: string | null; person: FriendProfile; onAdd: () => void }) {
  const { t } = useI18n();
  const { profile } = useProfile();
  const mine = !!me && person.id === me;
  const bio = (mine && profile.bio) || person.bio;
  if (bio) {
    return (
      <View style={s.bioBubble} testID="person-bio-row">
        <View style={s.bioTail} testID="person-bio-tail"><View style={s.bioTailFill} /></View>
        <Text style={s.bio} testID="person-bio">{bio}</Text>
      </View>
    );
  }
  if (!mine) return null;
  return (
    <PressableScale
      onPress={onAdd}
      scaleTo={0.96}
      haptic="selection"
      hitSlop={BIO_ADD_SLOP}
      accessibilityRole="button"
      contentStyle={s.bioAdd}
      testID="person-bio-add"
    >
      <Glyph name="add" size={ICON.action} color={colors.accent} />
      <Text style={s.bioAddText}>{t('Write a few words about you', 'Viết đôi dòng về bạn', '自分についてひとこと書く', '写几句介绍自己', '寫幾句介紹自己')}</Text>
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
 * What there is to do about this person: the friend button, and Message.
 *
 * A row of its own under the name (owner, 16 Nov 2026). The friend
 * button stood at the end of the name's row for an evening, and at 44 it
 * took nearly half the width beside the picture: "Le Nguyen Ngoc Minh"
 * shrank as far as it could and "@lenguyenngocminh" was cut. Under the
 * head the name has the whole width and the buttons have theirs.
 *
 * Rejected for it: the button as an icon alone (four states become four
 * glyphs, two of them ticks), and the button on the cover photograph
 * (the grey words for "Requested" and "Friends" cannot be read on a
 * photograph, and would need the pill they had just lost).
 *
 * ── one group in the middle, a rule between (owner, 17 Nov 2026) ──
 *
 * The friend button, a short rule, Message: one group, 22 either side
 * of the rule, in the middle of the page — the owner's reference.
 *
 * Before it the two stood from the page's left edge, grey words beside
 * a dimmed pill. Then, for a morning, in two equal halves of the page's
 * width: each act sat in the middle of its own half, which put them 190
 * apart with the rule alone between, and the owner read it, beside the
 * reference, as two things that had drifted. A group keeps them a pair.
 *
 * Both are words here when nothing is asked: "Friends" and "Requested"
 * at the body's 16 with a mark, Message the same and dimmed. Add friend
 * and Accept keep their pills — those are the two that are buttons.
 *
 * Message is not built. It is drawn anyway, dimmed and said to be
 * coming — the owner's choice over leaving the place empty — as
 * `ActionSheet` draws a row that is not yet a thing to do: 0.45, the
 * figure the app's dimmed controls share, "Soon" beside the word, and
 * the press refused, so nothing pretends to answer one. When messages
 * exist it becomes a button where it stands.
 */
function Acts({ friend, onLayout }: { friend: React.ReactNode; onLayout: (e: LayoutChangeEvent) => void }) {
  const { t } = useI18n();
  const message = t('Message', 'Nhắn tin', 'メッセージ', '发消息', '發訊息');
  const soon = t('Soon', 'Sắp có', '近日公開', '即将推出', '即將推出');
  return (
    <View style={s.acts} onLayout={onLayout} testID="person-acts">
      {friend}
      <View style={s.actsRule} testID="person-acts-rule" />
      <PressableScale
        // `disabled` alone, as `ActionSheet`'s rows that are not yet a
        // thing to do: the press is dropped and VoiceOver says dimmed.
        disabled
        scaleTo={1}
        contentStyle={s.message}
        accessibilityRole="button"
        accessibilityLabel={`${message}, ${soon}`}
        testID="person-message"
      >
        <Glyph name="chatbubble-outline" size={ICON.action} color={colors.text} />
        <Text style={s.messageText}>{message}</Text>
        <Text style={s.messageSoon}>{soon}</Text>
      </PressableScale>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: space.page },
  spinner: { marginTop: 20 },
  // The accent's tint: a cover with no photograph to wear.
  tint: { backgroundColor: colors.accentSoft },
  coverCard: { borderRadius: radius.card, overflow: 'hidden' },
  coverPhoto: { width: '100%', height: COVER_H },
  // The face half over the cover's lower edge, at the card's own inset,
  // and the name beside it. On the picture's foot: its upper half lies
  // over the cover.
  headRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginTop: -FACE_OVER, paddingHorizontal: space.cardPadding,
  },
  // The page's ground around the face, so it parts from the photograph.
  faceRing: { borderWidth: 4, borderRadius: FACE / 2 + 4 },
  // The name over the handle over the bio, one column beside the
  // picture, begun just under the cover's edge.
  names: { flex: 1, marginTop: FACE_OVER + NAME_DROP },
  // The display face at 22, the size the page's own Profile heads its
  // sections in. It has the row to itself beside the picture — about
  // 240pt on a 390pt phone, by arithmetic — since the friend button left
  // for a row of its own; it still shrinks to `TITLE_SHRINK` before it
  // is cut, for the name that is longer than that.
  title: {
    color: colors.text, fontSize: 22, lineHeight: TITLE_LINE, fontFamily: display.bold,
    letterSpacing: 0.2,
  },
  // The row of acts — see `Acts`: one group in the page's middle, 22
  // either side of the rule, 14 under the head.
  acts: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 14 },
  // The rule between them: a hairline 20 tall, under half the row's 44,
  // so it parts two things without fencing them.
  actsRule: { width: 1, height: 20, backgroundColor: colors.borderGlass },
  // Words and a mark at the button scale's height, dimmed: a button that
  // is not one yet.
  message: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.45,
    minHeight: SECONDARY_CONTROL_H,
  },
  messageText: { color: colors.text, ...type.body },
  messageSoon: { color: colors.text, fontSize: 15, fontStyle: 'italic' },
  // The header's end: the small friend button, when it is there, then
  // the ⋯.
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // The handle, right under the name: an address, quieter.
  handle: { color: colors.textTertiary, ...type.meta, lineHeight: 20 },
  // The bio's bubble — see `Bio`. 18 round at every corner, a point and
  // a half under a one-line bubble's half-height (39), so one line is
  // all but a pill. 4 under the handle and 4 left of the
  // names' edge, as the reference sets it a little toward the picture.
  bioBubble: {
    alignSelf: 'flex-start', marginTop: 4, marginLeft: -4,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: colors.surfaceGlassStrong,
  },
  // The tail's window, on the bubble's left edge about the first line's
  // middle (9 of padding and half of 21 is 19.5; the window is 14 to 25);
  // and the square turned in it, of which the window shows a corner.
  bioTail: { position: 'absolute', left: -9, top: 14, width: 9.3, height: 11, overflow: 'hidden' },
  bioTailFill: {
    position: 'absolute', left: 0, top: 1, width: 24, height: 24,
    backgroundColor: colors.surfaceGlassStrong,
    transformOrigin: 'left top', transform: [{ rotate: '-43deg' }],
  },
  bio: { color: colors.text, ...type.meta, lineHeight: 21, fontStyle: 'italic' },
  // The invitation in the bio's place — see `Bio`. The collection card's
  // "Add a description" (`descAdd`): an 18pt plus 4 from 14pt semibold
  // words, in the accent, hugging its words so the row beside it is not a
  // button.
  // Where the bubble will stand, under the handle.
  bioAdd: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 24,
    marginTop: 4,
  },
  bioAddText: { color: colors.accent, fontSize: 14, fontWeight: font.semibold },
});
