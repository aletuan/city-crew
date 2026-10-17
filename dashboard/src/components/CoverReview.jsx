// Cover review: the places whose cover the photo labels say does not show
// the place, beside the photograph they would put there instead
// (docs/photo-labels.md §11, step 6A; owner, 17 Oct 2026).
//
// Which places, and which suggestion, is `coverReview.js`. This page only
// asks. An editor answers each one of two ways — take the suggestion, or
// keep the cover — and both are recorded: a kept cover must not come
// back every time the page opens, and the share of suggestions taken is
// the measurement §11 asks for before any of this is shown in the app.
// That share is the pill at the top.
//
// The two photographs sit side by side at the same size, the cover on the
// left, because the question is a comparison and a thumbnail is how a
// cover is first seen. The reasons under the suggestion are the criteria
// it meets, in the labels' own terms, so an editor who disagrees with
// one can see which.
//
// It follows the desk's city: with one chosen, that city's places; with
// "All cities", the catalog's, grouped by city.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useCity, useToast } from '../App.jsx';
import { queue, tally } from '../coverReview.js';

export default function CoverReview() {
  const toast = useToast();
  const { city } = useCity();
  const cityId = city?.id ?? null;
  const [places, setPlaces] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    setPlaces(null);
    Promise.all([api.coverPlaces(cityId), api.coverAnswers()])
      .then(([p, a]) => { setPlaces(p); setAnswers(a); })
      .catch((e) => { setPlaces([]); toast(e.message, 'bad'); });
  }, [cityId, toast]);
  useEffect(load, [load]);

  const reviews = useMemo(() => (places ? queue(places, answers) : []), [places, answers]);
  const t = tally(answers);

  const answer = async (r, decision) => {
    setBusy(r.place.id);
    try {
      await api.answerCover(r, decision);
      toast(decision === 'changed' ? `${r.place.name}: cover changed` : `${r.place.name}: cover kept`, 'ok');
      // The answer is what moves the place off the page: the cover change
      // alone would too, but a kept cover only leaves by being answered.
      setAnswers((was) => [...was.filter((a) => a.place_id !== r.place.id),
        { place_id: r.place.id, cover_photo_id: r.cover.id, suggested_photo_id: r.suggestion.id, decision }]);
      if (decision === 'changed') {
        setPlaces((was) => was.map((p) => (p.id !== r.place.id ? p : {
          ...p, photos: p.photos.map((ph) => ({ ...ph, is_cover: ph.id === r.suggestion.id })),
        })));
      }
    } catch (e) {
      toast(e.message, 'bad');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="crumbs">
        <span className="slug">covers</span>
      </div>

      <div className="addplace">
        <h2>Cover review</h2>
        <p className="addsub">
          Places whose cover is not a view of the place — the front, the inside or the
          grounds, taken whole — while another of their photographs is. At a café or a
          place to eat, the food counts as a view of it.
        </p>

        <div className="repsum">
          <span className="reppill">
            {places ? `${reviews.length} to look at` : 'Reading…'}
          </span>
          {t.total > 0 && (
            <span className="reppill" title="Suggestions taken, of all answered">
              {t.changed} of {t.total} suggestions taken
            </span>
          )}
          <button type="button" className="syncbtn" onClick={load} disabled={!places}>
            Refresh
          </button>
        </div>

        {places && reviews.length === 0 && (
          <p className="addsub">Every cover here shows its place.</p>
        )}

        {reviews.map((r) => (
          <section key={r.place.id} className="panel repcard cr-card">
            <div className="rephead">
              <Link to={`/place/${r.place.slug}`} className="cr-name">{r.place.name}</Link>
              {!cityId && <span className="repkind">{r.place.city_id}</span>}
            </div>
            <div className="cr-pair">
              <figure className="cr-shot">
                <img src={r.cover.photo_uri} alt={`${r.place.name}: the cover`} loading="lazy" />
                <figcaption><b>Cover</b> · {r.why}</figcaption>
              </figure>
              <figure className="cr-shot">
                <img src={r.suggestion.photo_uri} alt={`${r.place.name}: the suggestion`} loading="lazy" />
                <figcaption><b>Suggested</b> · {r.reasons.join(' · ')}</figcaption>
              </figure>
            </div>
            <div className="repacts">
              <button
                type="button"
                className="syncbtn primary"
                disabled={busy === r.place.id}
                onClick={() => answer(r, 'changed')}
              >
                Use the suggestion
              </button>
              <button
                type="button"
                className="syncbtn"
                disabled={busy === r.place.id}
                onClick={() => answer(r, 'kept')}
              >
                Keep the cover
              </button>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
