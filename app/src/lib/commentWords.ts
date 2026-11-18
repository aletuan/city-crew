// The sentence for each way the server refuses a comment.
//
// `post_comment` raises one of nine words (`lib/comments.refusalOf`
// names them); a reader is owed a sentence for each one they can do
// something about or should be told. Here, and not in the field that
// shows them, so that every place a comment can be written from says
// the same thing — the thread's own field, and the one a card raises —
// and so Node can hold every branch to the gate.
//
// A failure that is not a refusal (no network, a function that is not
// there) says to try again; so do the two words that are not a post's.

import { BODY_MAX, type Refusal } from './comments';

type T = (en: string, vi: string, ja: string, zh?: string, hant?: string) => string;

/** What to tell a reader for each refusal. */
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
