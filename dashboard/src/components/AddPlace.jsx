// Add a place from the field: search Google Places by name, pick the match,
// and the fetch-place Edge Function imports it (details + photos) as a
// pending, unpublished place ready for review.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useCity, useProgress, useToast } from '../App.jsx';

export default function AddPlace() {
  const toast = useToast();
  const { refresh: refreshProgress } = useProgress();
  const { city } = useCity();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('food');
  const [candidates, setCandidates] = useState(null);
  const [busy, setBusy] = useState(false);
  // Keyed by place_id — true for a search result that's already in the
  // catalog, whether found there by the dup-check or just imported this
  // visit. Once a row lands here it renders as a stamp + link instead of
  // an Import button; importedIds only decides the link's label.
  const [existing, setExisting] = useState({});
  const [importingIds, setImportingIds] = useState(() => new Set());
  const [importedIds, setImportedIds] = useState(() => new Set());

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim() || busy) return;
    setBusy(true);
    setCandidates(null);
    setExisting({});
    setImportedIds(new Set());
    try {
      const { candidates: found } = await api.searchPlaces(query, city?.id);
      setCandidates(found);
      if (found.length) {
        // Best-effort: a failed dup-check shouldn't block the search results
        // themselves, just leave every row looking new.
        api.existingByPlaceIds(found.map((c) => c.place_id)).then(setExisting).catch(() => {});
      }
    } catch (err) {
      toast(`Search failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  // Stays on this page rather than jumping to the editor, so importing a
  // batch of search results doesn't mean re-searching after every one.
  const importPlace = async (c) => {
    if (importingIds.has(c.place_id) || existing[c.place_id]) return;
    setImportingIds((s) => new Set(s).add(c.place_id));
    try {
      const { slug, photos } = await api.importPlace(c.place_id, category, city?.id);
      refreshProgress();
      toast(`Imported ${c.name} (${photos} photos)`);
      setExisting((e) => ({ ...e, [c.place_id]: { slug, review_status: 'pending', name_en: c.name } }));
      setImportedIds((s) => new Set(s).add(c.place_id));
    } catch (err) {
      toast(`Import failed: ${err.message}`);
    } finally {
      setImportingIds((s) => {
        const next = new Set(s);
        next.delete(c.place_id);
        return next;
      });
    }
  };

  return (
    <>
      <div className="crumbs">
        <Link to="/">← All places</Link>
        <span>/</span>
        <span className="slug">add place</span>
      </div>

      <div className="addplace">
        <h2>Add a place</h2>
        <p className="addsub">
          Search Google Places for a spot in {city?.name_en ?? 'the selected city'}. Importing pulls the
          address, coordinates, rating, hours and photos into the database as a
          <span className="stamp pending" style={{ margin: '0 6px' }}>pending</span>
          unpublished place — polish and approve it in the editor.
        </p>

        <form className="addsearch" onSubmit={search}>
          <input
            autoFocus
            placeholder="e.g. The Workshop Coffee"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Place name"
          />
          <button type="submit" className="syncbtn" disabled={busy || !query.trim()}>
            {busy ? 'Searching…' : 'Search'}
          </button>
        </form>

        <div className="addcat">
          Import as:
          {[['food', 'Food & drinks'], ['out', 'Outdoors & culture']].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`chip ${category === value ? 'on' : ''}`}
              onClick={() => setCategory(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {candidates?.length === 0 && (
          <div className="empty">No matches — try adding the neighborhood or the city name.</div>
        )}
        <div className="rows">
          {candidates?.map((c) => {
            const dup = existing[c.place_id];
            const isImporting = importingIds.has(c.place_id);
            return (
              <div className="prow" key={c.place_id} style={{ gridTemplateColumns: '1fr auto' }}>
                <div className="names">
                  <div className="en">{c.name}</div>
                  <div className="loc">
                    {c.address}
                    {c.rating ? ` · ${c.rating}★ (${c.rating_count ?? 0})` : ''}
                  </div>
                </div>
                {dup ? (
                  <div className="addresult">
                    <span className={`stamp ${dup.review_status}`}>{dup.review_status}</span>
                    <Link className="syncbtn addbtn" to={`/place/${dup.slug}`}>
                      {importedIds.has(c.place_id) ? 'Imported ✓' : 'View existing'}
                    </Link>
                  </div>
                ) : (
                  <button className="syncbtn" onClick={() => importPlace(c)} disabled={isImporting}>
                    {isImporting ? 'Importing…' : 'Import'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
