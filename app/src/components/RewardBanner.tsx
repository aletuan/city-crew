// The banner that says a badge was earned, or a level reached.
//
// ── why a banner ──
//
// A badge is earned in the middle of something else: keeping a place
// while reading about it, checking in on a pavement. So it is said from
// the top of the screen, over whatever is up, for four seconds, and it
// does not ask to be answered.
//
// Rejected: the app's sheet, which is how everything else here pops up
// (`ActionSheet`). A sheet takes the screen until it is closed — right
// for a menu that was asked for, and an interruption for news that was
// not. A system alert, for the same reason and more. And the `Toast`:
// that is a sentence about what a tap just did, on the map, with nothing
// to press; this has a picture and goes somewhere.
//
// Rejected too: a notification from the system. The app has only the
// local ones a trip schedules for itself (`lib/reminders`), and the
// moment a badge is earned the reader is already looking at the app.
// What other people give — likes, copies — is earned while they are
// away, and is said the next time they open it.
//
// ── what a press does ──
//
// Goes to Profile and opens the sheet that explains it (`onOpen`, and
// `useRewards().want`, which `profile/HeroFace` answers). Left alone, it
// leaves; the dot on the tab bar and on "Lv" is what stays.
//
// ── one at a time ──
//
// `lib/badges`'s `noticeOf` decides what is said and never hands over
// two: several badges at once are their number, and a level is said
// only when no badge is.

import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BADGE_IMAGES } from './badgeImages';
import { PressableScale } from './ui';
import { Glyph } from './ui/glyph';
import { successHaptic } from './ui/haptics';
import { noticeWords } from '../lib/badges';
import { useI18n } from '../lib/i18n';
import { useRewards } from '../lib/rewards';
import { colors, font, radius } from '../theme';

/**
 * How long it stays, from the moment it starts to appear.
 *
 * Four seconds: twice the map's toast (`TOAST_MS`), because that one is
 * read by somebody who just pressed and is looking for it, and this one
 * arrives unasked while the eyes are elsewhere — and it is a thing to
 * press, which takes a moment to decide.
 */
export const BANNER_MS = 4000;
const IN_MS = 220;
const OUT_MS = 260;
/** How far above its place it starts: its own height, about. */
const DROP = 72;

export default function RewardBanner({ onOpen }: {
  /** Take the reader to where the sheet is. */
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { notice, dismiss, want } = useRewards();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!notice) return undefined;
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: IN_MS, useNativeDriver: true }).start();
    successHaptic();
    // VoiceOver hears it as it appears; nothing focuses a banner, and it
    // is gone before a swipe could reach it.
    const words = noticeWords(notice, t);
    AccessibilityInfo.announceForAccessibility(`${words.lead}: ${words.name}`);
    // Timers decide when it is gone, as the toast's do: the slide is
    // decoration, and a dropped frame must not leave a banner up.
    const out = setTimeout(() => {
      Animated.timing(slide, { toValue: 0, duration: OUT_MS, useNativeDriver: true }).start();
    }, BANNER_MS - OUT_MS);
    const gone = setTimeout(dismiss, BANNER_MS);
    return () => { clearTimeout(out); clearTimeout(gone); };
  // `t` is new each render and the words are read once, as it appears.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice, slide, dismiss]);

  if (!notice) return null;
  const words = noticeWords(notice, t);
  return (
    // The strip it rides in takes no touches of its own: only the card
    // is in the way of what is under it, and only for four seconds.
    <View style={[s.strip, { top: insets.top + 8 }]}>
      <Animated.View
        style={{
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-DROP, 0] }) }],
        }}
      >
        <PressableScale
          scaleTo={0.98}
          contentStyle={s.card}
          onPress={() => { dismiss(); want(); onOpen(); }}
          accessibilityRole="button"
          accessibilityLabel={`${words.lead}: ${words.name}`}
          accessibilityHint={t('Opens your badges', 'Mở huy hiệu của bạn', 'バッジを開きます', '打开你的徽章', '開啟你的徽章')}
          testID="reward-banner"
        >
          {notice.kind === 'badge'
            ? <Image source={BADGE_IMAGES[notice.id].on} style={s.picture} contentFit="contain" accessible={false} />
            : (
              <View style={s.mark}>
                <Glyph name={notice.kind === 'level' ? 'trophy-outline' : 'ribbon-outline'} size={22} color={colors.accent} />
              </View>
            )}
          <View style={s.words}>
            <Text style={s.lead} numberOfLines={1}>{words.lead}</Text>
            <Text style={s.name} numberOfLines={1}>{words.name}</Text>
          </View>
          <Glyph name="chevron-forward" size={17} color={colors.textTertiary} />
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  strip: { position: 'absolute', left: 16, right: 16, pointerEvents: 'box-none' },
  // The cards' surface and radius, so it reads as one of the app's own
  // objects come down from the top, and a shadow because it lies over a
  // screen that is still there.
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingLeft: 12, paddingRight: 14,
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  // 44: the two lines' height beside it, and the size a thumb is owed.
  picture: { width: 44, height: 44 },
  // Where there is no one badge to draw: several at once, under the
  // ribbon that heads their sheet, or a level, under the trophy its
  // card wears there (`profile/HeroFace`).
  mark: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  words: { flex: 1, gap: 1 },
  lead: { color: colors.textTertiary, fontSize: 12.5, lineHeight: 16, fontWeight: font.medium },
  name: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: font.semibold },
});
