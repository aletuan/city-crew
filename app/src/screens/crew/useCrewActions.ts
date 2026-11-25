// Every write on the Crew page: asking by handle, asking someone
// suggested, answering a request, unfriending, blocking and unblocking.
//
// Out of `CrewScreen` on 23 Nov 2026. The screen was one of nine that
// called the data layer's writes itself — five of them here, with twelve
// reloads — so what a tap did, what it reloaded and what it said on
// failure were spread through a 664-line function. They are in one place
// now, testable without drawing the page. The screen keeps what is
// drawn: the sheets, the confirmations, the rows.
//
// The reasoning moved with the code unchanged.

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Alert } from 'react-native';
import { successHaptic } from '../../components/ui';
import {
  acceptFriendRequest, blockUser, dismissSuggestion, type FriendProfile, profileByHandle,
  removeFriendship, searchHandles, sendFriendRequest, unblockUser,
} from '../../lib/data';
import type { useCrew } from '../../lib/crew';
import { MIN_SUGGEST_CHARS, standingWith, suggestable } from '../../lib/friends';
import { atHandle, handleProblem, normalizeHandle } from '../../lib/handle';
import type { useI18n } from '../../lib/i18n';
import { reasonOf, usePending } from '../../lib/pending';

type Crew = ReturnType<typeof useCrew>;

