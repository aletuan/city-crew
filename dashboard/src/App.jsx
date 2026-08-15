import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { api } from './api.js';
import { signOut } from './auth.jsx';

const ToastCtx = createContext(() => {});
const ProgressCtx = createContext({ progress: null, refresh: () => {} });
// City is a workspace mode (like the session), not a list filter: header links
// drop URL params, so it lives in context + localStorage instead of the URL.
const CityCtx = createContext({ cities: [], city: null, setCity: () => {} });
export const useToast = () => useContext(ToastCtx);
export const useProgress = () => useContext(ProgressCtx);
export const useCity = () => useContext(CityCtx);

const CITY_KEY = 'citycrew.dashboard.city';

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
  const city = cities.find((c) => c.id === cityId) ?? cities[0] ?? null;

  const refreshProgress = useCallback(() => {
    api.progress(cityId).then(setProgress).catch(() => {});
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
      const { published } = await api.publishApproved(cityId);
      showToast(published
        ? `Published ${published} approved place${published === 1 ? '' : 's'} in ${city?.name_en ?? cityId}`
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
              {/* Scope switcher — everything below the bar is filtered to it.
                  It sits beside the title rather than inside the heading: a
                  form control nested in an <h1> reads as part of the heading
                  to a screen reader. */}
              <select
                className="cityselect"
                value={city?.id ?? 'hcmc'}
                onChange={(e) => setCity(e.target.value)}
                aria-label="City"
              >
                {(cities.length ? cities : [{ id: 'hcmc', name_en: 'Ho Chi Minh City' }]).map((c) => (
                  <option key={c.id} value={c.id}>{c.name_en}</option>
                ))}
              </select>
              <div className="spacer" />
              {/* One visible action, and it is the one every editing
                  session starts with. Everything else in this bar was a
                  different kind of thing wearing the same pill —
                  navigation, a bulk write, an account control — so the
                  bar could not say which of them mattered. They are
                  sorted now: destinations and occasional actions into the
                  menu, the bulk write down beside the number it changes.

                  The label hides under 640px, leaving the ＋ alone. The
                  glyph is the whole meaning of the button; the words were
                  what made this row wrap onto a second line on a phone. */}
              <Link className="syncbtn addbtn primary" to="/add">
                <span aria-hidden="true">＋</span>
                <span className="btnlabel">Add place</span>
              </Link>
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
                {location.pathname === '/' && <h2 className="pagetitle">Places</h2>}
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
