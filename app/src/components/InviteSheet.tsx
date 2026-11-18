// "Who's coming?" — the crew, with the ones you have already asked ticked.
//
// It closes on Send rather than staying open the way SaveSheet does, and
// that is the difference between the two: saving to a second list is
// another private tick, but sending is one statement that reaches other
// people. A sheet that stayed open after it would leave the reader looking
// at a list they have finished with, wondering whether the press landed.
//
// ── only friends, and why the sheet does not say so ──
//
// The insert policy refuses anybody who is not an accepted friend, so
// listing anybody else would be offering a button that cannot work. There
// is no "add someone" affordance here for the same reason — the answer to
// "they aren't in the list" is the Crew screen, not this one, and a link
// out of a sheet mid-send is a way to lose the selection.
//
// ── an already-invited name is ticked, not hidden ──
//
// This is the one place that answers "who did I ask?", and a name quietly
// missing from it reads as having forgotten to ask them. An ANSWERED
// invitation is ticked and locked: withdrawing only reaches unanswered
// rows (see the delete policy), and a checkbox that springs back is worse
// than one that does not move.
//
// ── the sheet is `FriendPicker` ──
//
// Since 13 Nov 2026 the sheet itself — the rows, the ticks, the button and
// "Not now" — is `FriendPicker`, shared with the list's `ShareSheet`. What
// stays here is everything that makes it the trip's: the seats, the
// answered rows, the shared-saves count, and what the button says.

import React, { useEffect, useMemo, useState } from 'react';
import type { FriendProfile } from '../lib/data';
import { useI18n } from '../lib/i18n';
import {
  candidates, companySeats, diffSelection, roomLeft, seatsFull, togglePick, type InviteRow,
} from '../lib/invites';
import FriendPicker from './FriendPicker';

