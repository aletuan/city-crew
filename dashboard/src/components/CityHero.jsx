// City hero editor: the Explore screen's cover for the selected city —
// headline, CTA label, and which place's photo sits behind them. Reads and
// writes the hero_* columns on cities (see the city_hero migration); every
// field cleared falls back to the app's built-in copy or automatic photo
// pick, so "empty" is always a safe state.

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useCity, useToast } from '../App.jsx';

const HERO_FIELDS = [
  'hero_title_en', 'hero_title_vi', 'hero_title_ja',
  'hero_sub_en', 'hero_sub_vi', 'hero_sub_ja',
  'hero_cta_en', 'hero_cta_vi', 'hero_cta_ja', 'hero_place_slug',
];
const pickForm = (row) => Object.fromEntries(HERO_FIELDS.map((k) => [k, row[k] ?? '']));

/** Same defaults the app renders when a hero field is null. */
const defaultTitle = (city, lang) => {
  if (lang === 'vi') return `Gợi ý cho một đêm ở ${city?.short_vi ?? 'thành phố'}`;
  if (lang === 'ja') return `${city?.short_ja ?? city?.short_en ?? 'この街'}、夜のアイデア`;
  return `Ideas for a night in ${city?.short_en ?? 'the city'}`;
};
/** The app's built-in button label, mirrored — the two codebases share no
 *  module, so the only thing keeping this honest is that both sides say
 *  where the other one is. See ExploreScreen's hero CTA. */
const DEFAULT_CTA = { en: "Let's go", vi: 'Khám phá', ja: 'はじめる' };
/** Cleared, the app falls back to this — the line it used to show in
 *  every city. Shown as the placeholder so an empty field reads as
 *  "this is what they will see", not as "this will be blank". */
const DEFAULT_SUB = {
  en: 'Browse public collections and places — no account needed.',
  vi: 'Xem bộ sưu tập và địa điểm công khai — không cần tài khoản.',
  ja: 'コレクションとスポットを自由に閲覧 — アカウント不要。',
};

