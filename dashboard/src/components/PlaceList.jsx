import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { CATEGORY_KEYS, CATEGORY_LABEL } from '../categories.js';
import { useCity } from '../App.jsx';

const STATUSES = ['pending', 'approved', 'flagged'];
const VIBES = ['cafes', 'food_tour', 'outdoors', 'views', 'culture', 'shopping', 'nightlife', 'chill'];

const fmtCount = (n) => (!n ? null : n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));

export default function PlaceList() {
  const { city } = useCity();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [q, setQ] = useState(params.get('q') ?? '');

  const status = params.get('status') ?? '';
  const category = params.get('category') ?? '';
  const vibe = params.get('vibe') ?? '';

  const toggle = (key, value) => {
    const next = new URLSearchParams(params);
    if (next.get(key) === value) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (q) next.set('q', q);
      else next.delete('q');
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true;
    setError(null);
    // api.places throws on non-2xx (e.g. a transient Supabase auth error);
    // never hand a non-array to the render path.
    api.places({ ...Object.fromEntries(params), city: city?.id })
      .then((data) => live && setRows(Array.isArray(data) ? data : []))
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [params, retryKey, city?.id]);

  return (
    <>
      <div className="filters">
        {STATUSES.map((s) => (
          <button key={s} className={`chip st-${s} ${status === s ? 'on' : ''}`} onClick={() => toggle('status', s)}>
            {s}
          </button>
        ))}
        <span style={{ width: 8 }} />
        {CATEGORY_KEYS.map(([value, label]) => (
          <button key={value} className={`chip ${category === value ? 'on' : ''}`} onClick={() => toggle('category', value)}>
            {label}
          </button>
        ))}
        <span style={{ width: 8 }} />
        {VIBES.map((v) => (
          <button key={v} className={`chip ${vibe === v ? 'on' : ''}`} onClick={() => toggle('vibe', v)}>
            {v.replace('_', ' ')}
          </button>
        ))}
        <input
          className="search"
          placeholder="Search places…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search places"
        />
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
    </>
  );
}
