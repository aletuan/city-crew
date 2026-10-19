// Profile's App card, and the tagline under it.

import { useState } from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, fireHaptic } from '../../components/ui';
import LegalSheet from '../../components/LegalSheet';
import AboutSheet from '../../components/AboutSheet';
import type { LegalId } from '../../lib/legal';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../theme';
import { SettingRow } from './rows';
import { s } from './styles';

/**
 * The app itself: its two public documents, and which copy of it this is.
 *
 * The documents were the last two rows of `SettingsCard`, drawn without a
 * value on the right so the shape would say they were not settings. That
 * was too quiet: a reader hunting for the terms reads the heading first,
 * and the heading said the app's behaviour lived there. A section says it
 * outright.
 *
 * "About City Crew" joined them here, under a heading that names what all
 * three are about. It was briefly a card of its own under "Legal", where
 * it read as a stray; filed under "Legal" it would have been a document it
 * is not. "App" holds both without either being mislabelled.
 *
 * Drawn for guests as well as members, and that is the point rather than
 * a courtesy: the only other link to the documents is under the Sign up
 * button, on a screen an account holder can never reach again, and
 * somebody still deciding whether to sign up should be able to read the
 * terms without starting the form.
 *
 * The heading is written at each call site, the way every other section
 * on this screen is.
 */
export function AppCard() {
  const { t } = useI18n();
  // Which document is open, if any. The same sheet the sign-up screen
  // raises, so the two ways into these documents behave identically —
  // which they did not while one of them left for a browser.
  const [legal, setLegal] = useState<LegalId | null>(null);
  const [about, setAbout] = useState(false);

  return (
    <>
      <Card style={s.featureCard}>
        {/* No value on the right, still: these are a destination, not a
            setting. The version is not written on the About row either:
            it is one of four answers, and the one that settles "did the
            update arrive?" is the update's date, which is too long for a
            value column. See `AboutSheet`. */}
        <SettingRow
          icon="document-text-outline"
          label={t('Terms of Service', 'Điều khoản sử dụng', '利用規約')}
          onPress={() => { fireHaptic('selection'); setLegal('terms'); }}
        />
        <SettingRow
          icon="shield-checkmark-outline"
          label={t('Privacy Policy', 'Chính sách quyền riêng tư', 'プライバシーポリシー')}
          onPress={() => { fireHaptic('selection'); setLegal('privacy'); }}
        />
        <SettingRow
          icon="information-circle-outline"
          label={t('About City Crew', 'Giới thiệu City Crew', 'City Crewについて')}
          onPress={() => { fireHaptic('selection'); setAbout(true); }}
          last
        />
      </Card>
      <LegalSheet id={legal} onClose={() => setLegal(null)} />
      <AboutSheet visible={about} onClose={() => setAbout(false)} />
    </>
  );
}

export function Tagline() {
  const { t } = useI18n();
  return (
    <View style={s.tagline}>
      {/* The app's own mark, not a sparkle. An emoji here was whatever
          the reader's platform drew — a different sparkle on iOS, on
          Android and on the web, none of them ours, and none of them
          taking the theme's colour. A glyph does both: one shape
          everywhere, in the accent, and it turns with the theme.
          `accessibilityElementsHidden` because it says nothing the
          quote under it does not; a screen reader should reach the
          words, not "paw". */}
      <Ionicons
        name="paw"
        size={18}
        color={colors.accent}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text style={s.taglineText}>
        {t(
          '“We do not remember days,\nwe remember moments.”',
          '“Ta không nhớ những ngày,\nta nhớ những khoảnh khắc.”',
          '「私たちが覚えているのは日々ではなく、\n瞬間なのだ。」',
        )}
      </Text>
      {/* A borrowed sentence wears its author's name — and a name is
          quoted, not translated, so it sits outside t(). */}
      <Text style={s.taglineBy}>— Cesare Pavese</Text>
    </View>
  );
}
