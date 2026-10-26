// The pressable controls: the press itself, chips, tiles, tabs, the
// round and gradient buttons, the switch.

import React, { useRef, useState } from 'react';
import { Animated, Pressable, PressableProps, ScrollView, StyleProp, StyleSheet, Switch, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useI18n } from '../../lib/i18n';
import { moreToTheRight, peekGap, rowWidth, type PeekRow } from '../../lib/peek';
import { useScheme } from '../../lib/theme';
import { bgHex, type Color, colors, font, gradAI, labelScaleCap, radius, space } from '../../theme';
import { CONTROL_H, useNarrowWindow } from './layout';
import { type HapticKind, fireHaptic } from './haptics';
import { useReducedMotion, useLoop } from './motion';

/**
 * Pressable that sinks slightly under the finger (spring scale) and gives
 * a small haptic tap — the default press feedback for cards and buttons.
 *
 * ── a Pressable, prop for prop (19 Oct 2026) ──
 *
 * It takes `PressableProps`, so every prop must mean what it means on a
 * Pressable — and until this date `style` did not. It landed on the
 * animated view inside, the outer element took a `containerStyle`, and a
 * reader who trusted the type got it backwards: four buttons shipped with
 * their glyph stacked on their word, and a day row lost its text to a
 * `flex: 1` that had nothing to divide. The SOLID review of 18 Oct named
 * it (Liskov: a wrapper must stand in for what it wraps); every call site
 * was renamed by one codemod, `style` → `contentStyle` and
 * `containerStyle` → `style`, with no change on screen.
 */
