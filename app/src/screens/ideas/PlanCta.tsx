// Out of `IdeasScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import React from 'react';
import { Text, View } from 'react-native';
import { GradientCta } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { startMinFor } from '../../lib/planner';
import type { TripDraft } from '../../lib/trip';
import type { Nav } from '../../nav';
import { s } from './styles';

/** The Plan button, and the line under it while it waits. */
export function PlanCta({ draft, ready, origin, whereLabel, here, dayAt, navigation }: {
  draft: TripDraft;
  ready: boolean;
  origin: { lat: number; lng: number } | null;
  whereLabel: string;
  here: boolean;
  dayAt: (at: Date) => string;
  navigation: Nav;
}) {
  const { t } = useI18n();
  return (
    <View style={s.cta}>
      {/* Dimmed rather than hidden, and the line under it says why.
          A button that vanishes leaves the reader hunting for what
          they missed; one that explains itself does not. */}
      <View style={ready ? undefined : s.ctaOff} pointerEvents={ready ? 'auto' : 'none'}>
        <GradientCta
          wide
          disabled={!ready}
          testID="ideas-sketch"
          // The paw, and the paw only. A sparkle sat here once and
          // went: it was decoration, not a second reading of the
          // label, and it has since become every app's "AI" glyph.
          // The paw is different in kind — it is the planner's own
          // mark, the orb that turns while it thinks and the start
          // mark on the rail after — so the button says *whose*
          // planning this is, which the deliberately generic label
          // does not. `GradientCta`'s own rule: a glyph earns its
          // place beside a label that is generic. Not the map (the
          // Places tab wears one 60pt below) and not the paper plane
          // from the hero (the invite sheet already means "send" by
          // it).
          icon="paw"
          // Generic, and it stays generic — see the lede's note.
          label={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる', '规划行程', '規劃行程')}
          // `whereLabel` rather than the raw draft: only this screen
          // knows which of the three the reader ended up with — a
          // district, a pin, or the position behind "near me" — and
          // the next one has no business re-deciding that.
          onPress={() => {
            // `pointerEvents` above stops a finger and nothing else —
            // VoiceOver's activate still lands here.
            if (!ready) return;
            // The clock of the tap, not of the last render. This is a
            // tab root and stays mounted: opened at ten and tapped at
            // half past eight, it sent an evening starting at 18:00.
            const tapped = new Date();
            const date = dayAt(tapped);
            navigation.navigate('Sketching', {
              company: draft.company,
              categories: draft.categories,
              // `origin`, so the near-me case gets its words too. It
              // used to fall to null here, and a plan that really did
              // start where the reader was standing arrived with no
              // answer to "starting from where".
              where: draft.district ?? (origin ? whereLabel : null),
              // Which of those the words are, for the options
              // heading's second line (`planSub`): the same order
              // `whereLabel` decides them in.
              whereKind: draft.district ? 'district'
                : draft.at ? (draft.atName ? 'place' : 'pin')
                  : here ? 'near' : 'city',
              district: draft.district,
              // The coordinate behind that label. `where` is words and
              // has always been words; sending it without these is how
              // a pin came out as a plan across town, with the header
              // still claiming the pin had been read.
              //
              // `origin`, not `draft.at`: the default is the reader's
              // own position, and it travels the same wire the pin
              // does. See the note on `origin` for why a district
              // suppresses it rather than losing to it.
              atLat: origin?.lat,
              atLng: origin?.lng,
              date,
              when: draft.when,
              // Resolved once, here, and carried. See `PlanAsk.startMin`:
              // the three screens after this one each rebuild the plan,
              // and each reading the clock for itself is how one card
              // opens as a different evening.
              startMin: startMinFor(draft.when, date, tapped),
              from: draft.from,
            });
          }}
        />
      </View>
      {/* The line under a dimmed button, back (17 Oct 2026, UX-06)
          and now naming only what is still missing.

          It went on 15 Oct: the two empty questions are on the
          screen, and the dimmed button already says the day is not
          whole. The review showed what that left out. The questions
          are on the screen above the fold, not beside the button —
          scrolled down to the button, neither is in view — and
          `aria-disabled` tells VoiceOver *that* the button is off,
          never *why*. A dimmed button that cannot say what it waits
          for is a lock without a keyhole.

          The old line was one sentence for every state, so with
          "Friends" already picked it still asked for who's going.
          This one drops whichever half is answered. A full sentence
          rather than "Still to pick: …" — the owner chose it over
          the terser list and over a question in the hero's voice.
          Polite live region, so TalkBack reads the change as a
          chip is tapped; VoiceOver reads it as the next element
          after the button. */}
      {!ready && (
        <Text style={s.ctaHint} accessibilityLiveRegion="polite" testID="ideas-sketch-missing">
          {draft.company === null && draft.categories.length === 0
            ? t(
              "Pick who's going and one thing you fancy to make a plan.",
              'Chọn người đi cùng và một thứ bạn thích để lên kế hoạch.',
              '誰と行くかと、気になるものを1つ選ぶとプランを立てられます。',
              '选择同行的人和一样你感兴趣的，即可制定计划。', '選擇同行的人和一樣你感興趣的，即可制定計畫。',
            )
            : draft.company === null
              ? t(
                "Pick who's going to make a plan.",
                'Chọn người đi cùng để lên kế hoạch.',
                '誰と行くかを選ぶとプランを立てられます。',
                '选择同行的人，即可制定计划。', '選擇同行的人，即可制定計畫。',
              )
              : t(
                'Pick one thing you fancy to make a plan.',
                'Chọn một thứ bạn thích để lên kế hoạch.',
                '気になるものを1つ選ぶとプランを立てられます。',
                '选择一样你感兴趣的，即可制定计划。', '選擇一樣你感興趣的，即可制定計畫。',
              )}
        </Text>
      )}
    </View>
  );
}
