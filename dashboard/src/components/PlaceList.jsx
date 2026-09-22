import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { leftBehindNote } from '../storage.js';
import { api } from '../api.js';
import { CATEGORY_KEYS, CATEGORY_LABEL, CATEGORY_STYLE } from '../categories.js';
import { VIBE_ORDER, VIBE_STYLE } from '../vibes.js';
import { THREADS_FILTERS } from '../lib/threads.js';
import { CategoryIcon } from '../icons.jsx';
import { ALL_CITIES, chipLabel, useCity, useProgress, useToast } from '../App.jsx';

const STATUSES = ['pending', 'approved', 'flagged'];
// The params the rail owns, and so the ones the badge counts, the chip row
// lists and Reset / Clear all clear. `q` is not among them: it has its own
// visible box in the toolbar, and a reader who can see their own search
// term does not need a chip telling them it is there.
const FILTER_KEYS = ['status', 'category', 'vibe', 'threads'];
const VIEW_KEY = 'citycrew.dashboard.view';
const SORTS = [
  ['created_at:desc', 'Newest collected'],
  ['created_at:asc', 'Oldest collected'],
  ['rating_count:desc', 'Most reviews'],
  ['rating_count:asc', 'Fewest reviews'],
  ['rating:desc', 'Highest rating'],
  ['rating:asc', 'Lowest rating'],
];

const fmtCount = (n) => (!n ? null : n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));

// How each filter value is spelled once it is *on* — on the chip above the
// results, away from the group that gave it its meaning. "cafes" under a
// CATEGORY heading needs no more than itself; adrift in a row of chips it
// has to carry the same word the rail used, which for vibes and Threads is
// not the stored value.
const THREADS_LABEL = Object.fromEntries(THREADS_FILTERS);
const FILTER_LABEL = {
  status: (v) => v.charAt(0).toUpperCase() + v.slice(1),
  category: (v) => CATEGORY_LABEL[v] ?? v,
  vibe: (v) => VIBE_STYLE[v]?.label ?? v.replace('_', ' '),
  threads: (v) => THREADS_LABEL[v] ?? v,
};

/* How many answers a group shows before it offers the rest.
   Six is what a 236px column holds without becoming a scroll of its own:
   the two long groups (nine categories, eleven vibes) were 20 chips of
   rail between "Status" and "Threads", so the question at the bottom was
   one nobody scrolled to. */
const GROUP_SHOWN = 6;

/** The heading, which is also the control that folds the group. A button
 *  rather than a label with a button beside it: a 10.5px word is not a
 *  target, and the whole row reads as one thing to press. */
function FilterHead({ label, open, onToggle }) {
  return (
    <button type="button" className="filterhead" aria-expanded={open} onClick={onToggle}>
      <span className="filterlabel">{label}</span>
      <span className="filterchev" aria-hidden="true"><CategoryIcon name="chevron" size={12} /></span>
    </button>
  );
}

/**
 * One question in the rail: a heading, a row per answer with the count it
 * would return, and a way past the cap when there are more answers than a
 * column should hold at rest.
 *
 * Rows rather than the wrapped chips this replaces. A chip row packs more
 * into less, and that is the problem: nine chips wrapping over three lines
 * have no column for their counts, so every count sat in brackets after
 * its label and the numbers could not be read down. A row gives the count
 * a right edge to line up on, which is the whole reason it is there — the
 * desk picks the next filter by which queue is biggest.
 *
 * Single-answer, though it wears a checkbox: `api.places` takes one value
 * per key (see the query there), so picking a second category replaces the
 * first rather than widening the search. The box is still the right mark —
 * these are on/off statements about the list, and pressing the one that is
 * on turns it off, which is exactly what a checkbox promises.
 *
 * The heading folds the group, and every group starts open: the rail's
 * job is to show what can be asked, and a panel that opens as five shut
 * headings hides that behind a click. `startOpen` is kept for a group
 * that one day earns being shut. Folding lives in the component, not the
 * URL: it says nothing about what the list contains, so it has no
 * business in a link somebody pastes to a colleague.
 */
