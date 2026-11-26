// Place detail — a bar with the way back, the place's name and its
// bookmark; under it the photographs as a rounded card with a page count;
// the score with check-in beside it, the place's kinds as the card's pills,
// and one grouped card of Address / Hours / Call / Website rows, the weekly
// table folded behind the open-now line.
//
// ── the owner's shape (12 Nov 2026) ──
//
// The hero was full-bleed, up under the clock, with back, share and the
// bookmark floating on it in dark discs and the name in 26pt under it.
// The owner sent a mock-up of this screen and chose it over that, "simpler":
// a plain bar on the paper — the chevron bare at the left, the name centred
// on one line, the bookmark bare at the right — and the photograph as a
// card under the bar. A bar on paper needs no discs, no scrim and no
// light ink under the clock, which is three things this screen no longer
// has to manage. What it costs is written where it is paid: a long name is
// cut to one line (see `s.barName`), and share is not on the screen.
//
// A day earlier the same screen tried a name bar that came in only once
// the photograph had scrolled away, the photograph staying full-bleed with
// its discs. Measured, it was defensible — 41–47% of covers leave a bare
// white glyph on the photo under 3:1, and 18% of names do not fit one
// centred line — but the owner saw it on the phone and called it not
// pretty. On paper neither number applies to the glyphs: they are ink.

import { useTourAnchor } from '../components/SignupTour';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Glyph, ICON } from '../components/ui/glyph';
import { photosOf } from '../lib/data';
import { shortAddress } from '../lib/address';
import { splitName, subtitleBeside } from '../lib/name';
import { useCity } from '../lib/city';
import { kindsInOrder } from '../lib/categories';
import PhotoCarousel from '../components/PhotoCarousel';
import { cityTz } from '../lib/clock';
import { useI18n } from '../lib/i18n';
import { localized } from '../lib/localized';
import { useSaveActions } from '../lib/save';
import { colors, space } from '../theme';
import { AmbientWarmth, Empty, useTabBarClearance } from '../components/ui';
import { KindPills } from '../components/KindPill';
import LocalGuidePanel from '../components/LocalGuidePanel';
import { toPerson, type Nav, type RootRoute } from '../nav';
import { BlurbCard } from './placeDetail/BlurbCard';
import { GuestReviews } from './placeDetail/GuestReviews';
import { InfoCard } from './placeDetail/InfoCard';
import { usePhotoPage, usePlaceLookup } from './placeDetail/usePlacePage';
import { PlaceBar } from './placeDetail/PlaceBar';
import { ScoreRow } from './placeDetail/ScoreRow';
import { MARK_INSET, s } from './placeDetail/styles';

/**
 * The photograph card's height for its width, from the owner's mock-up:
 * a 400 x 252 card on a 440pt phone, 1.59 to 1. 5:8 is that ratio, and
 * a little shorter than the 4:3.4 the inset card had before the hero went
 * full-bleed — the bar above it now holds the name the photo used to sit
 * over, so the card does not have to carry the top of the screen.
 */
const HERO_RATIO = 5 / 8;

