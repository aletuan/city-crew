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

import React, { createContext, useCallback, useContext, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CommentComposer from './CommentComposer';
import { useKeyboardUp } from './keyboard';
import { useProfile } from '../lib/auth';
import type { Subject } from '../lib/comments';
import { commentsChanged } from '../lib/commentsChanged';
import { postComment } from '../lib/data';
import { useI18n } from '../lib/i18n';

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
}): 'quick' | 'thread' {
  return at.me && at.loaded && !at.loading && at.n === 0 ? 'quick' : 'thread';
}

type Target = { subject: Subject; about?: string };

/** The field itself, over the page. `target` null is not shown. */
export default function CommentQuick({ target, onClose }: { target: Target | null; onClose: () => void }) {
  const { t } = useI18n();
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const typing = useKeyboardUp();

  const send = async (body: string) => {
    // Never without a target: the field is not mounted without one.
    await postComment((target as Target).subject, null, body);
    commentsChanged();
    onClose();
  };

  return (
    <Modal visible={target !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        style={s.backdrop}
        onPress={onClose}
        accessibilityLabel={t('Close', 'Đóng', '閉じる', '关闭', '關閉')}
        testID="comment-quick-close"
      />
      {/* The field rides the keyboard, as on the thread's page; touches
          above it fall through to the dim. */}
      <KeyboardAvoidingView
        style={s.dock}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        {target ? (
          <View testID="comment-quick">
            <CommentComposer
              avatarUrl={profile?.avatar_url}
              replyTo={null}
              about={target.about}
              onSend={send}
              autoFocus
              bottomInset={typing ? 0 : insets.bottom}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
});
