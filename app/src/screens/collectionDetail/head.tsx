// The card at the head of a list: the cover, whose list it is and how
// it stands, what it says about itself, and the row of things a reader
// can do with it.
//
// Out of `CollectionDetailScreen` on 23 Nov 2026, the third step of F1
// in the 22 Nov code review. The card was most of what was left of the
// screen's complexity: nearly every line of it is drawn one way for your
// own list and another for somebody else's, and each of those choices
// was a branch in the screen's one function. Here they are three
// components, each deciding only what it draws:
//
// - `ListCurator`: the face, the handle and the line under them (the
//   list's age and the mark of who can see it).
// - `ListFoot`: the heart, Comments, Save a copy, Share, Activity.
// - `ListHead`: the card itself, with the other two and the kinds' row
//   handed in, so the screen still decides what goes in it.
//
// Nothing is fetched here and nothing is written: the presses are the
// screen's, passed down. The reasoning moved with the code unchanged.

import React from 'react';
import { Text, View } from 'react-native';
import CollectionHero from '../../components/CollectionHero';
import LikeHeart from '../../components/LikeHeart';
import MoreText from '../../components/MoreText';
import { PencilGlyph } from '../../components/PencilGlyph';
import { Avatar, CHIP_SLOP, Card, PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import type { Collection } from '../../lib/data';
import { atHandle, normalizeHandle } from '../../lib/handle';
import { useI18n } from '../../lib/i18n';
import { likesWorthShowing } from '../../lib/likes';
import { ageWord, listAgeOf } from '../../lib/listAge';
import { likeable, readerMark, SEEN_GLYPH, type Visibility } from '../../lib/shares';
import type { Place } from '../../lib/types';
import { colors } from '../../theme';
import { toPerson, type Nav, type RootRoute } from '../../nav';
import { CommentsDoor } from './CommentsDoor';
import { CopyDoor } from './CopyDoor';
import { ReaderSeen, readerWord, ShareButton, whoHint } from './Share';
import { ACT_GLYPH, ACTIVITY_CHEVRON, BYLINE_SLOP, FACE, s } from './styles';

/* ── the way to your own page, from your own list (owner, 16 Nov 2026) ──
   Somebody else's head opens their page, the whole of it one press. Your
   own could not be that: its second line holds a control — who sees the
   list — and a press around a control swallows it. So on your own list
   the face is a press and the handle is a press, each on its own, and the
   line under them is left alone.

   It was no press at all for a morning. The head had only ever opened a
   sheet to report or block, which nobody does to themselves, and when
   its destination became a page the "not your own" stayed: the owner was
   signed in as the author of the list they tried it on, and nothing
   happened. Your own page is the one worth opening first — it is how
   everybody else sees you.

   Outside the component's function, as it was outside the screen's. */
const ownDoor = (navigation: Nav, owned: boolean, handle: string) =>
  // Your own list, so your own page: in the last tab, its first page
  // (`toPerson`, 19 Nov 2026).
  (owned && handle ? () => toPerson(navigation, handle, handle) : undefined);

function FaceDoor({ url, onPress }: { url: string | null; onPress?: () => void }) {
  const { t } = useI18n();
  return (
    <PressableScale
      onPress={onPress}
      // The face is 40; two more each way makes the 44 a thumb is owed.
      hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={t('Your page', 'Trang của bạn', 'あなたのページ', '你的主页', '你的主頁')}
      testID="collection-own-face"
    >
      <Avatar url={url} size={FACE} />
    </PressableScale>
  );
}

/** Your own handle as the head writes it, or nothing when you have none yet. */
export const ownTagOf = (profile: { handle?: string | null } | null | undefined) =>
  (profile?.handle ? atHandle(profile.handle) : '');

/** How old the list is, in the byline's words; nothing for an editorial
 *  list, which has no owner and so no moment it was made by someone.
 *  Outside `ListCurator`, which is at the complexity ceiling. */
function ageTextOf(col: Collection | null | undefined, lang: string, t: ReturnType<typeof useI18n>['t']) {
  const madeAt = col?.owner_id ? col.created_at : null;
  const age = madeAt ? listAgeOf(madeAt, new Date()) : null;
  return age ? ageWord(age, lang, t, t('New', 'Mới tạo', '作成したばかり', '刚创建', '剛建立')) : '';
}

/** Whose list this is, and the line under the name. */
export function ListCurator({
  col, owned, profile, curatorAvatar, holdForFace, found, seen, seenWord, onWhoSees, navigation,
}: {
  col: Collection | null | undefined;
  owned: boolean;
  /** Your own profile, for your own list's head. */
  profile: { handle?: string | null; avatar_url?: string | null } | null | undefined;
  /** The curator's face when there is one, and whether to keep its place
   *  while the lookup is still out (`holdForFace` in the screen). */
  curatorAvatar: string | null;
  holdForFace: boolean;
  /** The curator's handle found a profile: an account, so a page to open. */
  found: boolean;
  seen: Visibility;
  seenWord: string;
  onWhoSees: () => void;
  navigation: Nav;
}) {
  const { t, lang } = useI18n();
  /* Who can see this list, and the place to change it (owner, 16 Oct
     2026). It sat under the title as a line of its own and was changed
     from the ⋯ menu, which split one fact across two places: the header
     said what it was, a menu row said how to make it the other thing.
     The header lost it so the title stands alone the way a visitor's
     does, and the menu lost its row so the way to the switch is the word
     that names the state — tap "Private" to choose who sees it.

     ── under your handle (owner, 13 Nov 2026) ──
     From 16 Oct it stood at the card's foot, after the heart. It is on
     the line under your handle now, after the list's age — "2h · 🔒
     Private ⌄" — where a post says who sees it: beside who wrote it and
     when, not under what it says. The same control, the same sheet;
     only its height changed, the line's 20 drawn and the rest of 44 in
     slop (`BYLINE_SLOP`).

     The owner's alone. A visitor meets a public list or one a friend
     shared with them, and a word telling them which would be a fact
     about nothing they can change.

     The padlock the list already uses for the same fact, so a private
     collection looks the same wherever you meet it — and a globe once it
     is not private any more. The chevron is what says the word opens
     something; without it the row reads as a label.

     Bare: the glyph, the word and the chevron on the card, no fill and
     no outline (owner, 12 Nov 2026). It wore a pill for a day — the
     glass fill and hairline a kind pill wears, from a reference — and
     the owner took it off again: the kinds above it had just lost their
     pills, and one boxed word under a row of bare ones read as the odd
     one out. The chevron is what says it opens something. The word
     stays: the reference drew the glyph alone, and the third state is
     here now — Friends, a list shared with chosen friends (13 Nov 2026)
     — whose two heads (`people-outline`) nobody could read as "shared
     with some friends" unaided. VoiceOver hears the word either way.

     Every state wears one grey (owner, 12 Nov 2026). Public was the
     app's green, semibold, as "the state worth checking". It read as
     the loudest thing on the card after the title, for a setting. The
     green also says "fine" everywhere else ("open now", a success
     banner), and Public is a choice, not a success. It was the same
     green on every look, Slate's two tones included. The globe and the
     padlock already say which state it is. The grey is `textTertiary`,
     the list's age beside it on the same line, and the step the
     chevron was already in (owner, 13 Nov 2026). It was `textSecondary`,
     one step above the heart's tally, on the reasoning that a control
     outranks a count; on the card that put the age, the control and
     "Read more" in the description's own ink (`descText`), so the lines
     about the list read as loud as the list. On Teal that is 9.35:1 on
     the card for the description and 5.65 for these now. The control is still told from the tally by its chevron and
     its place, not by its ink.

     The glyph alone since 17 Nov 2026: the word and the chevron went,
     and the control with them in all but the press. The owner did not
     like a setting standing in the line that says who made the list and
     when; it is Share at the card's foot now (`collectionDetail/Share`,
     which has the argument), and what stays here is a mark of how the
     list stands. Everything above about the word and the chevron is how
     it came to be one grey glyph; `seenWord` is what VoiceOver is told.
     It still opens the sheet, for whoever learned to press here.

     The globe was gone for a day (17 Nov 2026: "no mark is public") and
     the owner asked for it back the next morning, small, after the
     time, as a public post wears one on Facebook: with it a list of your
     own always says how it stands, and its absence is not left to be
     read. A person's page says it in the same glyph (`person.seenOn`).

     Tapping opens a choice rather than flipping the switch: a word that
     changes who can see your list on one touch is a word nobody would
     dare tap to find out what it does. */
  const visibility = owned ? (
    <PressableScale
      contentStyle={s.visibility}
      scaleTo={0.94}
      haptic="selection"
      // On the button scale: the byline's 20 drawn, 44 to the thumb.
      hitSlop={BYLINE_SLOP}
      onPress={onWhoSees}
      accessibilityRole="button"
      // The word the glyph stands for: VoiceOver has no glyph to read.
      accessibilityLabel={seenWord}
      accessibilityHint={whoHint(t)}
      testID="collection-visibility"
    >
      <Glyph name={SEEN_GLYPH[seen]} size={ICON.text} color={colors.textTertiary} />
    </PressableScale>
  ) : null;

  /* ── the curator, at the head of the card (owner, 16 Oct 2026) ──
     The face and the handle lead the card on somebody else's list, where
     the note glyph used to: the glyph said "a note", the face says whose,
     which is the question the glyph was standing in for. Beside a handle
     in the card's own ink — larger than the 18pt it wore in the header,
     because it is the card's subject now rather than a mark in a line of
     meta. 28pt until 13 Nov 2026, 40 since, with a second line under the
     handle (`byline`).

     The face appears only where there is a person: `holdForFace` keeps
     the slot while the lookup is out and drops it once an editorial
     handle comes back with nobody behind it.

     A tap opens the author's page (owner, 16 Nov 2026) — `PersonScreen`
     — where an account stands behind the handle. Until that day it
     opened a sheet here with two rows, "Report this list" and "Block":
     there was no page to open. The report is still a row in the ⋯ on
     this card, where it always also was; the block is an act about a
     person and went to their page's own ⋯ (`usePersonMenu`), with a
     report of the person beside it. The cost: blocking a list's author
     is two presses from here, where it was one.

     An editorial handle has nobody behind it and no page, so its head is
     not a button — a press that opens "Nobody here" is a dead control. */
  const curatorTag = !owned && col?.curator_handle ? atHandle(col.curator_handle) : '';
  // A face or a profile row means an account; an editorial handle has
  // neither (see `curatorHandle`), and so no page to open.
  const curatorIsPerson = !!curatorAvatar || found;
  /* ── your own face, too (owner, 16 Oct 2026) ──
     Your own list leads with your face and handle as well, as the
     owner’s view in the review drew it: the card reads the same from
     both sides, and the reader sees what a visitor will see. From the
     signed-in profile rather than `curator_handle`, which is a stamp
     taken when the row was made and does not follow a changed handle.
     Never a button: there is nothing to report or block about yourself.
     A face slot always, since an account is always a person; the note
     glyph comes back only for a profile with no handle yet. */
  const faceTag = owned ? ownTagOf(profile) : curatorTag;
  /* The handle as the head draws it: bare, no `@` (owner, 13 Nov 2026),
     as Threads and Instagram set the name beside a face. The `@` stays
     where the handle stands inside a sentence ("Block @lan?") or under
     a real name (the curator sheet), where it says "this is a handle";
     beside the face it is the name, and the sign was one more glyph
     before it. Sentences keep `curatorTag`. */
  const faceName = normalizeHandle(faceTag);

  /* ── the line under the handle (owner, 13 Nov 2026) ──
     A post's second line: how old the list is, and who sees it.

     - Your own list: its age, then who can see it — the control, with
       its sheet (`visibility`).
     - Somebody else's public list: its age alone. Not "Public": anyone
       who can see it already knows it is.
     - A friend's list lent to you (`sharedToMe`): its age, then two heads
       and "Shared with you". Not a control: who sees it is the owner's.

     The age only on a list with an owner. The editorial lists all wear
     one `created_at` — the instant the column was added with a default,
     not a date anybody chose (`fetchCollections`) — so every one of them
     would say the same day, and say it falsely. With no age and nothing
     after it, the line is not drawn, and the handle stands alone.

     Read at render, not ticking: a list opened at "New" says so until the
     screen draws again, as a post's header does until it is scrolled
     back to. */
  // The rest of the words are `ageWord`'s, which the list's activity page
  // reads too, so a list's "3h" and a like's cannot be spelled apart.
  const ageText = ageTextOf(col, lang, t);
  // What a reader who is not the owner sees there: "Shared with you",
  // or the globe of a person's public list — `shares.readerMark`.
  const readerSees = readerMark(col, owned);
  const sharedMark = readerSees ? <ReaderSeen kind={readerSees} /> : null;
  const seenOnLine = visibility ?? sharedMark;
  const byline = ageText || seenOnLine ? (
    <View style={s.byline} testID="collection-meta">
      {ageText ? <Text style={s.bylineText}>{ageText}</Text> : null}
      {ageText && seenOnLine ? <Text style={s.bylineText}>·</Text> : null}
      {seenOnLine}
    </View>
  ) : null;

  const curatorFace = (
    <>
      {owned
        ? <FaceDoor url={profile?.avatar_url || null} onPress={ownDoor(navigation, owned, faceName)} />
        : holdForFace ? <Avatar url={curatorAvatar} size={FACE} /> : null}
      <View style={s.curatorLines}>
        <Text style={s.curatorTag} numberOfLines={1} testID="collection-handle" onPress={ownDoor(navigation, owned, faceName)}>{faceName}</Text>
        {byline}
      </View>
    </>
  );
  const curatorRow = faceTag ? (
    !owned && curatorIsPerson ? (
      <PressableScale
        contentStyle={s.curator}
        onPress={() => navigation.navigate('Person', { handle: normalizeHandle(curatorTag) })}
        scaleTo={0.97}
        haptic="selection"
        accessibilityRole="button"
        // The whole head is the press, both lines with the face, as a
        // post's is — so VoiceOver hears both lines too, not the handle
        // alone. A visitor's line holds no control to be swallowed.
        accessibilityLabel={[faceName, ageText, readerWord(readerSees, t)].filter(Boolean).join(', ')}
        testID="collection-curator"
      >
        {curatorFace}
      </PressableScale>
    ) : (
      <View style={s.curator} testID="collection-curator">{curatorFace}</View>
    )
  // No handle to lead with — your own, before you choose one, or a lent
  // list whose owner has none: the line under it stands alone.
  ) : byline;
  return curatorRow;
}

/** The row at the card's foot: the heart, Comments, Save a copy, Share, Activity. */
export function ListFoot({
  col, uid, owned, isPublic, sharedCount, liked, likes, onHeart, title, canCopy, copy, seen, onWhoSees, navigation,
}: {
  col: Collection | null | undefined;
  uid: string | undefined;
  owned: boolean;
  isPublic: boolean;
  sharedCount: number;
  liked: boolean;
  likes: Record<string, number>;
  onHeart: () => void;
  title: string;
  canCopy: boolean;
  copy: () => void;
  seen: Visibility;
  onWhoSees: () => void;
  navigation: Nav;
}) {
  const { t } = useI18n();
  /* One heart, and it is both the gesture and the tally — the shape the
     shelf card settled on: two marks for one meaning is one too many, and
     a number beside a control it does not belong to reads as that
     control's label. Outline is a list you have not liked, filled is one
     you have, and the figure beside it is how many people agree.

     Pressable for everyone, the curator included (owner, 17 Oct 2026):
     you may like your own list, as on any social app. The shelf sorts by
     everybody's likes but yours (`rankLikes`), so the vote fills your
     heart and moves the number without moving the list up. Signed out it
     stays pressable and opens the sign-in sheet; see `onHeart`. `hitSlop`
     buys a 15pt glyph a 44pt target without drawing a disc.

     It prints from one: a `0` reads as "nobody liked this" rather than
     "no votes yet", and below that the heart draws bare — exactly when it
     is most obviously an invitation. */
  // A button on a public list, and on one shared with friends, for the
  // friends and for you — `shares.likeable`.
  const heart = col && likeable(isPublic, owned, sharedCount) && col.id ? (
    <LikeHeart
      brief
      liked={liked}
      count={likes[col.slug] ?? 0}
      onPress={onHeart}
      contentStyle={s.like}
      countStyle={s.act}
      hitSlop={{ top: 14, bottom: 14, left: 12, right: 14 }}
    />
  ) : null;

  /* ── the likes a list kept (owner, 13 Nov 2026) ──
     Since 17 Nov 2026 this is a Private list alone: one shared with
     friends has the heart above, for them and for its owner, and the
     row draws the heart before it looks for this (`heart ?? keptHeart`).
     What follows was written when neither could be liked, and still
     says why a list nobody else can open shows a figure and not a
     button.

     A list that gathered likes while public and then went to Friends or
     Private kept every row in `collection_likes`, and lost them from
     view: the heart above asks `isPublic`, and so did the count. The
     count is now returned for your own lists and for the lists shared
     with you, whatever they are now (`20261113120000_likes_kept_off_
     public.sql`), and this is where it shows.

     Read-only: the same outline in the same grey and the figure beside
     it, so the row looks as it did, but a View, not a button. A new like
     on a list that is not public is refused by the insert policy, so a
     press here would be a control that does nothing — and a filled heart
     would claim a state the reader cannot change. The outline whoever is
     looking, the owner who once liked it included, for the same reason.

     Gated on the count alone, not on who is reading: the server returns
     a non-public list's count only to its owner and to the friends it is
     shared with, so a list with no count here is one the reader may not
     count, or one with no likes, and either way the slot stays empty, as
     it was. No `col.id` either: the figure is read by slug and nothing is
     written.

     VoiceOver reads the figure as a sentence, with no role — there is
     nothing to press. */
  const keptLikes = col && !isPublic ? likes[col.slug] : undefined;
  const keptHeart = keptLikes && likesWorthShowing(keptLikes) ? (
    <View
      style={s.like}
      accessible
      accessibilityLabel={t(
        keptLikes === 1 ? '1 like' : `${keptLikes} likes`,
        `${keptLikes} lượt thích`,
        `${keptLikes}件のいいね`,
        `${keptLikes} 个赞`, `${keptLikes} 個讚`,
      )}
      testID="collection-likes-kept"
    >
      <Glyph name="heart-outline" size={ACT_GLYPH} color={colors.textTertiary} />
      <Text style={s.meta}>{keptLikes}</Text>
    </View>
  ) : null;

  /* ── the activity row (owner, 13 Nov 2026) ──
     The card's last row, under a hairline: the heart, and on your own
     list the way to who liked and copied it (`activityLink`).

     Kept even when it is empty — a private list, or one lent to you,
     has no heart, and holds only the likes it kept (`keptHeart`) when
     it has any — and always `CHIP_H` tall: the row is the activity's
     place, and a card that grew by a row when a list went public, or
     when the activity arrived, would move the grid under it.

     It was the card's foot until this day: the heart and who can see it,
     the count before that. The count went to the kinds' row and who can
     see it to the line under your handle (`visibility`) the same day, so
     what is left is the one fact about how the list is doing.

     The heart leads (owner, 12 Nov 2026). It sat at the end, "where a
     thumb finds a gesture", but the apps this reads beside — Instagram,
     Threads, X — put the like first in the row, and first it stands in
     one place whether the list is yours or somebody else's. */
  /* ── "View activity ›" (owner, 13 Nov 2026) ──
     At the row's right end: who liked the list and who saved a copy, on
     a page of its own (`CollectionActivity`), with its figures behind it.

     For whoever is signed in and can open the list (owner, 15 Nov 2026).
     It was the author's alone, and this comment said why: "Threads draws
     its 'View activity' the same way and to the author alone." It does
     not. The owner sent a screenshot of the link on somebody else's post
     and asked for the same here, all of it, as the author sees it. The
     harder reason it gave has gone too: `likes_on_mine` and
     `copies_of_mine` answer only the owner, and a reader's page now asks
     `likes_on_list` and `copies_of_list`, which answer whoever can read
     the list (`20261115090000_list_activity_for_readers`).

     Not a guest: the page is people with a friend button on each row,
     and the three functions behind it answer signed-in callers only.

     On a private list too, and since 13 Nov 2026 its page lists the
     likes and copies the list gathered while it was public — the two
     functions answer the owner whatever the list is now — which is the
     one thing an owner wondering where the likes went needs to see. The
     row keeps one look whatever the list's state.

     The link is the target, not the row. The heart is in the same row,
     and a row-wide press would turn a thumb that just missed the heart
     into a trip to another screen; and a row that is a button with a
     button inside is one VoiceOver element, which swallows the heart.

     The meta size in the byline's grey, as Threads sets it: a way in, not
     a call to act, so not the accent a tier-4 link wears (`docs/
     architecture.md`, "Bốn cấp nút") — beside the heart's coral when the
     list is liked, a second coral would read as a second state. `CHIP_H`
     drawn, the row's own height, and 44 to the thumb with `CHIP_SLOP`.

     "Activity", where it said "View activity" (owner, 18 Nov 2026): the
     chevron says "open", a person's page already calls the same thing
     "Activity", and the row needed the room for Share's word. VoiceOver
     is still told "View activity". */
  const activityLink = uid && col ? (
    <PressableScale
      onPress={() => navigation.navigate('CollectionActivity', { slug: col.slug })}
      haptic="selection"
      hitSlop={CHIP_SLOP}
      style={s.activityLinkHang}
      contentStyle={s.activityLink}
      accessibilityRole="button"
      accessibilityLabel={t('View activity', 'Xem hoạt động', 'アクティビティを見る', '查看动态', '檢視動態')}
      testID="collection-activity-link"
    >
      <Text style={s.activityLinkText}>{t('Activity', 'Hoạt động', 'アクティビティ', '动态', '動態')}</Text>
      <Glyph name="chevron-forward" size={ACTIVITY_CHEVRON} color={colors.textTertiary} />
    </PressableScale>
  ) : null;
  // Share: who can see the list, and sending it —
  // `collectionDetail/Share`. Yours alone.
  //
  // After the comments, not between the heart and them (owner, 19 Nov
  // 2026). It stood beside the heart because it was there first; the
  // comments came a day later and were put at the end. That left a plane
  // between two tallies, where its own figure (how many friends hold the
  // list) read as a third; it put the pair in the other order from a
  // feed card, which has heart then comments; and since a visitor has no
  // Share, the comments stood in a different place for the owner than
  // for everybody else. Now the two tallies lead, in the card's order,
  // and stand where they stand for every reader.
  //
  // Weighed with it, the owner's own first thought: the plane at the
  // row's far end. That end is `activityLink`'s, and a plane beside
  // "Activity ›" would be two doors at one edge; alone there with its
  // figure it would also read as a count of sends more than it does at
  // the end of the acts.
  const shareButton = owned
    ? <ShareButton seen={seen} friends={sharedCount} onPress={onWhoSees} />
    : null;
  const activity = (
    <View style={s.activity} testID="collection-activity">
      <View style={s.activityRow}>{heart ?? keptHeart}<CommentsDoor list={col} about={title} onPress={(id) => navigation.navigate('Comments', { subject: { kind: 'collection', id } })} /><CopyDoor list={col} canCopy={canCopy} onCopy={copy} navigation={navigation} />{shareButton}{activityLink}</View>
    </View>
  );
  return activity;
}

/** The card: the cover, the head with its ⋯, what the list says, the kinds and the foot. */
export function ListHead({
  col, owned, ownTag, desc, members, from, onCoverChanged, onEdit, onMore, curator, kinds, foot,
}: {
  col: Collection | null | undefined;
  owned: boolean;
  /** Your own handle, when you have one; without it your list's head wears a note glyph. */
  ownTag: string;
  desc: string;
  members: Place[];
  from: RootRoute<'CollectionDetail'>['params']['from'];
  onCoverChanged: () => void;
  onEdit: () => void;
  onMore: () => void;
  curator: React.ReactNode;
  kinds: React.ReactNode;
  foot: React.ReactNode;
}) {
  const { t } = useI18n();
  const edit = onEdit;
  /* ── the ⋯, at the card's top right (owner, 13 Nov 2026) ──
     It stood in the header's right-hand slot until this day, and this
     corner held the pencil on your own list and "Save a copy" on
     somebody else's. The ⋯ has both corners now, and the header keeps the
     way back and the title alone: what can be done with the list sits on
     the card that introduces it, and the two shortcuts it replaces are
     rows in its sheet — Edit collection and Save a copy — so nothing went
     out of reach, it went one tap further.

     Everybody gets it, not only the owner: what the sheet offers
     branches, but "there is more you can do with this list" is true on
     both sides of that line, and a card whose corner is empty for half
     its visitors reads as one that forgot something.

     Only once there is a list, which is also the only time there is a
     card. While your own lists are still loading there is no row to read
     `owner_id` off yet — `owned` is false by default, so the owner was
     briefly offered the visitor's "Save a copy" of their own list. Once
     the row is here its `owner_id` settles whose it is.

     The pencil's ink, not its box, ended at the card's padding, level
     with the end of the words under it; the ⋯ does the same by the
     header's own measure (`INK_GAP_END`), which holds unchanged because
     the box keeps the header's 44pt width — see `s.more`. */
  const more = (
    <PressableScale
      onPress={onMore}
      scaleTo={0.92}
      // `CHIP_H` drawn, 44 to the thumb: the slop above and below, the
      // box's own width across.
      hitSlop={CHIP_SLOP}
      style={s.moreHang}
      contentStyle={s.more}
      accessibilityRole="button"
      // "Tùy chọn khác" and not "Thêm" (owner, 22 Oct 2026): heard
      // alone, "Thêm" is "add", and this screen has an Add place too.
      accessibilityLabel={t('More', 'Tùy chọn khác', 'その他', '更多', '更多')}
      testID="collection-more"
    >
      <Glyph name="ellipsis-horizontal" size={ICON.nav} color={colors.textSecondary} />
    </PressableScale>
  );
  return col ? (
    <View style={s.descWrap}>
      <Card style={s.descCard} testID={desc || !owned ? 'collection-desc' : 'collection-desc-empty'}>
        <CollectionHero list={col} members={members} from={from} owned={owned} onChanged={onCoverChanged} />
        <View style={s.descIn}>
        {/* The face's row, drawn whenever the card is: the ⋯ is always
            in it. It was skipped when it held nothing — a list lent to
            you whose owner had no handle — so the words opened the card
            rather than sitting under an empty row and its 14. */}
        <View style={s.descTop}>
          {/* The note glyph, only on your own list and only when there
              is no handle to lead with: it says "your words go here". */}
          {owned && !ownTag ? (
            <Glyph
              name="document-text-outline"
              size={ICON.nav}
              color={desc ? colors.textSecondary : colors.textTertiary}
            />
          ) : null}
          <View style={s.descBody}>
            {curator}
          </View>
          {more}
        </View>
        {/* Across the card too, the words as well as the kinds: the
            description's column stopped at the pencil's, 48pt short of
            the right edge against 16 on the left (owner, 13 Nov 2026). */}
        {desc ? (
          // Four lines, then "Đọc thêm ⌄" on its own (owner, 3 and
          // 13 Nov 2026): a long note had filled the screen the places
          // are for. See `MoreText`.
          <MoreText text={desc} style={s.descText} testID="collection-desc-text" />
        ) : owned ? (
          // The invitation: the line opens the form.
          // Not the whole card, since the chips under the line are
          // a filter and a tap meant for one would open the form.
          //
          // Drawn as the empty bio is on your own page (`BioInvite`):
          // the words faint and in italic, then a small pencil in the
          // app's gold (owner, 21 Nov 2026). It was "＋ Add a
          // description" in the accent, a button among the card's
          // hearts, chips and ⋯; and before that (18 Oct) a sentence
          // one grey lighter than a description, which the owner read
          // as one. The italic and the pencil are what tell the two
          // apart now, as they do on the bio.
          <PressableScale
            onPress={edit}
            scaleTo={0.96}
            haptic="selection"
            accessibilityRole="button"
            contentStyle={s.descAdd}
            testID="collection-desc-add"
          >
            <Text style={s.descAddText}>{t('Write a few lines about this collection', 'Viết vài dòng về bộ sưu tập này', 'このコレクションについてひとこと書く', '为这个合集写几句介绍', '為這個合集寫幾句介紹')}</Text>
            <PencilGlyph color={colors.sun} />
          </PressableScale>
        ) : null}
        {kinds}
        {foot}
        </View>
      </Card>
    </View>
  ) : null;
}
