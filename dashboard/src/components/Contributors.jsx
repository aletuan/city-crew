import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { CityPicker, chipLabel, useCity } from '../App.jsx';
import {
  DAYS, SERIES_COLORS, TOP_N,
  windowDays, buildBoard, countStats, scopeRows, niceMax, guideScope, withGuide,
} from '../contributors.js';


// ── chart geometry ──
// Fixed viewBox, fluid width. The desk caps the shell at 1280px, so the
// scale factor stays near 1 and the mono labels keep their weight.
const W = 760;
const H = 380;
const M = { top: 30, right: 48, bottom: 30, left: 38 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;

const fmtDay = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Weekly marks from the window's first day, plus its last — the last wins
 *  when a weekly mark would crowd it. */
function xTickIndexes(len) {
  const out = [];
  for (let i = 0; i < len - 4; i += 7) out.push(i);
  out.push(len - 1);
  return out;
}

const px = (i, len) => M.left + (len === 1 ? 0 : (i / (len - 1)) * IW);
const py = (v, max) => M.top + IH * (1 - v / max);
const linePath = (series, max) =>
  series.map((v, i) => `${i ? 'L' : 'M'}${px(i, series.length).toFixed(1)},${py(v, max).toFixed(1)}`).join('');

/**
 * The cumulative picture: one solid line per top-ten contributor on the left
 * scale, and the whole scope as a dashed line on the right scale.
 *
 * Two scales on one plot is a thing the desk would normally never do — but
 * both measure the same unit (places, cumulative over the same days), the
 * dashed line is one aggregate rather than a competing series, and dash +
 * fill + its own pink axis keep the two readings from impersonating each
 * other. The per-user lines answer "who", the dashed line answers "how much
 * in total"; the right axis exists so ten lines and their own sum can share
 * the window without flattening the ten into grass.
 */
function ContribChart({ days, board, hover, setHover }) {
  const svgRef = useRef(null);
  const len = days.length;
  const leftMax = niceMax(Math.max(1, ...board.top.map((s) => s.total)));
  const rightMax = niceMax(Math.max(1, board.total));
  const ticks = [0, 1, 2, 3];

  const onMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;
    const day = Math.max(0, Math.min(len - 1, Math.round(((sx - M.left) / IW) * (len - 1))));
    // Nearest line at this day — the dashed whole-scope line competes on its
    // own scale, so each candidate is measured in screen pixels.
    let best = { type: 'all', dist: Math.abs(sy - py(board.allSeries[day], rightMax)) };
    for (const s of board.top) {
      const d = Math.abs(sy - py(s.series[day], leftMax));
      if (d < best.dist) best = { type: 'user', id: s.id, dist: d };
    }
    setHover({ type: best.type, id: best.id ?? null, day });
  };

  const hovered = hover?.type === 'user' ? board.top.find((s) => s.id === hover.id) : null;
  const dimUsers = hover && (hover.type === 'all' || hover.type === 'user');
  const tipDay = hover?.day ?? null;

  // Tooltip anchored to the crosshair day, flipped past the midline so it
  // never leaves the plot.
  const tip = tipDay != null && (
    <div
      className="contribtip"
      style={{
        left: `${(px(tipDay, len) / W) * 100}%`,
        transform: `translate(${tipDay > len / 2 ? '-100%' : '8px'}, 0)`,
      }}
    >
      <div className="tipdate">{fmtDay(days[tipDay])}</div>
      {hovered && (
        <div className="tiprow">
          <i style={{ background: SERIES_COLORS[board.top.indexOf(hovered)] }} />
          @{hovered.handle} · <b>{hovered.series[tipDay]}</b>
        </div>
      )}
      <div className="tiprow tipall">all · <b>{board.allSeries[tipDay]}</b></div>
    </div>
  );

  return (
    <div className="contribchartwrap" onMouseLeave={() => setHover(null)}>
      <div className="chartlegend">
        <span className="legendleft"><i className="swatch solid" />top 10 · per user · left axis</span>
        <span className="legendright">
          <i className="swatch dashed" />
          all {board.contributors} contributor{board.contributors === 1 ? '' : 's'} · right axis · follows city filter
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="contribchart"
        role="img"
        aria-label={`Cumulative places per day: top ${board.top.length} contributors and the ${board.contributors}-contributor total. The table beside the chart carries the same numbers.`}
        onMouseMove={onMove}
      >
        <defs>
          <linearGradient id="contrib-allfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--ai-violet)" stopOpacity="0.26" />
            <stop offset="1" stopColor="var(--ai-violet)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <text className="axistitle" x={M.left} y={M.top - 14}>places (cumulative)</text>

        {ticks.map((t) => {
          const y = py((leftMax / 3) * t, leftMax);
          return (
            <g key={t}>
              <line className={t === 0 ? 'gridbase' : 'gridline'} x1={M.left} x2={W - M.right} y1={y} y2={y} />
              <text className="ticklabel left" x={M.left - 8} y={y + 4}>{(leftMax / 3) * t}</text>
              <text className="ticklabel right" x={W - M.right + 8} y={y + 4}>{(rightMax / 3) * t}</text>
            </g>
          );
        })}
        {xTickIndexes(len).map((i, n, arr) => (
          <text
            key={i}
            className="ticklabel x"
            x={px(i, len)}
            y={H - 8}
            textAnchor={n === 0 ? 'start' : n === arr.length - 1 ? 'end' : 'middle'}
          >
            {fmtDay(days[i])}
          </text>
        ))}

        {/* the whole scope, dashed, on its own scale */}
        <g opacity={hover?.type === 'user' ? 0.4 : 1}>
          <path
            d={`${linePath(board.allSeries, rightMax)}L${W - M.right},${py(0, rightMax)}L${M.left},${py(0, rightMax)}Z`}
            fill="url(#contrib-allfill)"
            stroke="none"
          />
          <path className="allline" d={linePath(board.allSeries, rightMax)} />
          <circle
            className="enddot"
            cx={px(len - 1, len)}
            cy={py(board.allSeries[len - 1], rightMax)}
            r="3.5"
            fill="var(--ai-pink)"
          />
          <text
            className="alltotal"
            x={px(len - 1, len)}
            y={py(board.allSeries[len - 1], rightMax) - 10}
            textAnchor="end"
          >
            {board.total}
          </text>
        </g>

        {/* the top ten, slot colours, top rank drawn last so it stays on top */}
        {[...board.top].reverse().map((s) => {
          const slot = board.top.indexOf(s);
          const color = SERIES_COLORS[slot];
          const dim = dimUsers && !(hover.type === 'user' && hover.id === s.id);
          return (
            <g key={s.id} opacity={dim ? 0.22 : 1}>
              <path
                className="userline"
                d={linePath(s.series, leftMax)}
                stroke={color}
                strokeWidth={hover?.type === 'user' && hover.id === s.id ? 2.6 : 2}
              />
              <circle
                className="enddot"
                cx={px(len - 1, len)}
                cy={py(s.series[len - 1], leftMax)}
                r="3.5"
                fill={color}
              />
            </g>
          );
        })}

        {tipDay != null && (
          <g className="crosshair">
            <line x1={px(tipDay, len)} x2={px(tipDay, len)} y1={M.top} y2={H - M.bottom} />
            {hovered && (
              <circle
                cx={px(tipDay, len)}
                cy={py(hovered.series[tipDay], leftMax)}
                r="4.5"
                fill={SERIES_COLORS[board.top.indexOf(hovered)]}
              />
            )}
            <circle cx={px(tipDay, len)} cy={py(board.allSeries[tipDay], rightMax)} r="4" fill="var(--ai-pink)" />
          </g>
        )}
      </svg>
      {tip}
    </div>
  );
}

