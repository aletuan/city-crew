// The sheet that opens on a person's ⋯ — who they are, then what you
// can do about it.
//
// It replaces a stacked Alert, and the reason is not decoration. An
// alert menu gives every choice the same voice: three lines of bare
// verbs, no faces, no consequences, and on iOS the destructive ones
// turn red together so "Unfriend" and "Block" look like the same act.
// They are not. One is a quiet exit, the other is a door that stays
// shut, and a reader deserves to see which is which *before* pressing,
// not after.
//
// So: a card naming the person at the top — because a menu about
// somebody should say who — and rows carrying an icon and a sentence
// each, in the app's own sheet idiom (see SaveSheet, whose backdrop,
// spring and grabber this borrows so the two feel like one app).
//
// The rows and the chrome live in `ActionSheet` now, since the gallery
// needed the same sheet about a photograph; what stays here is the one
// thing that is about a person — the face and the name at the top.
//
// The confirmation that follows a destructive choice stays a system
// dialog on purpose. That is what iOS readers expect at the moment of
// no return, and it is the one place a native alert is the right
// instrument rather than the lazy one.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ActionSheet, { sheetHeader, type SheetAction } from './ActionSheet';
import { Avatar } from './ui';
import { colors, display } from '../theme';

/** The rows, as `ActionSheet` takes them. Kept under this name because
 *  the callers that predate the split — Crew, Activity, the report flow —
 *  spell it this way, and a rename would be churn for a synonym. */
export type PersonAction = SheetAction;

export default function PersonSheet({
  visible, name, meta, avatarUrl, actions, onClose,
}: {
  visible: boolean;
  name: string;
  /** The line under the name — handle, and what you have in common. */
  meta?: string;
  avatarUrl?: string;
  actions: PersonAction[];
  onClose: () => void;
}) {
  return (
    <ActionSheet
      visible={visible}
      actions={actions}
      onClose={onClose}
      header={(
        // Who this is about. A menu that names nobody is a menu you have
        // to trust you opened on the right row.
        <View style={s.who}>
          <Avatar url={avatarUrl} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.name} numberOfLines={1}>{name}</Text>
            {meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}
          </View>
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  who: sheetHeader,
  name: { color: colors.text, fontSize: 18, fontFamily: display.semibold },
  meta: { color: colors.textTertiary, fontSize: 14 },
});
