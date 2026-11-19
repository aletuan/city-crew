// Banned words — what no comment may contain.
//
// The App Store asks four things of an app that carries people's words
// (Guideline 1.2), and the first is a way to filter what is objectionable
// before it is posted. This list is that filter: the server reads it on
// every comment written (`comment_clean`), so a word added here stops the
// next comment, and a word removed lets it through, with no release.
//
// It shipped empty, and must not stay empty when comments open to
// readers (the plan's open item) — so an empty list says so, in the
// page's one warning.
//
// ── add many, remove one ──
//
// A list like this is written in a sitting and then pruned a word at a
// time. So the box takes a paste, one word or phrase a line, and each
// word in the list has its own way out. No "save": there is no draft of
// a filter worth keeping — a word is in the list or it is not, and the
// page shows the list as the server has it, re-read after every change.
//
// ── try a sentence ──
//
// The rule is whole words, which is not what most people expect of a
// word filter: "ass" does not stop "class", and a word spelled apart
// gets by. The box under the list answers "would this be stopped?" with
// the same reading (`wouldStop`), so the desk learns the rule by trying
// it rather than from a reader's report.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../App.jsx';
import { cleanWords, wouldStop } from '../bannedWords.js';

export default function BannedWords() {
  const toast = useToast();
  const [words, setWords] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentence, setSentence] = useState('');

  const load = useCallback(
    () => api.bannedWords()
      .then((w) => setWords(w ?? []))
      .catch((e) => {
        // A list that could not be read is not an empty list: the page
        // keeps what it had, or says nothing rather than "no words yet".
        setWords((had) => had ?? []);
        toast(`Couldn't load the banned words: ${e.message}`, 'bad');
      }),
    [toast],
  );
  useEffect(() => { load(); }, [load]);

  const fresh = useMemo(() => cleanWords(text, words ?? []), [text, words]);
  const stopped = useMemo(() => wouldStop(sentence, words ?? []), [sentence, words]);

  /** Change the list, then read it back: what the page shows is what the
   *  server holds, not what this tab believes it sent. */
  const change = async (run, done) => {
    if (busy) return;
    setBusy(true);
    try {
      await run();
      toast(done, 'ok');
      await load();
    } catch (e) {
      toast(e.message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  const add = () => change(
    async () => { await api.addBannedWords(fresh); setText(''); },
    `Added ${fresh.length} word${fresh.length === 1 ? '' : 's'}`,
  );

  if (!words) return <div className="empty">Loading…</div>;

  return (
    <>
      <div className="crumbs">
        <Link to="/reports">← Reports</Link>
        <span>/</span>
        <span className="slug">banned words</span>
      </div>

      <div className="addplace">
        <h2>Banned words</h2>
        <p className="addsub">
          Words and phrases no comment may contain. The app checks a comment against this
          list as it is posted and refuses one that has any of them, so a change here takes
          effect on the next comment anybody writes.
        </p>
        <p className="addsub">
          <strong>Whole words only.</strong> Capitals and punctuation make no difference, but
          a word is matched as a word: banning “ass” does not stop “class”. A word spelled
          apart to get round the list still gets through — that is what the report button is
          for.
        </p>

        <section className="panel" style={{ maxWidth: 860, marginBottom: 14 }}>
          <h3>
            The list
            <span className="chipcount"> ({words.length})</span>
          </h3>
          {words.length === 0 ? (
            <p className="hint">
              No words yet. Comments are not filtered at all until this list has something in it.
            </p>
          ) : (
            <ul className="banlist">
              {words.map((w) => (
                <li key={w} className="banword">
                  <span>{w}</span>
                  <button
                    type="button"
                    className="banx"
                    disabled={busy}
                    aria-label={`Remove “${w}”`}
                    onClick={() => change(() => api.removeBannedWord(w), `Removed “${w}”`)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="ban-add">
              Add words
              <span className="lang">ONE PER LINE</span>
            </label>
            <textarea
              id="ban-add"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div style={{ marginTop: 14 }}>
            <button type="button" className="syncbtn primary" disabled={fresh.length === 0 || busy} onClick={add}>
              {busy ? 'Saving…' : `Add ${fresh.length || ''}`.trim()}
            </button>
          </div>
        </section>

        <section className="panel" style={{ maxWidth: 860, marginBottom: 14 }}>
          <h3>Try a sentence</h3>
          <div className="field">
            <label htmlFor="ban-try">Would this comment be stopped?</label>
            <textarea
              id="ban-try"
              rows={2}
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
            />
          </div>
          {sentence.trim() ? (
            <p className="addsub" style={{ marginTop: 8 }} data-testid="ban-verdict">
              {stopped.length > 0
                ? `Stopped — it contains ${stopped.map((w) => `“${w}”`).join(', ')}.`
                : 'Not stopped by the list as it stands.'}
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
