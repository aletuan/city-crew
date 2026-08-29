// The terms and the privacy policy, read without leaving the app.
//
// Both used to be a `Linking.openURL` — from under the Sign up button and
// from two rows in settings — which hands a reader mid-form to Safari and
// a page painted for a dark browser, whatever theme the app is in. This
// draws them in the app's own type and colours instead, from the same
// blocks `legal.ts` renders the published pages from.
//
// It is a sheet rather than a screen for one reason that matters: a
// `Modal` renders inside the screen that owns it, so `SignUpScreen` never
// unmounts. Everything already typed into the form is still there when
// the sheet closes, with no state to lift and nothing to restore. A
// `navigation.navigate` would have had to earn that back.
//
// The sheet grammar is the app's — `Modal transparent` with a fading
// scrim and a sheet that springs up on the native driver, the same spring
// the city, language and theme switchers use. What is new here is only
// the height (these are long documents) and `accessibilityViewIsModal`,
// which none of the older sheets set: without it VoiceOver walks straight
// past the sheet into the form behind it.

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Linking, Modal, Pressable, ScrollView, StyleSheet, Text,
  useWindowDimensions, View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DOCS, type Block, type Doc, type LegalId } from '../lib/legal';
import { isDocLink, parseInline } from '../lib/legalmark';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';
import { fireHaptic, PressableScale } from './ui';

const byId = (id: LegalId): Doc => DOCS.find((d) => d.id === id) ?? DOCS[0];
const byFile = (file: string): LegalId | null => DOCS.find((d) => d.file === file)?.id ?? null;

/** One line of prose, with its bold runs and its links. */
function Line({ line, style, onDoc }: {
  line: string;
  style: object;
  onDoc: (id: LegalId) => void;
}) {
  return (
    <Text style={style}>
      {parseInline(line).map((s, i) => {
        if (s.bold) return <Text key={i} style={st.bold}>{s.text}</Text>;
        if (!s.href) return <Text key={i}>{s.text}</Text>;
        // A cross-reference between the two documents means "show the
        // other one" here — there is no page to resolve it against.
        const doc = isDocLink(s.href) ? byFile(s.href) : null;
        return (
          <Text
            key={i}
            style={st.link}
            accessibilityRole="link"
            onPress={() => {
              fireHaptic('selection');
              if (doc) { onDoc(doc); return; }
              Linking.openURL(s.href!).catch(() => {});
            }}
          >
            {s.text}
          </Text>
        );
      })}
    </Text>
  );
}

function BlockView({ block, lang, onDoc }: {
  block: Block;
  lang: 'en' | 'vi';
  onDoc: (id: LegalId) => void;
}) {
  if (block.k === 'ul') {
    return (
      <View style={st.list}>
        {block[lang].map((li, i) => (
          <View key={i} style={st.item}>
            <Text style={st.bullet}>•</Text>
            <Line line={li} style={st.body} onDoc={onDoc} />
          </View>
        ))}
      </View>
    );
  }
  // The page sets its h2 in the accent; this does not. On a web page the
  // accent is just the house colour, but in the app it is the one signal
  // that says "you can tap this" — spending it on a heading would teach
  // the reader something untrue three times a screen.
  const style = block.k === 'h2' ? st.h2 : block.k === 'h3' ? st.h3 : st.body;
  return <Line line={block[lang]} style={style} onDoc={onDoc} />;
}

/**
 * @param id  Which document to open on. Changing it while open swaps the
 *            document in place, which is what a cross-reference does.
 */
export default function LegalSheet({ id, onClose }: {
  id: LegalId | null;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  // The document actually on screen. It starts as the one the caller
  // named and moves when a cross-reference is tapped, so the caller does
  // not have to own a decision the sheet is better placed to make.
  const [shown, setShown] = useState<LegalId>(id ?? 'terms');
  useEffect(() => { if (id) setShown(id); }, [id]);

  const rise = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!id) { rise.setValue(1); return; }
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [id, rise]);

  const doc = byId(shown);
  // Japanese falls back to English, exactly as the published pages do for
  // a reader who follows the same link in a browser.
  const half = lang === 'vi' ? 'vi' : 'en';
  const close = t('Close', 'Đóng', '閉じる');

  const swap = (next: LegalId) => {
    setShown(next);
    // The other document opens at its own beginning, not at the scroll
    // depth of the one that sent you there.
    scroller.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <Modal visible={id != null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={st.scrim} onPress={onClose} accessibilityLabel={close} />
      <Animated.View
        accessibilityViewIsModal
        style={[st.sheet, {
          height: winH * 0.9,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 60] }) }],
        }]}
      >
        <View style={st.grabber} />
        <View style={st.head}>
          <View style={{ flex: 1 }}>
            <Text style={st.title} accessibilityRole="header">{doc.title[half]}</Text>
            <Text style={st.date}>{doc.effective[half]}</Text>
          </View>
          {/* 44×44 because it is a control, which is where that rule
              actually applies — see the note in SignUpScreen about why
              the links in the sentence below the button cannot be. */}
          <PressableScale
            onPress={onClose}
            haptic="selection"
            style={st.x}
            accessibilityRole="button"
            accessibilityLabel={close}
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </PressableScale>
        </View>

        <ScrollView
          ref={scroller}
          style={st.scroll}
          contentContainerStyle={{ paddingVertical: 18, paddingBottom: 26 }}
          showsVerticalScrollIndicator={false}
        >
          {doc.blocks.map((b, i) => <BlockView key={i} block={b} lang={half} onDoc={swap} />)}
        </ScrollView>

        {/* Quiet, not the gradient PrimaryButton: that one is the Sign up
            button, and the loudest thing on a screen should not be its
            way out. It earns its place all the same — at 90% tall the
            scrim is a 10% strip nobody's thumb reaches, and after a long
            document the thumb is down here. */}
        <View style={[st.foot, { paddingBottom: 14 + insets.bottom }]}>
          <Pressable onPress={() => { fireHaptic('selection'); onClose(); }} accessibilityRole="button">
            <Text style={st.footText}>{close}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const st = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.card + 6, borderTopRightRadius: radius.card + 6,
    paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.borderGlass, marginBottom: 10,
  },
  head: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: space.page, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderGlassSoft,
  },
  title: { color: colors.text, ...type.titleDetail },
  date: { color: colors.textTertiary, fontSize: 13, marginTop: 2 },
  x: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -6 },

  // A fixed-height sheet with a fixed head and foot: the middle takes
  // what is left. `flex: 1` rather than a maxHeight — see StartSheet for
  // the Yoga default that bites when the parent's height is a ceiling
  // instead of a number.
  scroll: { flex: 1, paddingHorizontal: space.page },

  h2: { color: colors.text, fontSize: 18, fontWeight: font.semibold, marginTop: 26, marginBottom: 6 },
  h3: { color: colors.textSecondary, fontSize: 15, fontWeight: font.semibold, marginTop: 16, marginBottom: 4 },
  body: { color: colors.textSecondary, fontSize: 15, lineHeight: 23, marginTop: 8 },
  bold: { color: colors.text, fontWeight: font.semibold },
  link: { color: colors.accent, fontWeight: font.medium },

  list: { marginTop: 4 },
  item: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  bullet: { color: colors.textTertiary, fontSize: 15, lineHeight: 23, marginTop: 8 },

  foot: {
    paddingTop: 12, paddingHorizontal: space.page, alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  footText: { color: colors.accent, fontSize: 16, fontWeight: font.semibold, paddingVertical: 10, paddingHorizontal: 24 },
});
