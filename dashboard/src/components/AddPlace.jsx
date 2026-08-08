// Add a place from the field: search Google Places by name, pick the match,
// and the fetch-place Edge Function imports it (details + photos) as a
// pending, unpublished place ready for review.

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useCity, useProgress, useToast } from '../App.jsx';

export default function AddPlace() {
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh: refreshProgress } = useProgress();
  const { city } = useCity();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('food');
  const [candidates, setCandidates] = useState(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(null);

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim() || busy) return;
    setBusy(true);
    setCandidates(null);
    try {
      const { candidates: found } = await api.searchPlaces(query, city?.id);
      setCandidates(found);
    } catch (err) {
      toast(`Search failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const importPlace = async (c) => {
    if (importing) return;
    setImporting(c.place_id);
    try {
      const { slug, photos } = await api.importPlace(c.place_id, category, city?.id);
      refreshProgress();
      toast(`Imported ${c.name} (${photos} photos) — review it now`);
      navigate(`/place/${slug}`);
    } catch (err) {
      toast(`Import failed: ${err.message}`);
      setImporting(null);
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
          {candidates?.map((c) => (
            <div className="prow" key={c.place_id} style={{ gridTemplateColumns: '1fr auto' }}>
              <div className="names">
                <div className="en">{c.name}</div>
                <div className="loc">
                  {c.address}
                  {c.rating ? ` · ${c.rating}★ (${c.rating_count ?? 0})` : ''}
                </div>
              </div>
              <button
                className="syncbtn"
                onClick={() => importPlace(c)}
                disabled={!!importing}
              >
                {importing === c.place_id ? 'Importing…' : 'Import'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
