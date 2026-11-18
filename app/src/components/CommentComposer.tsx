// The field a comment is written in, at the foot of the thread (owner,
// 18 Nov 2026): a face, the words, and a button that sends them.
//
// ── where it was, and why it moved ──
//
// For a day this was a form of its own, a press away from the thread
// (`CommentFormScreen`, C4a), because the tab bar floats over the foot
// of every page. On a phone that read as three presses to say one thing
// — the bubble, "Write a comment…", then the form — where Threads asks
// for one. The bar is the thing that moved instead: the thread's page
// holds it away (`useTabBarAway`), as Threads hides its own on a post,
// and the field sits where the thumb is.
//
// ── one field for a comment and for an answer ──
//
// "Reply" under a comment does not open anything: it tells this field
// whom the next words answer, and a line above the field says so —
// "Replying to trang" — with a ✕ to take it back. The keyboard may cover
// the comment being answered; the line is what keeps it in mind.
//
// ── what it shows of the rules ──
//
// The button is lit when there is something to send
// (`lib/comments.bodyProblem`). The count appears in the last
// `COUNT_FROM` characters before the ceiling and not before: a figure
// under every comment a reader starts is noise, and one that appears
// forty characters from the end is a warning in time. No `maxLength`:
// it counts UTF-16 units, and would stop 250 emoji that the server
// takes.
//
// A refusal is said above the field (`lib/commentWords`) and the words
// stay in it: nothing a reader typed is thrown away because a rule said
// not yet. Sent, the field empties and is ready for the next.
//
// ── nobody signed in ──
//
// The same shape, as a press: it raises the sign-in sheet. A field a
// guest could type into, and lose on pressing send, would be worse.
//
// It knows nothing of threads or subjects: it is handed `onSend` and
// tells the truth about what happened to it.
//
// ── tags ──
//
// Typing "@" offers the people and places the page said may be tagged
// (`taggable`), as rows over the field (`CommentTagOffers`); what is
// offered, where a tag lands and how it survives an edit are
// `lib/commentTags`. The field itself draws a tag as the words it is —
// "@name", uncoloured: colouring a run inside a `TextInput` means
// handing it children instead of a value, which react-native-web does
// not draw and iOS redraws with the caret thrown to the end.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import CommentTagOffers from './CommentTagOffers';
import { PressableScale } from './ui/controls';
import { SECONDARY_CONTROL_H } from './ui/layout';
import { Glyph, ICON } from './ui/glyph';
import { Avatar } from './ui/surfaces';
import { BODY_MAX, bodyLength, bodyProblem, refusalOf, type Mention } from '../lib/comments';
import {
  caretAfter, charsBefore, offersFor, outgoing, placesNamed, retag, tagQuery, tagged,
  type Offer, type Tag, type Taggable,
} from '../lib/commentTags';
import { refusalWords } from '../lib/commentWords';
import { useI18n } from '../lib/i18n';
import { colors, font } from '../theme';

/** The face beside the field: an answer's 28, so the bar reads as the
 *  place a comment goes and not as a comment. */
const FACE = 28;
/** The send disc: 32, inside a bar 44 tall — the thumb's 44 by its slop. */
const SEND = 32;
/** How far from the ceiling the count appears. Fifty: about a line of
 *  this field's type, so it shows as the last line is being written. */
export const COUNT_FROM = 50;
/** How tall the field grows before it scrolls inside itself: four lines
 *  of 15/21 type and its padding. Past that the thread above is gone. */
const FIELD_MAX_H = 4 * 21 + 16;

/**
 * The words being written and the tags in them (`lib/commentTags`).
 *
 * The caret is kept as the field reports it — in UTF-16 units — and
 * turned into characters against the words at each render, not when the
 * report arrives: the field says where its caret is in an event of its
 * own, which on a phone can land before the render that holds the words
 * it was measured in, and a caret converted against the old words would
 * be one letter short for exactly the keystroke the offer depends on.
 */