function LangRow({ label, base, form, set, placeholders }) {
  return (
    <div className="triple">
      {['en', 'vi', 'ja'].map((lang) => {
        const name = `${base}_${lang}`;
        return (
          <div className="field" key={name}>
            <label htmlFor={name}>{label}<span className="lang">{lang.toUpperCase()}</span></label>
            <input
              id={name}
              value={form[name]}
              placeholder={placeholders?.[lang] ?? ''}
              onChange={(e) => set(name, e.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function CityHero() {
  const toast = useToast();
  const { city } = useCity();
  const [row, setRow] = useState(null);
  const [form, setForm] = useState(null);
  const [places, setPlaces] = useState([]);
  const [saving, setSaving] = useState(false);
  const [previewLang, setPreviewLang] = useState('en');

  useEffect(() => {
    if (!city?.id) return;
    let live = true;
    setRow(null);
    setForm(null);
    api.city(city.id)
      .then((r) => { if (live) { setRow(r); setForm(pickForm(r)); } })
      .catch((err) => toast(`Couldn't load city: ${err.message}`));
    api.places({ city: city.id, all: true })
      .then((rows) => live && setPlaces(Array.isArray(rows) ? rows.filter((p) => p.cover_url) : []))
      .catch(() => live && setPlaces([]));
    return () => { live = false; };
  }, [city?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = useMemo(
    () => !!(row && form && JSON.stringify(pickForm(row)) !== JSON.stringify(form)),
    [row, form],
  );

  useEffect(() => {
    const onBeforeUnload = (e) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await api.saveCityHero(city.id, form);
      const fresh = await api.city(city.id);
      setRow(fresh);
      setForm(pickForm(fresh));
      toast(`Saved ${city.name_en}'s hero`);
    } catch (err) {
      toast(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Mirror of the app's photo pick: the pinned slug first, then a featured
  // views/nightlife place, then any featured, then anything with a photo.
  // Restricted to published places, because that's all the app can see.
  const previewPlace = useMemo(() => {
    const pub = places.filter((p) => p.is_published);
    return (
      (form?.hero_place_slug ? pub.find((p) => p.slug === form.hero_place_slug) : undefined)
      ?? pub.find((p) => p.is_featured && p.vibe_tags?.some((v) => v === 'views' || v === 'nightlife'))
      ?? pub.find((p) => p.is_featured)
      ?? pub[0]
    );
  }, [places, form?.hero_place_slug]);

  if (!city) return <div className="empty">Loading…</div>;
  if (!form) return <div className="empty">Loading {city.name_en}…</div>;

  const pinnedUnpublished = form.hero_place_slug
    && places.some((p) => p.slug === form.hero_place_slug && !p.is_published);
  const title = form[`hero_title_${previewLang}`] || form.hero_title_en || defaultTitle(city, previewLang);
  const cta = form[`hero_cta_${previewLang}`] || form.hero_cta_en || DEFAULT_CTA[previewLang];
  // Same precedence the app uses: this language, then English, then the
  // built-in line. Keyed off the English field there, so a city with a
  // subtitle set only in Vietnamese still shows it rather than the
  // fallback — which is what a half-translated desk edit should do.
  const sub = form[`hero_sub_${previewLang}`] || form.hero_sub_en || DEFAULT_SUB[previewLang];

  return (
    <>
      <div className="crumbs">
        <Link to="/">← All places</Link>
        <span>/</span>
        <span className="slug">city hero</span>
      </div>

      <div className="addplace">
        <h2>City hero — {city.name_en}</h2>
        <p className="addsub">
          The cover of the app's Explore screen for this city: headline, the line under it,
          button label, and the place whose photo sits behind them. Cleared fields fall back to
          the app's default copy and automatic photo pick.
        </p>

        <div className="heropreview">
          {previewPlace?.cover_url
            ? <img src={previewPlace.cover_url} alt="" />
            : <div className="heropreview-none">No published place with a photo yet</div>}
          <div className="heropreview-shade" />
          <div className="heropreview-content">
            <div className="heropreview-title">{title}</div>
            <div className="heropreview-sub">{sub}</div>
            <span className="heropreview-cta">{cta} →</span>
          </div>
        </div>
        <div className="herolangs">
          <span className="filterlabel">Preview</span>
          {['en', 'vi', 'ja'].map((lang) => (
            <button
              key={lang}
              className={`chip ${previewLang === lang ? 'on' : ''}`}
              onClick={() => setPreviewLang(lang)}
            >
              {lang.toUpperCase()}
            </button>
          ))}
          {previewPlace && (
            <span className="heropicked">
              photo: {previewPlace.name_en}{form.hero_place_slug === previewPlace.slug ? ' (pinned)' : ' (automatic)'}
            </span>
          )}
        </div>

        <section className="panel" style={{ maxWidth: 860 }}>
          <h3>Headline</h3>
          <LangRow label="Title" base="hero_title" form={form} set={set} />

          <h4 style={{ margin: '18px 0 8px' }}>Subtitle</h4>
          <LangRow label="Line" base="hero_sub" form={form} set={set} placeholders={DEFAULT_SUB} />

          <h4 style={{ margin: '18px 0 8px' }}>Call to action</h4>
          <LangRow label="Button" base="hero_cta" form={form} set={set} placeholders={DEFAULT_CTA} />

          <h4 style={{ margin: '18px 0 8px' }}>Cover photo</h4>
          <div className="field">
            <label htmlFor="hero_place_slug">Pinned place</label>
            <select
              id="hero_place_slug"
              value={form.hero_place_slug}
              onChange={(e) => set('hero_place_slug', e.target.value)}
            >
              <option value="">Automatic — featured place with a photo</option>
              {places.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name_en}{p.is_published ? '' : ' (not published)'}
                </option>
              ))}
            </select>
          </div>
          {pinnedUnpublished && (
            <p className="hint">
              This place isn't published yet — the app falls back to the automatic pick until it is.
            </p>
          )}

          <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="syncbtn primary" onClick={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save hero'}
            </button>
            {dirty && (
              <button className="syncbtn" onClick={() => setForm(pickForm(row))}>Discard changes</button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