function FilterGroup({ label, options, value, onPick, startOpen = true }) {
  const [open, setOpen] = useState(startOpen);
  const [expanded, setExpanded] = useState(false);
  const over = options.length - GROUP_SHOWN;
  // A chosen answer is never folded away: the row narrowing the list has to
  // be the row you can see and switch off, wherever it sits in the order.
  // That holds for both folds — past the cap, and the whole section.
  const chosenIsLate = options.findIndex((o) => o.value === value) >= GROUP_SHOWN;
  const full = expanded || chosenIsLate || over <= 0;
  const chosen = options.find((o) => o.value === value);
  // Shut, a group keeps the one row that is doing something and drops the
  // rest — rather than hiding the answer and leaving a heading that gives
  // no sign the list below is narrowed by it.
  const shown = open
    ? (full ? options : options.slice(0, GROUP_SHOWN))
    : (chosen ? [chosen] : []);
  return (
    <div className={`filterset${open ? '' : ' shut'}`}>
      <FilterHead label={label} open={open} onToggle={() => setOpen((v) => !v)} />
      <div className="filterlist" role="group" aria-label={label}>
        {shown.map((o) => (
          <button
            key={o.value}
            type="button"
            role="checkbox"
            aria-checked={value === o.value}
            className={`filterrow${value === o.value ? ' on' : ''}${o.cls ? ` ${o.cls}` : ''}`}
            onClick={() => onPick(o.value)}
          >
            <span className="filterbox" aria-hidden="true"><CategoryIcon name="check" size={10} /></span>
            {o.icon && <CategoryIcon name={o.icon} color={o.color} />}
            <span className="filtername">{o.label}</span>
            <span className="filtercount">{o.count ?? 0}</span>
          </button>
        ))}
      </div>
      {open && over > 0 && !chosenIsLate && (
        <button type="button" className="filtermore" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : `+ Show ${over} more`}
        </button>
      )}
    </div>
  );
}

/**
 * The city, asked with a box you can type in.
 *
 * Every other group in this rail is a fixed set — three statuses, nine
 * categories — and a row each is the right shape for those. Cities are
 * not fixed: there are nine today, the catalog is two countries wide, and
 * the answer to "which city" is one a reader usually arrives already
 * knowing. A list you scan is the wrong instrument for a question you can
 * already answer; a box you type three letters into is the right one, and
 * it costs the same two lines of rail at nine cities as at ninety.
 *
 * Still single-answer, like the rest of the rail and like `api.places`,
 * which takes one `city_id`. The chip under the box is the one that is
 * set, and clearing it means all cities rather than none — "no city" is
 * not a state this catalog has.
 *
 * The counts stay on the rows. They are why this is not a plain `select`:
 * the desk picks the next city to work by which one is biggest, and a
 * native menu has nowhere to put that number.
 */
