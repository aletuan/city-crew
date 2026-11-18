// Writing a comment, or an answer to one (C4 of `docs/comments-plan.md`).
//
// ── a form, not a field at the foot of the thread ──
//
// Threads opens a reply as a page of its own with the post answered
// above the field, and this does the same, for two reasons this app
// adds to Threads' one. Threads': the comment being answered stays in
// sight while the keyboard is up. This app's: the tab bar floats over
// the foot of every page, so a field pinned there would sit under it or
// above it with a gap, and every other thing the app asks a reader to
// write — a list's name, a bio — is already a form reached by a press
// (`AuthScreen`, which carries the keyboard for all of them).
//
// ── what it sends ──
//
// The words, trimmed by the server, under the subject it was handed and
// the comment it answers when there is one. No tags yet (C5).
//
// The button is lit when there is something to send: not spaces alone,
// not over the ceiling (`lib/comments.bodyProblem`, the server's two
// checks made first). The count is the server's count — characters, not
// UTF-16 units — and is drawn always, as the bio's is: a ceiling a
// reader meets only on hitting it is a ceiling they did not get to
// write toward. There is no `maxLength` on the field: it counts UTF-16
// units, and would stop a comment of 250 emoji that the server takes.
//
// ── when the server says no ──
//
// `post_comment` raises one of nine words; `refusalOf` names it and this
// has a sentence for each a reader can do something about or should be
// told. The words stay in the field: nothing a reader typed is thrown
// away because a rule said not yet. A failure that is not a refusal — no
// network — says to try again.
//
// ── when it says yes ──
//
// `commentsChanged()`, so the thread behind this form and every count
// that reads it ask again, and back. The thread draws the comment when
// its answer lands; nothing is drawn ahead of the server, because the
// server is what decides whether a comment exists (the filter, the cap,
// a block made a minute ago).

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthHeader, AuthScreen, FieldRow, FormError } from '../components/authUi';
import { successHaptic } from '../components/ui';
import { BODY_MAX, bodyLength, bodyProblem, refusalOf, type Refusal } from '../lib/comments';
import { commentsChanged } from '../lib/commentsChanged';
import { postComment } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, font, space } from '../theme';
import type { Nav, RootRoute } from '../nav';

type T = ReturnType<typeof useI18n>['t'];

/** What to tell a reader for each refusal — see the header. */
export function refusalWords(why: Refusal | null, t: T): string {
  switch (why) {
    case 'signed_out': return t('Sign in to comment.', 'Đăng nhập để bình luận.', 'コメントするにはログインしてください。', '登录后才能评论。', '登入後才能評論。');
    case 'subject': return t(
      'This collection is no longer open to comments.',
      'Bộ sưu tập này không còn nhận bình luận.',
      'このコレクションには現在コメントできません。',
      '这个合集已不再接受评论。', '這個合集已不再接受評論。',
    );
    case 'off': return t(
      'The owner has turned comments off for this collection.',
      'Chủ bộ sưu tập đã tắt bình luận.',
      'このコレクションのコメントはオフになっています。',
      '合集的主人已关闭评论。', '合集的主人已關閉評論。',
    );
    case 'empty': return t('Write something first.', 'Hãy viết gì đó trước.', '何か書いてください。', '请先写点什么。', '請先寫點什麼。');
    case 'long': return t(
      `Comments can be up to ${BODY_MAX} characters.`,
      `Bình luận tối đa ${BODY_MAX} ký tự.`,
      `コメントは${BODY_MAX}文字までです。`,
      `评论最多 ${BODY_MAX} 个字符。`, `評論最多 ${BODY_MAX} 個字元。`,
    );
    case 'banned': return t(
      'This comment has a word that is not allowed here.',
      'Bình luận có từ không được phép dùng ở đây.',
      'このコメントには使用できない言葉が含まれています。',
      '评论中含有此处不允许使用的词语。', '評論中含有此處不允許使用的詞語。',
    );
    case 'cap': return t(
      'You have reached today\'s limit for comments. Try again tomorrow.',
      'Bạn đã đạt giới hạn bình luận hôm nay. Hãy thử lại vào ngày mai.',
      '本日のコメント上限に達しました。明日もう一度お試しください。',
      '你已达到今天的评论上限，请明天再试。', '你已達到今天的評論上限，請明天再試。',
    );
    case 'parent': return t(
      'The comment you are replying to is no longer there.',
      'Bình luận bạn đang trả lời không còn nữa.',
      '返信先のコメントはもうありません。',
      '你要回复的评论已不存在。', '你要回復的評論已不存在。',
    );
    // `mention` cannot happen until tags are sent (C5), and `not_yours`
    // is a delete's; either reaching here is a failure like any other.
    default: return t(
      'Could not post your comment. Check your connection and try again.',
      'Không đăng được bình luận. Kiểm tra kết nối rồi thử lại.',
      'コメントを投稿できませんでした。接続を確認して、もう一度お試しください。',
      '无法发布评论。请检查网络连接后重试。', '無法發布評論。請檢查網路連線後重試。',
    );
  }
}

