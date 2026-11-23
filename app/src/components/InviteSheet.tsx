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
// Since 13 Nov 2026 the sheet itself — the friends, the ticks, the button
// and "Not now" — is `FriendPicker`, shared with the list's `ShareSheet`;
// since 20 Nov 2026 its friends are a strip of faces to scroll sideways,
// as the list's are (owner), and no longer rows with a shared-saves count. What
// stays here is everything that makes it the trip's: the seats, the
// answered faces, and what the button says.

import React, { useEffect, useMemo, useState } from 'react';
import type { FriendProfile } from '../lib/data';
import { useI18n } from '../lib/i18n';
import {
  candidates, companySeats, diffSelection, roomLeft, seatsFull, togglePick, type InviteRow,
} from '../lib/invites';
import FriendPicker from './FriendPicker';

export default function InviteSheet({
  open, company, friendIds, people, invites, sending, onClose, onSend,
}: {
  open: boolean;
  /** The sentence under the title, and the seat rule: a couple's evening
   *  holds one guest, so one tick greys the rest of the list out with the
   *  note saying why — see `companySeats`/`seatsFull`. */
  company: string | null;
  /** Accepted friends, in the order the crew list holds them. */
  friendIds: readonly string[];
  people: Record<string, FriendProfile>;
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
    // `seated`, not `invited`: a refusal is an invitation on the row but
    // not a yes, and ticking it opened the sheet saying she was coming.
    if (open) setPicked(new Set(rows.filter((r) => r.seated).map((r) => r.id)));
  }, [open, rows]);

  const { invite, withdraw } = diffSelection(rows, picked);
  const left = roomLeft(invites);
  // What the button says it will do. Sending leads, because it is the half
  // that reaches other people; a withdrawal on its own gets its own word
  // rather than being called "send 0". A press that does both is labelled
  // by the sending alone — "Send 1 and take back 1" is a button nobody
  // reads, and the ticks above already show the second half.
  const moved = invite.length + withdraw.length;
  // Asked and not answered, and still ticked: what the sheet opens on
  // after a send. With nothing moved, the note and the button speak for
  // them rather than offering to "send" what has been sent.
  const waiting = rows.filter((r) => r.invited && !r.locked && picked.has(r.id));
  const nameOf = (id: string) => people[id]?.full_name || people[id]?.handle || '';

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
    : !moved && waiting.length
      ? t('Sent — waiting for an answer', 'Đã gửi, đang chờ', '送信済み — 返事待ち', '已发送，等待回复', '已傳送，等待回覆')
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
    : !moved && waiting.length
      ? waiting.length === 1
        ? t(
          `${nameOf(waiting[0].id)} is invited and hasn’t answered yet. Tap them to take it back.`,
          `Đã mời ${nameOf(waiting[0].id)}, đang chờ trả lời. Chạm vào người đó để rút lời mời.`,
          `${nameOf(waiting[0].id)}さんを招待済み、返事待ちです。取り消すにはタップしてください。`,
          `已邀请${nameOf(waiting[0].id)}，等待回复。点一下可撤回邀请。`, `已邀請${nameOf(waiting[0].id)}，等待回覆。點一下可撤回邀請。`,
        )
        : t(
          `${waiting.length} invited and not answered yet. Tap one to take it back.`,
          `Đã mời ${waiting.length} người, đang chờ trả lời. Chạm vào một người để rút lời mời.`,
          `${waiting.length}人を招待済み、返事待ちです。取り消すにはタップしてください。`,
          `已邀请 ${waiting.length} 人，等待回复。点一下可撤回邀请。`, `已邀請 ${waiting.length} 人，等待回覆。點一下可撤回邀請。`,
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
        // An answered row says which way: a locked row that holds no seat
        // is a refusal (`candidates`), and wearing "Answered" it looked
        // like a yes (owner, 20 Nov 2026).
        // And an unanswered one says it is waiting, and a fresh tick that
        // it is about to go (owner, 23 Nov 2026): all three wore the same
        // coral tick, and an invitation nobody had answered read as a yes.
        const pending = r.invited && !r.locked;
        const badge = r.locked
          ? r.seated
            ? t('Accepted', 'Đã đồng ý', '承諾済み', '已接受', '已接受')
            : t('Can’t make it', 'Không đi được', '不参加', '无法参加', '無法參加')
          : !on ? undefined
            : pending
              ? t('Waiting', 'Đang chờ', '返事待ち', '等待中', '等待中')
              : t('To invite', 'Sẽ mời', '招待する', '将邀请', '將邀請');
        const mark = pending ? 'waiting' as const : r.locked && r.seated ? 'yes' as const : undefined;
        return { id: r.id, on, off: r.locked || benched, badge, mark };
      })}
      people={people}
      // The Crew screen is where that happens — and no link to it from
      // here: a link out of a sheet mid-plan is a way to lose the plan.
      // In the share sheet's words (owner, 20 Nov 2026): "friends", not
      // "crew" / "nhóm".
      none={t(
        'You have no friends here yet. Add one, then come back to invite.',
        'Bạn chưa có bạn bè nào. Thêm bạn rồi quay lại mời nhé.',
        'まだ友だちがいません。友だちを追加してから招待しましょう。',
        '你还没有好友。添加好友后再回来邀请吧。', '你還沒有好友。新增好友後再回來邀請吧。',
      )}
      note={{ icon: 'time-outline', text: note }}
      cta={{
        icon: !moved && waiting.length ? 'time-outline' : 'paper-plane-outline',
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
