// Who sees a list of yours, and the three ways of changing it.
//
// Out of `CollectionDetailScreen` on 23 Nov 2026, the first step of F1
// in that day's code review: the screen's one function was 740 lines
// with a complexity of 137, and this was about a quarter of it — the
// word under your handle, the sheet it opens, the friends picker, and
// the writes behind all three. The reasoning below moved with the code
// unchanged; only the seams are new.
//
// It is one hook rather than three because the three answers write the
// same two places (`is_public` and the share rows) and each has to know
// what the others did: Public keeps the shares, Friends on a public list
// unpublishes it, Private takes the shares off. Split, each piece would
// need the other two's state passed back in.
//
// What the screen still owns is the drawing: the glyph under your
// handle, the share button, the sheet and the picker. This returns what
// they read and the presses they make.

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';
import { successHaptic } from '../../components/ui';
import {
  isNotShareable, setCollectionPublic, setShares, unseenMembers, unseenSentence, useMyListShares,
  type Collection,
} from '../../lib/data';
import type { useCollections } from '../../lib/catalog';
import { useCrew } from '../../lib/crew';
import { splitFriendships } from '../../lib/friends';
import type { useI18n } from '../../lib/i18n';
import type { useMyLists } from '../../lib/save';
import { namesBriefly, seenName, sharesByList, visibilityOf } from '../../lib/shares';
import type { Nav, RootRoute } from '../../nav';
import { whoSeesRows } from './Share';

/** What a change of who-sees-it says to VoiceOver: published, private
 *  again, or shared with this many people — see `said`. */
type Said = 'public' | 'private' | { shared: number };

export type ListVisibilityArgs = {
  /** The list on screen, once it is in hand. */
  col: Collection | null | undefined;
  uid: string | undefined;
  owned: boolean;
  isPublic: boolean;
  /** The two catalogs a change of `is_public` moves the row between. */
  mine: ReturnType<typeof useMyLists>;
  cols: ReturnType<typeof useCollections>;
  /** The places nobody else can see yet, for the Public row's sentence. */
  unseen: ReturnType<typeof unseenMembers>;
  navigation: Nav;
  t: ReturnType<typeof useI18n>['t'];
  /** What the form asked for on its way out (`formParts`' `leaveForm`). */
  arrived: RootRoute<'CollectionDetail'>['params']['seen'];
};

