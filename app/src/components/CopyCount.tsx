// The copy button's state: how many people copied a list, and whether
// the reader is its owner or already has a copy (owner, 20 Nov 2026).
//
// ── why a button in the row, and a figure ──
//
// "Lưu bản sao" had two doors, a row in the list's ⋯ and the pill at the
// right of the dock, and the dock shows only once the card has scrolled
// away — so on opening a list it was a row inside a menu. The owner
// chose to put it in the row of acts beside the heart, with the number
// of people who copied the list beside it as the heart has its likes, on
// the list's page and on its card in a feed. A third door, kept on
// purpose: the two others stay.
//
// The figure is people, not copies, and never the owner's own
// (`20261120160000_collection_copy_counts.sql`). It names nobody: who
// copied is the list's activity page's, under its own rule.
//
// ── what pressing it does ──
//
// - a reader without a copy: the copy, as the ⋯ row makes it;
// - a reader who already has one: that copy, opened. A second copy of
//   the same list is never what the button means — the data had none in
//   ten (20 Nov 2026) — and the filled glyph has just said they have one;
// - the owner: who copied it, on the list's activity page. Copying your
//   own list stays in the ⋯.
//
// "Already has one" is read from the reader's own lists (`copied_from`),
// so it is true the moment the copy is saved, before the server's figure
// has been asked again; the figure is asked again then (`useCopyState`).

import { useEffect, useMemo } from 'react';
import { useSession } from '../lib/auth';
import { useCopyCountsQuery } from '../lib/data';
import { useMyLists } from '../lib/save';
import type { useI18n } from '../lib/i18n';
import type { Collection } from '../lib/types';

type I18n = ReturnType<typeof useI18n>;

/** The part of a list the button reads. */
export type CopyTarget = { id?: string | null; slug: string; owner_id?: string | null };

export type CopyState = {
  /** People other than the owner who copied it; 0 draws no figure. */
  n: number;
  /** The reader owns the list. */
  own: boolean;
  /** The reader's copy of it, when they made one. */
  copy: Collection | null;
};

/** One list's state, from the figures and the reader's own lists. */
export function copyStateOf(
  list: CopyTarget,
  me: string | null,
  counts: Readonly<Record<string, number>>,
  mine: readonly Collection[],
): CopyState {
  const own = !!me && list.owner_id === me;
  const copy = !own && list.id ? mine.find((c) => c.copied_from === list.id) ?? null : null;
  return { n: counts[list.slug] ?? 0, own, copy };
}

/** What VoiceOver says: what pressing does, then the figure. */
export function copyLabel(st: CopyState, t: I18n['t']): string {
  const what = st.own
    ? t('Who saved a copy', 'Ai đã lưu bản sao', 'コピーを保存した人', '谁保存了副本', '誰儲存了副本')
    : st.copy
      ? t('Open your copy', 'Mở bản sao của bạn', '自分のコピーを開く', '打开你的副本', '開啟你的副本')
      : t('Save a copy', 'Lưu bản sao', 'コピーを保存', '保存副本', '儲存副本');
  return st.n > 0 ? `${what}, ${st.n}` : what;
}

/**
 * A function from a list to its copy state, for a page that draws one
 * list or a feed of them. Asks the figures once, shared by every card.
 *
 * Asked again when the reader's copies change: a copy just saved is
 * theirs at once (`copy`), and the figure beside it should not still say
 * the number from before it.
 */
export function useCopyState(): (list: CopyTarget) => CopyState {
  const { session } = useSession();
  const me = session?.user?.id ?? null;
  const counts = useCopyCountsQuery();
  const mine = useMyLists();
  const bySlug = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of counts.data) out[r.slug] = r.copies;
    return out;
  }, [counts.data]);
  const copied = mine.data.filter((c) => c.copied_from).map((c) => c.copied_from).join(',');
  const { reload } = counts;
  // On mount the shared fetch is already asking, and `load` drops a
  // second ask while one is in flight.
  useEffect(() => { if (copied) reload(); }, [copied, reload]);
  return useMemo(
    () => (list: CopyTarget) => copyStateOf(list, me, bySlug, mine.data),
    [me, bySlug, mine.data],
  );
}
