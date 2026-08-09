import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { CATEGORY_KEYS, CATEGORY_LABEL, CATEGORY_STYLE } from '../categories.js';
import { VIBE_ORDER, VIBE_STYLE } from '../vibes.js';
import { CategoryIcon } from '../icons.jsx';
import { useCity, useProgress } from '../App.jsx';

const STATUSES = ['pending', 'approved', 'flagged'];
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

export default function PlaceList() {
  const { city } = useCity();
  const { progress } = useProgress();
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

  const status = params.get('status') ?? '';
  const category = params.get('category') ?? '';
  const vibe = params.get('vibe') ?? '';
  const sort = params.get('sort') || 'created_at';
  const dir = params.get('dir') || 'desc';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const totalPages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;

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
      <div className="filters">
        <input
          className="search"
          placeholder="Search places…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search places"
        />
        <div className="filtergroup">
          <span className="filterlabel">Status</span>
          {STATUSES.map((s) => (
            <button key={s} className={`chip st-${s} ${status === s ? 'on' : ''}`} onClick={() => toggle('status', s)}>
              {s}
              <span className="chipcount">({progress?.by_status?.[s] ?? 0})</span>
            </button>
          ))}
        </div>
        {/* Category (what a place is) and vibe (how it feels) share some
            English words — "views", "nightlife" — so each group needs its
            own labelled row, or the two read as one confusing, duplicated
            chip list. Icon colour mirrors the mobile app (see categories.js
            and vibes.js) — same hue, same concept, on every surface. */}
        <div className="filtergroup">
          <span className="filterlabel">Category</span>
          {CATEGORY_KEYS.map(([value, label]) => (
            <button key={value} className={`chip ${category === value ? 'on' : ''}`} onClick={() => toggle('category', value)}>
              <CategoryIcon name={CATEGORY_STYLE[value]?.icon} color={CATEGORY_STYLE[value]?.color} />
              {label}
              <span className="chipcount">({progress?.by_category_tag?.[value] ?? 0})</span>
            </button>
          ))}
        </div>
        <div className="filtergroup">
          <span className="filterlabel">Vibe</span>
          {VIBE_ORDER.map((v) => (
            <button key={v} className={`chip ${vibe === v ? 'on' : ''}`} onClick={() => toggle('vibe', v)}>
              <CategoryIcon name={VIBE_STYLE[v]?.icon} color={VIBE_STYLE[v]?.color} />
              {VIBE_STYLE[v]?.label}
              <span className="chipcount">({progress?.by_vibe?.[v] ?? 0})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="resultsbar">
        <span className="resultscount">{total != null ? `${total} place${total === 1 ? '' : 's'}` : ''}</span>
        <div className="resultscontrols">
          <select className="sortselect" value={`${sort}:${dir}`} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
            {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <div className="viewtoggle" role="group" aria-label="Layout">
            <button className={view === 'row' ? 'on' : ''} onClick={() => setView('row')} aria-pressed={view === 'row'} aria-label="Row view">
              <CategoryIcon name="list" />
            </button>
            <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-pressed={view === 'grid'} aria-label="Grid view">
              <CategoryIcon name="grid" />
            </button>
          </div>
        </div>
      </div>

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
                  {p.categories?.length
                    ? p.categories.map((c) => (
                      <CategoryIcon key={c} name={CATEGORY_STYLE[c]?.icon} color={CATEGORY_STYLE[c]?.color} />
                    ))
                    : <span className="tag noprice">no category</span>}
                  <span className="count">{p.photo_count} photos</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rows">
          {rows?.map((p) => (
            <Link className="prow" to={`/place/${p.slug}?${params}`} key={p.slug}>
              {p.cover_url
                ? <img className="thumb" src={p.cover_url} alt="" loading="lazy" />
                : <div className="thumb" />}
              <div className="names">
                <div className="en">{p.name_en} {p.is_featured && <span className="tag featured">featured</span>}</div>
                <div className="vi">{p.name_vi}</div>
                <div className="loc">
                  {p.neighborhood_en} · {p.rating ?? '—'}★
                  {p.rating_count ? ` · ${fmtCount(p.rating_count)} Google reviews` : ' · no reviews'}
                </div>
              </div>
              <div className="facts">
                {p.categories?.length
                  ? p.categories.map((c) => (
                    <span className="tag" key={c}>{CATEGORY_LABEL[c] ?? c}</span>
                  ))
                  : <span className="tag noprice">no category</span>}
                {p.vibe_tags.map((v) => <span className="tag vibe" key={v}>{v.replace('_', ' ')}</span>)}
                <span className="count">{p.photo_count} photos</span>
                {p.price_vnd === 0
                  ? <span className="tag">free</span>
                  : p.price_display || p.price_vnd
                    ? <span className="count">{p.price_display ?? `${Math.round(p.price_vnd / 1000)}k₫`}</span>
                    : <span className="tag noprice">no price</span>}
              </div>
              <span className={`stamp ${p.review_status}`}>{p.review_status}</span>
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
    </>
  );
}