export function useListVisibility({
  col, uid, owned, isPublic, mine, cols, unseen, navigation, t, arrived,
}: ListVisibilityArgs) {
  /*
   * Who your list is shared with (13 Nov 2026), and so which of three
   * words the line under your handle says — `lib/shares.visibilityOf`:
   * Public, Friends (not public, shared with somebody) or Private.
   *
   * Read for every list you own at once, the read the Collections tab's
   * tiles make too (`useMyListShares`), and remembered between launches,
   * so a shared list opens saying Friends rather than Private-then-Friends.
   * Somebody else's list asks nothing: who it is shared with is its
   * owner's business, and the policy would show you only your own row.
   *
   * The crew is the picker's: accepted friends in the crew's own order,
   * and the faces that name them on the sheet's Friends row.
   */
  const listShares = useMyListShares(owned ? uid : null);
  const sharedWith = useMemo(
    () => (col?.id ? sharesByList(listShares.data)[col.id] ?? [] : []),
    [listShares.data, col?.id],
  );
  const seen = visibilityOf(isPublic, sharedWith.length);
  const seenWord = seenName(seen, t);
  const { ships, blocks, people } = useCrew();
  const friendIds = useMemo(() => (uid ? splitFriendships(ships.data, uid).friends : []), [ships.data, uid]);

  /**
   * Publish, or take it back.
   *
   * No confirmation, and since 17 Oct 2026 no Undo either (owner: the
   * banner looked busy with it). An alert asking "are you sure" before a
   * reversible act is a toll on everyone who meant it. The Undo was the
   * way back while the switch was one tap in the ⋯ menu, where a slip
   * was easy; it is two deliberate taps now — the word under your handle
   * at the card's head, then the answer in the sheet — and the way back
   * is the same two taps on the same word, which stays on screen.
   *
   * Both catalogs are reloaded because the row moves between them: it
   * leaves nothing in `mine`, which returns everything you own either
   * way, but it enters and leaves the public query, and that query is
   * what the other section is drawn from.
   *
   * ── three answers, and what each does to the other two ──
   *
   * Since 13 Nov 2026 a list can also be shared with chosen friends, and
   * the three answers are written to two places — `is_public` and the
   * share rows — so each says what it does to the column it is not named
   * after (owner's calls, the same day):
   *
   * - Public keeps the shares. The migration's rule: a list that is
   *   public and shared is simply public, and its shares wait, applying
   *   again if it goes private. The card says Public.
   * - Friends on a public list makes it private as well — a shared list
   *   is a private list with a guest list — and the picker's subtitle
   *   says so before the press (`saveShares`).
   * - Private takes every share off, the waiting ones behind a public
   *   list included. It is the owner's "only me", and leaving the shares
   *   would make it Friends the moment it stopped being public — the
   *   answer they did not choose.
   */
  const [publishing, setPublishing] = useState(false);
  // No check for places under review here: a list goes public with them
  // in, and they stay out of everyone else's sight until they are live
  // (`*_lists_stay_public_around_unlive_places.sql`). The Public row says
  // how many (see `whoSeesRows`).
  const publish = () => {
    if (!col || publishing) return;
    setPublishing(true);
    setCollectionPublic(col.slug, true)
      .then(() => {
        mine.reload();
        cols.reload();
        said('public');
      })
      .catch((e: Error) => Alert.alert(
        t('Could not publish', 'Không công khai được', '公開できませんでした', '无法公开', '無法公開'),
        e.message,
      ))
      .finally(() => setPublishing(false));
  };
  const cannotMakePrivate = () => t('Could not make private', 'Không chuyển riêng tư được', '非公開にできませんでした', '无法设为私密', '無法設為私密');
  /* Only you: the shares off first, then the flag. In that order so that
     no moment in between shows the list to more people than before —
     the other order would, for a public list with shares waiting, hand
     it to those friends the instant it went private. `setShares` asks
     nothing when there is nobody to take off.

     The id is there whenever there is a share to take off: the shares
     are filed by it (`sharedWith`). */
  const makePrivate = () => {
    if (!col || publishing) return;
    const wasPublic = isPublic;
    setPublishing(true);
    setShares(col.id as string, [], sharedWith)
      .then(() => (wasPublic ? setCollectionPublic(col.slug, false) : undefined))
      .then(() => {
        listShares.reload();
        if (wasPublic) { mine.reload(); cols.reload(); }
        said('private');
      })
      .catch((e: Error) => Alert.alert(cannotMakePrivate(), e.message))
      .finally(() => setPublishing(false));
  };
  /* The picker's press: share with the ticked, take it from the
     unticked, and — for a public list being shared — make it private,
     after the shares, for the reason `setShares` gives. Nobody ticked is
     the picker's Keep private, which only a list that is not public
     offers (`shareCta`), so it never unpublishes.

     The catalogs reload only when the flag moved: shares are not in
     them, and the public query is the heaviest read the app makes.

     A refusal of a friend is the crew having moved on their phone — an
     unfriend or a block since the crew was read. Nothing was written
     (the insert fails whole, and the removal comes after it), so the
     sheet stays open with its ticks, the crew is read again so the name
     goes, and the alert says why rather than relaying a policy. */
  const [picking, setPicking] = useState(false);
  const saveShares = (list: Collection, add: string[], remove: string[]) => {
    const n = sharedWith.length + add.length - remove.length;
    const unpublish = n > 0 && isPublic;
    setPublishing(true);
    setShares(list.id as string, add, remove)
      .then(() => (unpublish ? setCollectionPublic(list.slug, false) : undefined))
      .then(() => {
        listShares.reload();
        if (unpublish) { mine.reload(); cols.reload(); }
        setPicking(false);
        said(n > 0 ? { shared: n } : 'private');
      })
      .catch((e: Error) => {
        if (isNotShareable(e)) ships.reload();
        Alert.alert(
          n > 0 ? t('Could not share', 'Không chia sẻ được', '共有できませんでした', '无法分享', '無法分享') : cannotMakePrivate(),
          isNotShareable(e)
            ? t(
              'Someone you ticked is no longer in your crew, so nothing was shared. Try again without them.',
              'Có người bạn chọn không còn trong nhóm, nên chưa chia sẻ gì cả. Hãy thử lại không có họ.',
              '選んだ人の中に、もう仲間ではない人がいるため共有されませんでした。その人を外してもう一度お試しください。',
              '你勾选的人中有人已不在你的好友里，所以没有分享。请去掉对方后再试一次。', '你勾選的人中有人已不在你的好友裡，所以沒有分享。請去掉對方後再試一次。',
            )
            : e.message,
        );
      })
      .finally(() => setPublishing(false));
  };

  /* A change that landed: a success tick under the thumb, and the
     sentence to VoiceOver. Nothing drawn — the word under your handle
     has already changed, and it is the record (owner, 13 Nov 2026).

     Rejected, and removed that day: a banner above the card for three
     seconds ("Bộ sưu tập này đã riêng tư trở lại"). It said again what
     the card's word said and kept saying, and it sat in the flow, so it
     pushed the card and the grid down by its height and margin (11 +
     a 20pt line + 11, then 12: about 54pt; 51 on the owner's screenshot)
     and pulled them back up three seconds later — two moves of the whole
     page for news the reader had just made. It earned its row while it
     held the only Undo; the Undo went on 17 Oct, and the way back is the
     same word, which stays. A toast floating over the list was not the
     answer either: it would hide part of the list to report on it.

     The sentence stays for VoiceOver because a reader who cannot see the
     card's word change would otherwise hear nothing at all —
     `accessibilityLiveRegion` is Android's alone. Failures still alert:
     those are what the reader cannot see for themselves. */
  const saidText = (which: Said) => which === 'public'
    ? t('This collection is now public', 'Bộ sưu tập này giờ đã công khai', 'このコレクションは公開されました', '这个合集已公开', '這個合集已公開')
    : which === 'private'
      ? t('This collection is private again', 'Bộ sưu tập này đã riêng tư trở lại', 'このコレクションは非公開に戻りました', '这个合集已改回私密', '這個合集已改回私密')
      : t(
        `Shared with ${which.shared} ${which.shared === 1 ? 'person' : 'people'}`,
        `Đã chia sẻ với ${which.shared} người`,
        `${which.shared}人と共有しました`,
        `已与 ${which.shared} 人分享`, `已與 ${which.shared} 人分享`,
      );
  const said = (which: Said) => {
    successHaptic();
    AccessibilityInfo.announceForAccessibility(saidText(which));
  };

  const [whoSees, setWhoSees] = useState(false);

  /* The three answers, each with what it means where the reader will meet
     it. Choosing Public or Private is doing: the sheet closes and the
     word under your handle changes, so there is no confirmation here
     either (see `publish`). The answer already true carries the tick,
     and choosing it again changes nothing — a write that re-saves the
     same boolean would tick under the thumb and tell VoiceOver about a
     change that did not happen (`said`).

     Friends is not a toggle: it opens the picker in this sheet's place
     (`ShareSheet`), because choosing Friends is choosing which. It opens
     it ticked or not — the tick here says only that the list is shared
     now — and the picker's own button is the press that writes. Its
     sentence names who has the list (`namesBriefly`), since this row is
     where an owner looks to check, and says what the answer means while
     nobody has it yet.

     No Cancel row. No other sheet in the app has one: the backdrop and
     the grabber are the way out, and the backdrop is a control VoiceOver
     names "Close".

     While some places are not public yet, Public says so in place of
     its plain description: the list goes out without them, and the
     owner who shows it to a friend should not be the one surprised that
     a place is missing. Until 23 Oct 2026 the row was dimmed instead and
     the list could not go public at all — and one already public went
     private, unannounced, the moment it gained such a place. */
  const choose = (next: 'public' | 'private') => () => {
    if (next === seen) return;
    if (next === 'public') publish();
    else makePrivate();
  };
  const nameOf = (id: string) => {
    const p = people[id];
    return p?.full_name || (p?.handle ? `@${p.handle}` : t('Someone', 'Ai đó', '誰か', '某人', '某人'));
  };
  const whoSees3 = whoSeesRows(t, {
    seen,
    publicDesc: unseen.pending + unseen.flagged > 0 ? unseenSentence(unseen, t) : undefined,
    friendsDesc: sharedWith.length ? namesBriefly(sharedWith.map(nameOf), t) : undefined,
    onChoose: (v) => (v === 'friends' ? setPicking(true) : choose(v)()),
  });
  // What the form was told (`formParts`' `leaveForm`): done here, by the
  // sheet's own rows, once the list is in hand — then cleared, so coming
  // back to the page does not do it again.
  useEffect(() => {
    if (!arrived || !col) return;
    navigation.setParams({ seen: undefined });
    whoSees3.find((r) => r.key === arrived)?.onPress();
  // Once per arrival: the rows are new every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrived, !col]);

  return {
    listShares, sharedWith, seen, seenWord, people, friendIds, blocks,
    publishing, picking, setPicking, saveShares, whoSees, setWhoSees, whoSees3,
  };
}
