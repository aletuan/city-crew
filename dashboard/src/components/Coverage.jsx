import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useCity } from '../App.jsx';
import { CITY_META } from '../contributors.js';
import {
  buildCoverage, fitView, lngToX, latToY, bubbleRadius, TILE,
} from '../coverage.js';

const MAP_H = 620;
const MAP_H_NARROW = 460;
// Dark basemap, the one the mock wears. Public tile CDN; attribution is the
// licence, not decoration.
const tileUrl = (z, x, y, dpr) =>
  `https://${'abcd'[(x + y) % 4]}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}${dpr > 1 ? '@2x' : ''}.png`;

/**
 * A static mosaic, not a map widget: the screen answers "where is the
 * catalog thin", which needs one well-framed look at the city, not pan and
 * zoom — so no map library rides along. Tiles for the fitted view are laid
 * as plain <img>, bubbles as SVG on top, both from the same mercator math
 * (see coverage.js). If the tile CDN is unreachable the bubbles still
 * stand on the dark ground — the numbers never depend on the network.
 */
function CoverageMap({ groups, hover, setHover }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(0);
  // A phone gets a shorter frame: 620px of map on a 360px column is mostly
  // empty mercator.
  const mapH = width && width < 520 ? MAP_H_NARROW : MAP_H;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const located = groups.filter((g) => g.lat != null);
  // Keyed on the coordinates themselves, not the array identity — groups is
  // rebuilt every render, and refitting the view on each one would refetch
  // every tile.
  const coordsKey = located.map((g) => `${g.lat},${g.lng}`).join(';');
  const view = useMemo(
    () => (width ? fitView(located, width, mapH) : null),
    [width, mapH, coordsKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  let tiles = [];
  let bubbles = [];
  if (view) {
    const left = view.x - width / 2;
    const top = view.y - mapH / 2;
    const maxTile = 2 ** view.z - 1;
    for (let tx = Math.floor(left / TILE); tx * TILE < left + width; tx++) {
      for (let ty = Math.max(0, Math.floor(top / TILE)); ty * TILE < top + mapH && ty <= maxTile; ty++) {
        tiles.push({ tx, ty, x: tx * TILE - left, y: ty * TILE - top });
      }
    }
    const maxCount = Math.max(...located.map((g) => g.count));
    // Small bubbles drawn last so a big neighbour never swallows their hover.
    bubbles = [...located]
      .sort((a, b) => b.count - a.count)
      .map((g) => ({
        g,
        r: bubbleRadius(g.count, maxCount),
        x: lngToX(g.lng, view.z) - left,
        y: latToY(g.lat, view.z) - top,
      }));
  }

  const dpr = window.devicePixelRatio ?? 1;

  return (
    <div className="covmap" ref={wrapRef} style={{ height: mapH }}>
      {tiles.map((t) => (
        <img
          key={`${t.tx}/${t.ty}`}
          className="covtile"
          src={tileUrl(view.z, t.tx, t.ty, dpr)}
          style={{ left: t.x, top: t.y }}
          alt=""
          loading="lazy"
          draggable={false}
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
        />
      ))}
      {view && (
        <svg className="covbubbles" width={width} height={mapH} role="img"
          aria-label={`${located.length} districts on the map; the list beside it carries the same numbers.`}>
          {bubbles.map(({ g, r, x, y }) => {
            const hot = hover === g.key;
            return (
              <g
                key={g.key}
                className={`covbubble${hot ? ' hot' : ''}`}
                onMouseEnter={() => setHover(g.key)}
                onMouseLeave={() => setHover(null)}
              >
                <circle className="halo" cx={x} cy={y} r={r + 7} />
                <circle className="body" cx={x} cy={y} r={r} />
                <text className="count" x={x} y={y + 4.5}>{g.count}</text>
                <text className="name" x={x} y={y + r + 15}>{g.label}</text>
              </g>
            );
          })}
        </svg>
      )}
      <span className="covattr">© OpenStreetMap · © CARTO</span>
    </div>
  );
}

export default function Coverage() {
  const [params, setParams] = useSearchParams();
  const { cities } = useCity();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [hover, setHover] = useState(null);

  const cityParam = params.get('city') ?? '';
  const city = CITY_META.some((c) => c.id === cityParam) ? cityParam : CITY_META[0].id;

  useEffect(() => {
    let live = true;
    setError(null);
    api.coverage()
      .then((d) => { if (live) setRows(d); })
      .catch((err) => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [retryKey]);

  const setCity = (id) => {
    const next = new URLSearchParams(params);
    next.set('city', id);
    setParams(next, { replace: true });
  };

  const perCity = useMemo(() => {
    if (!rows) return null;
    return Object.fromEntries(CITY_META.map((c) => [c.id, rows.filter((r) => r.city_id === c.id)]));
  }, [rows]);
  const cov = useMemo(() => (perCity ? buildCoverage(perCity[city]) : null), [perCity, city]);

  // The app's own long name for the panel heading; CITY_META's short label
  // stays on the chip, same as the mock.
  const longName = cities.find((c) => c.id === city)?.name_vi
    ?? { hcmc: 'TP. Hồ Chí Minh', hanoi: 'Hà Nội', danang: 'Đà Nẵng', dalat: 'Đà Lạt', hue: 'Huế' }[city];
  const maxCount = cov?.groups[0]?.count ?? 0;

  return (
    <div className="coverage">
      <div className="contribhead">
        <div>
          <h2>Coverage</h2>
          <p className="addsub">
            Where the catalog actually is — published places per district, so thin
            quận stand out before users notice.
          </p>
        </div>
        <div className="contribfilter" role="group" aria-label="City">
          {CITY_META.map((c) => (
            <button
              key={c.id}
              className={`chip${city === c.id ? ' on' : ''}`}
              onClick={() => setCity(c.id)}
            >
              {c.label}
              <span className="chipcount">{perCity ? perCity[c.id].length : '–'}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="empty">
          Couldn’t load coverage: {error}{' '}
          <button className="syncbtn" onClick={() => setRetryKey((k) => k + 1)}>Retry</button>
        </div>
      )}
      {!error && !rows && <div className="empty">Loading coverage…</div>}

      {cov && (
        <div className="contribgrid">
          <div className="panel covmappanel">
            {cov.groups.some((g) => g.lat != null)
              ? <CoverageMap groups={cov.groups} hover={hover} setHover={setHover} />
              // Three ways for the map to be blank, and they are not the same
              // news. Nothing published is a catalog to fill; addresses that
              // name no district is a parse to fix (the bubbles are per
              // district, so no district means nothing to draw, whatever the
              // coordinates say); districts with no coordinates is a backfill.
              // The screen used to report the third whatever had happened,
              // beside a panel that was busy counting places.
              : (
                <div className="empty">
                  {cov.total === 0
                    ? <>Nothing published in {longName} yet.</>
                    : cov.groups.length === 0
                      ? <>No district could be read from these {cov.total} addresses, so there is nothing to place on the map.</>
                      : <>No published place in {longName} has coordinates yet.</>}
                </div>
              )}
          </div>

          <div>
            <div className="panel contribboard">
              <div className="boardhead">
                <h3 className="boardtitle">{longName}</h3>
                <span className="boardpct">
                  {cov.total} place{cov.total === 1 ? '' : 's'} · {cov.groups.length} district{cov.groups.length === 1 ? '' : 's'}
                </span>
              </div>
              {/* Two different nothings, and the screen used to print the
                  wrong one. `groups` holds only the districts that could be
                  read off an address; everything else lands in `unplaced`,
                  which is rendered as its own row further down. So gating on
                  `groups.length` meant that a city whose addresses all failed
                  to parse showed "Nothing published here yet." directly above
                  a row counting twenty of them — under a heading that had
                  already said "20 places · 0 districts".
                  An empty catalog and an unreadable one need different
                  sentences, because they need different work. */}
              {cov.total === 0 && <div className="empty">Nothing published here yet.</div>}
              {cov.total > 0 && cov.groups.length === 0 && (
                <div className="empty">
                  No district could be read from any of these addresses.
                </div>
              )}
              {cov.groups.map((g) => (
                <div
                  key={g.key}
                  className={`boardrow covrow${hover === g.key ? ' hot' : ''}`}
                  onMouseEnter={() => setHover(g.key)}
                  onMouseLeave={() => setHover(null)}
                >
                  <span className="covname">{g.label}</span>
                  <span className="covtrack">
                    <span className="covbar" style={{ width: `${(g.count / maxCount) * 100}%` }} />
                  </span>
                  <b className="boardtotal">{g.count}</b>
                </div>
              ))}
              {cov.unplaced.length > 0 && (
                // Counted, not mapped to a district — the panel total must
                // still add up to the card the chip shows.
                <div className="boardrow covrow">
                  <span className="covname unplaced">no district on record</span>
                  <span className="covtrack" />
                  <b className="boardtotal">{cov.unplaced.length}</b>
                </div>
              )}
            </div>

            {cov.noCoords.length > 0 && (
              <div className="covwarn">
                <span aria-hidden="true">⚠</span>
                <span>
                  {cov.noCoords.length} place{cov.noCoords.length === 1 ? ' has' : 's have'} no
                  coordinates and {cov.noCoords.length === 1 ? "isn't" : "aren't"} on the map —{' '}
                  {cov.noCoords.slice(0, 6).map((r, i) => (
                    <React.Fragment key={r.slug}>
                      {i > 0 && ' · '}
                      <Link to={`/place/${r.slug}`}>{r.name_en ?? r.slug}</Link>
                    </React.Fragment>
                  ))}
                  {cov.noCoords.length > 6 && ` · +${cov.noCoords.length - 6} more`}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
