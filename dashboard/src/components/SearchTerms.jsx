// Search synonyms: the words readers type that the catalog does not
// otherwise contain.
//
// The gap this closes: somebody searching "cinema" found nothing. No field
// of a multiplex holds the word — two thirds of this catalog has no
// description at all — and the category it is filed under is labelled
// "Fun". The app keeps these words in a second pass, so a place answers to
// the words its kind is known by.
//
// ── they only fill a blank screen ──
//
// A word here belongs to a whole category, so "cinema" and "bowling" are
// both words for everything filed under Fun. The app therefore uses them
// *only when the exact search found nothing*, and labels what comes back
// as related rather than matched. Search "museum" and you get the museums,
// not every heritage place whose category happens to list the word.
//
// ── one list, three languages, on purpose ──
//
// There is no EN/VI/JA split here and there must not be one. The app's
// search never reads the reader's interface language: a place's English,
// Vietnamese and Japanese fields all sit in the same haystack, so somebody
// with the app in Vietnamese types "cinema" and somebody with it in
// English types "pho", and both work. Splitting these lists by language
// would break exactly that.
//
// ── it can only add ──
//
// The app ships its own defaults (app/src/lib/categories.ts) and unions
// this on top. Nothing typed here can remove a default, and an empty row —
// or a failed fetch, or this table not existing — leaves search exactly as
// it shipped. That is what makes a text box that steers results safe.

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { CATEGORY_KEYS, CATEGORY_STYLE } from '../categories.js';
import { CategoryIcon } from '../icons.jsx';
import { useToast } from '../App.jsx';

/** The app drops anything shorter, because matching is substring: a
 *  two-letter synonym is a category that answers almost any query. CJK is
 *  exempt there — 映画 is a whole word — and mirrored here so the warning
 *  does not cry wolf. */
const MIN_TERM = 3;
const CJK = /[぀-ヿ㐀-䶿一-鿿]/;
const tooShort = (t) => t.trim().length < MIN_TERM && !CJK.test(t);

/** One line per term is the only format that survives a phone keyboard,
 *  a comma inside a Vietnamese phrase, and a paste from a spreadsheet. */
const toText = (terms) => (terms ?? []).join('\n');
const toTerms = (text) => text.split('\n').map((t) => t.trim()).filter(Boolean);

function Row({ cat, label, saved, onSaved }) {
  const toast = useToast();
  const [text, setText] = useState(toText(saved));
  const [saving, setSaving] = useState(false);

  // Re-seed when the fetch lands, but never over a half-typed edit.
  useEffect(() => { setText(toText(saved)); }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const terms = useMemo(() => toTerms(text), [text]);
  const short = useMemo(() => terms.filter(tooShort), [terms]);
  const dirty = toText(saved) !== toText(terms);

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const clean = await api.saveCategoryTerms(cat, terms);
      onSaved(clean);
      toast(`Saved ${clean.length} term${clean.length === 1 ? '' : 's'} for ${label}`);
    } catch (err) {
      toast(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const style = CATEGORY_STYLE[cat];
  return (
    <section className="panel" style={{ maxWidth: 860, marginBottom: 14 }}>
      <h3>
        <CategoryIcon name={style?.icon} color={style?.color} />
        {' '}{label}
        <span className="chipcount"> ({terms.length})</span>
      </h3>
      <div className="field">
        <label htmlFor={`terms-${cat}`}>
          Extra search words
          <span className="lang">ONE PER LINE</span>
        </label>
        <textarea
          id={`terms-${cat}`}
          rows={Math.max(3, terms.length + 1)}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'cinema\nrạp phim\n映画館'}
        />
      </div>
      {short.length > 0 && (
        <p className="hint" style={{ marginTop: 8 }}>
          The app ignores {short.map((t) => `“${t}”`).join(', ')} — under {MIN_TERM} letters
          matches too much.
        </p>
      )}
      <div style={{ marginTop: 14 }}>
        <button className="syncbtn primary" disabled={!dirty || saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </section>
  );
}

export default function SearchTerms() {
  const toast = useToast();
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    let live = true;
    api.categoryTerms()
      .then((rows) => live && setSaved(rows))
      .catch((err) => {
        if (!live) return;
        setSaved({});
        toast(`Couldn't load search words: ${err.message}`);
      });
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!saved) return <div className="empty">Loading…</div>;

  return (
    <>
      <div className="crumbs">
        <Link to="/">← All places</Link>
        <span>/</span>
        <span className="slug">search words</span>
      </div>

      <div className="addplace">
        <h2>Search words</h2>
        <p className="addsub">
          Words a reader might type that a place’s own record does not contain — “cinema”
          for a multiplex, “laptop” for somewhere to work. They are a safety net: the app
          uses them <em>only</em> when the search found nothing exact, and shows what comes
          back under “no exact match”. So a word here can rescue an empty screen, and cannot
          crowd out a real result.
        </p>
        <p className="addsub">
          <strong>One list, all languages.</strong> Search never looks at the reader’s app
          language, so the English, Vietnamese and Japanese words go in the same box. These
          only ever <em>add</em> to the words the app already knows — clearing a box cannot
          break search.
        </p>

        {CATEGORY_KEYS.map(([cat, label]) => (
          <Row
            key={cat}
            cat={cat}
            label={label}
            saved={saved[cat] ?? []}
            onSaved={(terms) => setSaved((s) => ({ ...s, [cat]: terms }))}
          />
        ))}
      </div>
    </>
  );
}
