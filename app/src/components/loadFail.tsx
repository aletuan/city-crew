// What a screen shows when a read did not come back.
//
// Two shapes, and which one a screen draws is decided by one question:
// is there anything to show underneath? If the screen already holds an
// answer — the launch cache, or the last fetch that worked — the failure
// is a *banner* above it, and the answer stays. If it holds nothing, the
// failure is the whole *body*, and it carries the one control that can
// change anything: try again.
//
// Neither prints the server's words. `lib/loadfail` names the failure
// and writes the sentence; what arrives here is the name.
//
// The banner came out of a screenshot: "Không tải được địa điểm: JWT
// expired" on an otherwise empty Explore, with a whole catalog sitting in
// AsyncStorage behind it and the list — and its pull-to-refresh — hidden
// by the same `error` that put the sentence up. A failed refresh had
// made the app forget what it knew. The rule now is that it never does.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useI18n } from '../lib/i18n';
import { loadFailStale, loadFailText, type LoadFail } from '../lib/loadfail';
import { colors, font, radius, space, type } from '../theme';
import { PressableScale } from './ui';

const ICON: Record<LoadFail, keyof typeof Ionicons.glyphMap> = {
  offline: 'cloud-offline-outline',
  expired: 'key-outline',
  other: 'alert-circle-outline',
};

/**
 * The failure, said above an answer the screen is keeping.
 *
 * Quiet on purpose: a tinted row, one line, a small "Try again". The
 * list under it is still the point of the screen, and a banner that
 * shouted would be a second failure on top of the first. No retry for
 * `expired` — the app is already signing back in and will retry on its
 * own (see `CatalogProvider`); a button would race it.
 */
export function LoadFailBanner({ kind, onRetry, testID }: {
  kind: LoadFail;
  onRetry?: () => void;
  testID?: string;
}) {
  const { t } = useI18n();
  return (
    <View style={s.banner} testID={testID} accessibilityRole="alert">
      <Ionicons name={ICON[kind]} size={16} color={colors.textSecondary} />
      <Text style={s.bannerText} numberOfLines={2}>
        {loadFailText(kind, t)} {loadFailStale(t)}
      </Text>
      {onRetry && kind !== 'expired' ? (
        <PressableScale onPress={onRetry} accessibilityRole="button" style={s.retryPill} scaleTo={0.94}>
          <Text style={s.retryPillText}>{t('Try again', 'Thử lại', '再試行')}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/**
 * The failure as the whole body, for a screen with nothing to show.
 *
 * The same shape as `Empty` — centred, quiet type — plus the button that
 * `Empty` never had and this state cannot do without. Before this, a
 * failed first load was a sentence and nothing else, and the only way
 * forward was to kill the app.
 */
export function LoadFailEmpty({ kind, onRetry, testID }: {
  kind: LoadFail;
  onRetry?: () => void;
  testID?: string;
}) {
  const { t } = useI18n();
  return (
    <View style={s.empty} testID={testID}>
      <Ionicons name={ICON[kind]} size={28} color={colors.textTertiary} />
      <Text style={s.emptyText}>{loadFailText(kind, t)}</Text>
      {onRetry && kind !== 'expired' ? (
        <PressableScale onPress={onRetry} accessibilityRole="button" style={s.retry} scaleTo={0.96}>
          <Ionicons name="refresh" size={16} color={colors.text} />
          <Text style={s.retryText}>{t('Try again', 'Thử lại', '再試行')}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: space.page, marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radius.input,
    backgroundColor: colors.surfaceGlassStrong,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  bannerText: { flex: 1, color: colors.textSecondary, fontSize: 13.5, lineHeight: 18 },
  retryPill: {
    paddingHorizontal: 12, minHeight: 32, justifyContent: 'center',
    borderRadius: radius.pill, backgroundColor: colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  retryPillText: { color: colors.text, fontSize: 13.5, fontWeight: font.semibold },

  // `Empty`'s own padding and type, so the two states look like one
  // family; the glyph and the button are what this one adds.
  empty: { padding: 48, alignItems: 'center', gap: 14 },
  emptyText: { color: colors.textTertiary, ...type.meta, textAlign: 'center' },
  retry: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minHeight: 44, paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceGlassStrong,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
  retryText: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
});
