// The offer to keep the gallery, on a place the reader themselves put here.
//
// ── who ever sees this ──
//
// Three conditions, all of them also clauses of the insert policy: signed
// in, granted the role by the desk, and looking at a place they imported.
// `canKeepGallery` states them once and this component draws nothing
// unless it says yes — which is the point. A control that appears for
// everybody and refuses most of them is worse than no control.
//
// The mockup this follows had a second, primary "Edit Place" button
// beside this one, greyed out. It is not here. A disabled primary button
// is the loudest thing on a panel promising the one thing that cannot be
// done, and it pulls the eye away from the button that works. Editing
// arrives in its own release, with its own button.
//
// ── one door, not one verb ──
//
// This used to be the upload itself: a camera glyph, "Add photo", and the
// picker opening from the card. It opens the gallery now, because adding
// stopped being the only thing a guide can do with the pictures — they
// can choose the cover, hide one, put them in order — and a card with a
// button per verb would be four buttons on a panel whose whole job is to
// say "this is yours". The upload lives in `useAddPhoto`, behind the
// gallery's own header.
//
// ── the panel is the door ──
//
// It had a solid coral "Gallery" pill at its right, and on the phone that
// was the accent twice over — a filled button on a tinted card — beside a
// check-in pill that is itself solid coral once worn. The word repeated
// the line beside it ("…improve your gallery?") and gave up its own room
// on a 320pt window. So the whole card is the button now, and the only
// mark that says so is a chevron: the row-that-opens-a-screen sign the
// map card and the invite card already use. Not a bare "Gallery ›" link
// either — the 44pt a target needs is the card's height for free, where a
// link is a 17pt line someone has to aim at.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import welcomeLogo from '../../assets/welcome-logo.png';
import { useAuth } from '../lib/auth';
import { greetingName } from '../lib/greet';
import { useI18n } from '../lib/i18n';
import { useIsEditor, useIsGuide } from '../lib/useGuideGrant';
import { canKeepGallery } from '../lib/gallery';
import type { Place } from '../lib/types';
import { colors, font, radius, space } from '../theme';
import { PressableScale } from './ui';

export default function LocalGuidePanel({ place, onOpen, testID }: {
  place: Place;
  /** Opens the gallery. The screen owns the navigation; this only asks. */
  onOpen: () => void;
  testID?: string;
}) {
  const { t } = useI18n();
  const { session, profile } = useAuth();
  const uid = session?.user?.id ?? null;
  const who = greetingName(profile?.full_name);
  // Read, not fetched. `useIsGuide` answers from a store the launch
  // filled, so this component is right on its first frame — a fetch here
  // drew the card without the panel and then shoved it down a round trip
  // later, once for every place its owner opened. See `lib/guideGrant`.
  const granted = useIsGuide(place.city_id);
  const editor = useIsEditor();

  if (!canKeepGallery(place, { uid, granted, editor })) return null;

  return (
    // `testID` stays on a plain view so the screen can find the panel
    // without knowing it is pressable; the button keeps its own id.
    //
    // Named "Gallery" for VoiceOver, the screen it opens, with the question
    // as the hint: a card read out whole would be a sentence, then a name,
    // then a question, before the reader learns it is a button at all.
    <View style={s.slot} testID={testID}>
      <PressableScale
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={t('Gallery', 'Gallery', 'ギャラリー')}
        accessibilityHint={t('Want to improve your gallery?', 'Bạn muốn cải thiện gallery?', 'ギャラリーを充実させますか？')}
        // A card's press, not a button's: 0.97 on something this wide
        // moves its edges 5pt and reads as a lurch (InviteCard uses this).
        scaleTo={0.985}
        style={[s.panel, s.head]}
        testID="guide-open-gallery"
      >
        {/* The app's own mark rather than a camera glyph.
            A camera said what the card already says, twice on one card —
            and said it about the tool instead of about who is being
            asked. This panel only ever shows to the person who put
            the place here, so the mark that belongs at its head is the one
            they recognise. The artwork carries its own cut-out background,
            so it reads on either ground. */}
        <View style={s.mark}>
          <Image source={welcomeLogo} style={s.markLogo} contentFit="contain" />
        </View>
        <View style={s.words}>
          {/* Their name, then a question.
              Not "Your place / Keep it up to date", which was a claim of
              ownership followed by a chore — and this panel is neither.
              It appears to exactly one person, the one who went and put
              this café in front of everybody else, so it says their name
              and asks.

              A question is also the form that survives being read for
              the tenth time, which matters here: the panel shows every
              time its author opens their own place.

              `greetingName` picks the word — the last one, which is the
              given name in a Vietnamese name and the name English greets
              with too; see that module for why the family name would
              have been wrong in both. It answers null for a profile with
              no usable name, and then this greets a stranger rather than
              guessing, because "Chào 2024," is worse than "Chào bạn,".

              The question is short because the column was: about twenty
              characters at this size, beside the old button. "Bạn muốn bổ
              sung thêm ảnh chứ?" was thirty and took two lines on the
              phone, which is a third line of prose on a card whose whole
              job is one button. Eighteen fits, and says the same thing.
              No space before the question mark — Vietnamese does not
              take one, and neither does any other string in this app. */}
          <Text style={s.title} numberOfLines={1}>
            {who
              ? t(`Hi ${who},`, `Chào ${who},`, `${who}さん、`)
              : t('Hi there,', 'Chào bạn,', 'こんにちは、')}
          </Text>
          <Text style={s.sub}>
            {t('Want to improve your gallery?', 'Bạn muốn cải thiện gallery?', 'ギャラリーを充実させますか？')}
          </Text>
        </View>
        {/* "Gallery" in every language was a request, and it still holds:
            it is the accessible name above, and the gallery screen's
            title. It is not drawn here because the question beside it
            already says the word. */}
        <Ionicons name="chevron-forward" size={17} color={colors.accent} />
      </PressableScale>
    </View>
  );
}

const s = StyleSheet.create({
  // The accent at tint strength, the one place on this screen that takes a
  // fill: it is an offer rather than a fact, and everything around it —
  // the facts row, the info card — is glass or paper.
  slot: { marginTop: space.headingToContent },
  panel: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.card, padding: space.cardPadding,
  },
  // The mark, the words and the chevron on one line, where they used to
  // stack. Stacked, this card ran 183pt — a third of the first screen,
  // spent on an affordance only the person who added the place can even
  // see, and paid for by pushing the opening hours below the fold.
  head: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  mark: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  // Inside the 40pt disc with a little air: the logo is drawn to its own
  // edges, where a 22pt glyph came with padding built in.
  markLogo: { width: 26, height: 26 },
  words: { flex: 1, gap: 2 },
  // A size down from `type.cardTitle`: the heading of a two-line aside is
  // not a card title.
  title: { color: colors.accent, fontSize: 15.5, fontWeight: font.semibold },
  // The sub had ~140pt beside the old pill, about twenty characters at
  // this size — the reason both these lines are curt. An earlier draft
  // read "Help keep this place up to date" and wrapped to three ragged
  // lines in that space. The chevron takes 17pt where the pill took about
  // 100 (14 + 16 glyph + 6 + the word + 14), so the column has some 80pt
  // more now — about 158 on a 320pt window, where it had 78 and the
  // greeting truncated. The lines stay as cut.
  sub: { color: colors.textSecondary, fontSize: 13 },
});
