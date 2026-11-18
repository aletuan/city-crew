// One comment in a thread (C3 of `docs/comments-plan.md`): a face, who
// and how long ago on one line, and the words under it, with a person or
// a place tagged in them drawn as something to press.
//
// It draws a `Placed` and knows nothing else — not what the thread is
// about, not who is reading. Where it sits and what it answers were
// decided by `lib/comments.threadOf`; this turns `level` into an indent
// and `to` into a name at the head of the words.
//
// ── a comment that is gone ──
//
// One quiet line, no face, no name and no way to answer it (the server
// refuses an answer to a comment that is gone): the server sends neither, and
// does not say whether it was deleted or is by somebody blocked from the
// reader. The line is drawn only where answers still hang from it —
// `threadOf` drops the rest — so it reads as the thing they answer.
//
// ── the tags ──
//
// A person's opens their page, by the handle they have today; the text
// tagged stays as it was written. A tag with no handle behind it (an
// account whose handle the read could not find) and a place's, until C5
// gives it somewhere to go, are drawn in the accent and are not pressed:
// `onPlace` is the caller's to hand in when there is a page to open.
//
// The whole row is one line to VoiceOver — who, when, what — as a
// message is; a tag inside it is a link within that text.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './ui/controls';
import { Glyph, ICON } from './ui/glyph';
import { Avatar } from './ui/surfaces';
import { useI18n } from '../lib/i18n';
import { normalizeHandle } from '../lib/handle';
import { segmentsOf, type Placed } from '../lib/comments';
import { colors, font } from '../theme';

/** A comment's face: 36, the feed card's, where a face stands beside two
 *  lines of 15pt and 13pt type and is their height. */
export const FACE = 36;
/** An answer's: 28 — the size the collection card's head gave a face
 *  before 13 Nov, and what is left of 36 when the eye should read "under"
 *  before it reads "who". */
export const FACE_REPLY = 28;
/** The ⋯ at a row's end: 18, the size the feed card draws its heart and
 *  bubble at — a mark of the same weight. */
const MORE_GLYPH = ICON.action;
/** How far in each level sits: a root's face and its gap (36 + 10), so an
 *  answer's face starts under the root's words. The second step is the
 *  answer's own (28 + 10). On a 393pt screen with the page's margins that
 *  leaves the deepest level some 200pt of words beside its ⋯ — drawn to scale, not
 *  measured on a phone. */
export const INDENT = [0, FACE + 10, FACE + 10 + FACE_REPLY + 10] as const;

