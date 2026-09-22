import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { chipLabel, useCity } from '../App.jsx';
import {
  buildCoverage, fitView, lngToX, latToY, xToLng, yToLat, bubbleRadius,
} from '../coverage.js';
import { loadGoogleMaps, DARK_STYLE } from '../lib/googleMaps.js';

const MAP_H = 620;
const MAP_H_NARROW = 460;

/**
 * The desk's one look at geography: a Google basemap with a bubble per
 * district drawn over it.
 *
 * The bubbles are plain SVG, not map markers, and they stay that way. The
 * arithmetic that places them lives in coverage.js and projects into the
 * same 256px web-mercator world `google.maps.Map` uses, so a world pixel
 * computed here lands on the same spot as the basemap underneath — all this
 * component has to know is which world pixel the top-left corner of the
 * viewport is currently at. `bounds_changed` gives it that on every pan and
 * zoom.
 *
 * Keeping the overlay outside the map (rather than inside an OverlayView)
 * costs a re-render per frame while dragging — about a hundred SVG nodes,
 * which React reconciles well inside a frame — and buys the bubbles staying
 * testable arithmetic that does not import anything from Google.
 *
 * With no key, `loadGoogleMaps` resolves null: no basemap is built, the
 * fitted view stands, and the bubbles sit on the dark ground exactly as they
 * did when a tile CDN was unreachable. The numbers never depend on a map.
 */
function CoverageMap({ groups, hover, setHover }) {
  const wrapRef = useRef(null);
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [ready, setReady] = useState(false);
  // Where the live map is looking. Null until the map moves for the first
  // time — or forever, if there is no map.
  const [mapFrame, setMapFrame] = useState(null);
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
  // rebuilt every render, and refitting the view on each one would yank the
  // map out from under whoever is reading it.
  const coordsKey = located.map((g) => `${g.lat},${g.lng}`).join(';');
  const fitted = useMemo(
    () => (width ? fitView(located, width, mapH) : null),
    [width, mapH, coordsKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // The fit as of right now, for the map's first frame. Read through a ref
  // because the map is built inside a promise: without it the map opens on
  // the whole world and jumps to the city a tick later, which is a flash of
  // ocean on every visit to the screen.
  const fittedRef = useRef(null);
  fittedRef.current = fitted;

  // One map, built when the API arrives. Its container is sized by CSS, so
  // nothing here depends on the fit having been computed yet.
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then((maps) => {
      if (cancelled || !maps || !mapElRef.current || mapRef.current) return;
      const first = fittedRef.current;
      const map = new maps.Map(mapElRef.current, {
        center: first
          ? { lat: yToLat(first.y, first.z), lng: xToLng(first.x, first.z) }
          : { lat: 0, lng: 0 },
        zoom: first ? first.z : 2,
        styles: DARK_STYLE,
        backgroundColor: '#0d0a12',
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        // Without this the zoom control is Google's white plate, which on
        // this desk reads as a hole punched in the map.
        colorScheme: 'DARK',
        // The bubbles are the subject; Google's own POI pins would compete
        // with them for the same few pixels.
        maxZoom: 17,
        minZoom: 5,
      });
      mapRef.current = map;
      const sync = () => {
        const c = map.getCenter();
        const z = map.getZoom();
        const el = mapElRef.current;
        if (!c || z == null || !el) return;
        setMapFrame({
          z,
          left: lngToX(c.lng(), z) - el.clientWidth / 2,
          top: latToY(c.lat(), z) - el.clientHeight / 2,
        });
      };
      map.addListener('bounds_changed', sync);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Frame the map on the data. `fitted` is memoised, so this runs when the
  // districts or the viewport change — and once more when the map itself
  // becomes ready — but not while someone is panning.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitted) return;
    map.setZoom(fitted.z);
    map.setCenter({ lat: yToLat(fitted.y, fitted.z), lng: xToLng(fitted.x, fitted.z) });
  }, [fitted, ready]);

  // The map's own view wins once it has one; before that — and with no key
  // at all — the fitted view stands in, so the bubbles are never homeless.
  const frame = mapFrame
    ?? (fitted ? { z: fitted.z, left: fitted.x - width / 2, top: fitted.y - mapH / 2 } : null);

  let bubbles = [];
  if (frame && located.length) {
    const maxCount = Math.max(...located.map((g) => g.count));
    // Small bubbles drawn last so a big neighbour never swallows their hover.
    bubbles = [...located]
      .sort((a, b) => b.count - a.count)
      .map((g) => ({
        g,
        r: bubbleRadius(g.count, maxCount),
        x: lngToX(g.lng, frame.z) - frame.left,
        y: latToY(g.lat, frame.z) - frame.top,
      }));
  }

  return (
    <div className="covmap" ref={wrapRef} style={{ height: mapH }}>
      <div className="covbasemap" ref={mapElRef} />
      {frame && (
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
    </div>
  );
}

export default function Coverage() {
  const { cities, city: workspaceCity } = useCity();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [hover, setHover] = useState(null);


  useEffect(() => {
    let live = true;
    setError(null);
    api.coverage()
      .then((d) => { if (live) setRows(d); })
      .catch((err) => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [retryKey]);

  // Grouped off the rows, so a city added to the database appears here the
  // day its first place is published, without anyone editing a list.
  const perCity = useMemo(() => {
    if (!rows) return null;
    const m = {};
    for (const r of rows) (m[r.city_id] ??= []).push(r);
    return m;
  }, [rows]);

  /**
   * The city this map draws.
   *
   * The desk's workspace city, which is now the only city control on the
   * page — except for the one answer a map cannot draw. "All cities" is a
   * legitimate scope everywhere else and meaningless here, so it falls back
   * to whichever city has the most published places: the most useful thing
   * to be looking at when you have not said, and the caption says so rather
   * than letting the map imply a choice nobody made.
   *
   * A *named* city with nothing published is not a fallback case. It is an
   * answer — an empty map and "nothing published here yet" — and swapping
   * it for a busier city would make the page disagree with its own header.
   */
  const busiest = useMemo(() => {
    if (!perCity) return null;
    return Object.entries(perCity)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  }, [perCity]);
  const city = workspaceCity?.id ?? busiest;
  const fellBack = !workspaceCity && !!city;

  const cov = useMemo(
    () => (perCity && city ? buildCoverage(perCity[city] ?? []) : null),
    [perCity, city],
  );

  const longName = cities.find((c) => c.id === city)?.name_vi ?? city;
  const maxCount = cov?.groups[0]?.count ?? 0;

  return (
    <div className="coverage">
      <div className="contribhead">
        <div>
          <h2>Coverage</h2>
          <p className="addsub">
            Where the catalog actually is — published places per district, so thin
            quận stand out before users notice.
            {fellBack && (
              <>
                {' '}A map draws one city, so with the desk set to all cities this
                one shows <b className="contribem">{longName}</b>, the busiest.
              </>
            )}
          </p>
        </div>
        {/* The counts stay; the chips do not. They were a second city
            control disagreeing with the one at the top of the page — but
            what each city holds is this screen's subject, not its
            navigation, so it is read out instead. */}
        <div className="covcounts">
          {cities.map((c) => (
            <span key={c.id} className={c.id === city ? 'on' : ''}>
              {chipLabel(c)} <b>{perCity ? (perCity[c.id]?.length ?? 0) : '–'}</b>
            </span>
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
