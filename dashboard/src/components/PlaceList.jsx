import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const STATUSES = ['pending', 'approved', 'flagged'];
const CATEGORIES = [['food', 'Food & drinks'], ['out', 'Outdoors & culture']];
const VIBES = ['cafes', 'food_tour', 'outdoors', 'views', 'culture', 'shopping', 'nightlife', 'chill'];

export default function PlaceList() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState(null);
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
    fetch(`/api/places?${params}`).then((r) => r.json()).then((data) => live && setRows(data));
    return () => { live = false; };
  }, [params]);

  return (
    <>
      <div className="filters">
        {STATUSES.map((s) => (
          <button key={s} className={`chip st-${s} ${status === s ? 'on' : ''}`} onClick={() => toggle('status', s)}>
            {s}
          </button>
        ))}
        <span style={{ width: 8 }} />
        {CATEGORIES.map(([value, label]) => (
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

      {!rows && <div className="empty">Loading places…</div>}
      {rows?.length === 0 && <div className="empty">No places match these filters — clear one and try again.</div>}

      <div className="rows">
        {rows?.map((p) => (
          <Link className="prow" to={`/place/${p.slug}?${params}`} key={p.slug}>
            {p.cover_url
              ? <img className="thumb" src={p.cover_url} alt="" loading="lazy" />
              : <div className="thumb" />}
            <div className="names">
              <div className="en">{p.name_en} {p.is_featured && <span className="tag featured">featured</span>}</div>
              <div className="vi">{p.name_vi}</div>
              <div className="loc">{p.neighborhood_en} · {p.rating ?? '—'}★</div>
            </div>
            <div className="facts">
              {p.vibe_tags.map((v) => <span className="tag" key={v}>{v.replace('_', ' ')}</span>)}
              <span className="count">{p.photo_count} photos</span>
            </div>
            <span className={`stamp ${p.review_status}`}>{p.review_status}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
