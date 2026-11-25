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
// Four verbs, and they are deliberately narrow (see the moderation
// migrations): hide a public list, blank one field of a profile, take a
// comment down, stop an account signing in. Nothing here can rewrite
// somebody's words, and nothing here can reach a private list — which
// was never public, and so was never reportable. Three of the four are
// reversible, because the desk is people and people misjudge.
//
// The fourth is not. A removed comment is deleted, with the answers
// under it, and no copy is kept (the comment_desk migration says why).
// So it is the second act on this page that asks first, and its
// question says what will not come back.
//
// A check-in photo (K5 of docs/checkin-photos-plan.md) is the fifth
// verb's object: hidden, not deleted, and put back with the same press
// — its file stays, and nobody is signed a link to it while it is down.
// The photo is drawn on the card from a link the desk asks for itself
// (the bucket is private); suspending its owner hides every photo they
// have, and lifting that puts back what the suspension hid.
//
// Dismiss is a first-class answer, not a fallback. A report that was
// looked at and found harmless is work done, and the queue must be able
// to say so or it will fill with rows nobody dares clear.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { CategoryIcon } from '../icons.jsx';
import { useToast } from '../App.jsx';
import {
  ageLabel, kindOf, newCount, placeOf, previewOf, REASON_LABEL, slaState, sortQueue, SLA_HOURS,
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
          What readers have flagged in the four places this app publishes without review: a public collection’s words,
          a profile, a comment, and a photo on a check-in. Everything else — every place in the catalog — already passes this desk before anyone sees it.
        </p>
        <p className="addsub">
          <strong>Within {SLA_HOURS} hours.</strong> That is the window the App Store expects
          for acting on reported content, and the only reason this page leads with a clock.
          Hiding a list, clearing a field and hiding a check-in photo are all reversible; suspending an
          account stops a sign-in, hides their check-in photos, and leaves the rest of their rows where
          they are. Removing a comment is the one act here that cannot be undone.
        </p>
        <p className="addsub">
          Words no comment may contain are kept on their own page:{' '}
          <Link to="/banned-words">Banned words</Link>.
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
          const kind = kindOf(r);
          const place = placeOf(r);
          return (
            <section key={r.id} className={`panel repcard${gone ? ' done' : ''}`}>
              <div className="rephead">
                <span className={`repstate ${state}`}>
                  {gone ? r.status : `${ageLabel(r.created_at, now)} · ${STATE_LABEL[state]}`}
                </span>
                <span className="repkind">
                  <CategoryIcon name={kind.icon} />
                  {kind.label}
                </span>
                <span className="repreason">{REASON_LABEL[r.reason] ?? r.reason}</span>
                {r.owner_handle ? <span className="rephandle">@{r.owner_handle}</span> : null}
                {/* Where it was said. A comment is judged in its place:
                    "rubbish" under a list of bins is not the same word
                    as under a list of somebody's cafés. */}
                {place ? <span className="repplace">on “{place}”</span> : null}
              </div>

              {/* The words themselves. A queue that shows an id and asks
                  the reader to go and look is a queue nobody works. */}
              <p className="reptext">{previewOf(r) || <em>Nothing left to show — already cleared.</em>}</p>
              {r.note ? <p className="repnote">“{r.note}”</p> : null}
              {/* The cover the person wears (docs/wall-plan.md): an upload
                  is drawn, being the one picture on the page nobody at the
                  desk has seen; a city or a list is the catalog's own and
                  is named. */}
              {r.kind === 'profile' && r.wall_kind === 'upload' && r.wall_ref ? (
                <img className="repwall" src={r.wall_ref} alt="Uploaded cover" />
              ) : null}
              <ReportedPhoto row={r} busy={busy === r.id} act={act} done={gone} />
              {r.kind === 'profile' && r.wall_kind && r.wall_kind !== 'upload' ? (
                <p className="repnote">Cover: {r.wall_kind} {r.wall_ref}</p>
              ) : null}

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
                      {r.wall_kind ? (
                        <button
                          type="button"
                          className="syncbtn danger"
                          disabled={busy === r.id}
                          onClick={() => act(r, 'Cover taken down', () => api.moderateProfile(r.target_id, { wall: true }))}
                        >
                          Take the cover down
                        </button>
                      ) : null}
                    </>
                  )}
                  {r.kind === 'comment' && previewOf(r) && (
                    <button
                      type="button"
                      className="syncbtn danger"
                      disabled={busy === r.id}
                      onClick={() => {
                        if (!window.confirm(
                          'Remove this comment?\n\n'
                          + 'It is deleted, with any answers under it, and cannot be put back.',
                        )) return;
                        act(r, 'Comment removed', () => api.moderateComment(r.target_id));
                      }}
                    >
                      Remove the comment
                    </button>
                  )}
                  <PhotoAct row={r} busy={busy === r.id} act={act} />
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
                          + 'They will not be able to sign in, and their check-in photos are hidden. Their collections and trips stay where they are, and you can lift this later.',
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

