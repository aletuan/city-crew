// Photo labels, round 4: two photographs of one kind at one place, and
// which is the better photograph (docs/photo-labels.md §12; the pairs are
// in pairRound.js).
//
// One question, three answers, so an answer moves on by itself, as in
// rounds 1 and 2, and Back goes to the last pair to change it. The two
// photographs sit side by side where the screen is wide enough and one
// above the other on a phone (theme.css), each marked with the letter its
// button names, so the answer never depends on remembering which was
// "left".

import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../App.jsx';
import { CHOICES, KEY_4, KIND_NAME, PAIRS_4, encode4, firstOpen4 } from '../pairRound.js';

/** What this browser kept of the round, or nothing — a private window or
 *  cleared site data starts it over rather than breaking it. */
function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY_4)) ?? {};
  } catch {
    return {};
  }
}

const IDS = PAIRS_4.flatMap((p) => [p.a, p.b]);

function Shot({ uri, letter, n }) {
  return (
    <figure className="pp-shot">
      {uri
        ? <img className="pt-photo" src={uri} alt={`Pair ${n}, photograph ${letter}`} />
        : <p className="pt-gone">This photograph has been deleted — answer “Ngang nhau”.</p>}
      <figcaption className="pp-letter">{letter}</figcaption>
    </figure>
  );
}

export default function PhotoPairs() {
  const toast = useToast();
  const [answers, setAnswers] = useState(load);
  const [at, setAt] = useState(() => firstOpen4(load()));
  const [uris, setUris] = useState(null);

  useEffect(() => {
    api.photoUris(IDS)
      .then(setUris)
      .catch((err) => toast(`Couldn't load the photos: ${err.message}`));
  }, [toast]);

  useEffect(() => {
    try { localStorage.setItem(KEY_4, JSON.stringify(answers)); } catch { /* kept for this visit only */ }
  }, [answers]);

  if (!uris) return <div className="empty">Loading…</div>;

  const done = Object.keys(answers).length;
  if (at >= PAIRS_4.length) {
    const line = encode4(answers);
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
        <h3 className="pt-title">{done} / {PAIRS_4.length} answered</h3>
        <p className="pt-note">One letter per pair, in order: A or B the better photograph, = even, – none. Round 4.</p>
        <textarea id="pt-line" className="pt-line" readOnly value={line} rows={3} aria-label="Answers" />
        <div className="pt-actions">
          <button type="button" className="pt-btn pt-primary" onClick={copy}>Copy answers</button>
          <button type="button" className="pt-btn" onClick={() => setAt(PAIRS_4.length - 1)}>Back</button>
        </div>
      </section>
    );
  }

  const pair = PAIRS_4[at];
  const answer = (key) => {
    setAnswers((was) => ({ ...was, [at]: key }));
    setAt((i) => i + 1);
  };
  // The next pair, fetched while this one is being looked at.
  const next = PAIRS_4[at + 1];
  return (
    <section className="pt pp">
      <div className="pt-head">
        <button type="button" className="pt-back" onClick={() => setAt(at - 1)} disabled={at === 0}>‹ Back</button>
        <span className="pt-count">{at + 1} / {PAIRS_4.length}</span>
        <button type="button" className="pt-back" onClick={() => setAt(PAIRS_4.length)}>Answers ›</button>
      </div>
      <h3 className="pp-question">{KIND_NAME[pair.kind]}: ảnh nào đẹp hơn?</h3>
      <div className="pp-pair">
        <Shot uri={uris[pair.a]} letter="A" n={at + 1} />
        <Shot uri={uris[pair.b]} letter="B" n={at + 1} />
      </div>
      {next && [next.a, next.b].filter((id) => uris[id]).map((id) => (
        <img key={id} className="pt-preload" src={uris[id]} alt="" aria-hidden="true" />
      ))}
      <div className="pp-choices" role="group" aria-label="Which is the better photograph?">
        {CHOICES.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`pt-btn${answers[at] === c.key ? ' on' : ''}`}
            aria-pressed={answers[at] === c.key}
            onClick={() => answer(c.key)}
          >
            <b>{c.vi}</b>
          </button>
        ))}
      </div>
    </section>
  );
}
