// Batch-scan the selected city: run the scan-city Edge Function once per
// category, sequentially, so each row shows live progress. Everything lands
// as pending, unpublished places for the normal review flow.

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useCity, useProgress, useToast } from '../App.jsx';

export default function ScanCity() {
  const toast = useToast();
  const { city } = useCity();
  const { refresh: refreshProgress } = useProgress();

  const [categories, setCategories] = useState(null);
  const [results, setResults] = useState({});   // key → {state, imported, skipped, errors}
  const [running, setRunning] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    api.scanCategories()
      .then(({ categories: cats }) => setCategories(cats))
      .catch((err) => toast(`Couldn't load scan categories: ${err.message}`));
  }, [toast]);

  const run = async () => {
    if (running || !categories || !city) return;
    setRunning(true);
    cancelled.current = false;
    setResults({});
    let totalImported = 0;
    for (const cat of categories) {
      if (cancelled.current) break;
      setResults((r) => ({ ...r, [cat.key]: { state: 'scanning' } }));
      try {
        const res = await api.scanCity(city.id, cat.key);
        totalImported += res.imported.length;
        setResults((r) => ({
          ...r,
          [cat.key]: {
            state: 'done',
            imported: res.imported,
            skipped: res.skipped_existing,
            errors: res.errors,
          },
        }));
      } catch (err) {
        setResults((r) => ({ ...r, [cat.key]: { state: 'error', message: err.message } }));
      }
    }
    setRunning(false);
    refreshProgress();
    toast(cancelled.current
      ? `Scan cancelled — ${totalImported} places imported so far`
      : `Scan finished — ${totalImported} new pending places in ${city.name_en}`);
  };

  const stateLabel = (r) => {
    if (!r) return '·';
    if (r.state === 'scanning') return 'scanning…';
    if (r.state === 'error') return `failed: ${r.message}`;
    const parts = [`${r.imported.length} imported`];
    if (r.skipped) parts.push(`${r.skipped} already known`);
    if (r.errors?.length) parts.push(`${r.errors.length} errors`);
    return parts.join(' · ');
  };

  return (
    <>
      <div className="crumbs">
        <Link to="/">← All places</Link>
        <span>/</span>
        <span className="slug">scan city</span>
      </div>

      <div className="addplace">
        <h2>Scan {city?.name_en ?? '…'}</h2>
        <p className="addsub">
          Runs one curated Google Places search per category below and imports up to
          8 new places each as
          <span className="stamp pending" style={{ margin: '0 6px' }}>pending</span>
          unpublished entries. Already-imported places are skipped, so re-scanning is safe.
        </p>

        <div style={{ display: 'flex', gap: 10, margin: '14px 0 18px' }}>
          <button className="syncbtn" onClick={run} disabled={running || !categories || !city}>
            {running ? 'Scanning…' : `Scan ${city?.name_en ?? ''}`}
          </button>
          {running && (
            <button className="syncbtn" onClick={() => { cancelled.current = true; }}>
              Cancel after this category
            </button>
          )}
        </div>

        {!categories && <div className="empty">Loading categories…</div>}
        <div className="rows">
          {categories?.map((cat) => {
            const r = results[cat.key];
            return (
              <div className="prow" key={cat.key} style={{ gridTemplateColumns: '1fr auto' }}>
                <div className="names">
                  <div className="en">
                    {cat.label_en}
                    <span className="tag" style={{ marginLeft: 8 }}>{cat.category}</span>
                  </div>
                  <div className="loc">
                    {r?.state === 'done' && r.imported.length > 0
                      ? r.imported.map((p) => p.name).join(' · ')
                      : cat.label_vi}
                  </div>
                  {r?.errors?.length > 0 && (
                    <div className="loc" style={{ color: 'var(--bad)' }}>{r.errors.join(' · ')}</div>
                  )}
                </div>
                <span className={`stamp ${r?.state === 'done' ? 'approved' : r?.state === 'error' ? 'flagged' : 'pending'}`}>
                  {stateLabel(r)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
