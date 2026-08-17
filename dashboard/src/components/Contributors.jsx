import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import {
  CITY_META, SERIES_COLORS, TOP_N,
  windowDays, buildBoard, countStats, scopeRows, niceMax,
} from '../contributors.js';

const DAYS = 30;

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
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [hover, setHover] = useState(null);

  const cityParam = params.get('city') ?? '';
  const city = CITY_META.some((c) => c.id === cityParam) ? cityParam : '';

  useEffect(() => {
    let live = true;
    setError(null);
    api.contributors(DAYS)
      .then((d) => { if (live) setData(d); })
      .catch((err) => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [retryKey]);

  const setCity = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set('city', id); else next.delete('city');
    setParams(next, { replace: true });
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
      cities: CITY_META.map((c) => ({ ...c, stat: countStats(scopeRows(data.rows, c.id)) })),
    };
  }, [data]);

  const scopeLabel = city ? CITY_META.find((c) => c.id === city).label : 'all cities';
  const topSum = board ? board.top.reduce((n, s) => n + s.total, 0) : 0;

  return (
    <div className="contrib">
      <div className="contribhead">
        <div>
          <h2>Contributors</h2>
          <p className="addsub">
            Places added from the app that made it to <b className="contribem">approved</b>
            {' · '}<b className="contribem">published</b> — cumulative, last {DAYS} days.
          </p>
          <p className="contribhint">
            no filter → all cities combined · pick a city to re-rank the top {TOP_N} within it
          </p>
        </div>
        <div className="contribfilter" role="group" aria-label="City filter">
          <span className="filterlabel">City</span>
          <button className={`chip${city ? '' : ' on'}`} onClick={() => setCity('')}>All cities</button>
          {CITY_META.map((c) => (
            <button
              key={c.id}
              className={`chip${city === c.id ? ' on' : ''}`}
              onClick={() => setCity(city === c.id ? '' : c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
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
                  <span className="boardhandle">@{s.handle}</span>
                  <span className="boardcities">
                    {s.byCity.map((c, n) => (
                      <React.Fragment key={c.key}>
                        {n > 0 && <span className="dotsep"> · </span>}
                        {c.key} <b>{c.count}</b>
                      </React.Fragment>
                    ))}
                  </span>
                  <b className="boardtotal">{s.total}</b>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