export default function PlaceDetailScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'PlaceDetail'> }) {
  const { t, lang } = useI18n();
  const { city, cities } = useCity();
  const { save, askToSignIn } = useSaveActions();
  const { width } = useWindowDimensions();
  const { place, loading } = usePlaceLookup(route.params.slug);
  const saveAnchor = useTourAnchor('save', () => { if (place) save(place); }, () => navigation.isFocused());
  const { photoIndex, setPhotoIndex, pageKey, coverUri } = usePhotoPage(place);
  const tabClearance = useTabBarClearance();

  if (loading && !place) {
    return <SafeAreaView style={s.screen}><ActivityIndicator color={colors.accent} style={{ marginTop: 64 }} /></SafeAreaView>;
  }
  if (!place) {
    return <SafeAreaView style={s.screen}><Empty text={t('Place not found.', 'Không tìm thấy địa điểm.', 'スポットが見つかりません。', '找不到该地点。', '找不到該地點。')} /></SafeAreaView>;
  }

  const photos = photosOf(place);
  // The pin's category first, so the page leads where the card led.
  const kindOrder = kindsInOrder(place);
  // The page's width less its two margins, at the mock-up's ratio.
  const heroW = width - space.page * 2;
  const heroH = Math.round(heroW * HERO_RATIO);
  // The card shows the address a local would say — street and ward —
  // not the city, postal code and country Google wrote for a reader
  // anywhere in the world. The share sheet and the Maps link below keep
  // `place.address` whole: both leave the phone. The catalog's names for
  // the current city go along so a city `lib/address` has never heard of
  // is still cut from a short, ward-less address. See `shortAddress`.
  const cityNames = city ? [city.name_vi, city.name_en, city.short_vi, city.short_en] : [];
  const address = shortAddress(place.address, cityNames);
  // The brand as the title and the qualifier Google's listing hung off
  // it — a branch, a tagline — as a subtitle beneath, rather than three
  // lines of display type. See `lib/name` for the cut. The subtitle is
  // dropped when it only repeats what the card already prints: the
  // neighbourhood line under it, or the address row further down.
  const neighborhood = localized(place, 'neighborhood', lang);
  // The district is not printed here. Until 15 Nov 2026 it was, as a line
  // under the subtitle, for a place with no address row — and on that day
  // every one of the catalog's 1,477 places had an address, so the line
  // was drawn for none of them and would have been a third line in a head
  // that is now centred and two lines at most (owner). The subtitle is
  // still judged against the district — a branch named after its ward
  // ("CTQ Texas BBQ - Hà Đông") would otherwise repeat the word the
  // address ends in. The cost, written down: a place with no address
  // whose branch is its district says where it is nowhere on the page.
  const fullName = localized(place, 'name', lang);
  const name = splitName(fullName);
  // `address`, not `place.address`: the test is against what the reader
  // can actually see, and the short one is what the row prints.
  const subtitle = subtitleBeside(name, neighborhood, address);

  // What lies over the hero whether or not it has photographs: the scrim.
  // Laid between the pages and the marks by `PhotoCarousel`, so the marks
  // stay on top of the scrim they were sized against; laid over the grey
  // fallback the same way when there is nothing to page.
  const heroOverlays = (
    <>
            {/* One scrim, for the page count, the kinds and the credit that
                sit on the bottom edge. The top one went with the controls:
                nothing rides the top of this photograph any more. */}
            <LinearGradient
              pointerEvents="none"
              colors={['transparent', 'rgba(10,11,10,0.34)']}
              style={s.heroScrimBottom}
            />

            {/* Where the reader is in the photographs is `PageCount`'s
                "2 / 4" at the bottom right, drawn by the carousel — see
                that file for why a count and not dots. Not read aloud:
                each photograph is "Photo n of m" by itself. */}
    </>
  );

  // ── the bar ──
  //
  // On the paper, so the glyphs are the page's ink and need no disc —
  // the bare control the other pushed screens wear, each hung past the
  // margin so its ink, not its empty box, stands on it: back by
  // `BACK_HANG`, the bookmark by `SAVE_HANG`. The name between them is
  // centred on the screen, which the two hangs keep within a point.


  return (
    // The bar takes the top inset itself, so it can sit on the paper
    // right under the clock; the bottom is cleared by `tabClearance`.
    <View style={s.screen}>
      <AmbientWarmth style={{ top: heroH, height: 620 }} />
      <PlaceBar
        slug={route.params.slug}
        title={name.title}
        onBack={() => navigation.goBack()}
        onSave={() => save(place)}
        saveAnchor={saveAnchor}
      />
      <ScrollView
        testID={`detail-place-${place.slug}`}
        contentContainerStyle={{ paddingBottom: tabClearance }}
        showsVerticalScrollIndicator={false}
        // For the sheet that follows a check-in, which is drawn in a
        // `Modal` but is this scroll view's descendant in React's tree
        // (`CheckinPill`, in the score row) — and React Native's touch
        // responders follow that tree, not the screen. A scroll view's
        // default ('never') takes any tap made while the keyboard is up,
        // puts the keyboard away, and drops the tap. So the first press
        // on Done only lowered the keyboard and the sheet sat there until
        // a second (owner's recording, 24 Nov 2026: keyboard down at
        // 0:37.3, Done answering at 0:38.7). 'handled' lets a press that
        // a button takes go to the button. The page has no field of its
        // own, so nothing else here changes.
        keyboardShouldPersistTaps="handled"
      >
        {/* ── hero carousel ──
            `PhotoCarousel`'s paging, given the screen's width and the
            height this screen decides, remounted when the desk changes the
            cover under it so the strip starts again at the new first page.
            The marks sit `MARK_INSET` in from the card's edge, see `attr`. */}
        <View style={[s.heroWrap, { height: heroH }]}>
          {photos.length > 0 ? (
            <PhotoCarousel
              pages={photos}
              page={photoIndex}
              onPage={setPhotoIndex}
              width={heroW}
              height={heroH}
              scrollKey={pageKey}
              countRight={MARK_INSET}
              countBottom={15}
              attrStyle={s.attr}
              attributionOf={(ph) => ph.attribution_name}
              renderPage={(ph, i, size) => (
                <Image
                  key={ph.photo_uri}
                  source={{ uri: ph.photo_uri }}
                  style={[s.hero, size]}
                  contentFit="cover"
                  transition={200}
                  testID={i === 0 ? 'detail-photo' : undefined}
                  accessibilityLabel={t(
                    `Photo ${i + 1} of ${photos.length} of ${fullName}`,
                    `Ảnh ${i + 1}/${photos.length} của ${fullName}`,
                    `${fullName}の写真 ${i + 1}/${photos.length}`,
                    `${fullName}的照片，第 ${i + 1} 张，共 ${photos.length} 张`, `${fullName}的照片，第 ${i + 1} 張，共 ${photos.length} 張`,
                  )}
                />
              )}
            >
              {heroOverlays}
            </PhotoCarousel>
          ) : (
            <>
              <View style={[s.hero, s.heroFallback, { width: heroW, height: heroH }]}>
                <Text style={{ fontSize: 64 }}>{place.emoji ?? '📍'}</Text>
              </View>
              {heroOverlays}
            </>
          )}
        </View>

        <View style={s.body}>
          {/* ── what it scored ──
              The name is the bar's now (owner, 12 Nov 2026); what follows
              the photograph is the score. One column, not two, from when
              the name stood here. The rating used to sit in a badge beside
              the title, which cost the name 109pt of the 386 it could have
              had and made it wrap far more often than it needed to: 32% of
              places on a 393pt phone, against 7% at full width. Measured
              off the catalog, that is 167 places getting a whole line of
              26pt back.
              The rating loses nothing by moving. A score and a count are
              one short line of text; a badge was a box drawn around them,
              and the box was the part that was expensive. */}
          {/* ── "City Crew pick", the first line under the photograph ──
              Over the name until the name moved into the bar; it stays the
              first thing read on the page, for the reasons below.
              `is_featured` chose Explore's hero and was said nowhere else;
              since 12 Oct 2026 it is said here, and since 14 Oct it is said
              over the name rather than at the right of the Highlights
              heading. "Chosen" is a claim about the place, and the name is
              what the place is called; on the heading row it read as a
              claim about the paragraph, and it was lost on a featured
              place with no paragraph — 6 of the 21 featured places had
              none until 13 Oct, so that was not the empty case the old
              comment took it for. An eyebrow: the kicker above a title is
              where an editor's mark lives on a listing, read before the
              name and gone from the way of everything after it.
              A glyph and the accent on the words, small caps and spaced;
              not a tinted fill, because the accent as a surface is for
              state (`theme.ts`) and a place being featured is not
              something the reader did. The uppercase is a no-op on the
              Japanese, which has no case, so one style serves three.
              Centred, with the subtitle under it (owner, 15 Nov 2026):
              the two are said of the whole place, as the name in the bar
              above them is, and the bar's name is centred. Rejected the
              same day: both on one line with a dot between — two faces
              and two cases on a line, and a long tagline breaks mid-way. */}
          {place.is_featured ? (
            <View style={s.pick} testID="detail-pick">
              <Glyph name="ribbon-outline" size={ICON.meta} color={colors.accent} />
              <Text style={s.pickText}>{t('City Crew pick', 'City Crew chọn', 'City Crew のおすすめ', 'City Crew 精选', 'City Crew 精選')}</Text>
            </View>
          ) : null}
          {/* What `splitName` took off the name — a branch, a tagline —
              under the photograph rather than in the bar: the bar holds the
              brand on one line, and a chain's branch is the part a reader
              would lose first to the cut. */}
          {subtitle ? (
            <Text
              style={[s.subtitle, place.is_featured && s.subtitleUnderPick]}
              testID="detail-subtitle"
            >
              {subtitle}
            </Text>
          ) : null}
          <ScoreRow
            place={place} name={fullName} cover={coverUri}
            cityId={place.city_id ?? city?.id ?? null} askToSignIn={askToSignIn}
          />

          {/* ── what the place is ──
              Every category, as the pill the feed's card wears — the card
              says "● Cà phê | +1" because its line has room for one, and
              this is where the "+1" is named (owner, 15 Oct 2026). Same
              component (`KindPill`), so the two cannot drift.

              It replaces the glyphs that sat on the cover since #854. They
              said the same categories a second way — no words, a tap to
              name them — and the reader who came from "+1" did not find
              it there: three of the nine glyphs do not say their kind on
              sight, and the chips under the rating, which were the vibes,
              read as the "+1" instead. The vibes are gone from this
              screen too (the owner's call, the same day): the four
              judgements are on 123 of 976 places, so their absence read
              as a verdict it was not, and the planner, which is what
              they were for, still reads them from the row.

              In `kindsInOrder`: the pin's category first, so the pill that
              leads here is the one the card led with, then the filter
              row's order. 14 under the meta row, the step the vibes kept
              from it. */}
          <KindPills kinds={kindOrder} style={s.kindRow} testID="detail-kinds" />

          <BlurbCard place={place} />

          {/* The one offer this screen makes to the person who put the
              place here. Draws nothing for everybody else — see
              `LocalGuidePanel`, which asks `canAddPhoto` before it asks
              for anything else.

              Last of the four, and it moved twice to get here. It began
              between the rating and the pills, on the argument that being
              above the pills kept it from interrupting; being above the
              pills *was* the interruption, so it went below them. That
              still left it between the pills and the reason to go, which
              is the same fault one block further down: name, pills and
              highlights are one argument about the place, made to everybody,
              and this panel is a request made to one person by name. An
              argument is not interrupted halfway to be asked a favour.

              So it comes after the argument ends and before the facts
              begin — which is also where the eye is already looking for
              something to do. */}
          <LocalGuidePanel
            place={place}
            onOpen={() => navigation.navigate('Gallery', { slug: place.slug })}
            testID="guide-panel"
          />

          {/* What guests said, after the desk's word and before the
              facts — `GuestReviews` has why there. */}
          {/* A guest's name opens their page where this stack has one
              (Explore, Collections, Profile). The plan's and the trip's
              stacks do not register it, and a press there would bubble
              to another tab (`nav.test`); there the name does not press. */}
          <GuestReviews
            slug={place.slug}
            onPerson={navigation.getState?.()?.routeNames?.includes('Person')
              ? (handle) => toPerson(navigation, handle)
              : undefined}
          />

          {/* ── info card ── */}
          <InfoCard place={place} address={address} tz={cityTz(cities, place.city_id)} />

        </View>
      </ScrollView>
    </View>
  );
}
