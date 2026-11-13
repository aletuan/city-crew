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
// ── what it says before the press ──
//
// The subtitle says what sharing does to a public list: it goes private.
// A shared list is a private list with a guest list (the migration), so a
// public list cannot be shared without leaving Explore — and an owner who
// came here to add two friends should not find out from the banner that
// everybody else just lost it.
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
import { diffShares, shareCta, shareRows } from '../lib/shares';
import FriendPicker from './FriendPicker';

export default function ShareSheet({
  open, isPublic, friendIds, blocked, people, shared, sending, onClose, onSave, onCrew,
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
  sending: boolean;
  onClose: () => void;
  onSave: (add: string[], remove: string[]) => void;
  /** To the Crew screen, for a reader with nobody in it. */
  onCrew: () => void;
}) {
  const { t } = useI18n();
  const rows = useMemo(() => shareRows(friendIds, shared, blocked), [friendIds, shared, blocked]);

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
      onPress: onCrew,
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
          'Sharing makes this list private: it leaves Explore and search, and only the friends you tick can open it.',
          'Chia sẻ sẽ chuyển bộ sưu tập sang riêng tư: nó rời Khám phá và tìm kiếm, chỉ những bạn bè bạn chọn mới mở được.',
          '共有するとこのリストは非公開になり、「探索する」と検索から外れます。開けるのはチェックした友だちだけです。',
          '分享后这个清单会变为私密：它将不再出现在探索和搜索中，只有你勾选的好友才能打开。', '分享後這個清單會變為私密：它將不再出現在探索和搜尋中，只有你勾選的好友才能開啟。',
        )
        : t(
          'Only the friends you tick can open this list.',
          'Chỉ những bạn bè bạn chọn mới mở được bộ sưu tập này.',
          'チェックした友だちだけがこのリストを開けます。',
          '只有你勾选的好友才能打开这个清单。', '只有你勾選的好友才能開啟這個清單。',
        )}
      rows={rows.map((id) => ({ id, on: picked.has(id) }))}
      people={people}
      none={t(
        'Nobody in your crew yet. Add a friend first, then you can share with them.',
        'Chưa có ai trong nhóm. Thêm bạn trước rồi mới chia sẻ được.',
        'まだ仲間がいません。先に友だちを追加すると共有できます。',
        '你还没有好友。先添加好友，然后就可以分享了。', '你還沒有好友。先新增好友，然後就可以分享了。',
      )}
      // What a friend can do with it, so the owner knows what they are
      // handing over: read it and plan from it. Not like it or copy it —
      // the friend's page offers neither (owner, 12 Nov 2026) — and that
      // is left unsaid here, because it is a thing the friend meets, not
      // one the owner chooses.
      note={{
        icon: 'eye-outline',
        text: t(
          'They can open it and plan from it. Only you can change it.',
          'Họ mở được và lên kế hoạch từ đó. Chỉ bạn sửa được.',
          '友だちは開いて予定づくりに使えます。編集できるのはあなただけです。',
          '他们可以打开它并用来规划行程。只有你能修改。', '他們可以開啟它並用來規劃行程。只有你能修改。',
        ),
      }}
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
