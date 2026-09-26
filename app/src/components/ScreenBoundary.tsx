// What a reader sees when a render throws: one broken screen, not a blank
// phone.
//
// Before this, nothing in the app caught a render error except the two
// maps (`MapBoundary`). React's answer to an uncaught one is to throw the
// whole tree away, so a single screen that met a row it did not expect —
// a place missing a field, an OTA update with a bug that only one kind of
// phone reaches — took every tab down with it, and the reader was left
// with an empty window or an app that closed itself, and no words.
//
// So there are two catches, and the design for both was drawn and agreed
// before any of this was written (the "Màn hình báo lỗi" canvas):
//
//   - `ScreenBoundary`, one per screen, fitted by every stack's
//     `screenLayout` in `App.tsx`. A screen that throws is replaced by a
//     message and "Try again", and everything around it keeps working:
//     the tab bar is outside the screen, so the reader can simply go
//     somewhere else. A screen that was pushed also offers "Back".
//   - `AppBoundary`, once, around the providers. It only ever shows when
//     the thing that broke is outside every screen — the tab bar, a
//     provider — so there is nothing left to tap but "Reopen the app".
//
// Neither sends anything anywhere. The privacy policy promises the App
// Store build sends no diagnostics, and a boundary that reported would
// break that promise; see D1 in issue #708, which is where reporting
// would plug in — `componentDidCatch` on `Catch` — once the policy says
// so first.
//
// The message never names the error. A reader can do nothing with
// "undefined is not an object", and `lib/loadfail.ts` already made the
// rule for failed reads: never print words the reader did not write.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Updates from 'expo-updates';
import { BackButton, GradientCta, useTabBarClearance } from './ui';
import { I18nProvider, useI18n } from '../lib/i18n';
import { colors, display } from '../theme';

/**
 * The catch itself, shared by both boundaries.
 *
 * A class, because catching a render error is the one thing hooks cannot
 * do. `reset` puts the children back; if they throw again they are caught
 * again, so "Try again" on a screen that fails every time costs one frame
 * and lands on the same message, never on a crash.
 */
class Catch extends React.Component<
  { fallback: (reset: () => void) => React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  reset = () => this.setState({ failed: false });
  render() { return this.state.failed ? this.props.fallback(this.reset) : this.props.children; }
}

/** The part both messages share: the mark, the words, and what to press. */
function Message({ title, body, children }: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.message}>
      <View style={s.mark}>
        <Ionicons name="alert-circle-outline" size={30} color={colors.accent} />
      </View>
      <Text style={s.title} accessibilityRole="header">{title}</Text>
      <Text style={s.body}>{body}</Text>
      <View style={s.actions}>{children}</View>
    </View>
  );
}

/** Only the two methods the message uses, so a test can hand in its own. */
type Nav = { canGoBack: () => boolean; goBack: () => void };

function ScreenFallback({ navigation, retry }: { navigation: Nav; retry: () => void }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  // Clears the floating tab bar, so the message sits in the middle of what
  // the reader can see rather than behind the bar.
  const clearance = useTabBarClearance();
  // Asked as the message draws, not when the screen mounted: a stack's
  // first screen can never go back, and a pushed one always can.
  const pushed = navigation.canGoBack();
  return (
    <View style={[s.page, { paddingTop: insets.top, paddingBottom: clearance }]}>
      {pushed && (
        <View style={s.top}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
      )}
      <Message
        title={t('This screen ran into a problem', 'Màn hình này gặp lỗi', 'この画面で問題が起きました')}
        body={pushed
          ? t(
            'The rest of the app still works. Try again, or go back to the previous screen.',
            'Phần còn lại của app vẫn dùng được. Thử lại, hoặc quay về màn trước.',
            'アプリの他の部分は使えます。もう一度試すか、前の画面に戻ってください。',
          )
          : t(
            'The rest of the app still works. Try again, or switch to another tab.',
            'Phần còn lại của app vẫn dùng được. Thử lại, hoặc chuyển sang tab khác.',
            'アプリの他の部分は使えます。もう一度試すか、別のタブに切り替えてください。',
          )}
      >
        <GradientCta icon="refresh" label={t('Try again', 'Thử lại', '再試行')} onPress={retry} />
        {pushed && (
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            hitSlop={8}
            style={s.back}
          >
            <Text style={s.backText}>{t('Back', 'Quay lại', '戻る')}</Text>
          </Pressable>
        )}
      </Message>
    </View>
  );
}

export function ScreenBoundary({ navigation, children }: { navigation: Nav; children: React.ReactNode }) {
  return (
    <Catch fallback={(reset) => <ScreenFallback navigation={navigation} retry={reset} />}>
      {children}
    </Catch>
  );
}

/**
 * Reloads the JavaScript in place — the reader does not have to find the
 * app switcher. Where that is refused (a development client, or no update
 * machinery at all), the tree is simply drawn again, which is the same
 * thing as far as a render error is concerned.
 */
function reopen(reset: () => void) {
  Updates.reloadAsync().catch(reset);
}

function AppFallback({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.page, { paddingTop: insets.top, paddingBottom: insets.bottom + 40 }]}>
      <Message
        title={t('City Crew ran into a problem', 'City Crew gặp lỗi', 'City Crew で問題が起きました')}
        // Saved things live on the server and survive any of this; a line
        // half-typed and not yet saved does not, so this promises only the
        // first.
        body={t(
          'Everything you saved is still there. Reopen the app to carry on.',
          'Những gì bạn đã lưu vẫn còn nguyên. Mở lại app để tiếp tục.',
          '保存したものはそのまま残っています。アプリを開き直して続けてください。',
        )}
      >
        <GradientCta icon="refresh" label={t('Reopen the app', 'Mở lại app', 'アプリを開き直す')} onPress={() => reopen(reset)} />
      </Message>
    </View>
  );
}

/**
 * The last catch, around the providers.
 *
 * Its message brings its own `I18nProvider`, because the one the rest of
 * the app reads sits *inside* this boundary and may be part of what
 * failed. The provider reads the reader's saved language by itself, so
 * the message is in the language they chose; if even that cannot mount,
 * the context's default is English, which is still words rather than a
 * blank window.
 */
export function AppBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Catch fallback={(reset) => <I18nProvider><AppFallback reset={reset} /></I18nProvider>}>
      {children}
    </Catch>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: 16, paddingTop: 12 },
  message: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 36, gap: 14,
  },
  mark: {
    width: 64, height: 64, borderRadius: 32, marginBottom: 4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  title: {
    fontFamily: display.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.2,
    color: colors.text, textAlign: 'center',
  },
  body: {
    fontSize: 15, lineHeight: 22, color: colors.textSecondary,
    textAlign: 'center', maxWidth: 300,
  },
  actions: { marginTop: 10, alignItems: 'center', gap: 6 },
  // 44pt tall at the least, like every other thing a finger has to hit.
  back: { minHeight: 44, paddingHorizontal: 20, justifyContent: 'center' },
  backText: { fontSize: 15, fontWeight: '600', color: colors.accent },
});