export default function InviteSheet({
  open, company, friendIds, people, mutual, invites, sending, onClose, onSend,
}: {
  open: boolean;
  /** The sentence under the title, and the seat rule: a couple's evening
   *  holds one guest, so one tick greys the rest of the list out with the
   *  note saying why — see `companySeats`/`seatsFull`. */
  company: string | null;
  /** Accepted friends, in the order the crew list holds them. */
  friendIds: readonly string[];
  people: Record<string, FriendProfile>;
  /** Shared-taste counts, the number each row wears. */
  mutual: Record<string, number>;
  /** Every invitation already on this trip. */
  invites: readonly InviteRow[];
  sending: boolean;
  onClose: () => void;
  onSend: (invite: string[], withdraw: string[]) => void;
}) {
  const { t } = useI18n();

  const rows = useMemo(() => candidates(friendIds, invites), [friendIds, invites]);

  // Seeded from what is already sent, so the sheet opens showing the truth
  // rather than an empty slate the reader would have to rebuild.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) setPicked(new Set(rows.filter((r) => r.invited).map((r) => r.id)));
  }, [open, rows]);

  const { invite, withdraw } = diffSelection(rows, picked);
  const left = roomLeft(invites);
  // What the button says it will do. Sending leads, because it is the half
  // that reaches other people; a withdrawal on its own gets its own word
  // rather than being called "send 0". A press that does both is labelled
  // by the sending alone — "Send 1 and take back 1" is a button nobody
  // reads, and the ticks above already show the second half.
  const moved = invite.length + withdraw.length;

  // The company's own ceiling. On a couple's evening one tick fills the
  // seat, and the rest of the list greys out with the note below saying
  // why — the owner's call: simpler than any cleverness with the picks.
  // Unticking wakes the list back up. A seat held by an answered guest
  // greys it the same way, permanently.
  const seats = companySeats(company);
  const full = seatsFull(rows, picked, seats);
  const seatsHeld = seats != null && rows.filter((r) => r.locked && r.seated).length >= seats;

  const label = sending
    ? t('Sending…', 'Đang gửi…', '送信中…', '发送中…', '傳送中…')
    : invite.length
      ? t(
        `Send ${invite.length} invite${invite.length === 1 ? '' : 's'}`,
        `Gửi ${invite.length} lời mời`,
        `${invite.length}件の招待を送る`,
        `发送 ${invite.length} 个邀请`, `傳送 ${invite.length} 個邀請`,
      )
      : withdraw.length
        ? t(
          `Take back ${withdraw.length}`,
          `Rút lại ${withdraw.length}`,
          `${withdraw.length}件を取り消す`,
          `撤回 ${withdraw.length} 个`, `撤回 ${withdraw.length} 個`,
        )
        : t('Send invites', 'Gửi lời mời', '招待を送る', '发送邀请', '傳送邀請');

  const note = left === 0
    ? t(
      'This trip is full — twenty is the most one evening can hold.',
      'Chuyến này đã đầy — một buổi tối tối đa hai mươi người.',
      'この旅程は満員です — 一晩は最大20人までです。',
      '这个行程已满 — 一个晚上最多 20 人。', '這個行程已滿 — 一個晚上最多 20 人。',
    )
    : seatsHeld
      ? t(
        'A couple’s evening is complete — your guest has answered.',
        'Buổi tối hai người đã đủ — người đi cùng đã trả lời.',
        'ふたりの夜はそろいました — 相手はもう回答しています。',
        '两人的夜晚已凑齐 — 对方已经回复。', '兩人的夜晚已湊齊 — 對方已經回覆。',
      )
      : full
        ? t(
          'A couple’s evening seats one guest — untick to choose someone else.',
          'Buổi tối hai người chỉ mời một người — bỏ chọn để đổi người khác.',
          'ふたりの夜は1人だけ — 変えるにはチェックを外してください。',
          '两人的夜晚只能邀请一位 — 取消勾选可换人。', '兩人的夜晚只能邀請一位 — 取消勾選可換人。',
        )
        : t(
          'They see the plan once they accept. Times and stops stay yours to edit.',
          'Họ thấy kế hoạch sau khi đồng ý. Giờ giấc và các điểm dừng vẫn do bạn sửa.',
          '承諾すると予定が見えます。時刻とスポットはあなたが編集します。',
          '对方接受后即可看到计划。时间和地点仍由你编辑。', '對方接受後即可看到計畫。時間和地點仍由你編輯。',
        );

  return (
    <FriendPicker
      open={open}
      title={t('Who’s coming?', 'Ai sẽ đi cùng?', '誰と行く？', '谁一起来？', '誰一起來？')}
      subtitle={company === 'couple'
        ? t('A couple’s evening — pick who joins.', 'Buổi tối hai người — chọn người đi cùng.', 'ふたりの夜 — 誰を誘う？', '两人的夜晚 — 选择同行的人。', '兩人的夜晚 — 選擇同行的人。')
        : company === 'family'
          ? t('A family day — pick who joins.', 'Ngày của gia đình — chọn người đi cùng.', '家族の日 — 誰を誘う？', '家庭日 — 选择同行的人。', '家庭日 — 選擇同行的人。')
          : t('A friends day — pick who joins.', 'Ngày với bạn bè — chọn người đi cùng.', '友だちとの日 — 誰を誘う？', '朋友聚会日 — 选择同行的人。', '朋友聚會日 — 選擇同行的人。')}
      // Greyed once the seats are spoken for: an unticked row on a full
      // sheet cannot be picked, and it says so by standing down rather
      // than by a checkbox that ignores the tap. A locked row wears the
      // answer instead of a checkbox.
      rows={rows.map((r) => {
        const on = picked.has(r.id);
        const benched = full && !on && !r.locked;
        return {
          id: r.id,
          on,
          off: r.locked || benched,
          badge: r.locked ? t('Answered', 'Đã trả lời', '回答済み', '已回复', '已回覆') : undefined,
        };
      })}
      people={people}
      extra={(id) => {
        const n = mutual[id] ?? 0;
        return n > 0 ? ` · ${t(
          `${n} mutual save${n === 1 ? '' : 's'}`,
          `${n} nơi cùng lưu`,
          `共通の保存 ${n}`,
          `${n} 个共同收藏`, `${n} 個共同收藏`,
        )}` : '';
      }}
      // The Crew screen is where that happens — and no link to it from
      // here: a link out of a sheet mid-plan is a way to lose the plan.
      none={t(
        'Nobody in your crew yet. Add a friend first, then you can invite them.',
        'Chưa có ai trong nhóm. Thêm bạn trước rồi mới mời được.',
        'まだ仲間がいません。先に友だちを追加してください。',
        '你还没有好友。先添加好友，然后就可以邀请了。', '你還沒有好友。先新增好友，然後就可以邀請了。',
      )}
      note={{ icon: 'time-outline', text: note }}
      cta={{
        icon: 'paper-plane-outline',
        label,
        testID: 'invite-send',
        disabled: sending || !moved,
        onPress: () => onSend(invite, withdraw),
      }}
      rowTestID={(i) => `invite-friend-${i}`}
      onToggle={(id) => setPicked((cur) => togglePick(rows, cur, id, seats))}
      onClose={onClose}
    />
  );
}