export default function CommentRow({ comment, when, onPerson, onPlace, onReply, onMore }: {
  comment: Placed;
  /** How long ago, already in words. */
  when: string;
  onPerson: (handle: string) => void;
  /** Absent until a place tag has somewhere to open. */
  onPlace?: (placeId: string) => void;
  /** Answer this comment. Absent on a page that is read-only. */
  onReply?: () => void;
  /** Raise what can be done about this comment — delete, report. Absent
   *  where there is nothing to offer. */
  onMore?: () => void;
}) {
  const { t } = useI18n();
  const indent = { marginLeft: INDENT[comment.level] };

  if (comment.gone) {
    return (
      <View style={[s.row, s.goneRow, indent]} testID="comment-gone">
        <Text style={s.gone}>
          {t('This comment was deleted', 'Bình luận đã bị xoá', 'このコメントは削除されました', '该评论已删除', '該評論已刪除')}
        </Text>
      </View>
    );
  }

  const handle = comment.handle ? normalizeHandle(comment.handle) : '';
  const who = handle || comment.full_name || t('Someone', 'Ai đó', '誰か', '有人', '有人');
  const size = comment.level === 0 ? FACE : FACE_REPLY;
  const body = comment.body ?? '';

  return (
    <View style={[s.row, indent]} testID="comment-row">
      {/* The face is a door of its own, outside the line VoiceOver reads.
          Nobody's handle, nobody's page: then it is a face and no door. */}
      {handle ? (
        <PressableScale
          onPress={() => onPerson(handle)}
          haptic="selection"
          accessibilityRole="button"
          accessibilityLabel={who}
          testID="comment-face"
        >
          <Avatar url={comment.avatar_url} size={size} />
        </PressableScale>
      ) : <Avatar url={comment.avatar_url} size={size} />}
      <View style={s.words}>
        <View accessible accessibilityLabel={[who, when, body].join(', ')} testID="comment-words">
        <View style={s.head}>
          <Text style={s.who} numberOfLines={1} testID="comment-who">{who}</Text>
          <Text style={s.when} testID="comment-when">{when}</Text>
        </View>
        <Text style={s.body} testID="comment-body">
          {comment.to ? <Text style={s.to} testID="comment-to">{`@${normalizeHandle(comment.to)} `}</Text> : null}
          {segmentsOf(body, comment.mentions).map((seg, i) => {
            if (seg.kind === 'text') return <Text key={i}>{seg.text}</Text>;
            const open = seg.kind === 'person'
              ? (seg.handle ? () => onPerson(normalizeHandle(seg.handle as string)) : undefined)
              : (onPlace ? () => onPlace(seg.id) : undefined);
            return (
              <Text
                key={i}
                style={s.tag}
                onPress={open}
                accessibilityRole={open ? 'link' : undefined}
                testID={`comment-tag-${seg.kind}`}
              >
                {seg.text}
              </Text>
            );
          })}
        </Text>
        </View>
        {/* Outside the line VoiceOver reads: a control of its own. 44 to
            the thumb by its slop; drawn at the age's size, since it is
            the same kind of thing — small print under the words. */}
        {onReply ? (
          <PressableScale
            onPress={onReply}
            haptic="selection"
            hitSlop={{ top: 12, bottom: 14, left: 12, right: 24 }}
            style={s.replyHang}
            accessibilityRole="button"
            accessibilityLabel={t(`Reply to ${who}`, `Trả lời ${who}`, `${who}さんに返信`, `回复 ${who}`, `回覆 ${who}`)}
            testID="comment-reply"
          >
            <Text style={s.reply}>{t('Reply', 'Trả lời', '返信', '回复', '回覆')}</Text>
          </PressableScale>
        ) : null}
      </View>
      {/* What can be done about it, at the row's end and outside the line
          VoiceOver reads. The glyph is 18 in the quiet ink — it is on
          every row, and a page of them at full ink would be a column of
          dots louder than the names. 44 to the thumb by its slop. */}
      {onMore ? (
        <PressableScale
          onPress={onMore}
          haptic="selection"
          hitSlop={{ top: 13, bottom: 13, left: 13, right: 13 }}
          accessibilityRole="button"
          accessibilityLabel={t(`More about ${who}'s comment`, `Thêm về bình luận của ${who}`, `${who}さんのコメントのその他`, `关于 ${who} 的评论的更多操作`, `關於 ${who} 的評論的更多操作`)}
          testID="comment-more-menu"
        >
          <Glyph name="ellipsis-horizontal" size={MORE_GLYPH} color={colors.textTertiary} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  // 10 between the face and the words, the feed card's head; 8 above and
  // below, so two rows stand 16 apart — a line of the body's type.
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  goneRow: { paddingVertical: 10 },
  words: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  // The name gives when it is long; the age never does.
  who: { color: colors.text, fontSize: 15, fontWeight: font.semibold, lineHeight: 20, flexShrink: 1 },
  when: { color: colors.textTertiary, fontSize: 13, lineHeight: 17 },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  // Who a deep answer is to: the accent, as a tag is, since it is one.
  to: { color: colors.accent },
  tag: { color: colors.accent, fontWeight: font.medium },
  replyHang: { alignSelf: 'flex-start', marginTop: 4 },
  reply: { color: colors.textTertiary, fontSize: 13, fontWeight: font.semibold, lineHeight: 18 },
  gone: { color: colors.textTertiary, fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
});