/** One scope's card — the big count, with its contributor count beside it. */
function StatCard({ label, stat, accent }) {
  return (
    <div className="contribcard">
      <div className="contriblabel">{label}</div>
      <div className="contribstat">
        <span className={`contribnum${accent ? ' grad' : ''}`}>{stat.total}</span>
        <span className="contribsub">{stat.contributors} contributor{stat.contributors === 1 ? '' : 's'}</span>
      </div>
    </div>
  );
}

export default function Contributors() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [hover, setHover] = useState(null);

  // The city is the desk's, not this screen's. It used to be a `?city=`
  // param with its own chip row, which meant picking Hà Nội on Places and
  // coming here showed all cities — and the tiles at the top of the page,
  // which have always read the workspace city, contradicted the board
  // underneath them.
  const { cities, city: workspaceCity } = useCity();
  const city = workspaceCity?.id ?? '';

  useEffect(() => {
    let live = true;
    setError(null);
    api.contributors(DAYS)
      .then((d) => { if (live) setData(d); })
      .catch((err) => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [retryKey]);

  // Who is already a guide. Fetched apart from the board rather than folded
  // into `api.contributors`, because the two answer to different clocks: the
  // board is a thirty-day window recomputed on a city switch, this is a
  // handful of ids that only ever changes when somebody here changes it.
  // A failure leaves every box unticked and the screen otherwise intact —
  // the leaderboard is what this page is for, and it does not need this to
  // be readable.
  const [guides, setGuides] = useState(null);
  useEffect(() => {
    let live = true;
    api.localGuides()
      .then((g) => { if (live) setGuides(g); })
      .catch(() => { if (live) setGuides(new Map()); });
    return () => { live = false; };
  }, [retryKey]);

  // Which row is mid-write, so its box can say so and refuse a second click.
  const [saving, setSaving] = useState(null);

  // The grant is made for whichever city the desk is scoped to; with no
  // city picked it is made for all of them, including cities the catalog
  // has not got yet.
  const grantCity = workspaceCity?.id ?? null;

  const toggleGuide = async (id, on) => {
    setSaving(id);
    // Moved before the request, and put back if it fails. A checkbox that
    // waits for a round trip before it ticks reads as a checkbox that did
    // not register the click, and the second click undoes the first.
    setGuides((prev) => withGuide(prev, id, grantCity, on));
    try {
      await api.setLocalGuide(id, on, grantCity);
    } catch (err) {
      setGuides((prev) => withGuide(prev, id, grantCity, !on));
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  // The window is anchored once per visit — recomputing it mid-hover would
  // reshuffle every series under the cursor at midnight.
  const days = useMemo(() => windowDays(DAYS), []);
  const board = useMemo(
    () => (data ? buildBoard(data.rows, data.profiles, days, city) : null),
    [data, days, city],
  );
  const cards = useMemo(() => {
    if (!data) return null;
    return {
      all: countStats(data.rows),
      // Every city the database has, including the ones nobody has
      // contributed to: an empty card is where the next gap is.
      cities: cities.map((c) => ({
        id: c.id, label: chipLabel(c), stat: countStats(scopeRows(data.rows, c.id)),
      })),
    };
  }, [data, cities]);

  const scopeLabel = cities.find((c) => c.id === city)?.name_vi ?? 'all cities';
  const topSum = board ? board.top.reduce((n, s) => n + s.total, 0) : 0;

  return (
    <div className="contrib">
      {/* The name and the sentence are the page head's now, where every
          room's are. What stays is what only this screen knows. */}
      <div className="contribhead">
        <div>
          <p className="contribhint">
            {city
              ? `the top ${TOP_N} within ${scopeLabel} · switch city on the right`
              : `all cities combined · pick a city on the right to re-rank the top ${TOP_N} within it`}
          </p>
        </div>
        {/* The same control the other scoped screens draw, in the slot
            this head keeps for its own furniture. It replaces the chip row
            the page head used to carry for all three. */}
        <CityPicker />
      </div>

      {error && (
        <div className="empty">
          Couldn’t load contributors: {error}{' '}
          <button className="syncbtn" onClick={() => setRetryKey((k) => k + 1)}>Retry</button>
        </div>
      )}
      {!error && !data && <div className="empty">Loading contributors…</div>}

      {cards && board && (
        <>
          <div className="contribcards">
            <StatCard label="All cities · Total" stat={cards.all} accent />
            {cards.cities.map((c) => <StatCard key={c.id} label={c.label} stat={c.stat} />)}
          </div>

          <div className="contribgrid">
            {board.total === 0 ? (
              <div className="panel">
                <div className="empty">
                  Nothing from the app reached approved · published in {scopeLabel} these {DAYS} days.
                </div>
              </div>
            ) : (
              <div className="panel contribchartpanel">
                <ContribChart days={days} board={board} hover={hover} setHover={setHover} />
              </div>
            )}

            <div className="panel contribboard">
              <div className="boardhead">
                <h3 className="boardtitle">Top {Math.min(TOP_N, board.top.length) || TOP_N} · {scopeLabel}</h3>
                {board.total > 0 && (
                  <span className="boardpct">
                    {topSum} of {board.total} · {Math.round((topSum / board.total) * 100)}%
                  </span>
                )}
              </div>
              {board.top.length === 0 && <div className="empty">No contributors yet.</div>}
              {board.top.map((s, i) => (
                <div
                  key={s.id}
                  className={`boardrow${hover?.type === 'user' && hover.id === s.id ? ' hot' : ''}`}
                  onMouseEnter={() => setHover({ type: 'user', id: s.id, day: null })}
                  onMouseLeave={() => setHover(null)}
                  title={s.full_name ?? undefined}
                >
                  <span className="boardrank">{i + 1}</span>
                  <span className="boarddot" style={{ background: SERIES_COLORS[i] }} />
                  {/* The breakdown is not drawn. On one city it said the
                      total again in smaller type — `buildBoard` has already
                      scoped the rows, so there is only ever one term and it
                      equals the count beside it. On all cities it said
                      something real and said it at ruinous length: six
                      terms today, and one more every time the catalog
                      takes a city. It stays on the name, where a hover
                      answers "where do their places are" without spending
                      a line of the panel on the answer nobody asked. */}
                  <span
                    className="boardhandle"
                    title={s.byCity.map((c) => `${c.key} ${c.count}`).join(' · ')}
                  >
                    @{s.handle}
                  </span>
                  <b className="boardtotal">{s.total}</b>
                  {/* The one thing on this row that is a control rather than
                      a number. Last, after the count, because the board is
                      read as a ranking first and administered second — and
                      because a checkbox at the start of every row would make
                      ten rankings look like a selection list.

                      The label is the target: a 13px box is a poor thing to
                      aim at, and wrapping it gives the whole word-and-box
                      pair one hit area without a second element to style. */}
                  {(() => {
                    /* The grant is a city now, so the box answers for the
                       city the desk is on — and for the one case it cannot
                       answer, it says so rather than doing nothing. */
                    const g = guideScope(guides, s.id, grantCity);
                    const where = grantCity ? scopeLabel : 'every city';
                    return (
                      <label
                        className={`guidebox${g.on ? ' on' : ''}`}
                        title={g.locked
                          ? `@${s.handle} is a guide in every city — switch to All cities to change it`
                          : g.on
                            ? `@${s.handle} may add photos to places they imported in ${where}`
                            : `Let @${s.handle} add photos to places they imported in ${where}`}
                      >
                        <input
                          type="checkbox"
                          checked={g.on}
                          disabled={guides === null || saving === s.id || g.locked}
                          onChange={(e) => toggleGuide(s.id, e.target.checked)}
                        />
                        guide
                      </label>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