export function useCrewActions({ me, ships, blocks, setDismissed, t }: {
  me: string | null | undefined;
  ships: Crew['ships'];
  blocks: Crew['blocks'];
  /** The suggestions put away this visit, which the screen filters by. */
  setDismissed: Dispatch<SetStateAction<string[]>>;
  t: ReturnType<typeof useI18n>['t'];
}) {
  // ── the add flow ──
  const [adding, setAdding] = useState(false);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Suggestions under the field, from two typed letters up. Prefix only
  // — see `searchHandles` — debounced a beat so a fast typist costs one
  // query, not one per letter; and answers are checked against the text
  // still in the box, so a slow reply for "an" cannot overwrite the
  // suggestions for "anh" that already landed.
  const [found, setFound] = useState<FriendProfile[]>([]);
  useEffect(() => {
    const bare = normalizeHandle(handle);
    if (bare.length < MIN_SUGGEST_CHARS) { setFound([]); return; }
    // A failed lookup keeps the suggestions already shown: the field
    // still sends by exact handle, which says plainly when it fails.
    const timer = setTimeout(() => {
      searchHandles(bare).then((rows) => {
        setFound((prev) => (normalizeHandle(handle) === bare ? suggestable(rows, me ?? '', blocks.data) : prev));
      }).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [handle, me, blocks.data]);

  const send = async () => {
    const bare = normalizeHandle(handle);
    if (handleProblem(bare)) {
      setNote(t('That does not look like a handle.', 'Trông không giống một username.', 'ユーザー名の形式ではありません。', '这看起来不像用户名。', '這看起來不像使用者名稱。'));
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const who = await profileByHandle(bare);
      if (!who) {
        // The one thing the lookup may say about an absent account.
        setNote(t(`Nobody here is ${atHandle(bare)}.`, `Chưa có ai là ${atHandle(bare)}.`, `${atHandle(bare)} は見つかりませんでした。`, `没有找到 ${atHandle(bare)}。`, `沒有找到 ${atHandle(bare)}。`));
        return;
      }
      const standing = standingWith(ships.data, me ?? '', who.id);
      if (standing === 'yourself') {
        setNote(t('That is you.', 'Đó chính là bạn.', 'それはあなたです。', '这是你自己。', '這是你自己。'));
      } else if (standing === 'friends') {
        setNote(t(`You and ${atHandle(who.handle)} are already friends.`, `Bạn và ${atHandle(who.handle)} đã là bạn bè.`, `${atHandle(who.handle)} とはすでに友達です。`, `你和 ${atHandle(who.handle)} 已经是好友了。`, `你和 ${atHandle(who.handle)} 已經是好友了。`));
      } else if (standing === 'asked') {
        setNote(t('Already asked — waiting on their answer.', 'Đã gửi lời mời — đang chờ trả lời.', 'リクエスト送信済み — 返事待ちです。', '已发送请求 — 等待对方回复。', '已傳送請求 — 等待對方回覆。'));
      } else if (standing === 'asks_you') {
        setNote(t('They already asked you — their request is above.', 'Họ đã mời bạn — lời mời ở ngay trên.', '相手からのリクエストが上にあります。', '对方已经向你发送了请求 — 就在上方。', '對方已經向你傳送了請求 — 就在上方。'));
      } else {
        await sendFriendRequest(me!, who.id);
        setHandle('');
        setAdding(false);
        setNote(null);
        successHaptic();
        ships.reload();
      }
    } catch (e) {
      // A policy refusal is worded neutrally on purpose: the one way an
      // insert fails for a signed-in user under the cap is a block, and
      // a block must not announce itself. The cap has its own honest
      // sentence because the server names it in the count check's wake.
      const msg = (e as Error).message;
      setNote(/row-level security/i.test(msg)
        ? t('Could not send this request.', 'Không gửi được lời mời này.', 'リクエストを送信できませんでした。', '无法发送这个请求。', '無法傳送這個請求。')
        : msg);
    } finally {
      setBusy(false);
    }
  };

  // Every write below goes through `run`: one at a time per person, and a
  // failure said out loud. They all used to end in `.catch(() => {})` — a
  // dropped connection left the row as it was, with no word on whether the
  // tap had missed or the write had failed; for a block, the one a reader
  // is relying on, that is the worst possible silence. See lib/pending.
  const { pending, run } = usePending();
  const failed = (title: string) => (e: unknown) => Alert.alert(title, reasonOf(e));

  /** One tap from an introduction. No confirmation: the row says who and
   *  the ask is silent and withdrawable — a sheet here would be asking
   *  permission to be friendly. It lands in Sent, which is directly
   *  above, so the tap has somewhere visible to go. */
  const askSuggested = (id: string) => run(
    id,
    () => sendFriendRequest(me!, id),
    () => { successHaptic(); ships.reload(); },
    failed(t('Could not send the request', 'Không gửi được lời mời', 'リクエストを送れませんでした', '无法发送请求', '無法傳送請求')),
  );

  /** The ×: the row goes now and does not come back. No confirmation
   *  and no undo (owner, 25 Oct 2026) — it is a suggestion, and the
   *  person can still be added by handle. A write that fails costs only
   *  their return on the next visit, which is not worth a message. */
  const dismiss = (id: string) => {
    setDismissed((d) => [...d, id]);
    dismissSuggestion(me!, id).catch(() => {});
  };

  const answer = (requester: string, yes: boolean) => run(
    requester,
    () => (yes ? acceptFriendRequest(requester, me!) : removeFriendship(requester, me!)),
    () => { if (yes) successHaptic(); ships.reload(); },
    failed(yes
      ? t('Could not accept the request', 'Không chấp nhận được lời mời', 'リクエストを承認できませんでした', '无法接受请求', '無法接受請求')
      : t('Could not decline the request', 'Không từ chối được lời mời', 'リクエストを拒否できませんでした', '无法拒绝请求', '無法拒絕請求')),
  );

  const cutEdge = (id: string, failTitle: string) => run(
    id,
    () => removeFriendship(me!, id),
    () => ships.reload(),
    failed(failTitle),
  );
  const bar = (id: string) => run(
    id,
    () => blockUser(id),
    () => { ships.reload(); blocks.reload(); },
    failed(t('Could not block', 'Không chặn được', 'ブロックできませんでした', '无法屏蔽', '無法遮蔽')),
  );
  const unblock = (id: string) => run(
    id,
    () => unblockUser(me!, id),
    () => blocks.reload(),
    failed(t('Could not unblock', 'Không bỏ chặn được', 'ブロックを解除できませんでした', '无法取消屏蔽', '無法取消遮蔽')),
  );

  return {
    adding, setAdding, handle, setHandle, busy, note, setNote, found, setFound, send,
    pending, askSuggested, dismiss, answer, cutEdge, bar, unblock,
  };
}

export type CrewActions = ReturnType<typeof useCrewActions>;
