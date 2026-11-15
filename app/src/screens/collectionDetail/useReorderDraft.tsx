import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';
import { reorderCollection, type Collection } from '../../lib/data';
import type { useI18n } from '../../lib/i18n';
import { applyDraft, moveItem, sameOrder } from '../../lib/order';
import type { Place } from '../../lib/types';

/**
 * How long after the last move the order is written.
 *
 * Long enough that a run of moves — three cards dropped one after another
 * — is one write rather than one per drop; short enough that the write
 * lands before the reader has looked up. Not measured: a chosen beat. Leaving the screen writes at once, so the value can only decide
 * how many writes there are, never whether one is lost.
 */
const SAVE_AFTER_MS = 600;

/**
 * Putting the list in order.
 *
 * On the list itself, by holding a card (see `DraggableCard`). The old
 * worry about controls on the cards, that tapping a place would be a
 * thumb-width from moving it, does not apply to a hold: a tap still
 * only ever opens the place.
 *
 * ── saved as it goes ──
 *
 * There is no Done. Every move is the reader's decision already, and a
 * button to confirm it was a second decision about the first, one the
 * back arrow skipped and so threw the order away without a word. So each
 * move is written on its own, a beat after the last drop (`SAVE_AFTER_MS`)
 * so that three drops are one write rather than three. Leaving the
 * screen writes whatever is waiting at once.
 *
 * Nothing on screen says it worked: the order on screen is the result,
 * and a failure puts the old order back and says so in an alert. The
 * header used to carry "Saving…" then "Saved" beside the ⋯, and every
 * drag shifted the title across to make room for it — a report on
 * something the reader could already see, paid for by the one line that
 * says which list this is (owner, 16 Oct 2026). VoiceOver, which cannot
 * see the card land, is told instead.
 *
 * `draft` is the order on screen, as slugs — never places, because the
 * catalog can reload underneath this screen and slugs are what the write
 * takes anyway. It stays until the server's order has caught up with
 * it, so the list does not flick back to the old order for the
 * moment between the write landing and the reload.
 *
 * One write in flight at a time, always the latest order: a move made
 * while a write is out is picked up when it returns. The whole sequence
 * goes in one statement (`reorder_collection`), so a failure leaves the
 * server's order as it was — and the screen goes back to it, and says so.
 *
 * What the screen reads back: `drafted`, the places in the order on
 * screen, and `shuffle`, the one move there is.
 */
export function useReorderDraft({ col, members, mine, cols, t }: {
  col: Pick<Collection, 'slug'> | null | undefined;
  members: Place[];
  /** The two catalogs the order is read from — see the reloads in `flush`. */
  mine: { reload: () => void };
  cols: { reload: () => void };
  t: ReturnType<typeof useI18n>['t'];
}) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'waiting' | 'saving' | 'saved'>('idle');
  const wanted = useRef<string[] | null>(null);
  const writing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drafted = useMemo(() => applyDraft(members, draft), [members, draft]);
  // The draft steps aside once the server agrees with it and nothing is
  // left to write. Adjusted during render, React's pattern for state that
  // follows props — see `usePersistedFetch`.
  if (draft && (saveState === 'idle' || saveState === 'saved')
    && sameOrder(drafted.map((p) => p.slug), members.map((p) => p.slug))) {
    setDraft(null);
  }

  const flush = async () => {
    if (!col || writing.current || !wanted.current) return;
    writing.current = true;
    setSaveState('saving');
    try {
      while (wanted.current) {
        const order = wanted.current;
        wanted.current = null;
        await reorderCollection(col.slug, order);
      }
      setSaveState('saved');
      AccessibilityInfo.announceForAccessibility(
        t('Order saved', 'Đã lưu thứ tự', '並び順を保存しました', '顺序已保存', '順序已儲存'),
      );
      // Both catalogs: the row is in `mine` and, once published, in the
      // public list too, and the order is read from whichever copy the
      // screen that draws it happens to hold.
      mine.reload();
      cols.reload();
    } catch (e) {
      wanted.current = null;
      setDraft(null);
      setSaveState('idle');
      Alert.alert(
        t('Could not save the order', 'Không lưu được thứ tự', '並び順を保存できませんでした', '无法保存顺序', '無法儲存順序'),
        (e as Error).message,
      );
    } finally {
      writing.current = false;
    }
  };
  // The latest `flush`, for the one caller that outlives a render: the
  // unmount below, which must write a move made a moment before leaving.
  const flushRef = useRef(flush);
  useEffect(() => { flushRef.current = flush; });
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); void flushRef.current(); }
  }, []);

  const shuffle = (from: number, to: number) => {
    const next = moveItem(drafted.map((p) => p.slug), from, to);
    setDraft(next);
    wanted.current = next;
    setSaveState('waiting');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void flush(); }, SAVE_AFTER_MS);
  };

  return { drafted, shuffle };
}
