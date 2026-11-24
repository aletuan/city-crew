// The grouped card under a place: where it is, when it opens, and the
// ways to reach it — address and map, hours, phone, the venue's accounts,
// its website.
//
// Out of PlaceDetailScreen since 24 Nov 2026, in three pieces because the
// card alone was 40 of the screen's complexity of 118 — over the ceiling of
// 25 by itself (measured: every `?:` and `&&` the rule counts, grouped by
// region of the screen). The address and its map, and the hours, each hold
// their own state now — how many lines the address wanted, whether it is
// open, whether the hours table is — which the screen held for them only
// because it was one function. The words and their reasons came across
// unchanged.
import { useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import MiniMap, { canDrawMap } from '../../components/MiniMap';
import { pinImage } from '../../components/mapPins';
import { Card, PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { clockOf, groupHours, openState } from '../../lib/format';
import { atHandle } from '../../lib/handle';
import { useI18n } from '../../lib/i18n';
import {
  hostOf, instagramUrl, threadsUrl, websiteHref, websiteRepeatsHandle,
} from '../../lib/links';
import { mapsRouteUrl, mapsSearchUrl } from '../../lib/maps';
import type { Place } from '../../lib/data';
import { colors } from '../../theme';
import { InfoRow } from './InfoRow';
import { ADDRESS_LINES, s } from './styles';

type Row = 'address' | 'hours' | 'phone' | 'instagram' | 'threads' | 'website';


// A row that goes somewhere can fail to get there — a phone that cannot
// dial, a URL no app claims — and `openURL` says so only by rejecting.
// Unheard, the tap just did nothing; the reader is told instead.
export function openLink(url: string, failed: string): void {
  Linking.openURL(url).catch(() => Alert.alert(failed));
}

/** The card, or nothing when the place has none of the six facts. `address`
 *  is the short one the screen also judges its subtitle against; `tz` is
 *  the city's zone, for "open now". */
export function InfoCard({ place, address, tz }: { place: Place; address: string | null; tz: string }) {
  const { t, lang } = useI18n();
  // Grouped, not one row per day: see groupHours. A place open the same
  // seven days a week becomes one line instead of seven identical ones.
  const hours = groupHours(place.opening_hours ?? [], lang);
  // Which row opens the grouped card decides where the hairlines fall:
  // every row below the first draws one above itself, whatever subset of
  // the four a place actually has.
  // The venue's own accounts, bare and lowercase in the column; the @ and
  // the host are put back at the edges. A website that is only one of these
  // accounts said as a URL is dropped — the row above it already says the
  // same name, better.
  const ig = place.instagram_handle || null;
  const th = place.threads_handle || null;
  const site = place.website && !websiteRepeatsHandle(place.website, { instagram: ig, threads: th })
    ? place.website
    : null;

  const firstRow = place.address ? 'address'
    : hours.length ? 'hours'
    : place.phone ? 'phone'
    : ig ? 'instagram'
    : th ? 'threads'
    : site ? 'website' : null;

  if (firstRow == null) return null;
  return (
    <Card style={s.infoGroup} testID="detail-info-card">
      <AddressRows place={place} address={address} first={firstRow === 'address'} />

      {hours.length > 0 && (
        <HoursRow hours={hours} openNow={openState(place.opening_hours, new Date(), tz)} firstRow={firstRow} />
      )}

      {place.phone && (
        <InfoRow
          icon="call-outline"
          label={t('Phone', 'Điện thoại', '電話番号', '电话', '電話')}
          first={firstRow === 'phone'}
          onPress={() => openLink(
            `tel:${place.phone!.replace(/\s/g, '')}`,
            t('Could not place the call', 'Không gọi được', '電話をかけられませんでした', '无法拨打电话', '無法撥打電話'),
          )}
        >
          <Text style={[s.infoValue, s.infoLink]}>{place.phone}</Text>
        </InfoRow>
      )}

      {/* The venue's own accounts, above the website, because a
          handle is a name and a domain is an address — and because
          for a café in this catalog the account is usually where
          the news is. Ionicons' own `logo-` glyphs rather than the
          brands' full-colour marks: two saturated logos in a grey
          gutter pull the eye off the words, and the column those
          glyphs belong to is the point of the card. */}
      {ig && (
        <InfoRow
          icon="logo-instagram"
          label="Instagram"
          first={firstRow === 'instagram'}
          onPress={() => openLink(
            instagramUrl(ig),
            t('Could not open Instagram', 'Không mở được Instagram', 'Instagramを開けませんでした', '无法打开 Instagram', '無法開啟 Instagram'),
          )}
        >
          <Text style={[s.infoValue, s.infoLink]} numberOfLines={1} testID="detail-instagram">
            {atHandle(ig)}
          </Text>
        </InfoRow>
      )}

      {th && (
        <InfoRow
          icon="logo-threads"
          label="Threads"
          first={firstRow === 'threads'}
          onPress={() => openLink(
            threadsUrl(th),
            t('Could not open Threads', 'Không mở được Threads', 'Threadsを開けませんでした', '无法打开 Threads', '無法開啟 Threads'),
          )}
        >
          <Text style={[s.infoValue, s.infoLink]} numberOfLines={1} testID="detail-threads">
            {atHandle(th)}
          </Text>
        </InfoRow>
      )}

      {site && (
        <InfoRow
          icon="globe-outline"
          label={t('Website', 'Trang web', 'ウェブサイト', '网站', '網站')}
          first={firstRow === 'website'}
          onPress={() => openLink(
            websiteHref(site),
            t('Could not open the website', 'Không mở được trang web', 'ウェブサイトを開けませんでした', '无法打开网站', '無法開啟網站'),
          )}
        >
          {/* The domain, not the URL. What was here trimmed the
              scheme and the `www.` and left everything else, so 70
              of the catalog's 413 websites ran off the end of the
              row mid-tracking-parameter. The tap still carries the
              whole address; only the label is short. */}
          <Text style={[s.infoValue, s.infoLink]} numberOfLines={1} testID="detail-website">
            {hostOf(site)}
          </Text>
        </InfoRow>
      )}
    </Card>
  );
}

/** The address, and under it the map it answers — with the Directions
 *  button on whichever of the two can carry it. */
function AddressRows({ place, address, first }: { place: Place; address: string | null; first: boolean }) {
  const { t } = useI18n();
  // How many lines the address wanted before anything clamped it, and
  // whether the reader has asked for the rest. `null` is "not measured
  // yet", which is also the one paint that runs unclamped.
  const [measured, setMeasured] = useState<number | null>(null);
  const [addrOpen, setAddrOpen] = useState(false);
  // Through `lib/maps` rather than spelled out here, now that the saved
  // trip links out too. It also fixes a narrower bug than it looks: the
  // old test was `place.lat && place.lng`, and a place sitting exactly on
  // the equator or the prime meridian has a legitimate coordinate of 0,
  // which is falsy. None of these three cities is near either — but the
  // check was reading "has a position" off a value that means something
  // else, and `mapsSearchUrl` asks the question it means.
  const mapsUrl = mapsSearchUrl(place);
  // What the Directions button opens, since 12 Oct 2026: a route to the
  // place from wherever the reader is, not the place on the map. The
  // button said "Directions" and opened the place's pin, which is the
  // address row's own tap and the map's; the owner tapped it on the
  // pavement and got a pin where a route was promised. `mapsRouteUrl`
  // with one stop is exactly that journey — origin left to Google, which
  // reads a missing one as the device's position (`lib/maps` says why) —
  // so nothing here asks for location. Driving, as the route does when
  // it knows nothing about the legs: the mode that is merely
  // inconvenient over the one that strands somebody, and Google lets
  // them switch once it is open.
  const routeUrl = mapsRouteUrl([place], 'driving')?.url ?? null;

  // Whether there is a picture to hang the Directions button on.
  //
  // Asked once, because two things now turn on it and they must not
  // disagree: the map draws, and the button either rides on the map or
  // falls back into the address row. A build with no Google Maps SDK —
  // Expo Go on iOS, or a binary made without the key — draws no map, and
  // the one action this card exists for must not vanish with it.
  const showsMap = place.lat != null && place.lng != null && !!mapsUrl && canDrawMap;

  const addrLong = measured != null && measured > ADDRESS_LINES;

  /** Named once: the address row, its button and the map all do this. */
  const toMaps = () => openLink(
    mapsUrl!,
    t('Could not open Maps', 'Không mở được bản đồ', 'マップを開けませんでした', '无法打开地图', '無法開啟地圖'),
  );
  const toRoute = () => openLink(
    routeUrl!,
    t('Could not open Maps', 'Không mở được bản đồ', 'マップを開けませんでした', '无法打开地图', '無法開啟地圖'),
  );

  return (
    <>
      {place.address && (
        <InfoRow
          icon="location-outline"
          label={t('Address', 'Địa chỉ', '住所', '地址', '地址')}
          first={first}
          onPress={mapsUrl ? toMaps : undefined}
          hug={!!mapsUrl && !showsMap}
          /* Only when there is no map to put the button on. It used
             to live here always, and the row has no `gap`, so the
             address ran straight into it: measured off a real
             render, "The Crest Residence, 15 Đ. Trần" stopped 5pt
             short of the pill, and five is where that line happened
             to break rather than anything anybody chose.

             Worse than the touching was the width. The button is
             104.7pt of the 318.7pt the address could have, a third
             of the row, and it cost half the catalog a second line:
             of 671 addresses, 332–415 fit on one line beside it
             against 582–613 without, and 6–16 needed a third line
             and got clamped where none would. So on a card with a
             map the button moves onto the picture and the address
             takes the whole width; see `goOnMap`.

             And when it does fall back here it is a square with
             the arrow, since 12 Oct 2026, not the labelled pill:
             36pt beside the address rather than 105 at the row's
             end (`hug`), so the address keeps its width and the
             control sits with the value it acts on — the owner's
             sketch. The arrow is the same glyph the disc on the
             map wears, and it keeps its name for VoiceOver. On the
             accent's tint, not the glass with a hairline the pill
             had: a glyph with no word beside it needs a ground
             that says "control" on its own, and the tint is what
             `MiniMap`'s own locate button stands on. */
          trailing={mapsUrl && !showsMap ? (
            <PressableScale
              onPress={toRoute}
              accessibilityRole="button"
              accessibilityLabel={t('Directions', 'Chỉ đường', '経路', '路线', '路線')}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              style={s.goSlot}
              contentStyle={s.go}
              testID="detail-directions"
            >
              <Glyph name="navigate" size={ICON.action} color={colors.accent} />
            </PressableScale>
          ) : undefined}
        >
          {/* Two lines, then an ellipsis, and a tap opens it.
              Of the 648 published places, 254 fit on one line
              beside the button and 606 fit in two; 42 do not, and
              those forty-two are the whole of this. A card that
              grows to five lines for one address in fifteen costs
              the other fourteen the opening hours.

              `measured` is the first paint, deliberately
              unclamped: `onTextLayout` reports the lines it
              actually drew, so a Text already limited to two can
              only ever report two and could never say whether
              there was a third. Measuring before clamping is the
              one way to know. It costs one frame on the long ones
              — the full address, then the clamp — during the same
              mount the photographs are still arriving in. */}
          <Pressable
            onPress={addrLong ? () => setAddrOpen((v) => !v) : undefined}
            disabled={!addrLong}
            accessibilityRole={addrLong ? 'button' : undefined}
            accessibilityState={addrLong ? { expanded: addrOpen } : undefined}
            accessibilityHint={addrLong
              ? t('Shows the whole address', 'Xem đầy đủ địa chỉ', '住所の全文を表示', '显示完整地址', '顯示完整地址')
              : undefined}
            testID="detail-address-toggle"
          >
            <Text
              style={s.infoValue}
              testID="detail-address"
              numberOfLines={measured == null || addrOpen ? undefined : ADDRESS_LINES}
              onTextLayout={(e) => {
                if (measured == null) setMeasured(e.nativeEvent.lines.length);
              }}
            >
              {address}
            </Text>
          </Pressable>
        </InfoRow>
      )}

      {/* The map, under the address it answers.
          It used to be a card of its own below this one, which asked
          the reader to bind "where" to two separate objects — the
          words in one box, the picture in another. Here it is the
          address's own illustration.

          Frozen (`interactive={false}`), because a live map inside a
          vertical scroll is a hole the page cannot be scrolled
          through. And drawn only where the binary has a Google Maps
          SDK — Expo Go on iOS, or a build made without the key, get
          no map. Being inside the card now, that absence has to be
          quiet: the rows close over the gap and the card is simply a
          card without a picture. */}
      {showsMap && (
        <View style={s.mapSlot}>
          <MiniMap
            lat={place.lat!}
            lng={place.lng!}
            height={150}
            interactive={false}
            onPick={toMaps}
            /* The same picture this place wears on Explore's map,
               instead of Google's default red teardrop — which
               said only "a place", on a screen that is already
               about one place, while the chips two rows up said
               Focus and Cafés.

               `chip` is null because a detail page stands in no
               filter, and `chosen` is false on purpose: the coral
               variant exists to win a fight with 250 other pins,
               and there is no fight here. Plain keeps the
               category's own colour as the fill, which is the
               thing being said. */
            pin={pinImage(place, null, false)}
          />
          {/* Bottom right, and that corner is not a taste. Google's
              terms require their attribution stay visible, and the
              logo sits bottom *left* — measured off a real render,
              60 × 29pt. The map is 150pt tall, so a 40pt disc in
              the opposite corner clears it with room to spare.

              A disc and no word. The labelled pill was 104.7pt
              wide and laid that much of a 320pt map under itself,
              covering street names on a picture whose whole job is
              street names. The arrow is the same glyph the row
              carried and the same one `MiniMap`'s locate button
              wears, and it keeps its name for VoiceOver — what
              goes is the ink on the tiles, not the label.

              Tapping the map already opened Maps; this only says
              so. Which is the same argument that first put the
              button on the row — an address looks like a fact, not
              a button — now made where it costs the picture least. */}
          <PressableScale
            onPress={toRoute}
            accessibilityRole="button"
            accessibilityLabel={t('Directions', 'Chỉ đường', '経路', '路线', '路線')}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={s.goOnMap}
            contentStyle={s.goDisc}
            testID="detail-directions"
          >
            <Glyph name="navigate" size={ICON.action} color={colors.accent} />
          </PressableScale>
        </View>
      )}
    </>
  );
}

/** One line for "open now", the week behind a chevron. */
function HoursRow({ hours, openNow, firstRow }: {
  hours: ReturnType<typeof groupHours>;
  openNow: ReturnType<typeof openState>;
  firstRow: Row;
}) {
  const { t } = useI18n();
  const [hoursOpen, setHoursOpen] = useState(false);
  return (
    <View>
      {firstRow !== 'hours' && <View style={s.rowDivider} />}
      {/* The one line most people came for is the whole row;
          the table it was derived from waits behind the
          chevron instead of pushing Call and Website off the
          screen. Green when open; closed is a fact about a
          café, not a fault, so it stays in the quiet grey
          rather than going red. */}
      <Pressable
        onPress={() => setHoursOpen((v) => !v)}
        style={s.infoStack}
        accessibilityRole="button"
        accessibilityState={{ expanded: hoursOpen }}
      >
        <View style={s.infoIconSlot}>
          <Glyph name="time-outline" size={ICON.action} color={colors.textTertiary} />
        </View>
        <View style={s.infoWords}>
          <Text style={s.infoLabel}>{t('Hours', 'Giờ mở cửa', '営業時間', '营业时间', '營業時間')}</Text>
          {openNow ? (
            <Text style={[s.openNow, !openNow.open && s.openNowShut]}>
              {/* Whole sentences per language, not a preposition
                  glued to a time: Japanese puts "まで" after the
                  hour, so concatenating a translated "until" in
                  front of it reads backwards. */}
              {openNow.open
                ? openNow.untilMin != null
                  ? t(
                    `Open now · until ${clockOf(openNow.untilMin)}`,
                    `Đang mở cửa · đến ${clockOf(openNow.untilMin)}`,
                    `営業中 · ${clockOf(openNow.untilMin)}まで`,
                    `营业中 · 营业至 ${clockOf(openNow.untilMin)}`, `營業中 · 營業至 ${clockOf(openNow.untilMin)}`,
                  )
                  : t('Open now · 24 hours', 'Đang mở cửa · 24 giờ', '営業中 · 24時間', '营业中 · 24小时', '營業中 · 24小時')
                : openNow.opensAtMin != null
                  ? t(
                    `Closed · opens ${clockOf(openNow.opensAtMin)}`,
                    `Đã đóng cửa · mở lúc ${clockOf(openNow.opensAtMin)}`,
                    `閉店中 · ${clockOf(openNow.opensAtMin)}開店`,
                    `已打烊 · ${clockOf(openNow.opensAtMin)} 开门`, `已打烊 · ${clockOf(openNow.opensAtMin)} 開門`,
                  )
                  : t('Closed today', 'Hôm nay đóng cửa', '本日休業', '今日休息', '今日休息')}
            </Text>
          ) : null}
          {/* Hours in a shape openState cannot read still get
              their table behind the chevron; the label alone
              heads the row until it is opened. */}
        </View>
        {/* The same box as the clock opposite it. Left
            top-aligned it would have stayed where the clock
            used to be and the row would read as two glyphs at
            two heights — the raggedness this change is about,
            moved to the other end of the row. */}
        <View style={s.infoChevronSlot}>
          <Glyph name={hoursOpen ? 'chevron-up' : 'chevron-down'} size={ICON.action} color={colors.textTertiary} />
        </View>
      </Pressable>
      {hoursOpen && (
        // Indented to the gutter the values keep, so the table
        // reads as this row's working rather than as a fifth fact.
        <View style={s.hoursTable}>
          {hours.map((row) => (
            <View key={row.label} style={s.hourRow}>
              <Text style={s.hourDay}>{row.label}</Text>
              <Text style={s.hourTime}>{row.hours}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
