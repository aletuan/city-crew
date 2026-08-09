import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { CATEGORY_KEYS } from '../categories.js';
import { useCity, useProgress, useToast } from '../App.jsx';
import PhotoManager, { emptyPhotoEdits, photoEditsDirty } from './PhotoManager.jsx';

const VIBES = ['cafes', 'food_tour', 'outdoors', 'views', 'culture', 'shopping', 'nightlife', 'chill'];
const FORM_FIELDS = [
  'name_en', 'name_vi', 'desc_en', 'desc_vi', 'neighborhood_en', 'neighborhood_vi',
  'address', 'category', 'categories', 'is_featured', 'vibe_tags', 'emoji',
  'price_display', 'price_vnd', 'duration_min', 'duration_max',
  'website', 'phone', 'saved_count', 'is_published', 'review_note',
];

const pickForm = (place) => Object.fromEntries(FORM_FIELDS.map((k) => [k, place[k]]));

function BilingualField({ label, nameEn, nameVi, form, set, textarea }) {
  const Input = textarea ? 'textarea' : 'input';
  return (
    <div className="pair">
      {[[nameEn, 'EN'], [nameVi, 'VI']].map(([name, lang]) => (
        <div className="field" key={name}>
          <label htmlFor={name}>{label}<span className="lang">{lang}</span></label>
          <Input id={name} value={form[name] ?? ''} onChange={(e) => set(name, e.target.value)} />
        </div>
      ))}
    </div>
  );
}