/**
 * A reported check-in photo, from a link asked for as the card draws: the
 * bucket is private, so the path in the queue is not a picture until
 * Storage signs it. Dimmed, and said, when it is already down.
 */
function ReportedPhoto({ row, busy, act, done }) {
  // A check-in reported whole draws all of itself — `ReportedVisit`.
  if (row.kind === 'checkin') return <ReportedVisit row={row} busy={busy} act={act} done={done} />;
  return row.kind === 'checkin_photo' && row.photo_path
    ? <SignedPhoto path={row.photo_path} hidden={row.photo_hidden} />
    : null;
}

function SignedPhoto({ path, hidden }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    api.signCheckinPhoto(path).then((url) => { if (live) setSrc(url); }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [path]);
  return (
    <>
      {src ? <img className={`repphoto${hidden ? ' off' : ''}`} src={src} alt="Reported check-in photo" /> : null}
      {failed ? <p className="repnote">The photo could not be loaded.</p> : null}
      {hidden ? <p className="repnote">Hidden — nobody but the desk can see it.</p> : null}
    </>
  );
}

/**
 * A check-in reported whole: its photos, each with its own hide or put
 * back while the report is open, and what is down already said. The
 * photos the queue sends include the hidden ones, so one can be put back.
 */
function ReportedVisit({ row, busy, act, done }) {
  if (row.kind !== 'checkin') return null;
  const photos = row.visit_photos ?? [];
  return (
    <>
      {row.visit_hidden ? <p className="repnote">The whole check-in is hidden — only its owner sees it.</p> : null}
      {row.visit_note_hidden ? <p className="repnote">The note is hidden — only its owner sees it.</p> : null}
      {row.visit_audience ? <p className="repnote">Seen by: {row.visit_audience}</p> : null}
      {photos.map((ph) => (
        <div key={ph.id} className="repvisitphoto">
          <SignedPhoto path={ph.path} hidden={ph.hidden} />
          {done ? null : (
            <button
              type="button"
              className={`syncbtn${ph.hidden ? '' : ' danger'}`}
              disabled={busy}
              onClick={() => (ph.hidden
                ? act(row, 'Photo put back', () => api.moderateCheckinPhoto(ph.id, false), 'dismissed')
                : act(row, 'Photo hidden', () => api.moderateCheckinPhoto(ph.id, true)))}
            >
              {ph.hidden ? 'Put the photo back' : 'Hide the photo'}
            </button>
          )}
        </div>
      ))}
    </>
  );
}

/** The note and the whole visit, each hidden or put back — putting back
 *  is the desk finding nothing wrong, and is answered as that. */
function VisitAct({ row, busy, act }) {
  if (row.kind !== 'checkin') return null;
  const one = (part, down, hideLabel, backLabel, hidden, back) => (
    <button
      type="button"
      className={`syncbtn${down ? '' : ' danger'}`}
      disabled={busy}
      onClick={() => (down
        ? act(row, back, () => api.moderateCheckin(row.target_id, part, false), 'dismissed')
        : act(row, hidden, () => api.moderateCheckin(row.target_id, part, true)))}
    >
      {down ? backLabel : hideLabel}
    </button>
  );
  return (
    <>
      {row.body || row.visit_note_hidden
        ? one('note', row.visit_note_hidden, 'Hide the note', 'Put the note back', 'Note hidden', 'Note put back')
        : null}
      {one('visit', row.visit_hidden, 'Hide the check-in', 'Put the check-in back', 'Check-in hidden', 'Check-in put back')}
    </>
  );
}

/** Hide a reported photo, or put back one already down — the second is
 *  the desk finding nothing wrong with it, and is answered as that. */
function PhotoAct({ row, busy, act }) {
  // A check-in reported whole has acts of its own — `VisitAct`.
  if (row.kind === 'checkin') return <VisitAct row={row} busy={busy} act={act} />;
  if (row.kind !== 'checkin_photo' || !row.photo_path) return null;
  const down = row.photo_hidden;
  return (
    <button
      type="button"
      className={`syncbtn${down ? '' : ' danger'}`}
      disabled={busy}
      onClick={() => (down
        ? act(row, 'Photo put back', () => api.moderateCheckinPhoto(row.target_id, false), 'dismissed')
        : act(row, 'Photo hidden', () => api.moderateCheckinPhoto(row.target_id, true)))}
    >
      {down ? 'Put the photo back' : 'Hide the photo'}
    </button>
  );
}
