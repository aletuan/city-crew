import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Glyph, ICON } from '../../components/ui/glyph';
import { LinearGradient } from 'expo-linear-gradient';
import { useLoop } from '../../components/ui';
import { type FindingLine, type StepState } from '../../lib/sketch';
import { colors, gradAI } from '../../theme';
import { s } from './styles';

/**
 * The reasoning feed: the fact being worked out, over the one just
 * settled.
 *
 * ── the animation, and what it is allowed to imply ──
 *
 * Two slots, never more. The current line fades up bright with its mark
 * pulsing; when the next fact lands, it slides into the seat above —
 * dimmed, keeping its own glyph — and the feed moves on. Nothing loops
 * and there is no marquee: a status line that comes back round is the
 * tell of a progress bar with nothing behind it, and this screen spent
 * its first life being exactly that. Every line here is a fact about a
 * plan that already exists, shown once, settled once.
 *
 * ── why the whole box does not resize ──
 *
 * The lines are different lengths and two of them wrap. Animating a box
 * that also changes height makes the steps above it jump, so the height
 * is held at two lines' worth and the text is centred in it. A little
 * empty space under a short line is cheaper than a list that twitches
 * every time a fact lands.
 *
 * ── reduced motion ──
 *
 * `still` cuts the transition rather than shortening it. Somebody who has
 * asked the system for less movement is not asking for faster movement,
 * and this screen already honours the same flag on the orb.
 */
export function FindingFeed({ previous, current, still }: {
  previous: FindingLine | null; current: FindingLine; still: boolean;
}) {
  // The current line arrives the way the single line always did: a short
  // fade-and-rise, keyed on the text so a fact held across two steps
  // does not blink.
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(6)).current;
  useEffect(() => {
    if (still) { fade.setValue(1); rise.setValue(0); return; }
    fade.setValue(0);
    rise.setValue(6);
    const run = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [current.text, still, fade, rise]);

  // The settled line slides up into its seat — the same frame the fact
  // it names stops being current — and lands dimmed. The dim is the
  // whole costume: a real blur is Android-only in RN and a milky overlay
  // everywhere else, and a line at 60% in the footnote colour says
  // "already handled" just as clearly on both platforms.
  //
  // Which is also why the tick that used to sit here is gone. It said
  // the same word the dim already says, in a second glyph a size below
  // the one across from it — so the two rows never lined up, and the
  // settled fact lost the one mark that said what *kind* of fact it
  // was. Keeping its own glyph costs nothing the dim was not already
  // paying for.
  const prevIn = useRef(new Animated.Value(0)).current;
  const prevRise = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    if (!previous) return;
    if (still) { prevIn.setValue(1); prevRise.setValue(0); return; }
    prevIn.setValue(0);
    prevRise.setValue(12);
    const run = Animated.parallel([
      Animated.timing(prevIn, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(prevRise, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [previous?.text, previous, still, prevIn, prevRise]);

  // The soft pulse on the current line's mark — "being worked out", said
  // without words. A loop, which is exactly what the box's own rules
  // forbid for *content*; a glow is not content, and it stops the moment
  // the line settles into the seat above. Reduce Motion stills it, the
  // same courtesy the orb and the tab bar already pay.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (still) { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [still, pulse]);

  return (
    <View style={s.finding} testID="findings">
      {previous ? (
        <Animated.View
          style={[s.findingRow, {
            opacity: prevIn.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }),
            transform: [{ translateY: prevRise }],
          }]}
        >
          <View style={s.findingBadge}>
            <Glyph
              name={previous.icon as React.ComponentProps<typeof Ionicons>['name']}
              size={ICON.text}
              color={colors.textSecondary}
            />
          </View>
          <Text style={s.findingPrevText} numberOfLines={1}>{previous.text}</Text>
        </Animated.View>
      ) : null}
      <Animated.View style={[s.findingRow, { opacity: fade, transform: [{ translateY: rise }] }]}>
        <Animated.View style={[s.findingBadge, { opacity: pulse }]}>
          {/* The colour of the words it sits with, not the accent. Coral
              on this screen means progress — the ring's arc, a step done,
              the step running — and a glyph that only says which kind of
              fact this is was spending that meaning on a label. What
              marks the line as the current one is the pulse around this
              view and the weight of the text, both of which stay. */}
          <Glyph
            name={current.icon as React.ComponentProps<typeof Ionicons>['name']}
            size={ICON.text}
            color={colors.textSecondary}
          />
        </Animated.View>
        <Text style={s.findingText}>{current.text}</Text>
      </Animated.View>
    </View>
  );
}

/**
 * The mark beside a step, in whichever of the three states it is in.
 *
 * The active one is a bright arc travelling over a faint full ring, and
 * both halves of that matter. The first version drew only the arc — a
 * circle with its top border transparent — which is a *hole*, not a
 * segment, and a hole in a ring that is also standing still does not read
 * as "working". It reads as broken, which is what it was reported as.
 *
 * So: the track goes back, and the arc turns again.
 *
 * It turns at the orb's own 1.6s, which answers the objection that put it
 * on hold. Two spinners at two speeds read as two separate things
 * happening; two turning in step read as one thing, in two sizes.
 */
/**
 * One answer in the facts card: a glyph, what was chosen, and what
 * qualifies it.
 *
 * The qualifier is optional and the cell does not invent one. `p.where`
 * is a district on one visit and "Melbourne · Gần bạn" on the next,
 * so a cell that always drew two lines would have to make the second one
 * up — and the date cell beside it fixes the row's height either way, so
 * a one-line cell centres against it rather than shrinking the row.
 *
 * `numberOfLines={1}` on both: a long district under a long city name
 * would otherwise wrap inside a cell half a phone wide, which is the
 * problem this card was built to end rather than move.
 */
export function Fact({ icon, primary, secondary }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  primary: string;
  secondary?: string | null;
}) {
  return (
    <View style={s.factCell}>
      <View style={s.factDisc}>
        <Glyph name={icon} size={ICON.action} color={colors.text} />
      </View>
      <View style={s.factText}>
        <Text style={s.factPrimary} numberOfLines={1}>{primary}</Text>
        {!!secondary && <Text style={s.factSecondary} numberOfLines={1}>{secondary}</Text>}
      </View>
    </View>
  );
}

