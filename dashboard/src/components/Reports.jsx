// Reports — the queue that makes the report button mean something.
//
// The App Store's rule about other people's content is not satisfied by
// a button. It asks for four things, and the fourth is the one with
// teeth: reported content is acted on **within a day**. This page is
// where that day is kept — so it leads with the clock, not with the
// complaint. A report is coloured by how long it has waited, the queue
// puts the oldest unanswered first, and the sidebar carries the count
// so nobody has to remember to come and look.
//
// ── what the desk can actually do ──
//
// Three verbs, and they are deliberately narrow (see the moderation
// migration): hide a public list, blank one field of a profile, stop an
// account signing in. Nothing here can rewrite somebody's words, and
// nothing here can reach a private list — which was never public, and
// so was never reportable. Every one of the three is reversible, because
// the desk is people and people misjudge.
//
// Dismiss is a first-class answer, not a fallback. A report that was
// looked at and found harmless is work done, and the queue must be able
// to say so or it will fill with rows nobody dares clear.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { CategoryIcon } from '../icons.jsx';
import { useToast } from '../App.jsx';
import {
  ageLabel, newCount, previewOf, REASON_LABEL, slaState, sortQueue, SLA_HOURS,
} from '../reports.js';

const STATE_LABEL = { fresh: 'waiting', due: 'due today', overdue: 'overdue', done: '' };

export default function Reports() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  // Read once per render pass rather than per row: forty rows asking the
  // clock forty times can straddle a minute and disagree with each other.
  // `rows` is the cache key rather than an input: the instant is meant to be
  // re-taken when a fetch lands and held still between them.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [rows]);

  const load = useCallback(() => {
    setLoading(true);
    api.reports()
      .then((r) => setRows(r ?? []))
      .catch((e) => toast(e.message, 'bad'))
      .finally(() => setLoading(false));
  }, [toast]);
  useEffect(load, [load]);

  const queue = useMemo(() => sortQueue(rows), [rows]);
  const waiting = newCount(rows);
  const late = rows.filter((r) => slaState(r, now) === 'overdue').length;

  /** Do the thing, then record that it was done — in that order, so a
   *  failed action never leaves the queue claiming it was handled. */
  const act = async (row, label, run, status = 'actioned') => {
    setBusy(row.id);
    try {
      if (run) await run();
      await api.markReport(row.id, status);
      toast(label, 'ok');
      load();
    } catch (e) {
      toast(e.message, 'bad');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="crumbs">
        <span className="slug">reports</span>
      </div>

      <div className="addplace">
        <h2>Reports</h2>
        <p className="addsub">
          What readers have flagged in the two places this app publishes without review: a
          public collection’s words, and a profile. Everything else — every place in the
          catalog — already passes this desk before anyone sees it.
        </p>
        <p className="addsub">
          <strong>Within {SLA_HOURS} hours.</strong> That is the window the App Store expects
          for acting on reported content, and the only reason this page leads with a clock.
          Hiding a list and clearing a field are both reversible; suspending an account stops
          a sign-in and leaves the person’s own rows where they are.
        </p>

        <div className="repsum">
          <span className={`reppill${late > 0 ? ' bad' : ''}`}>
            {waiting} waiting{late > 0 ? ` · ${late} overdue` : ''}
          </span>
          <button type="button" className="syncbtn" onClick={load} disabled={loading}>
            {loading ? 'Reading…' : 'Refresh'}
          </button>
        </div>

        {!loading && queue.length === 0 && (
          <p className="addsub">Nothing reported. The quietest page in the desk.</p>
        )}

        {queue.map((r) => {
          const state = slaState(r, now);
          const gone = r.status !== 'new';
          return (
            <section key={r.id} className={`panel repcard${gone ? ' done' : ''}`}>
              <div className="rephead">
                <span className={`repstate ${state}`}>
                  {gone ? r.status : `${ageLabel(r.created_at, now)} · ${STATE_LABEL[state]}`}
                </span>
                <span className="repkind">
                  <CategoryIcon name={r.kind === 'collection' ? 'list' : 'users'} />
                  {r.kind === 'collection' ? 'collection' : 'profile'}
                </span>
                <span className="repreason">{REASON_LABEL[r.reason] ?? r.reason}</span>
                {r.owner_handle ? <span className="rephandle">@{r.owner_handle}</span> : null}
              </div>

              {/* The words themselves. A queue that shows an id and asks
                  the reader to go and look is a queue nobody works. */}
              <p className="reptext">{previewOf(r) || <em>Nothing left to show — already cleared.</em>}</p>
              {r.note ? <p className="repnote">“{r.note}”</p> : null}

              {!gone && (
                <div className="repacts">
                  {r.kind === 'collection' && (
                    <button
                      type="button"
                      className="syncbtn danger"
                      disabled={busy === r.id}
                      onClick={() => act(r, 'List hidden', () => api.moderateCollection(r.target_id, true))}
                    >
                      Hide the list
                    </button>
                  )}
                  {r.kind === 'profile' && (
                    <>
                      <button
                        type="button"
                        className="syncbtn danger"
                        disabled={busy === r.id}
                        onClick={() => act(r, 'Bio cleared', () => api.moderateProfile(r.target_id, { bio: true }))}
                      >
                        Clear the bio
                      </button>
                      <button
                        type="button"
                        className="syncbtn danger"
                        disabled={busy === r.id}
                        onClick={() => act(r, 'Photo cleared', () => api.moderateProfile(r.target_id, { avatar: true }))}
                      >
                        Clear the photo
                      </button>
                    </>
                  )}
                  {r.owner_id && (
                    <button
                      type="button"
                      className="syncbtn danger"
                      disabled={busy === r.id}
                      onClick={() => {
                        // The one act that reaches past the content to the
                        // person, so it asks first — and says what it does
                        // and does not do.
                        if (!window.confirm(
                          `Suspend @${r.owner_handle ?? 'this account'}?\n\n`
                          + 'They will not be able to sign in. Their collections and trips stay '
                          + 'where they are, and you can lift this later.',
                        )) return;
                        act(r, 'Account suspended', () => api.suspendUser(r.owner_id, true));
                      }}
                    >
                      Suspend the account
                    </button>
                  )}
                  <button
                    type="button"
                    className="syncbtn"
                    disabled={busy === r.id}
                    onClick={() => act(r, 'Dismissed', null, 'dismissed')}
                  >
                    Nothing wrong
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
