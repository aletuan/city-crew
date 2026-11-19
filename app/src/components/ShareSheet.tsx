// "Share with friends" — the crew, with the friends a list is already
// shared with ticked (13 Nov 2026).
//
// Opened from the Friends row of a list's "Who can see your list?" sheet,
// in its place: choosing Friends is choosing who, and a toggle that shared
// with nobody would be a third state meaning the second. The trip's
// "Who's coming?" is the pattern (owner's call) and the chrome is the one
// that sheet wears, `FriendPicker`; what is here is what makes it a list's.
//
// It closes on the press, once the write has landed — the screen closes
// it — for the reason the trip's does: sharing reaches other people, and a
// sheet still open after it leaves the owner wondering whether it landed.
// A failure keeps it open, so the ticks are not lost to an alert.
//
// ── faces in a strip (owner, 19 Nov 2026) ──
//
// The friends are drawn across, not down, and in an order made for a
// strip: who has the list, then who the owner shares with most —
// `FriendPicker` has the drawing and what it costs, `lib/shares.shareRows`
// the order and what was weighed for it.
//
// ── what it says before the press ──
//
// The subtitle says what sharing does to a public list: it goes private.
// A shared list is a private list with a guest list (the migration), so a
// public list cannot be shared without leaving Explore — and an owner who
// came here to add two friends should not find out from the banner that
// everybody else just lost it.
//
// The owner's words since 19 Nov 2026 — tightened with him the same
// evening: "the friends you choose" for a phrase that could be read as
// "whom your friends choose", and the private list's line given the same
// two verbs, see and use — and one sentence where there were two. It had said "it leaves Explore and search", which is what
// private means spelled out, and under the friends a second line in a
// box — "They can open it and plan from it. Only you can change it." —
// which the owner took out: "see and use" in the subtitle says the half
// of it that is a choice, and that nobody else edits your list is true
// of every list.
//
// The button says what it will do, from `lib/shares.shareCta`: "Share
// with 3 people" counts who will have it, not who is new, because that is
// the number the banner and the row will say afterwards. Unticking
// everyone on a shared list turns it into "Keep private", which takes
// everyone off: the owner's "nobody after all" is a real answer, and a
// button that dimmed instead would leave Private one sheet back as the
// only way to say it.
//
// ── an empty crew ──
//
// A line, and the button becomes the way to the Crew screen. The trip
// sheet will not link out — mid-plan, a link loses the selection — but
// with nobody to tick there is no selection to lose, and a dimmed Share
// over an empty list would be a dead end.

import React, { useEffect, useMemo, useState } from 'react';
import type { FriendProfile } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { diffShares, shareCta, shareRows, type ShareRow } from '../lib/shares';
import { goTo } from '../nav';
import FriendPicker from './FriendPicker';

export default function ShareSheet({
  open, isPublic, friendIds, blocked, people, shared, history, sending, onClose, onSave,
}: {
  open: boolean;
  /** Whether the list is public now: sharing it makes it private, and the
   *  subtitle says so. */
  isPublic: boolean;
  /** Accepted friends, in the order the crew list holds them. */
  friendIds: readonly string[];
  /** Who the reader has blocked — refused by the insert policy. */
  blocked: readonly string[];
  people: Record<string, FriendProfile>;
  /** Who the list is shared with now, in the order they were named. */
  shared: readonly string[];
  /** Every share on every list of the owner's: what the order of the
   *  faces is worked out from (`shareRows`). */
  history: readonly ShareRow[];
  sending: boolean;
  onClose: () => void;
  onSave: (add: string[], remove: string[]) => void;
}) {
  const { t } = useI18n();
  const rows = useMemo(() => shareRows(friendIds, shared, blocked, history), [friendIds, shared, blocked, history]);

  // Seeded from what is shared now, every time it opens: the sheet is the
  // one place that answers "who has this list?", and a name missing from
  // its ticks reads as having forgotten them.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) setPicked(new Set(shared));
  }, [open, shared]);

  const cta = shareCta(shared, picked, isPublic);
  const { add, remove } = diffShares(shared, picked);

  const button = rows.length === 0
    ? {
      icon: 'person-add-outline' as const,
      label: t('Find friends', 'Tìm bạn bè', '友だちを探す', '查找好友', '查詢好友'),
      disabled: false,
      // The Crew screen is in the Profile tab's stack, so the jump is
      // across tabs; `initial: false` keeps Profile's home beneath it
      // (see `goTo`). Here since 19 Nov 2026, from the list's page,
      // whose function had no line to give for `history`.
      onPress: () => { onClose(); goTo('Profile', { screen: 'Crew', initial: false }); },
    }
    : {
      icon: cta.kind === 'private' ? 'lock-closed-outline' as const : 'people-outline' as const,
      label: sending
        ? t('Saving…', 'Đang lưu…', '保存中…', '保存中…', '儲存中…')
        : cta.kind === 'share'
          ? t(
            `Share with ${cta.n} ${cta.n === 1 ? 'person' : 'people'}`,
            `Chia sẻ với ${cta.n} người`,
            `${cta.n}人と共有`,
            `与 ${cta.n} 人分享`, `與 ${cta.n} 人分享`,
          )
          : cta.kind === 'private'
            ? t('Keep private', 'Để riêng tư', '非公開のままにする', '保持私密', '保持私密')
            : t('Choose friends', 'Chọn bạn bè', '友だちを選ぶ', '选择好友', '選擇好友'),
      disabled: sending || cta.kind === 'none' || (cta.kind === 'share' && !cta.live),
      onPress: () => onSave(add, remove),
    };

  return (
    <FriendPicker
      open={open}
      title={t('Share with friends', 'Chia sẻ với bạn bè', '友だちと共有', '与好友分享', '與好友分享')}
      subtitle={isPublic
        ? t(
          'This list will become private: only the friends you choose can see and use it.',
          'Bộ sưu tập sẽ chuyển sang riêng tư: chỉ những người bạn mà bạn chọn mới xem và dùng được.',
          'このリストは非公開になり、選んだ友だちだけが見て使えるようになります。',
          '这个清单会变为私密，只有你选择的好友才能看到和使用。', '這個清單會變為私密，只有你選擇的好友才能看到和使用。',
        )
        : t(
          'Only the friends you choose can see and use this list.',
          'Chỉ những người bạn mà bạn chọn mới xem và dùng được bộ sưu tập này.',
          '選んだ友だちだけがこのリストを見て使えます。',
          '只有你选择的好友才能看到和使用这个清单。', '只有你選擇的好友才能看到和使用這個清單。',
        )}
      across
      rows={rows.map((id) => ({ id, on: picked.has(id) }))}
      people={people}
      none={t(
        'Nobody in your crew yet. Add a friend first, then you can share with them.',
        'Chưa có ai trong nhóm. Thêm bạn trước rồi mới chia sẻ được.',
        'まだ仲間がいません。先に友だちを追加すると共有できます。',
        '你还没有好友。先添加好友，然后就可以分享了。', '你還沒有好友。先新增好友，然後就可以分享了。',
      )}
      cta={{ ...button, testID: 'share-save' }}
      rowTestID={(i) => `share-friend-${i}`}
      onToggle={(id) => setPicked((cur) => {
        const next = new Set(cur);
        if (!next.delete(id)) next.add(id);
        return next;
      })}
      onClose={onClose}
    />
  );
}
