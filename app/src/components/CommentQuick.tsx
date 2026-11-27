// The first comment on something, written where the reader already is
// (owner, 18 Nov 2026).
//
// ── what it is for ──
//
// A list nobody has commented on has an empty thread behind its bubble,
// and going there to write the first line is a page change to look at
// nothing. Threads does not make that trip on its feed: a press on the
// bubble of a post with no replies raises the field and the keyboard
// over the feed, with a line saying what is being answered. This is
// that: the thread's own field (`CommentComposer`, so the count, the
// refusals and the kept words cannot differ between the two), raised
// over whatever page the bubble was on.
//
// A list that has comments still opens its thread: there is something
// to read first, and a reply belongs under what it answers.
// `quickOrThread` is the rule, in one place for the two bubbles that
// follow it — the one on a list's own page and the one on a feed card.
//
// ── how it sits over the page ──
//
// A `Modal`, transparent: it is above the page and above the floating
// tab bar without either having to move, so a screen that raises it
// changes nothing of its own layout. Mounted once for the whole app
// (`CommentQuickProvider`), not by each bubble — where the reason is. The dim behind it is a press that
// puts it away, as on every sheet in the app; the words typed go with
// it — the same as leaving the thread's page with words in its field.
//
// Sent, the app is told (`commentsChanged`), so the bubble that raised
// this counts one, and the field goes away. The reader stays where they
// were; the comment is a press on that bubble away.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AboutCard, useAbout } from './CommentAbout';
import CommentComposer from './CommentComposer';
import { useRide } from './keyboard';
import { useProfile, useSession } from '../lib/auth';
import type { Mention, Subject } from '../lib/comments';
import { commentsChanged } from '../lib/commentsChanged';
import { postComment, useTaggableQuery } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors } from '../theme';

/**
 * Whether a press on a bubble writes here or opens the thread.
 *
 * Here, for somebody signed in when the thread is *known* to be empty —
 * the count has been answered, is not being asked again, and is zero.
 * The thread otherwise: there are comments to read; or the count is not
 * in yet, and "none" would be a guess that hides them; or nobody is
 * signed in, and the thread's page is where a guest is asked to be.
 * (And where no field is mounted to raise, a caller opens the thread
 * without asking this — `useQuickComment` answers null.)
 */
export function quickOrThread(at: {
  me: string | null; n: number; loaded: boolean; loading: boolean;
  /** The owner has closed the thread: nothing can be written anywhere. */
  off?: boolean;
}): 'quick' | 'thread' {
  // Your own list too, since 22 Nov 2026 (owner): the switch that closes
  // its thread is in the list's own ⋯ menu as well as on the thread's
  // page (`collectionDetail/CommentsSetting`), so this press is no longer
  // the owner's only way to it, and the two bubbles behave alike.
  return at.me && at.loaded && !at.loading && at.n === 0 && !at.off ? 'quick' : 'thread';
}

type Target = { subject: Subject; about?: string };