export default function PlaceEditor() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh: refreshProgress } = useProgress();
  const { city } = useCity();

  const [place, setPlace] = useState(null);
  const [form, setForm] = useState(null);
  const [photoEdits, setPhotoEdits] = useState(emptyPhotoEdits);
  const [siblings, setSiblings] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const p = await api.place(slug);
    setPlace(p);
    setForm((prev) => prev ?? pickForm(p));
    return p;
  }, [slug]);

  useEffect(() => {
    setPlace(null);
    setForm(null);
    setPhotoEdits(emptyPhotoEdits());
    load().catch((err) => toast(err.message));
  }, [load, toast]);

  // Ordered slugs under the current filters, for prev/next
  useEffect(() => {
    const listParams = new URLSearchParams(params);
    listParams.delete('q');
    api.places({ ...Object.fromEntries(listParams), city: city?.id })
      .then((rows) => setSiblings(Array.isArray(rows) ? rows.map((r) => r.slug) : []))
      .catch(() => setSiblings([]));
  }, [params, city?.id]);

  // Text and photo edits share one dirty state: both light up Save, both are
  // applied together, both are discarded together.
  const dirty = useMemo(
    () => !!(place && form
      && (JSON.stringify(pickForm(place)) !== JSON.stringify(form) || photoEditsDirty(photoEdits))),
    [place, form, photoEdits],
  );

  useEffect(() => {
    const onBeforeUnload = (e) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setNum = (key, value) => set(key, value === '' ? null : Number(value));

  const save = useCallback(async (extra = {}) => {
    if (saving) return;
    setSaving(true);
    try {
      await api.savePlace(slug, { ...form, ...extra });

      // Apply staged photo edits in one batch, same Save as the text.
      const e = photoEdits;
      const tempToReal = {};
      for (const u of e.uploads) {
        const row = await api.uploadPhoto(slug, u.blob, u.name);
        tempToReal[u.tempId] = row.id;
        URL.revokeObjectURL(u.previewUrl);
      }
      for (const id of e.deleted) await api.deletePhoto(id);
      for (const [id, hidden] of Object.entries(e.hidden)) {
        if (e.deleted.includes(id)) continue;
        const saved = place.place_photos.find((p) => p.id === id);
        if (saved && saved.is_hidden !== hidden) await api.patchPhoto(id, { is_hidden: hidden });
      }
      if (e.coverId) {
        const realId = tempToReal[e.coverId] ?? e.coverId;
        await api.patchPhoto(realId, { is_cover: true });
      }
      if (e.order) {
        const ids = e.order.map((id) => tempToReal[id] ?? id).filter((id) => !e.deleted.includes(id));
        await api.reorderPhotos(slug, ids);
      }

      // Refresh the baseline in place — never unmount the editor (a null form
      // would flash the loading screen and remount every photo, which reads
      // as a full page reload).
      const fresh = await api.place(slug);
      setPhotoEdits(emptyPhotoEdits());
      setPlace(fresh);
      setForm(pickForm(fresh));
      refreshProgress();
      toast(extra.review_status ? `Marked ${extra.review_status}` : 'Saved');
    } catch (err) {
      toast(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [saving, slug, form, photoEdits, place, refreshProgress, toast]);

  const idx = siblings.indexOf(slug);
  const go = useCallback((delta) => {
    const next = siblings[idx + delta];
    if (!next) return;
    if (dirty) {
      if (!confirm('Discard unsaved changes (text and photo edits)?')) return;
      photoEdits.uploads.forEach((u) => URL.revokeObjectURL(u.previewUrl));
    }
    navigate(`/place/${next}?${params}`);
  }, [siblings, idx, dirty, photoEdits, navigate, params]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches('input, textarea, select') || e.metaKey || e.ctrlKey) {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
        return;
      }
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'a') save({ review_status: 'approved' });
      if (e.key === 'f') save({ review_status: 'flagged' });
      if (e.key === 's') save();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, save]);

  if (!place || !form) return <div className="empty">Loading {slug}…</div>;

  const hours = Array.isArray(place.opening_hours) ? place.opening_hours.join('\n') : null;

  return (
    <>
      <div className="crumbs">
        <Link to={`/?${params}`}>← All places</Link>
        <span>/</span>
        <span className="slug">{place.slug}</span>
        <span className={`stamp ${place.review_status}`} style={{ marginLeft: 8 }}>{place.review_status}</span>
      </div>

      <div className="editor">
        <PhotoManager place={place} edits={photoEdits} setEdits={setPhotoEdits} />

        <div className="facts-col">
          <section className="panel">
            <h3>Identity</h3>
            <BilingualField label="Name" nameEn="name_en" nameVi="name_vi" form={form} set={set} />
            <BilingualField label="Blurb" nameEn="desc_en" nameVi="desc_vi" form={form} set={set} textarea />
            <BilingualField label="Neighborhood" nameEn="neighborhood_en" nameVi="neighborhood_vi" form={form} set={set} />
            <div className="inline-fields">
              <div className="field" style={{ flex: 3 }}>
                <label htmlFor="address">Address</label>
                <input id="address" className="mono" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
              </div>
              <div className="field" style={{ flex: 0, minWidth: 74 }}>
                <label htmlFor="emoji">Emoji</label>
                <input id="emoji" value={form.emoji ?? ''} onChange={(e) => set('emoji', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="panel">
            <h3>Categories &amp; placement</h3>
            {/* What the place is — many per place, and what the Explore
                filter chips are built from. At least one is required. */}
            <div className="vibes" style={{ marginBottom: 6 }}>
              {CATEGORY_KEYS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`vibe ${form.categories?.includes(key) ? 'on' : ''}`}
                  onClick={() => set('categories', form.categories?.includes(key)
                    ? form.categories.filter((c) => c !== key)
                    : [...(form.categories ?? []), key])}
                >
                  {label}
                </button>
              ))}
            </div>
            {!form.categories?.length && (
              <p className="hint" style={{ marginBottom: 14 }}>
                Pick at least one category — a place with none can't be reached from any Explore chip.
              </p>
            )}
            <h4 style={{ margin: '18px 0 8px' }}>Vibes</h4>
            <div className="vibes" style={{ marginBottom: 14 }}>
              {VIBES.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`vibe ${form.vibe_tags?.includes(v) ? 'on' : ''}`}
                  onClick={() => set('vibe_tags', form.vibe_tags?.includes(v)
                    ? form.vibe_tags.filter((t) => t !== v)
                    : [...(form.vibe_tags ?? []), v])}
                >
                  {v.replace('_', ' ')}
                </button>
              ))}
            </div>
            {/* The legacy food/out column is still written by the import
                pipeline but no longer drives anything the app shows, so it
                is not editable here. */}
            <div className="inline-fields">
              <label className="checkline" style={{ alignSelf: 'end', paddingBottom: 9 }}>
                <input type="checkbox" checked={!!form.is_featured} onChange={(e) => set('is_featured', e.target.checked)} />
                Featured (“For you” tab)
              </label>
              <label className="checkline" style={{ alignSelf: 'end', paddingBottom: 9 }}>
                <input type="checkbox" checked={!!form.is_published} onChange={(e) => set('is_published', e.target.checked)} />
                Published
              </label>
            </div>
          </section>

          <section className="panel">
            <h3>Facts</h3>
            <div className="inline-fields">
              <div className="field">
                <label htmlFor="price_display">Price shown</label>
                <input id="price_display" className="mono" value={form.price_display ?? ''} onChange={(e) => set('price_display', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="price_vnd">Price ₫</label>
                <input id="price_vnd" className="mono" type="number" value={form.price_vnd ?? ''} onChange={(e) => setNum('price_vnd', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="duration_min">Min (phút)</label>
                <input id="duration_min" className="mono" type="number" value={form.duration_min ?? ''} onChange={(e) => setNum('duration_min', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="duration_max">Max (phút)</label>
                <input id="duration_max" className="mono" type="number" value={form.duration_max ?? ''} onChange={(e) => setNum('duration_max', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="saved_count">Saved count</label>
                <input id="saved_count" className="mono" type="number" value={form.saved_count ?? 0} onChange={(e) => setNum('saved_count', e.target.value)} />
              </div>
            </div>
            <div className="inline-fields" style={{ marginTop: 12 }}>
              <div className="field" style={{ flex: 2 }}>
                <label htmlFor="website">Website</label>
                <input id="website" className="mono" value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input id="phone" className="mono" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
              </div>
            </div>
            {hours && (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                  Opening hours (from Google)
                </summary>
                <div className="hoursline">{hours}</div>
              </details>
            )}
          </section>

          <section className="panel">
            <h3>Fact-check</h3>
            <iframe
              className="mapframe"
              title="Map location"
              loading="lazy"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${place.lng - 0.004}%2C${place.lat - 0.003}%2C${place.lng + 0.004}%2C${place.lat + 0.003}&layer=mapnik&marker=${place.lat}%2C${place.lng}`}
            />
            <div className="coordline">{place.lat?.toFixed(6)}, {place.lng?.toFixed(6)} · ★ {place.rating ?? '—'} ({place.rating_count ?? 0} reviews)</div>
            <div className="factlinks">
              <a href={`https://www.google.com/maps/place/?q=place_id:${place.google_place_id}`} target="_blank" rel="noreferrer">
                Open in Google Maps ↗
              </a>
              {place.website && <a href={place.website} target="_blank" rel="noreferrer">Website ↗</a>}
            </div>
          </section>

          <div className="dangerrow">
            <span>Don't want this place in the app at all?</span>
            <button
              className="dangerbtn"
              onClick={async () => {
                if (!confirm(`Delete “${place.name_en}” permanently?\n\nThis removes the place, all its photos (including your uploads) and its collection entries from the database.`)) return;
                try {
                  await api.deletePlace(place.slug);
                  refreshProgress();
                  toast(`Deleted ${place.name_en}`);
                  navigate(`/?${params}`);
                } catch (err) {
                  toast(`Delete failed: ${err.message}`);
                }
              }}
            >
              Delete place
            </button>
          </div>

          <div style={{ height: 46 }} />
        </div>
      </div>

      <div className="reviewbar">
        <button className="navbtn" onClick={() => go(-1)} disabled={idx <= 0} aria-label="Previous place">←</button>
        <span className="pos">{idx + 1} / {siblings.length}</span>
        <button className="navbtn" onClick={() => go(1)} disabled={idx >= siblings.length - 1} aria-label="Next place">→</button>
        <input
          className="notefield"
          placeholder="Review note…"
          value={form.review_note ?? ''}
          onChange={(e) => set('review_note', e.target.value)}
        />
        <button className={`rbtn save ${dirty ? 'dirty' : ''}`} onClick={() => save()} disabled={saving || !dirty}>
          Save<span className="kbd-hint">S</span>
        </button>
        <button
          className={`rbtn approve ${place.review_status === 'approved' ? 'on' : ''}`}
          onClick={() => save({ review_status: 'approved' })}
          disabled={saving}
        >
          Approve<span className="kbd-hint">A</span>
        </button>
        <button
          className={`rbtn flag ${place.review_status === 'flagged' ? 'on' : ''}`}
          onClick={() => save({ review_status: 'flagged' })}
          disabled={saving}
        >
          Flag<span className="kbd-hint">F</span>
        </button>
      </div>
    </>
  );
}