function CityFilter({ cities, value, counts, allCount, onPick }) {
  const [open, setOpen] = useState(true);
  const [listOpen, setListOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrap = useRef(null);
  const input = useRef(null);

  // A menu that stays open after you have looked away from it is a menu
  // covering the thing you looked at. Pointerdown rather than click, so it
  // shuts on the press that starts a scroll, not on the release.
  useEffect(() => {
    if (!listOpen) return undefined;
    const away = (e) => { if (!wrap.current?.contains(e.target)) setListOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [listOpen]);

  const options = useMemo(() => [
    { value: ALL_CITIES, label: 'All cities', count: allCount },
    ...cities.map((c) => ({ value: c.id, label: chipLabel(c), count: counts?.[c.id] ?? 0 })),
  ], [cities, counts, allCount]);

  const needle = q.trim().toLowerCase();
  // Accent-insensitive, because the desk types "da nang" for Đà Nẵng far
  // more often than it reaches for the diacritics.
  const flat = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const matches = needle
    ? options.filter((o) => flat(o.label).includes(flat(needle)))
    : options;

  const chosen = options.find((o) => o.value === value);
  const pick = (v) => {
    onPick(v);
    setQ('');
    setListOpen(false);
  };

  return (
    <div className={`filterset${open ? '' : ' shut'}`}>
      <FilterHead label="City" open={open} onToggle={() => setOpen((v) => !v)} />
      {open && (
        <div className="citypick" ref={wrap}>
          <div className="citybox">
            <span className="cityboxicon" aria-hidden="true"><CategoryIcon name="search" size={12} /></span>
            <input
              ref={input}
              type="text"
              className="cityinput"
              role="combobox"
              aria-expanded={listOpen}
              aria-label="Search cities"
              placeholder="Search cities…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setListOpen(true); }}
              onFocus={() => setListOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setListOpen(false); setQ(''); }
                // One match and a reader who has finished typing: take it.
                if (e.key === 'Enter' && matches.length === 1) pick(matches[0].value);
              }}
            />
            <button
              type="button"
              className="cityboxchev"
              aria-label={listOpen ? 'Hide cities' : 'Show cities'}
              aria-expanded={listOpen}
              onClick={() => {
                setListOpen((v) => !v);
                if (!listOpen) input.current?.focus();
              }}
            >
              <CategoryIcon name="chevron" size={12} />
            </button>
          </div>

          {listOpen && (
            <div className="citymenu" role="listbox" aria-label="Cities">
              {matches.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={value === o.value}
                  className={`filterrow${value === o.value ? ' on' : ''}`}
                  onClick={() => pick(o.value)}
                >
                  <span className="filterbox" aria-hidden="true"><CategoryIcon name="check" size={10} /></span>
                  <span className="filtername">{o.label}</span>
                  <span className="filtercount">{o.count ?? 0}</span>
                </button>
              ))}
              {matches.length === 0 && <p className="citynone">No city by that name.</p>}
            </div>
          )}

          {/* What is set, when the box is not showing it. Clearing goes to
              all cities, which is this filter's off position. */}
          {chosen && value !== ALL_CITIES && (
            <div className="citychips">
              <span className="citychip">
                {chosen.label}
                <button type="button" onClick={() => pick(ALL_CITIES)} aria-label={`Clear ${chosen.label}`}>
                  <CategoryIcon name="x" size={9} />
                </button>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// What each door means, in the words a reviewer would use about it.
const CHANNEL_TITLE = {
  seed: 'From the frozen HCMC bootstrap pipeline',
  scan: 'Brought in by a Scan city run — a batch, unreviewed',
  desk: 'Searched for and imported here at the desk',
  mobile: 'Suggested from the app',
};

/**
 * Where this row came from and who put it there, under its review stamp.
 *
 * Two separate facts, and they were one column until they had to answer
 * two questions: the channel says *how* — a scan brings in twenty nobody
 * has looked at, a desk import is an editor who already chose — and the
 * handle says *who*. Neither substitutes for the other, so both are shown
 * and the handle is the quieter of the two: it is the answer to a second
 * question, asked less often.
 *
 * Beside the stamp rather than among the tags, because the tag row is the
 * first thing hidden on a phone — and provenance is most worth knowing
 * exactly when you are triaging on one.
 *
 * A row with no channel shows nothing: those predate the column and could
 * not be attributed, and an "unknown" pill would label every old row with
 * a word that means nothing. A row with a channel and no handle shows the
 * channel alone, which is the honest half — desk and scan rows created
 * before `added_by` existed have nobody recorded on them.
 */
function SourceMark({ place }) {
  if (!place.channel) return null;
  const who = place.submitter?.handle;
  return (
    <div className="srcmark">
      <span className="srcchannel" title={CHANNEL_TITLE[place.channel] ?? place.channel}>
        {place.channel}
      </span>
      {who && (
        <span className="srcwho" title={`Added by ${place.submitter.full_name ?? who}`}>
          @{who}
        </span>
      )}
    </div>
  );
}

/**
 * What a row and a card both say about a place, in one place.
 *
 * They did not agree before this. The desktop row printed every category,
 * every vibe, the photo count and the price; the grid card dropped the
 * Vietnamese name and the vibes entirely and showed category *icons*
 * instead of labels; and on a phone `.prow .facts` was `display: none`, so
 * a row said nothing at all about what the place is. One place, three
 * accounts of it, and a reader who learns the list on a laptop learns a
 * different list on their phone.
 *
 * So: one order (categories, then vibes), one vocabulary (the same labels
 * the filter rail uses), one price rule, one cap, everywhere. The cap is
 * two because that is what the narrower of the two views affords, and a
 * row that says more than a card about the same place is the problem this
 * exists to end. The rest becomes "+n", whose title lists them all.
 *
 * The two warnings are never capped away. "no category" and "no price" are
 * the reason a desk looks at this list, and a worklist that hides its own
 * work is not one.
 */
const MAX_FACTS = 2;

function tagsOf(place) {
  const out = [];
  for (const c of place.categories ?? []) {
    out.push({ key: `c:${c}`, cls: 'tag', text: CATEGORY_LABEL[c] ?? c });
  }
  for (const v of place.vibe_tags ?? []) {
    out.push({ key: `v:${v}`, cls: 'tag vibe', text: VIBE_STYLE[v]?.label ?? v.replace('_', ' ') });
  }
  return out;
}

/** The price as the desk writes it, or null when the row has none. */
function priceOf(place) {
  if (place.price_vnd === 0) return 'free';
  if (place.price_display) return place.price_display;
  if (place.price_vnd) return `${Math.round(place.price_vnd / 1000)}k₫`;
  return null;
}

function Facts({ place }) {
  const tags = tagsOf(place);
  const shown = tags.slice(0, MAX_FACTS);
  const hidden = tags.length - shown.length;
  const price = priceOf(place);
  return (
    <div className="facts">
      {!place.categories?.length && <span className="tag noprice">no category</span>}
      {shown.map((t) => <span className={t.cls} key={t.key}>{t.text}</span>)}
      {hidden > 0 && <span className="tag more" title={tags.map((t) => t.text).join(' · ')}>+{hidden}</span>}
      <span className="count">{place.photo_count} photos</span>
      {price ? <span className="count">{price}</span> : <span className="tag noprice">no price</span>}
    </div>
  );
}

export default function PlaceList() {
  const { cities, city, setCity } = useCity();

  // Every city's size, for the rail's City group. Fetched once and not on
  // a city switch: the answer does not depend on which city is picked,
  // which is the whole reason it is not read off `progress`.
  const [cityCounts, setCityCounts] = useState(null);

  /**
   * How tall the toolbar is, so the rail can stick below it.
   *
   * This measurement has been added and retired twice, and it is back
   * because the geometry is genuinely different this time. While the bar
   * sat in the results column the rail was *beside* it and had nothing of
   * it to clear; now the bar spans both columns, so a rail sticking at
   * the top bar's edge slides its first rows underneath an opaque
   * toolbar. A constant will not do — the bar is one row on a laptop and
   * two on a phone, and it changes height when a batch is selected.
   *
   * Same shape as `--topbar-h` in App.jsx: publish on mount, again on
   * resize, and clear it on the way out so no other screen inherits a
   * number that describes a bar it does not have.
   */
  const worktopRef = useRef(null);
  useEffect(() => {
    const el = worktopRef.current;
    if (!el) return undefined;
    const publish = () =>
      document.documentElement.style.setProperty('--worktop-h', `${el.offsetHeight}px`);
    publish();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      document.documentElement.style.removeProperty('--worktop-h');
    };
  }, []);
  useEffect(() => {
    let live = true;
    api.cityCounts()
      .then((c) => { if (live) setCityCounts(c); })
      // A failure leaves the counts blank and the rows still pressable —
      // the group is a control first and a measure second.
      .catch(() => { if (live) setCityCounts({}); });
    return () => { live = false; };
  }, []);
  const allCityCount = useMemo(
    () => (cityCounts ? Object.values(cityCounts).reduce((n, v) => n + v, 0) : 0),
    [cityCounts],
  );
  const { progress, refresh: refreshProgress } = useProgress();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(null);
  const [pageSize, setPageSize] = useState(24);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [q, setQ] = useState(params.get('q') ?? '');
  // Presentation only — doesn't affect what's fetched, so it lives outside
  // the URL params that drive the query (see toggle/setSort for those).
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) ?? 'row');
  useEffect(() => localStorage.setItem(VIEW_KEY, view), [view]);
  // A scan-city run brings in a dozen rows at once, and triaging them is
  // batch work in both directions: select the duds and delete them
  // together, or select the keepers and approve them together, instead
  // of opening each one to press the same button alone.
  const [selected, setSelected] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [approving, setApproving] = useState(false);
  // Phones only: the rail is a column on desktop and never closed there.
  const [filtersOpen, setFiltersOpen] = useState(false);



  const status = params.get('status') ?? '';
  const category = params.get('category') ?? '';
  const vibe = params.get('vibe') ?? '';
  const threads = params.get('threads') ?? '';
  const sort = params.get('sort') || 'created_at';
  const dir = params.get('dir') || 'desc';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const totalPages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const activeCount = FILTER_KEYS.filter((k) => params.get(k)).length;

  const clearFilters = () => {
    const next = new URLSearchParams(params);
    FILTER_KEYS.forEach((k) => next.delete(k));
    next.delete('page');
    setParams(next, { replace: true });
  };

  const toggle = (key, value) => {
    const next = new URLSearchParams(params);
    if (next.get(key) === value) next.delete(key);
    else next.set(key, value);
    next.delete('page'); // a changed filter invalidates whatever page we were on
    setParams(next, { replace: true });
  };

  const setSort = (value) => {
    const [s, d] = value.split(':');
    const next = new URLSearchParams(params);
    next.set('sort', s);
    next.set('dir', d);
    next.delete('page');
    setParams(next, { replace: true });
  };

  const gotoPage = (n) => {
    const next = new URLSearchParams(params);
    if (n <= 1) next.delete('page');
    else next.set('page', String(n));
    setParams(next, { replace: true });
    window.scrollTo({ top: 0 });
  };

  const toggleSelect = (slug) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const allOnPageSelected = rows?.length > 0 && rows.every((p) => selected.has(p.slug));
  const toggleSelectAll = () => setSelected(allOnPageSelected ? new Set() : new Set(rows.map((p) => p.slug)));

  const deleteSelected = async () => {
    const slugs = [...selected];
    if (!slugs.length || deleting) return;
    const msg = `Delete ${slugs.length} place${slugs.length === 1 ? '' : 's'} permanently?\n\n`
      + 'This removes each place, its photos (including uploads) and its collection entries from the database.';
    if (!confirm(msg)) return;
    setDeleting(true);
    try {
      const res = await api.deletePlaces(slugs);
      toast([`Deleted ${slugs.length} place${slugs.length === 1 ? '' : 's'}`, leftBehindNote(res.left)]
        .filter(Boolean).join(' — '));
      setSelected(new Set());
      refreshProgress();
      gotoPage(1);
      setRetryKey((k) => k + 1);
    } catch (err) {
      toast(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // No confirm, unlike the delete beside it: approving is reversible from
  // the editor screen and ships nothing by itself — publish is its own
  // switch. And no page reset: approval only empties rows out of a
  // status-filtered view, so the reader usually stays exactly where they
  // were. Batch *flagging* is deliberately absent — a flag deserves a
  // look at the row it stamps, and usually a note, which is the editor
  // screen's job.
  const approveSelected = async () => {
    const slugs = [...selected];
    if (!slugs.length || approving) return;
    setApproving(true);
    try {
      const { approved } = await api.approvePlaces(slugs);
      toast(approved
        ? `Approved ${approved} place${approved === 1 ? '' : 's'}`
        : 'Nothing to approve — everything selected already was');
      setSelected(new Set());
      refreshProgress();
      setRetryKey((k) => k + 1);
    } catch (err) {
      toast(`Approve failed: ${err.message}`);
    } finally {
      setApproving(false);
    }
  };

  // Escape closes the sheet, the same key that closes the tab bar's More.
  useEffect(() => {
    if (!filtersOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setFiltersOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filtersOpen]);

  // Widening past the breakpoint turns the sheet back into a column, and a
  // sheet that is no longer a sheet must not leave its backdrop behind.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 961px)');
    const sync = () => { if (mq.matches) setFiltersOpen(false); };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (q) next.set('q', q);
      else next.delete('q');
      next.delete('page');
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  // A city switch invalidates the current page the same way a filter change
  // does — only worth acting on if we actually had one set.
  useEffect(() => {
    if (!params.get('page')) return;
    const next = new URLSearchParams(params);
    next.delete('page');
    setParams(next, { replace: true });
  }, [city?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true;
    setError(null);
    // A different filter, page, sort or city means a different result set —
    // a selection made against the old one shouldn't carry over silently.
    setSelected(new Set());
    // api.places throws on non-2xx (e.g. a transient Supabase auth error);
    // never hand a non-array to the render path.
    api.places({ ...Object.fromEntries(params), city: city?.id })
      .then((result) => {
        if (!live) return;
        setRows(Array.isArray(result.rows) ? result.rows : []);
        setTotal(result.total ?? 0);
        setPageSize(result.pageSize ?? 24);
      })
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [params, retryKey, city?.id]);

  return (
    <>
      {/* Search, sort and layout, across the page.

            These act on the whole screen rather than on the results
            column alone, and the reference gives them the whole width to
            say so. What used to ride with them and no longer does is the
            row of chips naming the live filters: those describe the
            results, and starting them at the page's left edge ran them
            along the top of the panel that produced them. They are in
          `.workmain` now, above the first card.

          It is also a child of the page rather than of a wrapper, and
          that is load-bearing: a `position: sticky` element can only
          travel inside its own containing block, so a bar wrapped in a
          div of exactly its own height — or sitting in a grid row sized
          to its content, which is where this one used to be — is
          nominally sticky and factually not. It has been that for as
          long as it has been inside the split. Out here its containing
          block is `.shell` and it actually sticks.

          On phones, where it is two rows tall, it stays stuck only while
          a batch is selected — see the media query in theme.css. */}
      <div className={`worktop${selected.size > 0 ? ' pinned' : ''}`} ref={worktopRef}>
            {selected.size > 0 ? (
              <div className="resultsbar">
                <span className="resultscount">{selected.size} selected</span>
                <div className="resultscontrols">
                  <button className="syncbtn" onClick={toggleSelectAll}>
                    {allOnPageSelected ? 'Deselect all' : `Select all ${rows?.length ?? 0} on page`}
                  </button>
                  <button className="syncbtn" onClick={() => setSelected(new Set())}>Cancel</button>
                  <button className="syncbtn primary" onClick={approveSelected} disabled={approving || deleting}>
                    {approving ? 'Approving…' : `Approve ${selected.size}`}
                  </button>
                  <button className="dangerbtn" onClick={deleteSelected} disabled={deleting || approving}>
                    {deleting ? 'Deleting…' : `Delete ${selected.size}`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="resultsbar browse">
                <div className="resultscontrols">
                  <button
                    className={`filterbtn${activeCount ? ' on' : ''}`}
                    onClick={() => setFiltersOpen(true)}
                    aria-expanded={filtersOpen}
                  >
                    <CategoryIcon name="sliders" />
                    Filters
                    {activeCount > 0 && <span className="filterbadge">{activeCount}</span>}
                  </button>
                  <div className="searchbox">
                    <CategoryIcon name="search" />
                    <input
                      className="search"
                      placeholder="Search places…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      aria-label="Search places"
                    />
                  </div>
                  <select className="sortselect" value={`${sort}:${dir}`} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
                    {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  {/* Grid first, List second, as the reference draws it.
                      The words are on at every width: two abstract glyphs
                      in a pill are a guess until you press one, and the
                      bar has the room now that it spans the page. */}
                  <div className="viewtoggle" data-view={view} role="group" aria-label="Layout">
                    <span className="viewtoggle-thumb" />
                    <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-pressed={view === 'grid'}>
                      <CategoryIcon name="grid" />
                      <span>Grid</span>
                    </button>
                    <button className={view === 'row' ? 'on' : ''} onClick={() => setView('row')} aria-pressed={view === 'row'}>
                      <CategoryIcon name="list" />
                      <span>List</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
      </div>

      <div className="worksplit">
        {filtersOpen && <div className="sheetback" onClick={() => setFiltersOpen(false)} />}
        {/* One rail, two projections. A column beside the results where
            there is width for one, a sheet over them where there is not —
            same markup, same URL params, either way. The phone is the
            surface that could not afford it inline, and the phone is what
            ended up with six rows of chips standing between the reader and
            the first place. */}
        <aside className={`filterrail${filtersOpen ? ' open' : ''}`} aria-label="Filters">
          <div className="railhead">
            <span className="railtitle">Filters</span>
            {activeCount > 0 && (
              <button className="railclear" onClick={clearFilters}>Reset</button>
            )}
            <button className="railclose" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
              <CategoryIcon name="x" size={12} />
            </button>
          </div>
          <div className="filters">
            {/* First, because it is the question the others are asked
                inside: which city, then which of its places.

                Counts come from `api.cityCounts`, which is scoped by
                nothing: the box has to show every city's size while one
                of them is picked, and the other groups' counts ignore
                their siblings too. */}
            <CityFilter
              cities={cities}
              value={city?.id ?? ALL_CITIES}
              counts={cityCounts}
              allCount={allCityCount}
              onPick={(v) => setCity(v)}
            />
            <FilterGroup
              label="Status"
              value={status}
              onPick={(v) => toggle('status', v)}
              options={STATUSES.map((v) => ({
                value: v,
                label: FILTER_LABEL.status(v),
                count: progress?.by_status?.[v] ?? 0,
                cls: `st-${v}`,
              }))}
            />
            {/* Category (what a place is) and vibe (how it feels) share some
                English words — "views", "nightlife" — so each group needs its
                own labelled heading, or the two read as one confusing,
                duplicated list. Icon colour mirrors the mobile app (see
                categories.js and vibes.js) — same hue, same concept, on every
                surface. */}
            <FilterGroup
              label="Category"
              value={category}
              onPick={(v) => toggle('category', v)}
              options={CATEGORY_KEYS.map(([v, label]) => ({
                value: v,
                label,
                count: progress?.by_category_tag?.[v] ?? 0,
                icon: CATEGORY_STYLE[v]?.icon,
                color: CATEGORY_STYLE[v]?.color,
              }))}
            />
            <FilterGroup
              label="Vibe"
              value={vibe}
              onPick={(v) => toggle('vibe', v)}
              options={VIBE_ORDER.map((v) => ({
                value: v,
                label: VIBE_STYLE[v]?.label ?? v,
                count: progress?.by_vibe?.[v] ?? 0,
                icon: VIBE_STYLE[v]?.icon,
                color: VIBE_STYLE[v]?.color,
              }))}
            />
            {/* Its own group rather than a row inside one above, because it
                asks a different kind of question. Category and vibe ask what
                a place *is*; this asks whether the desk has finished looking
                it up. Handles arrive by hand — Google Places does not return
                one — so "No handle" is a worklist that only shrinks when
                somebody works it, and it starts out holding nearly every
                place. */}
            <FilterGroup
              label="Threads"
              value={threads}
              onPick={(v) => toggle('threads', v)}
              options={THREADS_FILTERS.map(([v, label]) => ({
                value: v,
                label,
                count: progress?.by_threads?.[v] ?? 0,
              }))}
            />
          </div>
        </aside>

        <div className="workmain">
          {/* What the rail is currently asking, said where the answer is.
              Over the results rather than in the toolbar: the toolbar
              spans the page now, and a row of chips starting at the
              page's left edge runs along the top of the panel that
              produced them — a description of the results drawn over
              their cause. The rail is a column on a laptop and a shut
              sheet on a phone, and either way a filter you cannot see is
              a filter you forget you set, which is how "no places match"
              arrives without a visible reason. Each chip removes its own
              filter; the row is absent when nothing is set. */}
          {selected.size === 0 && (activeCount > 0 || (q && total != null)) && (
            <div className="resultlead">
              {/* Only when it is telling you something the head is not.
                  With no filter and no search this is the same number as
                  "places" in the page head, larger and an inch up —
                  printing it twice says nothing the second time. */}
              {total != null && (
                <span className="resulttally">{total} place{total === 1 ? '' : 's'}</span>
              )}
              {activeCount > 0 && (
                <div className="activefilters">
                  {FILTER_KEYS.map((key) => {
                    const value = params.get(key);
                    if (!value) return null;
                    const label = FILTER_LABEL[key](value);
                    return (
                      <button
                        key={key}
                        className={`fchip${key === 'status' ? ` st-${value}` : ''}`}
                        onClick={() => toggle(key, value)}
                        aria-label={`Remove filter ${label}`}
                        title={`Remove filter ${label}`}
                      >
                        {label}
                        <CategoryIcon name="x" size={10} />
                      </button>
                    );
                  })}
                  <button className="clearall" onClick={clearFilters}>Clear all</button>
                </div>
              )}
            </div>
          )}
          {error && (
            <div className="empty">
              Couldn't load places: {error}
              <div style={{ marginTop: 12 }}>
                <button className="syncbtn" onClick={() => setRetryKey((k) => k + 1)}>Retry</button>
              </div>
            </div>
          )}
          {!error && !rows && <div className="empty">Loading places…</div>}
          {!error && rows?.length === 0 && <div className="empty">No places match these filters — clear one and try again.</div>}

          {view === 'grid' ? (
            <div className="grid">
              {rows?.map((p) => (
                <Link className="gcard" to={`/place/${p.slug}?${params}`} key={p.slug}>
                  <div className="gcard-media">
                    {p.cover_url
                      ? <img src={p.cover_url} alt="" loading="lazy" />
                      : null}
                    <span
                      className="selecthit"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(p.slug); }}
                    >
                      <input
                        type="checkbox"
                        className={`selectbox ${selected.has(p.slug) ? 'checked' : ''}`}
                        checked={selected.has(p.slug)}
                        readOnly
                        aria-label={`Select ${p.name_en}`}
                      />
                    </span>
                    <span className={`stamp ${p.review_status}`}>{p.review_status}</span>
                  </div>
                  <div className="gcard-body">
                    <div className="gcard-name">
                      {p.name_en} {p.is_featured && <span className="tag featured">featured</span>}
                    </div>
                    <div className="gcard-meta">
                      {p.neighborhood_en} · {p.rating ?? '—'}★
                      {p.rating_count ? ` · ${fmtCount(p.rating_count)}` : ''}
                    </div>
                    <div className="gcard-tags">
                      <SourceMark place={p} />
                      <Facts place={p} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rows">
              {rows?.map((p) => (
                <Link className="prow" to={`/place/${p.slug}?${params}`} key={p.slug}>
                  <div className="thumbwrap">
                    {p.cover_url
                      ? <img className="thumb" src={p.cover_url} alt="" loading="lazy" />
                      : <div className="thumb" />}
                    <span
                      className="selecthit"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(p.slug); }}
                    >
                      <input
                        type="checkbox"
                        className={`selectbox ${selected.has(p.slug) ? 'checked' : ''}`}
                        checked={selected.has(p.slug)}
                        readOnly
                        aria-label={`Select ${p.name_en}`}
                      />
                    </span>
                  </div>
                  <div className="names">
                    <div className="en">{p.name_en} {p.is_featured && <span className="tag featured">featured</span>}</div>
                    <div className="vi">{p.name_vi}</div>
                    <div className="loc">
                      {p.neighborhood_en} · {p.rating ?? '—'}★
                      {p.rating_count ? ` · ${fmtCount(p.rating_count)} Google reviews` : ' · no reviews'}
                    </div>
                  </div>
                  <Facts place={p} />
                  <div className="stampcol">
                    <span className={`stamp ${p.review_status}`}>{p.review_status}</span>
                    <SourceMark place={p} />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="pagination">
              <button className="pagebtn" onClick={() => gotoPage(page - 1)} disabled={page <= 1} aria-label="Previous page">←</button>
              <span>Page {page} of {totalPages}</span>
              <button className="pagebtn" onClick={() => gotoPage(page + 1)} disabled={page >= totalPages} aria-label="Next page">→</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