export function PressableScale({ children, style, contentStyle, anchorRef, haptic = 'light', scaleTo = 0.97, onPress, onPressIn, onPressOut, ...rest }: Omit<PressableProps, 'style'> & {
  anchorRef?: React.Ref<React.ComponentRef<typeof View>>;
  haptic?: HapticKind;
  scaleTo?: number;
  /**
   * The outer element, as on any Pressable — **anything that positions
   * this element within its parent**: `flex`, `alignSelf`, `width`,
   * absolute position. A plain style, not Pressable's function form: the
   * pressed state here is the spring, not a restyle.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * The view the children live in, which is the one that scales —
   * **how this element lays out and paints its own contents**:
   * `flexDirection`, `gap`, `padding`, `backgroundColor`, `borderRadius`.
   * A row's `flexDirection: 'row'` belongs here; on `style` it lays out
   * the one animated child and leaves the icon and label stacked.
   */
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 5 }).start();
  return (
    <Pressable
      {...rest}
      ref={anchorRef}
      style={style}
      onPressIn={(e) => { springTo(scaleTo); onPressIn?.(e); }}
      onPressOut={(e) => { springTo(1); onPressOut?.(e); }}
      onPress={(e) => { fireHaptic(haptic); onPress?.(e); }}
    >
      <Animated.View style={[contentStyle, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Chip({ label, count, active, onPress, icon, iconColor, testID }: {
  label: string;
  /** How many the chip stands for, after its word in brackets and the
   *  tertiary ink, as a rating's review count is: "Hà Nội (6)". Search's
   *  city chips (owner, 22 Oct 2026): a figure set flush against a name,
   *  "Hà Nội 6", read as part of the name. */
  count?: number;
  /** For the iOS smoke flows; see `.maestro/README.md`. */
  testID?: string;
  active?: boolean;
  onPress?: () => void;
  /** Optional leading glyph. It keeps its own colour in both states — the
   *  hue is what ties a chip to the dot the same concept wears on a card,
   *  so selection must not repaint it. */
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}) {
  return (
    // A chip is read as a button, and says whether it is chosen, only when
    // it does something — a display-only chip is just its words. Without
    // this VoiceOver read "Cà phê" and nothing else: no hint it could be
    // tapped, and no way to tell the picked ones from the rest, which the
    // fill says to everyone who can see it. `aria-*` rather than
    // `accessibilityState`, which react-native-web drops, so the tests can
    // see what VoiceOver hears.
    <PressableScale
      onPress={onPress}
      haptic="selection"
      scaleTo={0.94}
      contentStyle={[s.chip, onPress && s.chipTap, active && s.chipOn]}
      accessibilityRole={onPress ? 'button' : undefined}
      aria-selected={onPress ? !!active : undefined}
      testID={testID}
    >
      {icon ? <Ionicons name={icon} size={15} color={iconColor ?? colors.textSecondary} /> : null}
      <Text style={[s.chipText, active && s.chipTextOn]}>
        {label}
        {count !== undefined ? <Text style={s.chipCount}>{` (${count})`}</Text> : null}
      </Text>
    </PressableScale>
  );
}

/**
 * The platform switch, centred in its row.
 *
 * ── the bug this exists to stop repeating ──
 *
 * React Native's iOS `Switch` composes `{ alignSelf: 'flex-start' }` into
 * its own style before the caller's (`Switch.js`, the non-Android
 * branch). A row that sets `alignItems: 'center'` therefore centres every
 * child except this one, and the taller the row the further off it looks:
 * on the Profile settings card, where a 44pt round icon makes the row
 * 72pt tall and the switch is 31, it sat 8pt high — parked exactly on the
 * row's 14pt top padding, which is what `flex-start` means there.
 *
 * `StyleSheet.compose` gives the caller's style the last word, so the fix
 * is one line. It is here rather than at the two call sites because the
 * quirk is invisible in the markup: a reviewer reads `alignItems:
 * 'center'` on the row and has no reason to doubt it, and the third
 * switch somebody adds would be misaligned again.
 *
 * Everything else is the platform's, props and all.
 */
export function Toggle(props: React.ComponentProps<typeof Switch>) {
  return (
    <Switch
      // The app's colours, not the platform's green: the track takes the
      // look's accent and the thumb its ink, so a switch is coffee on
      // Coffee and rose on Rose like every other chosen thing. Here so
      // that the second switch (Profile's tips, 17 Oct 2026) could not
      // come out in different colours from the first.
      trackColor={{ false: colors.borderGlass, true: colors.accentFaint }}
      thumbColor={colors.text}
      {...props}
      style={[{ alignSelf: 'center' }, props.style]}
    />
  );
}

/**
 * One cell of a chooser laid out as a grid: the glyph above its word.
 *
 * ── why this exists beside `Chip` ──
 *
 * A chip is sized by its label, which is right for a row of filters you
 * skim — the widths are the shape of the answers. It is wrong for a set
 * you *choose from*, where the labels have nothing to do with one another
 * and their widths are noise: "Cà phê" beside "Thiên nhiên" beside "Về
 * đêm" wraps into a ragged three-and-a-half lines, and the reader has to
 * find the options before they can compare them. Nine equal cells in
 * three rows can be read as a set, and a set is what a question with nine
 * answers is.
 *
 * The glyph goes above the word rather than before it for the same
 * reason: stacked, every cell's icon lands on one line and the eye can
 * run down the column; inline, each one sits wherever its label's width
 * put it.
 *
 * ── the two colours ──
 *
 * The icon keeps its category's hue in both states, exactly as `Chip`
 * does and for the same reason: the hue is what ties this cell to the dot
 * the same concept wears on a place card, so selection must not repaint
 * it. What selection changes is the ground and the word — `accentSoft`
 * under `accent`, the pair the app already uses for a chosen control.
 */
export function Tile({ label, icon, iconColor, active, onPress, testID }: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** The concept's own hue, kept through selection. */
  iconColor?: string;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      scaleTo={0.97}
      style={{ flex: 1 }}
      contentStyle={[s.tile, active && s.tileOn]}
      accessibilityRole="button"
      // `aria-selected` rather than `accessibilityState`, which
      // react-native-web drops — see `Chip`.
      aria-selected={!!active}
      testID={testID}
    >
      <Ionicons name={icon} size={24} color={iconColor ?? colors.textSecondary} />
      {/* Two lines allowed, and needed: "Nightlife" is "Về đêm" in one
          language and "ナイトライフ" in another, and a cell a third of
          the screen wide cannot hold the third on one line. Centred, so
          a wrapped label stays under its own glyph. */}
      <Text style={[s.tileText, active && s.tileTextOn]} numberOfLines={2}>{label}</Text>
    </PressableScale>
  );
}

/**
 * `Tile`s in even columns.
 *
 * Rows are built here rather than left to `flexWrap`, and the last one is
 * padded with spacers, because a wrapped row of `flex: 1` children
 * stretches whatever landed in it: seven categories in threes would draw
 * two normal rows and then one cell twice the width of the others,
 * reading as emphasis on whichever concept happened to be seventh.
 */
export function TileGrid({ cols, children }: { cols: number; children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, i) => (
        <View key={i} style={s.tileRow}>
          {row}
          {Array.from({ length: cols - row.length }, (_, k) => (
            <View key={`pad${k}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * The switch between the halves of a screen — labelled doors, the open
 * one underlined.
 *
 * Underlines, after two filled attempts on the Crew screen: a gradient
 * made a tab as loud as Accept, and the soft pill that works over the
 * tab bar's glass sank into flat paper — pale coral on a pale track on
 * cream is three warm greys pretending to differ. On a flat page,
 * contrast has to come from the type itself: the chosen tab's word and
 * glyph go accent over a 2pt rule, and there is no tray, no fill, no
 * slab across the screen. The row hugs its words, left-aligned, like
 * every chip row in the app.
 *
 * `count` rides differently on each half: a bubble on an unchosen tab —
 * a bell, rung from the other room, the only place a bell is news — and
 * folded into the label on the chosen one, where whatever it counts is
 * already on screen. Zero draws nothing either way.
 *
 * `tally` is the other kind of number — a fact rather than news: how
 * many the tab holds, folded into the label in both states and never a
 * bubble, because a permanent bubble would ring a bell over nothing
 * new. Zero draws nothing here too: "Friends (0)" states an absence
 * twice. A tab carries one kind or the other, not both.
 */
export function UnderlineTabs<K extends string>({ tabs, active, onChange, right }: {
  tabs: { key: K; icon: keyof typeof Ionicons.glyphMap; label: string; count?: number; tally?: number; testID?: string }[];
  active: K;
  onChange: (k: K) => void;
  /** The row's far end — a small control about the list the tabs switch
   *  (a view toggle), in the space left-aligned tabs leave free. Removed
   *  once as unused; back with a tenant. */
  right?: React.ReactNode;
}) {
  // The strip's gap is the one thing in it that can give on a small
  // phone: Crew's two tabs — "Requests" with its bubble, "Your friends
  // (12)" — come to about 280pt with the 26pt gap, and a 320pt window has
  // 276 between the page margins. The tabs can also shrink now, so on a
  // width nothing anticipated the last label ellipsizes rather than
  // running off the edge under the screen's rounded corner.
  const narrow = useNarrowWindow();
  return (
    <View style={[s.tabsRow, narrow && s.tabsRowNarrow]}>
      {tabs.map(({ key, icon, label, count, tally, testID }) => {
        const on = active === key;
        const worded = tally
          ? `${label} (${tally})`
          : on && count ? `${label} (${count})` : label;
        return (
          <PressableScale
            key={key}
            contentStyle={[s.tabItem, on && s.tabItemOn]}
            scaleTo={0.97}
            haptic="selection"
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            onPress={() => onChange(key)}
            testID={testID}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Ionicons name={icon} size={16} color={on ? colors.accent : colors.textTertiary} />
            <Text style={[s.tabText, on && s.tabTextOn]} numberOfLines={1}>
              {worded}
            </Text>
            {!on && count ? (
              <View style={s.tabBadge}>
                {/* A 21pt disc; the number is capped so it stays a
                    number in a disc rather than a digit spilling out of
                    one. See `labelScaleCap`. */}
                <Text style={s.tabBadgeText} maxFontSizeMultiplier={labelScaleCap}>{count}</Text>
              </View>
            ) : null}
          </PressableScale>
        );
      })}
      {right ? <View style={{ marginLeft: 'auto', flexShrink: 0 }}>{right}</View> : null}
    </View>
  );
}

/** How wide the far end of an `UnderlineChoice` fades into the page:
 *  narrower than the `PEEK_SHOWN` the cut leaves, so the cut item's glyph
 *  is in the clear and only its word goes under. */
const CHOICE_FADE = 28;
/** The row's spacing, and how far the gap may give to cut an item at the
 *  edge (`lib/peek`, where 14–34 is measured). */
const CHOICE_ROW: PeekRow = { padLeft: space.page, base: 22, min: 14, max: 34 };
/** The stacked row's spacing. Each item already carries `STACK_MIN` of
 *  width around a short word, so the air between two is partly its own,
 *  and the base comes down from inline's 22 to 16 — a judgement to check
 *  on a phone, not a measurement. The cut may give from 10 to 28. */
const STACK_ROW: PeekRow = { padLeft: space.page, base: 16, min: 10, max: 28 };
/** A stacked item's narrowest: the 44pt a target is, and room for the
 *  22pt glyph to stand over a two-letter word without the next item's
 *  glyph crowding it. */
const STACK_MIN = 56;
/** The key the "All" item answers to: never a key a caller's item has. */
const ALL_KEY = '__all__';

/**
 * A row of things to narrow by, one at a time, drawn as `UnderlineTabs`
 * draws a switch: the word and a 2pt rule in the accent under the chosen
 * one, no fill, no outline (owner, 24 Oct 2026 — Explore's categories,
 * which were chips with a filled ground, the last boxed row in a header
 * whose other controls had all lost theirs).
 *
 * Three things set it apart from the tabs, each because it narrows a list
 * rather than switching between halves of a screen:
 *
 * - Nothing chosen is an answer: the whole list. So the chosen one tapped
 *   again lets go, as every filter chip in the app does, and `chosen` may
 *   be null. A tab bar always has a tab open.
 * - It scrolls, and says so: nine categories are some 900pt of row on a
 *   390pt phone, and a row that simply stops at the screen's edge reads
 *   as finished. The edge always cuts an item — the gap gives a little,
 *   measured against this phone, these words and this text size, so a
 *   glyph and a letter of the next kind show (`lib/peek`) — and the far
 *   end fades into the page while anything is left to scroll to, and
 *   not once the row is at its end or fits whole (owner, 24 Oct 2026: on
 *   one phone the edge fell in a gap, and the row read as finished).
 * - A glyph keeps its own colour, chosen or not — the rule `Chip` and
 *   `Tile` keep, for their reason: the hue is what ties the category to
 *   the dot it wears on a card and the pin it wears on the map. So the
 *   chosen state is the word and the rule, never the glyph; two of the
 *   category hues (Cafés, Eats) are warm enough to pass for the accent.
 *
 * `aria-selected` on a button rather than the tabs' role, which says
 * "one of these is always open": this is a filter, and VoiceOver should
 * read it as one.
 *
 * ── "All" (owner, 25 Oct 2026) ──
 *
 * `all` puts an item first that stands for nothing chosen, and wears the
 * rule while nothing is. The owner took "All" out on 15 Oct, when it was
 * a chip that meant "no chip" and a tap on it was the only way to leave a
 * choice; with the boxes gone the row has room for it, and a row with one
 * word always underlined says what it is showing where a row with none
 * underlined says nothing. Tapping the chosen item still lets go.
 *
 * The cut is measured against where the fade begins, not the screen's
 * edge, so the piece of the next item it shows is clear of the fade.
 *
 * A › on the fade, while the row sat at its start, shipped for a day
 * (#1176) and came out (owner, 25 Oct 2026, on a phone): it stood on the
 * very item the edge cuts, so the two signs that the row goes on drew
 * over each other, and the cut alone says it.
 *
 * ── figures (owner, 25 Oct 2026) ──
 *
 * Search's cities came over from chips with the figures they carried, so
 * an item may have one, set after its word as `Chip` sets it: "Hà Nội
 * (6)", in the tertiary ink. "All" takes `allCount`, and draws none until
 * the caller knows it.
 *
 * ── an item that would leave nothing (owner, 25 Oct 2026) ──
 *
 * `off` dims an item to the 0.45 `ActionSheet`'s rows wear for "not now"
 * and takes the press away: on a sheet asking two questions, a city with
 * none of the kind already chosen is a tap that would show nothing. Dimmed
 * rather than dropped, the owner's choice — dropped, the row would close
 * up and reorder under the reader's thumb each time the other question
 * changed. The chosen item is never off, whatever the caller says: it is
 * the way back to everything.
 *
 * ── stacked (owner, 25 Oct 2026) ──
 *
 * `stacked` sets the glyph over the word, larger, for a row that starts
 * something rather than narrows it — Search's Browse, where a tap is a
 * search and the row is gone the moment there is a word. A row of doors
 * looks unlike a row of filters on purpose: the reader should not wait
 * for an underline that a launcher never draws. The items are narrower,
 * so more of the row is in sight, and the cut and the fade are the same
 * measured ones.
 */
export function UnderlineChoice<K extends string>({ items, chosen, onPick, all, allCount, ground, stacked, testID }: {
  /** `count`, when given, follows the word as `Chip`'s does: "Hà Nội (6)". */
  items: { key: K; label: string; count?: number; icon?: keyof typeof Ionicons.glyphMap; iconColor?: string; testID?: string; off?: boolean }[];
  chosen: K | null;
  /** The key tapped, or null for "All". */
  onPick: (k: K | null) => void;
  /** The "All" item's word, when the row has one, and its figure. */
  all?: string;
  allCount?: number;
  /** The ground the row sits on, as plain hex, for the fade to end in:
   *  the page's unless the row is on something else (a sheet). */
  ground?: string;
  /** The glyph over the word: a row that launches rather than filters. */
  stacked?: boolean;
  testID?: string;
}) {
  // The page's own colour, as plain hex: the fade has to end in exactly
  // the ground the row sits on, and a gradient takes no dynamic colour.
  const page = bgHex[useScheme().scheme];
  const bg = ground ?? page;
  // What the row measures of itself: its own width, each item's, and how
  // far it is scrolled. Until every item has been measured the row keeps
  // its own gap and draws no fade — a beat, before the first frame shows.
  const [edge, setEdge] = useState(0);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [scrollX, setScrollX] = useState(0);
  const row: { key: string; label: string; count?: number; icon?: keyof typeof Ionicons.glyphMap; iconColor?: string; testID?: string; off?: boolean; on: boolean; pick: K | null }[] = [
    ...(all ? [{ key: ALL_KEY, label: all, count: allCount, testID: testID ? `${testID}-all` : undefined, on: chosen === null, pick: null }] : []),
    ...items.map((i) => ({ ...i, on: chosen === i.key, pick: i.key })),
  ];
  const measured = row.map((i) => widths[i.key] ?? 0);
  const known = edge > 0 && measured.every((w) => w > 0);
  const spacing = stacked ? STACK_ROW : CHOICE_ROW;
  const gap = known ? peekGap(measured, edge - CHOICE_FADE, spacing) : spacing.base;
  const more = known && moreToTheRight(rowWidth(measured, gap, space.page, space.page), edge, scrollX);
  return (
    <View testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.choiceRow, { gap }]}
        onLayout={(e) => setEdge(e.nativeEvent.layout.width)}
        onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
        // A row under a search box is tapped with the keyboard up. The
        // default ('never') spends that first tap on putting the keyboard
        // away, and the choice is never made.
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={32}
        testID={testID ? `${testID}-scroll` : undefined}
      >
        {row.map(({ key, label, count, icon, iconColor, testID: itemID, off, on, pick }) => {
          const dim = !!off && !on;
          return (
            <PressableScale
              key={key}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                setWidths((was) => (was[key] === w ? was : { ...was, [key]: w }));
              }}
              contentStyle={[s.tabItem, stacked && s.stackItem, on && s.tabItemOn, dim && s.choiceOff]}
              scaleTo={dim ? 1 : 0.97}
              haptic="selection"
              // The row is 33pt drawn; the slop makes it the 44pt a
              // target is, above and below, without spacing the words out.
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              onPress={() => onPick(pick)}
              // `disabled` alone, as `ActionSheet`'s rows: the press is
              // dropped and VoiceOver says "dimmed" by itself.
              disabled={dim}
              testID={itemID}
              accessibilityRole="button"
              aria-selected={on}
            >
              {icon ? <Ionicons name={icon} size={stacked ? 22 : 16} color={iconColor ?? colors.textSecondary} /> : null}
              <Text style={[s.choiceText, stacked && s.stackText, on && s.tabTextOn]} numberOfLines={1}>
                {label}
                {count !== undefined ? <Text style={s.chipCount}>{` (${count})`}</Text> : null}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
      {more ? (
        <LinearGradient
          pointerEvents="none"
          colors={[`${bg}00`, bg]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={s.choiceFade}
          testID={testID ? `${testID}-fade` : undefined}
        />
      ) : null}
    </View>
  );
}

export function RoundIconButton({ icon, onPress, label, size = 21, color, testID }: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label?: string;
  size?: number;
  /**
   * Ink, when the glyph carries a state rather than an action.
   *
   * Every button in this shape used to draw in `colors.text`, which is
   * right for back and for an overflow menu — both of them are doors, and
   * a door is not on or off. The heart is: it shipped through here and
   * came out near-black while the identical heart on the shelf was coral,
   * so the same gesture wore two colours on two screens.
   *
   * Optional, and the default is the one to reach for. A coloured round
   * button is for a control whose colour *is* the information.
   *
   * The theme's `Color` rather than `string`, because every token in the
   * theme is a `dyn()` — a value that resolves per theme, not a hex.
   */
  color?: Color;
  testID?: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.92}
      contentStyle={s.backBtn}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={size} color={color ?? colors.text} />
    </PressableScale>
  );
}

/**
 * The lone action in an empty-state card: gradient, glyph, label.
 *
 * There were two of these, written apart and landing 2pt apart —
 * 24/15 under "No collections yet", 22/13 under an empty list. Nobody
 * chose that difference, and it is the kind that compounds: the next one
 * would have been a third figure. One size, and it is the roomier of the
 * two, which also buys a 46pt touch target instead of 42.
 *
 * Distinct from `AddPill` on purpose. That one sits beside a heading or
 * inside a bar and is sized to stay quiet next to them; this one is the
 * only thing on its card and carries a full sentence of a label.
 *
 * `quiet` for a button that is the way out rather than the way on: the
 * plans screen's "Regenerate", under three cards whose own "View & edit"
 * is what the screen is for (owner, 26 Oct 2026). Filled, it was the
 * largest solid thing on the screen and the cards' rival. Quiet is
 * `AddPill`'s quiet — the round buttons' glass, the body's ink, the mark
 * in the accent — so one word means one look.
 */
export function GradientCta({ icon, label, onPress, wide, quiet, busy, disabled, testID }: {
  /**
   * Optional, and the omission is a choice rather than an oversight. A
   * glyph beside a label is a second way of saying the same thing, worth
   * it where the label is generic — and noise where the button is the
   * only action on the screen and the words already name it.
   */
  icon?: keyof typeof Ionicons.glyphMap;
  /** For the iOS smoke flows; see `.maestro/README.md`. */
  testID?: string;
  label: string;
  onPress: () => void;
  /** Full width, for the one action that commits a sheet. Sized to its
   *  label everywhere else: a button as wide as the screen reads as "the
   *  only thing here", which is true at the foot of a sheet and false in
   *  the middle of a card. */
  wide?: boolean;
  /** Glass, not the gradient: a second way on, not the first. */
  quiet?: boolean;
  /**
   * Working, and not to be pressed again.
   *
   * The glyph turns and the label does not move. The first version of a
   * busy CTA swapped the words instead — "Regenerate" for "Finding three
   * more…" — and a `wide` button centres its contents, so the longer
   * label spread the row and slid the icon about 70pt to the left. A
   * button whose mark jumps position while it works reads as a different
   * button, not as the same one running.
   *
   * So the mark holds its place and rotates, which is what a circular
   * arrow is for. `useLoop` and the 1600ms turn are the ones the sketch
   * screen's step marks already spin by; a third rotation in this app
   * should not be a third speed.
   */
  busy?: boolean;
  /**
   * Not ready to be pressed — the draft is incomplete, nothing has changed.
   * Said to VoiceOver as "dimmed" and refused for every kind of press,
   * including the activate a screen reader sends, which a caller's
   * `pointerEvents="none"` never stopped. How it looks stays the caller's:
   * the screens that dim one already say why beside it.
   */
  disabled?: boolean;
}) {
  const still = useReducedMotion();
  const spin = useLoop(1600, still || !busy);
  // An iconless button still has to show that it is working, so `busy`
  // borrows a mark rather than leaving the reader with a dead press.
  const glyph = icon ?? (busy ? 'sync' : null);
  const inside = (
    <>
      {/* The rotation wraps the glyph whether or not it is turning. At
          rest `useLoop` holds zero, so it is the identity transform —
          no branch between rest and busy, no reflow, and the icon
          cannot shift by a pixel between the two states. The branch
          here is over having a glyph at all, which does not change
          while the button is on screen. */}
      {glyph && (
        <Animated.View
          style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}
        >
          <Ionicons name={glyph} size={20} color={quiet ? colors.accent : colors.accentInk} />
        </Animated.View>
      )}
      <Text style={[s.ctaText, quiet && s.ctaTextQuiet]}>{label}</Text>
    </>
  );
  return (
    <PressableScale
      onPress={onPress}
      // Straight through to `Pressable`, which is what stops the scale as
      // well as the press: a button that dips under a thumb and then does
      // nothing has answered, and answered wrongly.
      disabled={busy || disabled}
      accessibilityRole="button"
      aria-busy={!!busy}
      aria-disabled={!!(busy || disabled)}
      testID={testID}
      style={wide ? { alignSelf: 'stretch' } : undefined}
    >
      {/* Dimmed for everyone, not only as a second opinion beside the
          spin. Reduced motion holds the glyph still — `useLoop` parks it
          at zero — and without this the button would take a tap and show
          nothing at all to the readers who asked for less movement, which
          is worse than the label it replaces. Fade is not motion. */}
      {quiet
        ? <View style={[s.cta, s.ctaQuiet, (busy || disabled) && s.ctaDim]}>{inside}</View>
        : <LinearGradient {...gradAI} style={[s.cta, (busy || disabled) && s.ctaDim]}>{inside}</LinearGradient>}
    </PressableScale>
  );
}

/**
 * The tick on a row you have chosen.
 *
 * Filled with `gradAI`, not `colors.accent`, and the distinction is one
 * this codebase has now got wrong twice. `colors.accent` is
 * `dyn('#C4402C', '#FF6F5B')` — on paper a *foreground* colour, dark
 * enough to read as text on a light page. Filling something with it puts
 * the `accentInk` glyph at 3.64:1 in the light theme while measuring 6.79
 * in the dark, so the control is right half the time and muddy the other
 * half. The theme file says it at the gradient itself: a gradient is a
 * fill.
 *
 * Three rows wanted this — Add a place, Search, and the wizard's
 * collections — which is why it stopped being a style object copied
 * between them.
 */
export function SelectTick({ on }: { on: boolean }) {
  if (!on) return <View style={s.tick} />;
  return (
    <LinearGradient {...gradAI} style={[s.tick, s.tickOn]}>
      <Ionicons name="checkmark" size={15} color={colors.accentInk} />
    </LinearGradient>
  );
}

/** In-page back control: the round glass button wearing a chevron. */
export function BackButton({ onPress, testID }: { onPress: () => void; testID?: string }) {
  const { t } = useI18n();
  return (
    <RoundIconButton
      icon="chevron-back"
      size={22}
      onPress={onPress}
      label={t('Back', 'Quay lại', '戻る', '返回', '返回')}
      testID={testID}
    />
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 7, marginRight: 8,
  },
  // Only a chip that does something is a target, and a target is 44pt —
  // it measured 31 drawn from padding alone. A display-only chip keeps
  // the padding's height, so a row of facts does not swell into buttons.
  chipTap: { minHeight: 44 },
  // Selected control carries the accent — same rule as the language pill.
  chipOn: { backgroundColor: colors.surfaceGlass, borderColor: colors.borderGlass },
  chipText: { color: colors.textSecondary, fontSize: 14, fontWeight: font.medium },
  // 82pt minimum so a two-line label does not make its cell taller than
  // the rest of its row — the whole point of a grid is that the cells
  // measure the same.
  tile: {
    minHeight: 82, borderRadius: 14, paddingHorizontal: 6, paddingTop: 12, paddingBottom: 10,
    alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  tileOn: { backgroundColor: colors.accentSoft },
  tileText: {
    color: colors.textSecondary, fontSize: 14, fontWeight: font.medium,
    textAlign: 'center', lineHeight: 18,
  },
  tileTextOn: { color: colors.accent, fontWeight: font.semibold },
  tileRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  chipTextOn: { color: colors.accent, fontWeight: font.semibold },
  // The same in either state: the figure is not what is chosen.
  chipCount: { color: colors.textTertiary, fontWeight: font.regular },
  tabsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 26,
    marginHorizontal: space.page, marginBottom: 14,
  },
  tabsRowNarrow: { gap: 18 },
  tabItem: {
    flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1,
    paddingVertical: 7,
    // The rule is drawn transparent when unchosen rather than added when
    // chosen, so switching tabs never moves a pixel of layout.
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemOn: { borderBottomColor: colors.accent },
  tabText: { color: colors.textTertiary, fontSize: 15, fontWeight: font.medium, flexShrink: 1 },
  // `UnderlineChoice`: the tabs' items with the page's margins and the
  // tabs' 26pt gap brought down to 22 — nine of them rather than two, and
  // the gap is what tells one from the next, not a box. The unchosen word
  // a step brighter than a tab's: here it is the thing being read, where
  // a tab's name is a door the reader already knows.
  // The gap is the row's to choose (`CHOICE_ROW`); the paddings are the
  // page's. No air for the fade at the end: the fade goes when the end
  // comes into sight.
  choiceRow: { paddingHorizontal: space.page },
  choiceText: { color: colors.textSecondary, fontSize: 15, fontWeight: font.medium },
  choiceFade: { position: 'absolute', top: 0, bottom: 0, right: 0, width: CHOICE_FADE },
  // `ActionSheet`'s `rowOff`, so "not now" reads the same on a row of
  // words as on a row of actions.
  choiceOff: { opacity: 0.45 },
  // Stacked: the glyph over the word, centred in at least `STACK_MIN`.
  // The word a step smaller than inline's 15: under a glyph it is a
  // caption, and the item stays near the width of its word.
  stackItem: { flexDirection: 'column', gap: 5, minWidth: STACK_MIN },
  stackText: { fontSize: 13 },
  tabTextOn: { color: colors.accent, fontWeight: font.semibold },
  tabBadge: {
    minWidth: 21, height: 21, borderRadius: 10.5, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.badgeSolid,
  },
  tabBadgeText: { color: colors.accentInk, fontSize: 13, fontWeight: font.semibold },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: CONTROL_H, paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: radius.pill,
  },
  // 0.6, where the busy state on a text link takes 0.4. The lighter hand
  // is the surface: 0.4 on a hairline of type reads as "not yet", and the
  // same figure on a coral gradient running the width of the screen reads
  // as broken. Chosen by eye rather than measured — a value to argue with,
  // not a finding.
  // Busy and not-ready wear the same dim: both mean "a press does
  // nothing now", and a disabled button at full strength (the start
  // sheet's, after a refused pin) read as the one thing to press.
  ctaDim: { opacity: 0.6 },
  // Nothing left to say about the wide one but that it is wide — the
  // centring and the height it used to carry are now what every button of
  // this class gets. `wide` still stretches it in its parent; see
  // `GradientCta`.
  ctaText: { color: colors.accentInk, fontSize: 16, fontWeight: font.semibold },
  // `AddPill`'s quiet, to the token: see the note on `GradientCta`.
  ctaQuiet: { backgroundColor: colors.surfaceGlass },
  ctaTextQuiet: { color: colors.text },
  tick: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.borderGlass,
  },
  tickOn: { borderColor: 'transparent' },
  // Every round action in the app wears this: header search, back, share,
  // the overflow menu, the heart, person-add, reorder Done. Glass fill,
  // 44pt target, no hairline — the ring came off in the borderless pass,
  // because a filled circle is already unmistakably a button and the
  // stroke was the app's most-repeated one, on screens carrying four of
  // these at once.
  //
  // Three things this is deliberately *not*. The discs on a photograph
  // keep their dark scrim: that fill is doing contrast work over imagery
  // nobody has seen, not saying "button". Accent-tinted controls keep
  // their coral hairline, which is information rather than chrome.
  //
  // And a circle holding a *photograph of a person* is not a button
  // either — see `Avatar`. Nothing distinguishes the two shapes except
  // scale, so scale is what has to carry it: this size class is a
  // control, and a face belongs at the size of the type it sits beside.
  // A curator's face on a collection is 18pt against a 15pt line, which
  // no thumb has ever tried to press. The rule only fails if a face is
  // ever drawn at 44 next to one of these, which is why `Avatar` refuses
  // to have a default size.
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass,
  },
});