/** The field itself, over the page. `target` null is not shown. */
export default function CommentQuick({ target, onClose }: { target: Target | null; onClose: () => void }) {
  const { t } = useI18n();
  const { profile } = useProfile();
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const { ride } = useRide(insets.bottom, QUICK_LEAD);

  // What is on screen: the target given, or — on its way out — the last
  // one. Put away, the field is not unmounted on the spot (27 Nov 2026):
  // it was, and vanished in one frame while the keyboard under it took
  // twelve to fall and the dim eighteen to clear. Now the keyboard is sent
  // down, the field rides it (`useRide`), and the dim and the field clear
  // over that fall; the `Modal` goes when they have.
  const last = useRef(target);
  if (target) last.current = target;
  const held = target ?? last.current;
  const showing = target !== null;
  const [mounted, setMounted] = useState(showing);
  if (showing && !mounted) setMounted(true);
  const shown = useRef(new Animated.Value(0)).current;
  const was = useRef(showing);
  useEffect(() => {
    if (was.current && !showing) Keyboard.dismiss();
    was.current = showing;
    const run = Animated.timing(shown, { toValue: showing ? 1 : 0, duration: showing ? DIM_IN_MS : DIM_OUT_MS, useNativeDriver: true });
    run.start(({ finished }) => { if (finished && !showing) setMounted(false); });
    return () => run.stop();
  }, [showing, shown]);

  // The list the words are for, lit over the dim — `CommentAbout`. Where
  // it is not known, the field names it in a line, as it always did.
  const about = useAbout(held ? held.subject : null);

  // Whom and what "@" offers: asked when a target is set, not before.
  const taggable = useTaggableQuery(target ? target.subject : null, session?.user?.id);

  const send = async (body: string, mentions: Mention[]) => {
    // Never without a target: the field is not mounted without one.
    await postComment((held as Target).subject, null, body, mentions);
    commentsChanged();
    onClose();
  };

  return (
    // No animation of the `Modal`'s own: its fade took the field with it,
    // which showed the page through the field for its first frames.
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: shown }]}>
        <Pressable
          style={s.backdrop}
          onPress={onClose}
          accessibilityLabel={t('Close', 'Đóng', '閉じる', '关闭', '關閉')}
          testID="comment-quick-close"
        />
      </Animated.View>
      {/* The field rides the keyboard — see `useRide`. Touches above it
          fall through to the dim. */}
      <View style={s.dock} pointerEvents="box-none">
        {held ? (
          <Animated.View style={{ opacity: shown.interpolate(SOLID), transform: [{ translateY: ride }] }} testID="comment-quick" pointerEvents="box-none">
            {/* A press on the card is a press on the dim under it. */}
            {about ? <View pointerEvents="none"><AboutCard about={about} /></View> : null}
            <CommentComposer
              avatarUrl={profile?.avatar_url}
              replyTo={null}
              about={about ? undefined : held.about}
              onSend={send}
              autoFocus
              taggable={taggable.data}
              bottomInset={insets.bottom}
            />
            {/* The field's own ground carried on down under the keyboard,
                so what shows round its rounded top corners, and in the
                instant before it lands, is this and not the dim. */}
            <View style={s.under} pointerEvents="none" testID="comment-quick-under" />
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

/** The field's head start on the keyboard, as measured here: a frame late
 *  going up — it is mounted and focused in the same breath — and on time
 *  coming down, since it sends the keyboard down itself (`keyboard.tsx`). */
const QUICK_LEAD = { rise: 1 };
/** The dim's way in. */
const DIM_IN_MS = 200;
/** Its way out, and the field's: the keyboard's fall as far as the screen's
 *  foot — 88% of its travel is gone at 183 ms and the rest is under the
 *  edge (`keyboard.tsx`, the same recording), so a little over that. */
const DIM_OUT_MS = 250;
/** The field against the dim: solid for all but the first of the way in
 *  and the last of the way out — a field, not a ghost of one. */
const SOLID = { inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] };

type Quick = (subject: Subject, about?: string) => void;
const Ctx = createContext<Quick | null>(null);

/**
 * The one field of the app, mounted above the navigator.
 *
 * ── why it is here and not beside the bubble that raises it ──
 *
 * For an evening each bubble rendered its own field next to itself
 * (`useQuickComment` handed back a `node`), which put the `Modal` inside
 * whatever the bubble was inside: the list page's scroll view, the
 * feed's. On a phone the send button then took two presses — the first
 * put the keyboard away and did nothing else (owner, 18 Nov 2026).
 *
 * That is React Native's scroll view, not this field. A scroll view
 * that is not told `keyboardShouldPersistTaps` answers the first touch
 * outside a focused input by dismissing the keyboard and swallowing the
 * touch — and it decides what is "inside" it by the React tree, so a
 * `Modal` rendered among its children counts, though it is drawn over
 * the whole screen (facebook/react-native#28871). The thread's own field
 * never had this: it is a sibling of its scroll view, not a child.
 *
 * Rejected: `keyboardShouldPersistTaps="handled"` on each scroll view a
 * bubble sits in. It works, and it has to be remembered for the next
 * page that draws a bubble; forgotten, it fails the same quiet way. One
 * field here, with no scroll view above it, cannot be put in the wrong
 * place.
 */
export function CommentQuickProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);
  const quick = useCallback<Quick>((subject, about) => setTarget({ subject, about }), []);
  return (
    <Ctx.Provider value={quick}>
      {children}
      <CommentQuick target={target} onClose={() => setTarget(null)} />
    </Ctx.Provider>
  );
}

/** The press that raises the field — or null where there is no field to
 *  raise (a screen rendered outside the provider, as in its own tests),
 *  and then a bubble opens its thread. */
export function useQuickComment(): Quick | null {
  return useContext(Ctx);
}

const s = StyleSheet.create({
  // The action sheet's dim, value for value: one way of saying "this is
  // over the page" in the app.
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.62)' },
  dock: { flex: 1, justifyContent: 'flex-end' },
  // The field's ground (`CommentComposer`'s bar) below it, deeper than
  // any keyboard.
  under: { position: 'absolute', top: '100%', left: 0, right: 0, height: 600, backgroundColor: colors.bg },
});
