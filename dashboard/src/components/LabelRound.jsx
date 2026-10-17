// Photo labels, round 3: one photograph at a time, what it is and the six
// cover criteria (docs/photo-labels.md, step 4; the sample is in
// labelRound.js).
//
// Rounds 1 and 2 asked one question, so an answer could move on by
// itself. This one asks seven, so the kind is a choice like the others
// and Next moves on — only once a kind is chosen, since a photograph
// without one is not an answer. The six criteria are chips that a tap
// steps through Không → Có → Không rõ, so the usual photograph (no on
// most of them) costs one tap for the kind and one for Next.
//
// The definitions are folded under the photograph rather than above it as
// in round 2: thirteen lines above the photograph would push it off a
// phone's screen, and by the tenth photograph they are known.
//
// Round 3b asks the six criteria alone, the kinds being answered already.
// With no kind to choose, Next is always open and marks the photograph
// answered; each chip carries its definition, since the criteria are the
// whole of the round and round 3 showed they were passed over when they
// sat beside the kinds.

import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../App.jsx';
import { ATTRS, GUIDE_3, KINDS_3, ROUNDS_3, STATES, code, encode3, firstOpen3, nextState } from '../labelRound.js';

/** What this browser kept of the round, or nothing — a private window or
 *  cleared site data starts it over rather than breaking it. */
function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? {};
  } catch {
    return {};
  }
}

const stateName = (s) => STATES.find((x) => x.key === s).vi;

function Guide() {
  return (
    <details className="lr-guide">
      <summary>Định nghĩa</summary>
      <ul aria-label="Definitions">
        {GUIDE_3.map((text) => <li key={text}>{text}</li>)}
        {ATTRS.map((a) => <li key={a.key}><b>{a.vi}:</b> {a.hint}</li>)}
      </ul>
    </details>
  );
}

export default function LabelRound({ round = 'r3' }) {
  const { key: KEY, sample: SAMPLE_3, kinds } = ROUNDS_3[round];
  const toast = useToast();
  const [answers, setAnswers] = useState(() => load(KEY));
  const [at, setAt] = useState(() => firstOpen3(SAMPLE_3, load(KEY), kinds));
  const [uris, setUris] = useState(null);

  useEffect(() => {
    api.photoUris(SAMPLE_3)
      .then(setUris)
      .catch((err) => toast(`Couldn't load the photos: ${err.message}`));
  }, [SAMPLE_3, toast]);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(answers)); } catch { /* kept for this visit only */ }
  }, [KEY, answers]);

  const done = SAMPLE_3.filter((id) => code(answers[id], kinds)[0] !== '-').length;

  if (!uris) return <div className="empty">Loading…</div>;

  if (at >= SAMPLE_3.length) {
    const line = encode3(SAMPLE_3, answers, kinds);
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
        <h3 className="pt-title">{done} / {SAMPLE_3.length} answered</h3>
        <p className="pt-note">
          {kinds
            ? 'One code per photograph, in order: the kind (F food, I interior, E exterior, V view, T text, O other, U not sure), then brand, wide, green, daylight, people, staged as 1 yes, 0 no, ? can\'t tell. Round 3.'
            : 'One code per photograph, in order: brand, wide, green, daylight, people, staged as 1 yes, 0 no, ? can\'t tell. Round 3b.'}
        </p>
        <textarea id="pt-line" className="pt-line" readOnly value={line} rows={6} aria-label="Answers" />
        <div className="pt-actions">
          <button type="button" className="pt-btn pt-primary" onClick={copy}>Copy answers</button>
          <button type="button" className="pt-btn" onClick={() => setAt(SAMPLE_3.length - 1)}>Back</button>
        </div>
      </section>
    );
  }

  const id = SAMPLE_3[at];
  const mine = answers[id] ?? {};
  const set = (patch) => setAnswers((was) => ({ ...was, [id]: { ...was[id], ...patch } }));
  const uri = uris[id];
  // The next photograph, fetched while this one is being looked at, so
  // Next does not wait on the network.
  const next = uris[SAMPLE_3[at + 1]];
  return (
    <section className="pt lr">
      <div className="pt-head">
        <button type="button" className="pt-back" onClick={() => setAt(at - 1)} disabled={at === 0}>‹ Back</button>
        <span className="pt-count">{at + 1} / {SAMPLE_3.length}</span>
        <button type="button" className="pt-back" onClick={() => setAt(SAMPLE_3.length)}>Answers ›</button>
      </div>
      <div className="pt-frame">
        {uri
          ? <img className="pt-photo" src={uri} alt={`Photograph ${at + 1}`} />
          : <p className="pt-gone">This photograph has been deleted — answer “Không chắc”.</p>}
      </div>
      {next && <img className="pt-preload" src={next} alt="" aria-hidden="true" />}
      {kinds && <div className="pt-kinds lr-kinds" role="group" aria-label="What is this photograph?">
        {KINDS_3.map((k) => (
          <button
            key={k.key}
            type="button"
            className={`pt-btn${mine.kind === k.key ? ' on' : ''}`}
            aria-pressed={mine.kind === k.key}
            onClick={() => set({ kind: k.key })}
          >
            <b>{k.vi}</b>
            <span>{k.en}</span>
          </button>
        ))}
      </div>}
      <div className={`lr-attrs${kinds ? '' : ' lr-attrs-only'}`} role="group" aria-label="Cover criteria">
        {ATTRS.map((a) => {
          const s = mine.attrs?.[a.key] ?? '0';
          return (
            <button
              key={a.key}
              type="button"
              className={`lr-attr s${s === '?' ? 'q' : s}`}
              aria-label={`${a.vi}: ${stateName(s)}`}
              onClick={() => set({ attrs: { ...mine.attrs, [a.key]: nextState(s) } })}
            >
              <b>{a.vi}</b>
              <span>{stateName(s)}</span>
              {!kinds && <small>{a.hint}</small>}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="pt-btn pt-primary lr-next"
        disabled={kinds && !mine.kind}
        onClick={() => { if (!kinds) set({ seen: true }); setAt(at + 1); }}
      >
        Tiếp ›
      </button>
      {kinds && <Guide />}
    </section>
  );
}
