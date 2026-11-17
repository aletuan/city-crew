// Your name on your own profile, the mark of your role after it, and
// your handle under it.
//
// Two lines, two things: the name you are called, then the
// name you are found by.
//
// These shared a line, separated by the app's own dot, with
// the name set to yield and the handle set to hold its width —
// on the argument that a handle cut to "@tra…" is not an
// address while "Tran Thi Tra…" is still a person. Both halves
// of that were true and the conclusion was still wrong: what
// it produced was "Le Nguy…  ·  @lenguyenngocminh", a screen
// that hides your name to protect an address nobody reads off
// their own profile.
//
// Stacked, neither has to yield. The measure here is about
// 247pt beside the 88pt ring, which fits most display names
// whole on one line — the handle was what pushed them over,
// not the width. A name long enough to need two takes two and
// truncates after that.
//
// ── the bio left this line (owner, 16 Nov 2026) ──
// It stood after the handle behind the app's dot, as a
// tagline: "@trang · Food lover". That held while a bio was
// three words. The field that writes it is multiline and had
// no limit, and this line is cut at two — so a bio of any
// length was shown as its first forty characters and an
// ellipsis, with nowhere on the screen to read the rest. A
// line that cannot grow is the wrong place for a paragraph.
// It is the first thing in About me now (`BioRow`), across the
// card's full measure, and the hero is a name and an address:
// two lines whose height does not depend on what anyone
// wrote.
//
// ── the role, after the name (owner, 17 Nov 2026) ──
//
// The reader's standing in the catalog: a guide, and an editor (the
// desk's hand), may keep galleries the panel would otherwise refuse. It
// was first said in a pill under the name, beside Edit profile, and the
// owner found the pill loud for what it is — a mark, not a message. So
// it became a small disc, on the ring's top-right corner; and a day
// after it was drawn on a person's page too, the owner moved both to
// stand after the name (`components/RoleBadge` has the reasons). Editor
// outranks guide and is the one disc shown: the desk's hand keeps every
// gallery, which includes the ones a guide keeps. A reader with neither
// wears none. A tap says what the grant lets them do, in the desk's
// words, and VoiceOver reads the role as the disc's name.
//
// The disc arrives a round trip after the name and moves nothing: the
// name's box is as wide as the name. The pill needed room held for it.
//
// ── out of `AccountProfile` ──
//
// Its function stands at its ceiling (`oversize.js`), and the role's
// two questions had nowhere to go there. The lines came here and the
// ceiling came down by what left.

import React from 'react';
import { Text, View } from 'react-native';
import { type Role, WithRole } from '../../components/RoleBadge';
import { useIsEditor, useIsGuideAnywhere } from '../../lib/useGuideGrant';
import { NAME_LINE, s } from './styles';

export function HeroName({ name, handle }: { name: string; handle?: string | null }) {
  const editor = useIsEditor();
  const guide = useIsGuideAnywhere();
  const role: Role | null = editor ? 'editor' : guide ? 'guide' : null;
  return (
    <View style={s.nameBlock}>
      <WithRole role={role} whose="yours" line={NAME_LINE}>
        <Text style={s.accountName} numberOfLines={2}>{name}</Text>
      </WithRole>
      {handle ? <Text style={s.handle} numberOfLines={1}>{`@${handle}`}</Text> : null}
    </View>
  );
}
