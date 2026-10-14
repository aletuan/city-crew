import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { leftBehindNote } from '../storage.js';
import { CATEGORY_KEYS } from '../categories.js';
import { LANGS, foldI18n, localizedColumns, localizedKeys, objectLangs, unfoldI18n } from '../langs.js';
import { VIBE_ORDER, VIBE_STYLE } from '../vibes.js';
import { useCity, useProgress, useToast } from '../App.jsx';
import PhotoManager, { emptyPhotoEdits, photoEditsDirty } from './PhotoManager.jsx';
import { normalizeThreads, threadsProblem, threadsUrl } from '../lib/threads.js';
import { SOURCE_OPTIONS, sourceCredit, sourceLink, sourceProblem, sniffSource } from '../lib/reviewer.js';
import { loadGoogleMaps, DARK_STYLE } from '../lib/googleMaps.js';

const FORM_FIELDS = [
  ...localizedColumns(),
  'address', 'category', 'categories', 'is_featured', 'vibe_tags', 'emoji',
  'price_display', 'price_vnd', 'duration_min', 'duration_max',
  'website', 'phone', 'threads_handle', 'is_published', 'review_note',
  'reviewer_source', 'reviewer_name', 'reviewer_url',
];

// The object's languages arrive as flat keys beside the columns', so the
// fields, the dirty check and the tests see one shape — see `langs.js`.
const pickForm = (place) => ({
  ...Object.fromEntries(FORM_FIELDS.map((k) => [k, place[k]])),
  ...unfoldI18n(place.i18n),
});
// What Save sends: the columns as they are, the object's languages folded
// back into `i18n`. The flat keys never reach the row — they are not
// columns any more (the trigger would mirror them, but a patch naming a
// column that is on its way out is the thing `EDITABLE` refuses).
const OBJECT_KEYS = new Set(localizedKeys().filter((k) => !localizedColumns().includes(k)));
const toPatch = (form, place, drafted) => ({
  ...Object.fromEntries(Object.entries(form).filter(([k]) => !OBJECT_KEYS.has(k))),
  i18n: foldI18n(form, place.i18n, drafted),
});

/**
 * The Fact-check map: is the pin where the address says it is?
 *
 * This was an OpenStreetMap <iframe>, which meant the curator checked a
 * place on one company's map and then opened "Open in Google Maps ↗" to see
 * a different company's idea of the same street. Now both agree, and the map
 * pans and zooms so a wrong-side-of-the-road pin is visible without leaving
 * the desk.
 *
 * A circle, not a pin: a teardrop marks its spot with a tip a few pixels
 * below its own weight, and this is the one screen where those pixels are
 * the entire question.
 */
