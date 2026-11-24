// The two cards a shelf of collections is drawn in: the tile, two to a
// row, and the Mosaic's card, of three sizes.
//
// Out of CollectionsScreen since 24 Nov 2026. Each was a function inside
// the screen's one function — the Mosaic's card at complexity 31 and the
// tile at 24, beside the screen's own 56 — reading a dozen of the
// screen's values from the closure. They read them from `ShelfKit` now,
// one object the screen builds, so what a card depends on is written in
// one place. The lines were moved, not retyped.
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import LikeHeart from '../../components/LikeHeart';
import NewBadge from '../../components/NewBadge';
import { Avatar, PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { mosaicCaption, type MosaicEntry } from '../../lib/collectionMosaic';
import type { Collection, FriendProfile } from '../../lib/data';
import { normalizeHandle } from '../../lib/handle';
import { useI18n } from '../../lib/i18n';
import { isNewList } from '../../lib/newest';
import type { useCoverOpen } from '../../lib/useCoverOpen';
import { colors, coverScrim, mosaicScrim, onPhoto } from '../../theme';
import { EmptyCover } from './empties';
import { s } from './styles';

/** What a card reads of the screen around it. */
export type ShelfKit = {
  coverFor: (c: Collection) => string | undefined;
  /** The press: note the search that led here, then open from the cover. */
  open: (slug: string, uri: string | undefined) => void;
  coverRef: ReturnType<typeof useCoverOpen>['ref'];
  faces: Record<string, FriendProfile>;
  now: number;
  newWord: string;
  membersOf: (c: Collection) => number;
  reasonFor: (slug: string) => string | null;
  myLikes: string[];
  likes: Record<string, number>;
  onHeart: (c: Collection) => void;
  visibilityOf: (c: Collection) => string;
  seenFor: (c: Collection) => 'public' | 'friends' | 'private';
  placesOf: (n: number) => string;
};


/** One tile of a pair: the shelf's card, and Yours' and Shared's. */
export function CollectionTile({ c, own, shared, at, width, height, kit }: {
  c: Collection; own: boolean; shared: boolean; at: number; width: number; height: number; kit: ShelfKit;
}) {
  const { t } = useI18n();
  const uri = kit.coverFor(c);
  const members = kit.membersOf(c);
  const reason = kit.reasonFor(c.slug);
  const my = !!c.id && kit.myLikes.includes(c.id);
  const fresh = isNewList(c, kit.now);
  return (
    <PressableScale
      contentStyle={[s.gcard, { width, height }]}
      onPress={() => { kit.open(c.slug, uri); }}
      testID={own ? undefined : `${shared ? 'collection-shared' : 'collection-card'}-${at}`}
      accessibilityRole="button"
      // A shared tile says whose it is, as the heading
      // above it says it is not yours: the face is not
      // read out, and the handle is the one fact that
      // tells two friends' lists apart.
      accessibilityLabel={own
        ? `${t(c.title_en, c.title_vi, c.title_ja)}${fresh ? `, ${kit.newWord}` : ''}, ${kit.visibilityOf(c)}`
        : `${t(c.title_en, c.title_vi, c.title_ja)}${fresh ? `, ${kit.newWord}` : ''}${shared && c.curator_handle ? `, ${normalizeHandle(c.curator_handle)}` : ''}`}
    >
      <View ref={kit.coverRef(c.slug)} style={StyleSheet.absoluteFill} pointerEvents="none">
        {uri
          ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated }]} />}
      </View>
      {/* The Explore shelf's scrim, the one `coverScrim`
          — same object, same card language, second
          surface. It began at 55% here once, to give the
          picture back; that left a white photograph's
          title at 2.5:1. See `coverScrim`. */}
      <LinearGradient
        colors={coverScrim.colors}
        locations={coverScrim.locations}
        style={StyleSheet.absoluteFill}
        testID="collection-card-scrim"
      />
      {fresh ? <NewBadge /> : null}
      {/* ── only the exception is marked (owner, 2 Nov 2026) ──
          A private list of yours wears a padlock in the
          top-right corner; a public one wears nothing.
          The globe stood in every tile's foot, and most
          of your lists are public (five of six on the
          owner's screen), so it said the default on
          nearly every tile. The padlock alone says the
          one thing that differs, and its absence reads
          as "anyone can see this".

          In a 24pt disc of the card ground, the "New"
          badge's own (top-left, 10pt in), so the two
          marks on a photograph are one kind of thing:
          a bare glyph under the scrim's 0.22 top was
          lost on a white sky. VoiceOver still hears
          Public or Private in the tile's name.

          A private list shared with friends wears two
          heads in the same disc instead (13 Nov 2026):
          still the exception — it is not public — but
          not "only me" either, and a padlock on a list
          three friends are reading would be the tile
          saying the opposite of the list's own page.

          Both in outline, at 13 in the 24 disc (owner,
          13 Nov 2026): the glyphs the list's own page
          draws for the same two states, at its foot and
          in its sheet, and the line the tab bar and the
          place pin are drawn in. They were filled at
          12 until then. A filled padlock is a solid
          black block on a photograph, the loudest thing
          on the tile after its title, and filled at 12
          the two heads ran into one blob. The outline's
          stroke is 32/512 of its size: 0.75pt at 12,
          0.81 at 13, so the point gained gives back
          some of the weight the fill took away. */}
      {own && !c.is_public ? (
        kit.seenFor(c) === 'friends' ? (
          <View style={s.gcardLock} testID="collection-tile-shared">
            <Glyph name="people-outline" size={ICON.meta} color={colors.text} />
          </View>
        ) : (
          <View style={s.gcardLock} testID="collection-tile-lock">
            <Glyph name="lock-closed-outline" size={ICON.meta} color={colors.text} />
          </View>
        )
      ) : null}
      <View style={s.gcardText}>
        <Text style={s.gcardTitle} numberOfLines={1}>
          {t(c.title_en, c.title_vi, c.title_ja)}
        </Text>
        {/* One meta line, not two.
            
            The byline had a row and the count-and-heart
            had another, and between them they put three
            lines of text over 40% of the photograph —
            in the view whose whole reason is the
            photograph. They are one row now: who made
            it on the left, the heart on the right.

            Whose list this is, said with a face: the
            avatar beside the handle carries the whole
            of "by", so the word goes. The list rows do
            the same now, and the detail screen did it
            before either — three surfaces, one grammar,
            no verb in any of them. On your own tab neither
            appears — the byline would only say your own
            name — and the padlock, which once led this
            row, sits in the top corner now, private
            lists only. */}
        <View style={s.gcardFoot} testID="collection-tile-foot">
          {!own && c.curator_handle ? (
            <>
              <Avatar url={c.owner_id ? kit.faces[c.owner_id]?.avatar_url : undefined} size={18} />
              <Text style={s.gcardBy} numberOfLines={1}>
                {normalizeHandle(c.curator_handle)}
              </Text>
            </>
          ) : null}
          {/* How many places, on your own tiles only.

              Dropped from other people's tiles because
              it is the weakest of the four things this
              card can say: ten places against seven
              rarely decides a tap, where who made it and
              how many liked it do — and the like count
              also explains the order the shelf is in.
              The full number is still one tap away.

              Zero is said in words rather than as a
              count. A list you made and never filled is
              the one size that changes what you do next
              — and only yours can be empty here: the
              community shelf drops empty lists before
              they reach a tile (see `visible`). */}
          {/* Narrowed, the reason stands in for the count
              on every tile — the one time a community
              tile says anything about its places, since
              which of them the chip reached is what the
              reader just asked. */}
          {reason ? (
            <Text style={s.gcardMeta} numberOfLines={1}>{reason}</Text>
          ) : own && (members === 0 ? (
            <Text style={s.gcardMeta} numberOfLines={1}>
              {t('No places yet', 'Chưa có địa điểm', 'スポットはまだありません', '还没有地点', '還沒有地點')}
            </Text>
          ) : (
            // The pin and the figure (owner, 2 Nov 2026),
            // as on the Explore shelf and the list's own
            // card; spoken in full.
            <View
              style={s.gcardCount}
              accessible
              accessibilityLabel={kit.placesOf(members)}
              testID="collection-tile-count"
            >
              <Glyph name="location-outline" size={ICON.meta} color={onPhoto.textSecondary} />
              <Text style={s.gcardMeta}>{members}</Text>
            </View>
          ))}
          {/* Only where a like is possible: a private
              list is one nobody may like, and a heart
              on it would be an invitation to nothing.

              On your own tile too, the same control
              (owner, 17 Oct 2026): a curator may like
              their own list, and it draws at any count
              — the list nobody has liked yet is the
              one that most needs the invitation. */}
          {c.id && c.is_public ? (
            <LikeHeart
              tone="photo"
              liked={my}
              count={kit.likes[c.slug] ?? 0}
              onPress={() => kit.onHeart(c)}
              style={{ marginLeft: 'auto' }}
              contentStyle={s.gcardLikes}
              countStyle={s.gcardMeta}
              hitSlop={{ top: 14, bottom: 14, left: 16, right: 12 }}
            />
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

/** A card of the Mosaic, Community's view: its caption over the
 *  photograph or under it, as `mosaicCaption` lays it out. */
export function MosaicCard({ entry: { c, at }, width, height, featured = false, kit }: {
  entry: MosaicEntry<Collection>; width: number; height: number; featured?: boolean; kit: ShelfKit;
}) {
  const { t } = useI18n();
  const caption = mosaicCaption(c.slug);
  const below = caption === 'below';
  const uri = kit.coverFor(c);
  const title = t(c.title_en, c.title_vi, c.title_ja);
  // Bare, beside a face (owner, 14 Nov 2026), as the collection page's
  // head and the activity rows have it: the `@` stays where a handle
  // stands in a sentence or under a real name, and a byline is neither.
  const author = c.curator_handle ? normalizeHandle(c.curator_handle) : '';
  // "New" on the Mosaic as on a tile. Mosaic has been Community's own
  // view since #1257 and never drew the mark, so a list made this week
  // went unmarked on the screen most readers open (owner, 11 Nov 2026).
  // Top-left of the photograph as everywhere else — except where the
  // caption itself sits top-left, over the words' first line: there the
  // badge rides at the head of the caption, above the title, still in
  // the corner and over nothing.
  const fresh = isNewList(c, kit.now);
  return (
    <PressableScale
      contentStyle={[s.mosaicCard, { width, height }]}
      onPress={() => { kit.open(c.slug, uri); }}
      testID={`collection-card-${at}`}
      accessibilityRole="button"
      accessibilityLabel={`${title}${fresh ? `, ${kit.newWord}` : ''}${author ? `, ${author}` : ''}`}
    >
      <View ref={kit.coverRef(c.slug)} style={s.mosaicPhoto} testID={`collection-mosaic-${c.slug}-${caption}`}>
        {uri
          ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          : <EmptyCover />}
        {fresh && caption !== 'top' ? <NewBadge /> : null}
        {!below ? (
          // The dark lives inside the caption, so it is exactly as long
          // as the words are, and the tail hangs off its far side into
          // the photograph — no measuring, no first frame without it.
          // Both run from the edge the caption sits on. See `mosaicScrim`.
          <View
            style={[s.mosaicOverlay, caption === 'top' ? s.mosaicWordsTop : s.mosaicWordsBottom]}
            pointerEvents="none"
            testID={`collection-mosaic-scrim-${c.slug}`}
          >
            <LinearGradient
              colors={mosaicScrim.body}
              start={{ x: 0, y: caption === 'top' ? 0 : 1 }}
              end={{ x: 0, y: caption === 'top' ? 1 : 0 }}
              style={StyleSheet.absoluteFill}
              testID={`collection-mosaic-body-${c.slug}`}
            />
            <LinearGradient
              colors={mosaicScrim.tail}
              locations={mosaicScrim.tailLocations}
              start={{ x: 0, y: caption === 'top' ? 0 : 1 }}
              end={{ x: 0, y: caption === 'top' ? 1 : 0 }}
              style={[s.mosaicTail, caption === 'top' ? s.mosaicTailBelow : s.mosaicTailAbove]}
              testID={`collection-mosaic-tail-${c.slug}`}
            />
            <MosaicWords c={c} caption={caption} featured={featured} fresh={fresh} title={title} author={author} kit={kit} />
          </View>
        ) : null}
      </View>
      {below ? <MosaicWords c={c} caption={caption} featured={featured} fresh={fresh} title={title} author={author} kit={kit} /> : null}
    </PressableScale>
  );
}

/** The Mosaic card's words: the title, the blurb on a featured card whose
 *  words sit on the photograph, and the face and handle of who made it. */
function MosaicWords({ c, caption, featured, fresh, title, author, kit }: {
  c: Collection; caption: ReturnType<typeof mosaicCaption>; featured: boolean; fresh: boolean;
  title: string; author: string; kit: ShelfKit;
}) {
  const { t } = useI18n();
  const below = caption === 'below';
  const blurb = featured && !below ? t(c.desc_en, c.desc_vi, c.desc_ja)?.trim() : '';
  return (
    <View style={[
      s.mosaicWords,
      below && s.mosaicWordsBelow,
      featured && !below && s.mosaicWordsFeatured,
    ]}>
      {fresh && caption === 'top' ? <NewBadge style={s.mosaicBadgeInline} /> : null}
      <Text
        style={[s.gcardTitle, featured && s.mosaicTitleFeatured, below ? s.mosaicTitleBelow : s.mosaicInkShadow]}
        numberOfLines={2}
      >{title}</Text>
      {blurb ? <Text style={[s.mosaicBlurb, s.mosaicInkShadow]} numberOfLines={2}>{blurb}</Text> : null}
      {/* Who made it, said with a face, as the tiles say it (owner,
          14 Nov 2026): with the `@` gone, the face is what tells a name
          from one more word of the title. 16, not the tiles' 18: the
          words beside it are 12, not 13, and the face stays a little
          taller than their line. */}
      {author ? (
        <View style={s.mosaicBy} testID={`collection-mosaic-by-${c.slug}`}>
          <Avatar url={c.owner_id ? kit.faces[c.owner_id]?.avatar_url : undefined} size={16} />
          <Text style={[s.mosaicAuthor, below ? s.mosaicAuthorBelow : s.mosaicInkShadow]} numberOfLines={1}>{author}</Text>
        </View>
      ) : null}
    </View>
  );
}
