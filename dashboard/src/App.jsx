import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { api } from './api.js';
import { signOut } from './auth.jsx';
import { CategoryIcon } from './icons.jsx';

const ToastCtx = createContext(() => {});
const ProgressCtx = createContext({ progress: null, refresh: () => {} });
// City is a workspace mode (like the session), not a list filter: header links
// drop URL params, so it lives in context + localStorage instead of the URL.
const CityCtx = createContext({ cities: [], city: null, setCity: () => {} });
export const useToast = () => useContext(ToastCtx);
export const useProgress = () => useContext(ProgressCtx);
export const useCity = () => useContext(CityCtx);

const CITY_KEY = 'citycrew.dashboard.city';
// The stored value for "no city filter". `city` in context is null then —
// every query that keys off city?.id simply drops its filter, which is what
// "aggregate across all cities" means everywhere the desk counts anything.
const ALL = 'all';

const UNFILED_SHOWN = 6;

// The chip spelling for each city — the desk's own abbreviations, matching
// the analytics screens.
const CHIP_LABEL = { hcmc: 'TP.HCM', hanoi: 'Hà Nội', danang: 'Đà Nẵng' };
const chipLabel = (c) => CHIP_LABEL[c.id] ?? c.short_vi ?? c.id;

/**
 * For the screens that cannot mean anything across all cities at once —
 * importing a place, scanning, editing a hero. With "All cities" selected
 * they would otherwise have to invent a scope; instead they ask, and the
 * answer sets the workspace city the whole desk then follows.
 */