export default function CommentFormScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'CommentForm'>;
}) {
  const { t } = useI18n();
  const { subject, replyTo } = route.params;
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem = bodyProblem(body);
  const length = bodyLength(body.trim());

  const post = async () => {
    setBusy(true);
    setError(null);
    try {
      await postComment(subject, replyTo ? replyTo.id : null, body);
      successHaptic();
      commentsChanged();
      navigation.goBack();
    } catch (e) {
      setError(refusalWords(refusalOf(e), t));
      setBusy(false);
    }
  };

  return (
    <AuthScreen>
      <AuthHeader
        onBack={() => navigation.goBack()}
        backBare compactTitle
        title={replyTo ? t('Reply', 'Trả lời', '返信', '回复', '回覆') : t('Comment', 'Bình luận', 'コメント', '评论', '評論')}
        action={{
          label: t('Post', 'Đăng', '投稿', '发布', '發布'),
          onPress: post,
          busy,
          disabled: problem !== null,
          testID: 'comment-post',
        }}
      />
      {/* What is being answered, above the field, where the keyboard
          leaves it. Two lines: enough to know which comment, and the
          thread is one press back for the rest. */}
      {replyTo ? (
        <View style={s.quote} testID="comment-form-quote">
          <Text style={s.quoteWho} numberOfLines={1}>{replyTo.who}</Text>
          <Text style={s.quoteBody} numberOfLines={2}>{replyTo.body}</Text>
        </View>
      ) : null}
      {error ? <FormError>{error}</FormError> : null}
      <View>
        <FieldRow
          grouped
          flush
          icon="chatbubble-outline"
          label={replyTo
            ? t(`Your reply to ${replyTo.who}`, `Trả lời ${replyTo.who}`, `${replyTo.who}さんへの返信`, `回复 ${replyTo.who}`, `回覆 ${replyTo.who}`)
            : t('Your comment', 'Bình luận của bạn', 'あなたのコメント', '你的评论', '你的評論')}
          placeholder={t('What do you think?', 'Bạn nghĩ gì?', 'どう思いますか？', '你怎么看？', '你怎麼看？')}
          value={body}
          onChangeText={setBody}
          multiline
          autoFocus
          testID="comment-field"
        />
        <Text style={[s.count, problem === 'long' && s.countOver]} testID="comment-count">
          {`${length}/${BODY_MAX}`}
        </Text>
      </View>
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  // The comment answered: a rule down its left edge in the quiet ink, the
  // way a quoted line is set in every mail client a reader has used, and
  // nothing else — it is context, and the field is the page.
  quote: {
    borderLeftWidth: 2, borderLeftColor: colors.borderGlassSoft,
    paddingLeft: 12, paddingVertical: 2, gap: 2,
  },
  quoteWho: { color: colors.textSecondary, fontSize: 13, fontWeight: font.semibold, lineHeight: 18 },
  quoteBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  // The bio's count, value for value, on the page's own margin since the
  // field is flush.
  count: {
    alignSelf: 'flex-end', marginTop: space.cardGap / 2,
    color: colors.textTertiary, fontSize: 12, fontWeight: font.medium, fontVariant: ['tabular-nums'],
  },
  countOver: { color: colors.bad },
});
