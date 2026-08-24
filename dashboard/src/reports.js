// The arithmetic behind the Reports queue, kept away from React so it can
// be read — and tested — as plain functions over plain rows.
//
// A row here is what `reports_queue()` returns: the report itself plus
// whatever the reported thing currently says. Everything the screen shows
// beyond that text — the order, the age, whether the desk is late — is a
// fold over those rows, computed here.
//
// ── the clock is the feature ──
//
// The App Store's rule about user content is not "have a report button".
// It is that reported content gets acted on **within a day**. A queue
// that does not say how old its oldest item is cannot keep that promise,
// so the age and its verdict are first-class here rather than a detail
// of the markup.

/** What each stored reason is called on the page. The keys are the four
 *  the table's CHECK allows; see the reports migration. */
export const REASON_LABEL = {
  spam: 'Spam or advertising',
  offensive: 'Offensive or hateful',
  impersonation: 'Impersonation',
  other: 'Something else',
};

/** The window the store expects, in hours. Not a setting: it is the
 *  number the guideline names, and the page exists to keep it. */
export const SLA_HOURS = 24;

/** Half of it, where a report stops being fresh and starts being work
 *  for today rather than work for tomorrow. */
export const DUE_HOURS = 12;

export function hoursSince(iso, now = new Date()) {
  const then = Date.parse(iso);
  if (!isFinite(then)) return null;
  return Math.max(0, (now.getTime() - then) / 3600000);
}

/**
 * How a waiting report should read: fresh, due, or late.
 *
 * Only unhandled reports have a state — once the desk has answered one,
 * how long it took is history, and colouring an answered row red would
 * be the page nagging about work already done.
 */
export function slaState(row, now = new Date()) {
  if (row.status !== 'new') return 'done';
  const h = hoursSince(row.created_at, now);
  if (h === null) return 'fresh';
  if (h >= SLA_HOURS) return 'overdue';
  if (h >= DUE_HOURS) return 'due';
  return 'fresh';
}

/** Age as the desk says it out loud: minutes under an hour, then hours,
 *  then days. Short by design — it sits in a badge, not a sentence. */
export function ageLabel(iso, now = new Date()) {
  const h = hoursSince(iso, now);
  if (h === null) return '';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

/** How many are still waiting — the number the sidebar wears. */
export function newCount(rows) {
  return (rows ?? []).filter((r) => r.status === 'new').length;
}

/**
 * Queue order: unanswered first, oldest of those first.
 *
 * Oldest-first inside the new pile, which is the opposite of most feeds
 * and the right way round for work: the report closest to breaking the
 * day is the one that should be read next. Answered rows keep
 * newest-first, because there the question is "what did we just do".
 */
export function sortQueue(rows) {
  const news = (rows ?? []).filter((r) => r.status === 'new')
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const done = (rows ?? []).filter((r) => r.status !== 'new')
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return [...news, ...done];
}

/**
 * The words the desk is judging, trimmed to what a row can show.
 *
 * A reported profile's whole case is often its bio, and a reported list's
 * is its title and description — so both come through, joined, rather
 * than the page showing an id and asking the reader to go and look.
 */
export function previewOf(row, max = 180) {
  const parts = [row.title, row.body].map((x) => (x ?? '').trim()).filter(Boolean);
  const text = parts.join(' — ');
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