function useTagField(taggable: Taggable | undefined) {
  const { lang } = useI18n();
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [caretUnits, setCaretUnits] = useState(0);

  const people = taggable?.people;
  const rows = taggable?.places;
  const places = useMemo(() => placesNamed(rows ?? [], lang), [rows, lang]);
  const typing = tagQuery(body, charsBefore(body, caretUnits), tags);
  const offers = typing ? offersFor(typing.query, people ?? [], places, tags) : [];

  const unitsAt = (text: string, chars: number) => Array.from(text).slice(0, chars).join('').length;
  const change = (next: string) => {
    setTags(retag(body, next, tags));
    setCaretUnits(unitsAt(next, caretAfter(body, next)));
    setBody(next);
  };
  const take = (offer: Offer) => {
    // Offers are only drawn while something is being typed.
    const out = tagged(body, tags, typing as { at: number; query: string }, offer);
    setBody(out.text);
    setTags(out.tags);
    setCaretUnits(unitsAt(out.text, out.caret));
  };
  const clear = () => { setBody(''); setTags([]); setCaretUnits(0); };

  return { body, tags, offers, change, take, clear, select: setCaretUnits };
}

export default function CommentComposer({ avatarUrl, replyTo, about, onCancelReply, onSend, onGuest, inputRef, autoFocus, bottomInset = 0, taggable }: {
  /** The reader's own face. */
  avatarUrl?: string | null;
  /** Whom the next words answer, or nobody. */
  replyTo: { who: string } | null;
  /** What the words are about, said above the field where there is no
   *  thread behind it to say so — the field a card raises over a feed
   *  (`CommentQuick`). Not drawn while `replyTo` says whom instead. */
  about?: string;
  /** Absent where nothing can be answered, and then is never called. */
  onCancelReply?: () => void;
  /** Send the words. Resolves when the server took them; rejects with
   *  what it said when it did not. */
  onSend: (body: string, mentions: Mention[]) => Promise<void>;
  /** For nobody signed in: what a press on the bar does. When given, the
   *  bar is a press and there is no field. */
  onGuest?: () => void;
  /** So the page can put the cursor in the field when "Reply" is pressed. */
  inputRef?: React.RefObject<React.ComponentRef<typeof TextInput> | null>;
  /** Open with the cursor in the field and the keyboard up. */
  autoFocus?: boolean;
  /** The phone's own margin under the bar — the home indicator's. */
  bottomInset?: number;
  /** Whom and what "@" offers here. Absent, "@" is a letter. */
  taggable?: Taggable;
}) {
  const { t } = useI18n();
  const { body, tags, offers, change, take, clear, select } = useTagField(taggable);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeholder = t('Write a comment…', 'Viết bình luận…', 'コメントを書く…', '写评论…', '寫評論…');
  const pad = { paddingBottom: 8 + bottomInset };

  if (onGuest) {
    return (
      <View style={[s.bar, pad]}>
        <PressableScale onPress={onGuest} haptic="selection" contentStyle={s.pill} accessibilityRole="button" testID="composer-guest">
          <Avatar url={null} size={FACE} />
          <Text style={[s.field, s.guest]}>{placeholder}</Text>
        </PressableScale>
      </View>
    );
  }

  const problem = bodyProblem(body);
  const length = bodyLength(body.trim());
  const ready = problem === null && !busy;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      // Trimmed here, with the tags moved to match — see `outgoing`.
      const out = outgoing(body, tags);
      await onSend(out.body, out.mentions);
      clear();
    } catch (e) {
      setError(refusalWords(refusalOf(e), t));
    }
    setBusy(false);
  };

  return (
    <View style={[s.bar, pad]} testID="composer">
      {error ? (
        <Text style={s.error} accessibilityLiveRegion="polite" testID="composer-error">{error}</Text>
      ) : null}
      {replyTo ? (
        <View style={s.replying} testID="composer-replying">
          <Text style={s.replyingText} numberOfLines={1}>
            {t(`Replying to ${replyTo.who}`, `Đang trả lời ${replyTo.who}`, `${replyTo.who}さんに返信中`, `正在回复 ${replyTo.who}`, `正在回覆 ${replyTo.who}`)}
          </Text>
          <PressableScale
            onPress={onCancelReply}
            haptic="selection"
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            accessibilityRole="button"
            accessibilityLabel={t('Stop replying', 'Thôi trả lời', '返信をやめる', '取消回复', '取消回覆')}
            testID="composer-cancel-reply"
          >
            <Glyph name="close" size={ICON.text} color={colors.textTertiary} />
          </PressableScale>
        </View>
      ) : null}
      {about && !replyTo ? (
        <Text style={[s.replyingText, s.about]} numberOfLines={1} testID="composer-about">{about}</Text>
      ) : null}
      <CommentTagOffers offers={offers} onTake={take} />
      <View style={s.pill}>
        <Avatar url={avatarUrl} size={FACE} />
        <TextInput
          ref={inputRef}
          autoFocus={autoFocus}
          style={s.field}
          value={body}
          onChangeText={change}
          onSelectionChange={(e) => select(e.nativeEvent.selection.end)}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          multiline
          accessibilityLabel={replyTo
            ? t(`Your reply to ${replyTo.who}`, `Trả lời ${replyTo.who}`, `${replyTo.who}さんへの返信`, `回复 ${replyTo.who}`, `回覆 ${replyTo.who}`)
            : t('Your comment', 'Bình luận của bạn', 'あなたのコメント', '你的评论', '你的評論')}
          testID="composer-field"
        />
        {length > BODY_MAX - COUNT_FROM ? (
          <Text style={[s.count, problem === 'long' && s.countOver]} testID="composer-count">
            {`${length}/${BODY_MAX}`}
          </Text>
        ) : null}
        <PressableScale
          onPress={ready ? send : undefined}
          disabled={!ready}
          haptic="light"
          scaleTo={0.9}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          contentStyle={[s.send, !ready && s.sendOff]}
          accessibilityRole="button"
          accessibilityLabel={t('Post', 'Đăng', '投稿', '发布', '發布')}
          accessibilityState={{ disabled: !ready, busy }}
          testID="composer-send"
        >
          <Glyph name="arrow-up" size={ICON.action} color={colors.accentInk} />
        </PressableScale>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // The foot of the page: the page's own margins, a hairline over it so
  // the thread reads as passing under.
  bar: {
    paddingHorizontal: 16, paddingTop: 8, gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
    backgroundColor: colors.bg,
  },
  // Threads' pill: the glass, a full round, the scale's 44 at rest
  // (`SECONDARY_CONTROL_H`) and growing with the words. The face and the button stay at its foot as it grows.
  pill: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: SECONDARY_CONTROL_H,
    paddingLeft: 8, paddingRight: 6, paddingVertical: 6,
    borderRadius: SECONDARY_CONTROL_H / 2, backgroundColor: colors.surfaceGlass,
  },
  field: {
    flex: 1, color: colors.text, fontSize: 15, lineHeight: 21,
    paddingTop: 5, paddingBottom: 5, maxHeight: FIELD_MAX_H,
  },
  guest: { color: colors.textTertiary },
  count: {
    color: colors.textTertiary, fontSize: 12, fontWeight: font.medium, fontVariant: ['tabular-nums'],
    lineHeight: SEND,
  },
  countOver: { color: colors.bad },
  send: {
    width: SEND, height: SEND, borderRadius: SEND / 2, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentFill,
  },
  // Dimmed, not gone: a button that vanishes leaves the reader hunting
  // for how to send.
  sendOff: { opacity: 0.35 },
  replying: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  replyingText: { flex: 1, color: colors.textTertiary, fontSize: 13, lineHeight: 18 },
  // The same line with nothing beside it: it keeps the row's inset, not its `flex`.
  about: { flex: 0, paddingHorizontal: 8 },
  error: { color: colors.bad, fontSize: 13, lineHeight: 18, paddingHorizontal: 8 },
});