function FactCheckMap({ lat, lng, name }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapsApi, setMapsApi] = useState(undefined); // undefined = still asking

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then((maps) => { if (!cancelled) setMapsApi(maps); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapsApi || !elRef.current || lat == null || lng == null) return;
    const position = { lat, lng };
    if (!mapRef.current) {
      mapRef.current = new mapsApi.Map(elRef.current, {
        center: position,
        zoom: 16,
        styles: DARK_STYLE,
        backgroundColor: '#0d0a12',
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        // Without this the zoom control is Google's white plate, which on
        // this desk reads as a hole punched in the map.
        colorScheme: 'DARK',
      });
      markerRef.current = new mapsApi.Marker({
        map: mapRef.current,
        icon: {
          path: mapsApi.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#EC96E9',
          fillOpacity: 0.95,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
    } else {
      mapRef.current.setCenter(position);
    }
    markerRef.current.setPosition(position);
    markerRef.current.setTitle(name ?? '');
  }, [mapsApi, lat, lng, name]);

  if (lat == null || lng == null) {
    return <div className="mapblank">No coordinates on this place yet.</div>;
  }
  // `mapsApi === null` is a desk with no key, or a key the browser was
  // refused. Say so once, quietly, and let the coordinates below carry the
  // screen — they are the fact being checked.
  if (mapsApi === null) {
    return <div className="mapblank">Map unavailable — set VITE_GOOGLE_MAPS_KEY.</div>;
  }
  return <div className="mapframe" ref={elRef} />;
}

/** One input per language in `LANGS`, for a column that exists once per
 *  language. The id is the column name, which is what the tests and the
 *  Threads skill select by. */
function LocalizedField({ label, field, form, set, textarea, machine }) {
  const Input = textarea ? 'textarea' : 'input';
  return (
    <div className="langs">
      {LANGS.map(({ code, label: lang }) => {
        const name = `${field}_${code}`;
        return (
          <div className="field" key={name}>
            <label htmlFor={name}>
              {label}<span className="lang">{lang}</span>
              {/* The words are a model's and nobody has changed them.
                  Said on the blurb only — that is the field a draft
                  fills — and cleared by editing, not by reading. */}
              {machine?.has(code) ? <span className="lang machine">machine draft</span> : null}
            </label>
            <Input id={name} value={form[name] ?? ''} onChange={(e) => set(name, e.target.value)} />
          </div>
        );
      })}
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
  const [saves, setSaves] = useState(null);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  // The blurb text the model produced this session, per object language:
  // what `foldI18n` compares against to decide the `machine` flag.
  const [drafted, setDrafted] = useState({});

  const load = useCallback(async () => {
    const p = await api.place(slug);
    setPlace(p);
    setForm((prev) => prev ?? pickForm(p));
    return p;
  }, [slug]);

  useEffect(() => {
    setPlace(null);
    setForm(null);
    setSaves(null);
    setPhotoEdits(emptyPhotoEdits());
    load().catch((err) => toast(err.message));
  }, [load, toast]);

  // The real save count, fetched beside the row rather than with it: it is a
  // separate table, it is only ever read, and a slow count must not hold the
  // editor closed. A failure leaves the line reading "—" and says nothing —
  // this is a reference number, not something the desk acts on.
  useEffect(() => {
    if (!place?.id) return;
    let live = true;
    api.saveCount(place.id)
      .then((n) => { if (live) setSaves(n); })
      .catch(() => { if (live) setSaves(-1); });
    return () => { live = false; };
  }, [place?.id]);

  // Ordered slugs under the current filters, for prev/next
  useEffect(() => {
    const listParams = new URLSearchParams(params);
    listParams.delete('q');
    api.places({ ...Object.fromEntries(listParams), city: city?.id, all: true })
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

  // A model's first draft of a blank blurb, dropped into the two Blurb
  // fields unsaved — exactly as if the editor had typed it — so the one
  // gate every sentence in the app already passes, Save, is the gate
  // here too. Nothing reaches the row until the editor has read it. Only
  // for a blank: a blurb worth replacing is cleared by hand first, so the
  // button never puts a model's words over a person's.
  const draft = async () => {
    if (drafting) return;
    setDrafting(true);
    try {
      const d = await api.draftBlurb(slug);
      setForm((f) => ({
        ...f, desc_vi: d.desc_vi, desc_en: d.desc_en,
        ...Object.fromEntries(objectLangs().map((l) => [`desc_${l.code}`, d[`desc_${l.code}`] ?? f[`desc_${l.code}`]])),
        // A draft the desk reads and saves is the desk's blurb, so its
        // source is `editorial` — the one value the function reads its
        // examples by, and the one the app credits as the desk's. Left for
        // the editor to pick, it was left blank: 20 rows on 13 Oct 2026,
        // none of them ever an example. A source already set is kept; a
        // Threads credit is not something a draft should overwrite.
        reviewer_source: f.reviewer_source || 'editorial',
      }));
      setDrafted(Object.fromEntries(objectLangs().filter((l) => d[`desc_${l.code}`]).map((l) => [l.code, d[`desc_${l.code}`]])));
      const from = [
        d.photos ? `${d.photos} photo${d.photos === 1 ? '' : 's'}` : null,
        d.sources?.length ? 'Wikipedia' : null,
      ].filter(Boolean);
      toast(from.length
        ? `Drafted from ${from.join(' and ')} — read it before you save.`
        : 'Drafted from the row alone — read it before you save.');
    } catch (err) {
      toast(`Draft failed: ${err.message}`);
    } finally {
      setDrafting(false);
    }
  };
  const blank = !(form?.desc_en?.trim() || form?.desc_vi?.trim());
  // The other direction: a blurb the row has, asked for in one of the
  // object's languages that is still empty. Same model, the blurb as the
  // only material (no photographs: shown them, the model added what they
  // held — see the function); the flag is set exactly as a full draft's.
  const draftLang = async (code) => {
    if (drafting) return;
    setDrafting(true);
    try {
      const d = await api.draftBlurb(slug, code);
      setForm((f) => ({ ...f, [`desc_${code}`]: d[`desc_${code}`] }));
      setDrafted((prev) => ({ ...prev, [code]: d[`desc_${code}`] }));
      toast('Drafted from the blurb — read it before you save.');
    } catch (err) {
      toast(`Draft failed: ${err.message}`);
    } finally {
      setDrafting(false);
    }
  };
  const missingLangs = blank ? [] : objectLangs().filter((l) => !form?.[`desc_${l.code}`]?.trim());
  const setNum = (key, value) => set(key, value === '' ? null : Number(value));

  const save = useCallback(async (extra = {}) => {
    if (saving) return;
    setSaving(true);
    try {
      await api.savePlace(slug, { ...toPatch(form, place, drafted), ...extra });

      // Apply staged photo edits in one batch, same Save as the text.
      const e = photoEdits;
      const tempToReal = {};
      for (const u of e.uploads) {
        const row = await api.uploadPhoto(slug, u.blob, u.name);
        tempToReal[u.tempId] = row.id;
        URL.revokeObjectURL(u.previewUrl);
      }
      const left = [];
      for (const id of e.deleted) left.push(...(await api.deletePhoto(id)).left);
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
      toast([extra.review_status ? `Marked ${extra.review_status}` : 'Saved', leftBehindNote(left)]
        .filter(Boolean).join(' — '));
    } catch (err) {
      toast(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [saving, slug, form, photoEdits, place, refreshProgress, toast, drafted]);

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

  // Normalised for the link and the check, not for the box: the field keeps
  // whatever is being typed until blur, so the cursor does not jump.
  const threadsHandle = normalizeThreads(form.threads_handle);
  const threadsMsg = threadsProblem(threadsHandle);

  // The blurb's source is three fields that only make sense together, so it
  // is validated as one thing rather than field by field.
  const sourceMsg = sourceProblem(form);
  const sourcePreview = sourceCredit(form);
  const sourceHref = sourceLink({ ...form, google_place_id: place.google_place_id });

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
            <LocalizedField label="Name" field="name" form={form} set={set} />
            <LocalizedField
              label="Blurb" field="desc" form={form} set={set} textarea
              machine={new Set(objectLangs()
                .filter((l) => foldI18n(form, place.i18n, drafted)[l.code]?.machine)
                .map((l) => l.code))}
            />
            <div className="draftline">
              <button type="button" className="vibe" onClick={draft} disabled={drafting || !blank}>
                {drafting ? 'Drafting…' : 'Draft blurb'}
              </button>
              {missingLangs.map((l) => (
                <button key={l.code} type="button" className="vibe" onClick={() => draftLang(l.code)} disabled={drafting}>
                  {drafting ? 'Drafting…' : `Draft ${l.label}`}
                </button>
              ))}
              <p className="note">
                {blank
                  ? 'Fills the three Blurb fields from the row and its photographs. Read them before you save.'
                  : missingLangs.length
                    ? `Drafts the ${missingLangs.map((l) => l.label).join(', ')} blurb from the EN and VI ones. Clear both to draft from scratch.`
                    : 'Clear the EN and VI Blurb fields to draft a new one.'}
              </p>
            </div>
            <LocalizedField label="Neighborhood" field="neighborhood" form={form} set={set} />
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
                No category yet — this place only shows under “All” in Explore until it has one.
              </p>
            )}
            <h4 style={{ margin: '18px 0 8px' }}>Vibes</h4>
            <div className="vibes" style={{ marginBottom: 14 }}>
              {VIBE_ORDER.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`vibe ${form.vibe_tags?.includes(v) ? 'on' : ''}`}
                  onClick={() => set('vibe_tags', form.vibe_tags?.includes(v)
                    ? form.vibe_tags.filter((t) => t !== v)
                    : [...(form.vibe_tags ?? []), v])}
                >
                  {VIBE_STYLE[v]?.label}
                </button>
              ))}
            </div>
            {/* The legacy food/out column is still written by the import
                pipeline but no longer drives anything the app shows, so it
                is not editable here. */}
            <div className="inline-fields">
              <label className="checkline" style={{ alignSelf: 'end', paddingBottom: 9 }}>
                <input type="checkbox" checked={!!form.is_featured} onChange={(e) => set('is_featured', e.target.checked)} />
                Featured (candidate for the Explore hero)
              </label>
              <label className="checkline" style={{ alignSelf: 'end', paddingBottom: 9 }}>
                <input type="checkbox" checked={!!form.is_published} onChange={(e) => set('is_published', e.target.checked)} />
                Published
              </label>
            </div>
          </section>

          {/* Contact and links used to be the back half of Facts, next to price
              and duration. They are a different kind of thing — where to reach
              the place, not what the place is — and Facts had become the panel
              anything landed in. Threads would have made that worse. */}
          <section className="panel">
            <h3>Contact &amp; links</h3>
            <div className="inline-fields">
              <div className="field" style={{ flex: 2 }}>
                <label htmlFor="website">Website</label>
                <input id="website" className="mono" value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input id="phone" className="mono" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
              </div>
            </div>
            <div className="inline-fields" style={{ marginTop: 12, alignItems: 'flex-start' }}>
              <div className="field" style={{ flex: 2 }}>
                <label htmlFor="threads_handle">Threads</label>
                {/* The @ belongs to the chrome: the handle is stored bare, so
                    the field shows the punctuation and never keeps it. Paste a
                    whole profile URL and `normalizeThreads` takes the handle
                    out of it on blur, because that is what the clipboard has. */}
                <div className="prefixed">
                  <span className="prefix" aria-hidden="true">@</span>
                  <input
                    id="threads_handle"
                    className="mono"
                    placeholder="handle, or paste the profile URL"
                    value={form.threads_handle ?? ''}
                    onChange={(e) => set('threads_handle', e.target.value)}
                    onBlur={(e) => set('threads_handle', normalizeThreads(e.target.value) || null)}
                  />
                </div>
                {threadsMsg
                  ? <p className="fieldnote warn">{threadsMsg}</p>
                  : <p className="fieldnote">Leave empty if the venue has no Threads account.</p>}
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Verify</label>
                {threadsHandle
                  ? <a className="verifylink" href={threadsUrl(threadsHandle)} target="_blank" rel="noreferrer">Open profile ↗</a>
                  : <span className="fieldnote">Nothing to check yet.</span>}
              </div>
            </div>
          </section>

          {/* Where the blurb came from — its own panel, not a third row of
              Contact & links, because it is about the words above and not
              about reaching the venue. `threads_handle` up there is the
              venue's account; this is whoever wrote the blurb, and they are
              routinely different people. Google is a source with no author:
              the import copies `editorialSummary`, which Google writes, so
              the name stays empty and the credit reads "Google". */}
          <section className="panel">
            <h3>Blurb source</h3>
            <div className="inline-fields" style={{ alignItems: 'flex-start' }}>
              <div className="field">
                <label htmlFor="reviewer_source">Source</label>
                <select
                  id="reviewer_source"
                  value={form.reviewer_source ?? ''}
                  onChange={(e) => set('reviewer_source', e.target.value || null)}
                >
                  {SOURCE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="reviewer_name">Credit</label>
                <div className="prefixed">
                  <span className="prefix" aria-hidden="true">@</span>
                  <input
                    id="reviewer_name"
                    className="mono"
                    placeholder={form.reviewer_source === 'google' ? 'Google names no author'
                      : form.reviewer_source === 'editorial' ? 'the desk credits nobody'
                      : 'handle of whoever wrote it'}
                    disabled={form.reviewer_source === 'google' || form.reviewer_source === 'editorial'}
                    value={form.reviewer_name ?? ''}
                    onChange={(e) => set('reviewer_name', e.target.value)}
                    onBlur={(e) => set('reviewer_name', normalizeThreads(e.target.value) || null)}
                  />
                </div>
              </div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="reviewer_url">Link</label>
              {/* Paste the permalink and the other two boxes fill themselves:
                  the URL is the only thing an editor has in the clipboard. */}
              <input
                id="reviewer_url"
                className="mono"
                placeholder="paste the post permalink"
                value={form.reviewer_url ?? ''}
                onChange={(e) => set('reviewer_url', e.target.value)}
                onBlur={(e) => {
                  const sniffed = sniffSource(e.target.value);
                  if (sniffed) setForm((f) => ({ ...f, ...sniffed }));
                  else set('reviewer_url', e.target.value.trim() || null);
                }}
              />
            </div>
            {sourceMsg
              ? <p className="fieldnote warn">{sourceMsg}</p>
              : <p className="fieldnote">Leave empty when nobody recorded where the blurb came from.</p>}
            <div className="field" style={{ marginTop: 12 }}>
              <label>Reads as</label>
              {sourcePreview
                ? (sourceHref
                    ? <a className="verifylink" href={sourceHref} target="_blank" rel="noreferrer">{sourcePreview} ↗</a>
                    : <span className="fieldnote">{sourcePreview} — no link to open.</span>)
                : <span className="fieldnote">Nothing to credit yet.</span>}
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
                <label htmlFor="duration_min">Visit min (mins)</label>
                <input id="duration_min" className="mono" type="number" value={form.duration_min ?? ''} onChange={(e) => setNum('duration_min', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="duration_max">Visit max (mins)</label>
                <input id="duration_max" className="mono" type="number" value={form.duration_max ?? ''} onChange={(e) => setNum('duration_max', e.target.value)} />
              </div>
            </div>
            {/* Both labels read "(phút)" in an otherwise English desk, and
                neither said what the numbers were for. They are the only
                editorial input into a generated plan's clock, and the planner
                does things to them worth knowing before you type. */}
            <p className="fieldnote">
              How long a visit takes. The planner averages the two, snaps to 15 minutes
              and clamps to 45–150; leave both blank and it assumes 75.
            </p>
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
            <FactCheckMap lat={place.lat} lng={place.lng} name={place.name_en} />
            {/* Observed numbers, all of them read-only. `saves` counts rows in
                collection_places — the thing `places.saved_count` was supposed
                to mirror and never did. */}
            <div className="coordline">
              {place.lat?.toFixed(6)}, {place.lng?.toFixed(6)} · ★ {place.rating ?? '—'} ({place.rating_count ?? 0} reviews)
              {' · '}
              {saves == null ? 'counting saves…' : saves < 0 ? 'saves —' : `in ${saves} ${saves === 1 ? 'list' : 'lists'}`}
            </div>
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
                  const res = await api.deletePlace(place.slug);
                  refreshProgress();
                  toast([`Deleted ${place.name_en}`, leftBehindNote(res.left)].filter(Boolean).join(' — '));
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