function StepMark({ state, still }: { state: StepState; still: boolean }) {
  const spin = useLoop(1600, still || state !== 'active');

  if (state === 'done') {
    return (
      <LinearGradient {...gradAI} style={s.mark}>
        <Glyph name="checkmark" size={ICON.text} color={colors.accentInk} />
      </LinearGradient>
    );
  }
  if (state !== 'active') return <View style={[s.mark, s.markPending]} />;

  // Held still, an arc parked at some angle is the broken-looking ring
  // this screen already shipped once. With nothing turning there is no
  // reason to draw a segment at all, so the running mark closes into a
  // solid ring — the third distinct shape, beside the gradient disc that
  // means done and the dashed outline that means waiting.
  if (still) return <View style={[s.mark, s.markStill]} />;

  return (
    <View style={s.mark}>
      {/* The track. Without it the arc is a gap rather than a segment, and
          the ring looks damaged at every angle it stops at. */}
      <View style={[StyleSheet.absoluteFill, s.markTrack]} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          s.markArc,
          { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
        ]}
      />
    </View>
  );
}

export function StepRow({ label, state, still, last }: {
  label: string; state: StepState; still: boolean;
  /** No rail below the final step — there is nothing for it to reach. */
  last: boolean;
}) {
  // The label breathes while its step is running — the `shimmer` the design
  // asked for, at 0.62 rather than 0.45 at the bottom. Text that fades most
  // of the way out is text somebody is mid-sentence with when it goes.
  const glow = useLoop(1400, still || state !== 'active', 'inOut');
  const dim = state === 'active'
    ? glow.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] })
    : 1;

  return (
    <View style={s.step}>
      {/* The marks are joined, because the steps are. Five circles down a
          card read as five things; a line through them reads as one
          thing happening in order, which is what the screen is reporting.
          It is also the shape the plan list already uses for its stops —
          see `dotCol` and `rail` there — so the two screens describe a
          sequence the same way.
          The column stretches and the rail is `flex: 1`, so it reaches
          the next mark whatever the label under it turned out to be;
          which is why the row's vertical rhythm moved onto the label
          below, where the stretch can see it. */}
      <View style={s.markCol}>
        <StepMark state={state} still={still} />
        {!last && <View style={s.rail} />}
      </View>
      <View style={s.stepBody}>
        <Animated.Text
          style={[
            s.stepText,
            state === 'pending' && s.stepTextOff,
            state === 'active' && s.stepTextOn,
            { opacity: dim },
          ]}
          numberOfLines={2}
        >
          {label}
        </Animated.Text>
        {/* The rule under the label, and it has to earn its place beside
            the rail — two separators in one row is the way this reads as
            busy rather than as clear.
            They are given different jobs and different means. The rail is
            vertical and tinted: it is the thread, and it says these five
            are one thing in order. The rule is horizontal, neutral and a
            hairline: it is the row's floor, and it only says where to
            look next. Nothing carries both an axis and a colour, so
            neither is saying what the other already said.
            It is also inset — it starts at the label, not at the card —
            so the thread runs past it uninterrupted rather than being
            crossed out five times. */}
        {!last && <View style={s.rule} />}
      </View>
    </View>
  );
}