export function CityGate({ children }) {
  const { cities, city, setCity } = useCity();
  if (city) return children;
  return (
    <div className="panel citygate">
      <h3>One city at a time</h3>
      <p>This screen works on a single city. Pick one — the whole desk follows.</p>
      <div className="cityswitch">
        {cities.map((c) => (
          <button key={c.id} className="chip" onClick={() => setCity(c.id)}>
            {chipLabel(c)}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The places nobody has filed yet, behind the bell that counts them.
 *
 * Categories and vibes are the two fields Google cannot supply and the app
 * leans on hardest — Explore filters by one, the cards wear the other. A
 * place with neither is in the catalog and reachable from nowhere.
 *
 * It needs saying here because the filter row cannot say it: every chip
 * counts places that *have* a tag, so a place with none is missing from
 * all of them. The screen for finding things is the one screen these do
 * not appear in.
 *
 * A panel rather than the banner this replaces, and the difference is not
 * decoration: the banner could only ever report a number, so the next move
 * was always "filter the list and go looking". This names the places and
 * puts the way in beside each one, which is the whole job.
 *
 * The bell is absent at zero rather than empty. A control that is always
 * there says nothing by being there, and its absence is the signal that
 * nothing is waiting — the same rule the publish button follows.
 *
 * No dismiss, for the same reason it never had one: a way to silence it
 * without fixing it turns one signal into something people learn to click
 * past.
 */
function UnfiledBell({ places }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const n = places?.length ?? 0;
  if (!n) return null;
  const shown = places.slice(0, UNFILED_SHOWN);
  const rest = n - shown.length;

  return (
    <div className="moremenu" ref={ref}>
      <button
        className="syncbtn bell"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${n} place${n === 1 ? '' : 's'} missing categories or vibes`}
      >
        <CategoryIcon name="bell" color="var(--warn)" />
        <span className="bellcount">{n}</span>
      </button>
      {open && (
        <div className="notifypanel" role="dialog" aria-label="Missing categories or vibes">
          <div className="notifyhead">
            <CategoryIcon name="alert" color="var(--warn)" />
            <b>{n} place{n === 1 ? '' : 's'} missing categories or vibes</b>
          </div>
          {/* What it costs, in the reader's terms rather than the schema's.
              "needs_classification" is true and useless; this is why they
              should care. */}
          <p className="notifywhy">
            These only show under “All” in Explore and never match a filter chip.
          </p>
          {shown.map((p) => (
            <div className="notifyrow" key={p.slug}>
              <div className="notifyname">
                <div className="notifytitle">{p.name}</div>
                <div className="notifymeta">
                  {[
                    p.status,
                    p.no_category && 'no categories',
                    p.no_vibe && 'no vibes',
                  ].filter(Boolean).join(' · ')}
                </div>
              </div>
              <Link className="fixbtn" to={`/place/${p.slug}`} onClick={() => setOpen(false)}>
                Fix
              </Link>
            </div>
          ))}
          {rest > 0 && (
            // Past the cap the panel stops being a panel. The filter is
            // the right tool for thirty of them, and it is one press away.
            <Link className="notifymore" to="/?needs=1" onClick={() => setOpen(false)}>
              {rest} more →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const [toast, setToast] = useState(null);
  const [progress, setProgress] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [cities, setCities] = useState([]);
  const [cityId, setCityId] = useState(() => localStorage.getItem(CITY_KEY) ?? 'hcmc');
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  // Close the overflow menu on outside click or Escape — same contract as
  // any native menu, so it doesn't strand itself open over the page.
  useEffect(() => {
    if (!moreOpen) return;
    const onDocClick = (e) => { if (!moreRef.current?.contains(e.target)) setMoreOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    api.cities().then(setCities).catch(() => {});
  }, []);

  const setCity = useCallback((id) => {
    localStorage.setItem(CITY_KEY, id);
    setCityId(id);
  }, []);
  // null means "all cities" — deliberately, so every consumer that passes
  // city?.id to the api drops its filter instead of inventing a scope.
  const city = cityId === ALL
    ? null
    : cities.find((c) => c.id === cityId) ?? cities[0] ?? null;

  const refreshProgress = useCallback(() => {
    api.progress(cityId === ALL ? undefined : cityId).then(setProgress).catch(() => {});
  }, [cityId]);
  useEffect(refreshProgress, [refreshProgress]);

  const runSync = async () => {
    setSyncing(true);
    try {
      await api.sync();
      showToast('Mockup synced from database');
    } catch (err) {
      showToast(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const publishApproved = async () => {
    setPublishing(true);
    try {
      const { published } = await api.publishApproved(cityId === ALL ? undefined : cityId);
      showToast(published
        ? `Published ${published} approved place${published === 1 ? '' : 's'} in ${city?.name_en ?? 'all cities'}`
        : 'Nothing new to publish — all approved places are already live');
      refreshProgress();
    } catch (err) {
      showToast(`Publish failed: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  const approved = progress?.by_status?.approved ?? 0;
  const flagged = progress?.by_status?.flagged ?? 0;
  const total = progress?.total ?? 0;
  // Approved and still invisible. Both the line and the button vanish at
  // zero, which makes their absence the signal that nothing is waiting —
  // a button that is always there says nothing by being there.
  const unpublished = progress?.unpublished ?? 0;

  return (
    <ToastCtx.Provider value={showToast}>
      <ProgressCtx.Provider value={{ progress, refresh: refreshProgress }}>
        <CityCtx.Provider value={{ cities, city, setCity }}>
          <header className="topbar">
            <div className="topbar-inner">
              <Link to="/" aria-label="All places">
                <img className="logo" src="logo.png" alt="cityCrew" />
              </Link>
              <h1>Data desk</h1>
              {/* The scope switcher used to sit here as a <select>. It moved
                  down beside the page title as a chip row (see .pagehead):
                  chips can say "All cities", which a workspace pill never
                  could, and the bar keeps to actions and destinations. */}
              <div className="spacer" />
              {/* One visible action, and it is the one every editing
                  session starts with. Everything else in this bar was a
                  different kind of thing wearing the same pill —
                  navigation, a bulk write, an account control — so the
                  bar could not say which of them mattered. They are
                  sorted now: destinations and occasional actions into the
                  menu, the bulk write down beside the number it changes.

                  Labelled at every width, phones included — a ＋ on its own
                  is a shape you have to press to find out about. It was
                  hidden on phones for room the pill next to it was hoarding;
                  see the phone block in theme.css. */}
              <Link className="syncbtn addbtn primary" to="/add">
                <span aria-hidden="true">＋</span>
                <span className="btnlabel">Add<span className="btnlabel-more"> place</span></span>
              </Link>
              <UnfiledBell places={progress?.unclassified} />
              <div className="moremenu" ref={moreRef}>
                <button
                  className="syncbtn kebab"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-haspopup="true"
                  aria-expanded={moreOpen}
                  aria-label="Menu"
                >
                  ⋯
                </button>
                {moreOpen && (
                  <div className="moremenu-panel" role="menu">
                    {/* Where you can go, then what you can run, then who
                        you are — the order they are asked for, and the
                        separators are what keep the last one from being
                        pressed by accident on the way past. */}
                    <Link className="moremenu-item" to="/city" role="menuitem" onClick={() => setMoreOpen(false)}>City hero</Link>
                    <Link className="moremenu-item" to="/scan" role="menuitem" onClick={() => setMoreOpen(false)}>Scan city</Link>
                    <Link className="moremenu-item" to="/analytics/contributors" role="menuitem" onClick={() => setMoreOpen(false)}>Contributors</Link>
                    <Link className="moremenu-item" to="/analytics/coverage" role="menuitem" onClick={() => setMoreOpen(false)}>Coverage</Link>
                    <div className="moremenu-sep" />
                    {/* Served next to the dashboard by the Pages deploy (dist/mockup.html) */}
                    <a className="moremenu-item" href="mockup.html" target="_blank" rel="noreferrer" role="menuitem">Mockup ↗</a>
                    <button
                      className="moremenu-item"
                      role="menuitem"
                      disabled={syncing}
                      onClick={() => { setMoreOpen(false); runSync(); }}
                    >
                      {syncing ? 'Syncing…' : 'Sync mockup'}
                    </button>
                    <div className="moremenu-sep" />
                    <button className="moremenu-item" role="menuitem" onClick={signOut}>Sign out</button>
                  </div>
                )}
              </div>
            </div>
          </header>
          <div className="shell">
            {(location.pathname === '/' || total > 0) && (
              <div className="pagehead">
                {location.pathname === '/' && (
                  <div className="pagehead-scope">
                    <h2 className="pagetitle">Places</h2>
                    {/* The workspace scope, where the work is: a chip row
                        beside the title, with the one option the old top-bar
                        pill could not offer — no filter at all. */}
                    <div className="cityswitch" role="group" aria-label="City">
                      <button
                        className={`chip${city ? '' : ' on'}`}
                        onClick={() => setCity(ALL)}
                      >
                        All cities
                      </button>
                      {(cities.length ? cities : [{ id: 'hcmc' }]).map((c) => (
                        <button
                          key={c.id}
                          className={`chip${city?.id === c.id ? ' on' : ''}`}
                          onClick={() => setCity(c.id)}
                        >
                          {chipLabel(c)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {total > 0 && (
                  <div className="rail" title={`${approved} approved · ${flagged} flagged · ${total - approved - flagged} pending`}>
                    <div className="counts">
                      <span><b>{approved}</b>/{total} approved</span>
                      {flagged > 0 && <span style={{ color: 'var(--bad)' }}>{flagged} flagged</span>}
                      {unpublished > 0 && <span style={{ color: 'var(--warn)' }}>{unpublished} not public</span>}
                    </div>
                    <div className="track">
                      <div className="fill" style={{ width: `${(approved / total) * 100}%` }} />
                      <div className="flagged" style={{ width: `${(flagged / total) * 100}%` }} />
                    </div>
                    {/* Here rather than in the header, because this is the
                        number it changes. Pressed from the top bar, the
                        only evidence it had worked was a stamp in a row
                        somewhere below — which is how a published place
                        and a hidden one came to look identical to the
                        person who had just published it. */}
                    {unpublished > 0 && (
                      <button className="publishbtn" onClick={publishApproved} disabled={publishing}>
                        {publishing ? 'Publishing…' : `Publish ${unpublished}`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <Outlet />
            {toast && <div className="toast" role="status">{toast}</div>}
          </div>
        </CityCtx.Provider>
      </ProgressCtx.Provider>
    </ToastCtx.Provider>
  );
}
