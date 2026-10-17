// The photo-type round, one photograph at a time (Q4 in
// docs/photo-critic.md; the sample and why it is shaped as it is are in
// photoTypes.js).
//
// Made for a phone, because that is where the owner answers it (17 Oct
// 2026): the photograph as large as the screen allows, four buttons a
// thumb can hit under it, and nothing else to read. An answer moves on to
// the next photograph; Back goes to the last one to change it. The
// answers live in this browser and leave it as one line to paste.

import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../App.jsx';
import { GUIDE, KINDS, ROUNDS, encode, firstOpen } from '../photoTypes.js';

/** What this browser kept of a round, or nothing — a private window or
 *  cleared site data starts it over rather than breaking it. */
function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? {};
  } catch {
    return {};
  }
}

/** The definitions, on the page of a round answered under them — above
 *  the photograph, so they are read before each answer, not once. */
function Guide() {
  return (
    <ul className="pt-guide" aria-label="Definitions">
      {GUIDE.map((g) => <li key={g.key}>{g.text}</li>)}
    </ul>
  );
}

export default function PhotoTypes({ round = 'r1' }) {
  const { key: KEY, sample: SAMPLE, guide } = ROUNDS[round];
  const toast = useToast();
  const [labels, setLabels] = useState(() => load(KEY));
  const [at, setAt] = useState(() => firstOpen(SAMPLE, load(KEY)));
  const [uris, setUris] = useState(null);

  useEffect(() => {
    api.photoUris(SAMPLE)
      .then(setUris)
      .catch((err) => toast(`Couldn't load the photos: ${err.message}`));
  }, [SAMPLE, toast]);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(labels)); } catch { /* kept for this visit only */ }
  }, [KEY, labels]);

  const answer = (key) => {
    setLabels((was) => ({ ...was, [SAMPLE[at]]: key }));
    setAt((i) => i + 1);
  };
  const done = Object.keys(labels).length;

  if (!uris) return <div className="empty">Loading…</div>;

  if (at >= SAMPLE.length) {
    const line = encode(SAMPLE, labels);
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(line);
        toast('Copied — paste it into the chat');
      } catch {
        // Some in-app browsers refuse the clipboard: select it instead,
        // so the system's own Copy is one tap away.
        document.getElementById('pt-line').select();
        toast('Select-all done — use Copy');
      }
    };
    return (
      <section className="pt">
        <h3 className="pt-title">{done} / {SAMPLE.length} answered</h3>
        <p className="pt-note">One letter per photograph, in order: F food, P place, S scenery, U not sure, – none.{guide ? ' Round 1b.' : ''}</p>
        <textarea id="pt-line" className="pt-line" readOnly value={line} rows={4} aria-label="Answers" />
        <div className="pt-actions">
          <button type="button" className="pt-btn pt-primary" onClick={copy}>Copy answers</button>
          <button type="button" className="pt-btn" onClick={() => setAt(SAMPLE.length - 1)}>Back</button>
        </div>
      </section>
    );
  }

  const id = SAMPLE[at];
  const uri = uris[id];
  // The next photograph, fetched while this one is being looked at, so
  // the answer does not wait on the network.
  const next = uris[SAMPLE[at + 1]];
  return (
    <section className="pt">
      {guide && <Guide />}
      <div className="pt-head">
        <button type="button" className="pt-back" onClick={() => setAt(at - 1)} disabled={at === 0}>‹ Back</button>
        <span className="pt-count">{at + 1} / {SAMPLE.length}</span>
        <button type="button" className="pt-back" onClick={() => setAt(SAMPLE.length)}>Answers ›</button>
      </div>
      <div className="pt-frame">
        {uri
          ? <img className="pt-photo" src={uri} alt={`Photograph ${at + 1}`} />
          : <p className="pt-gone">This photograph has been deleted — answer “Not sure”.</p>}
      </div>
      {next && <img className="pt-preload" src={next} alt="" aria-hidden="true" />}
      <div className="pt-kinds" role="group" aria-label="What is this photograph?">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            className={`pt-btn${labels[id] === k.key ? ' on' : ''}`}
            aria-pressed={labels[id] === k.key}
            onClick={() => answer(k.key)}
          >
            <b>{k.vi}</b>
            <span>{k.en}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
