import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
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
  const [toast, setToast] = useState(null);
  const [progress, setProgress] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [cities, setCities] = useState([]);
  const [cityId, setCityId] = useState(() => localStorage.getItem(CITY_KEY) ?? 'hcmc');

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

  return (
    <ToastCtx.Provider value={showToast}>
      <ProgressCtx.Provider value={{ progress, refresh: refreshProgress }}>
        <CityCtx.Provider value={{ cities, city, setCity }}>
          <div className="shell">
            <header className="topbar">
              <Link to="/" aria-label="All places">
                <img className="logo" src="logo.png" alt="cityCrew" />
              </Link>
              <h1>
                Data desk
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
              </h1>
              <div className="spacer" />
              {total > 0 && (
                <div className="rail" title={`${approved} approved · ${flagged} flagged · ${total - approved - flagged} pending`}>
                  <div className="counts">
                    <span><b>{approved}</b>/{total} approved</span>
                    {flagged > 0 && <span style={{ color: 'var(--bad)' }}>{flagged} flagged</span>}
                  </div>
                  <div className="track">
                    <div className="fill" style={{ width: `${(approved / total) * 100}%` }} />
                    <div className="flagged" style={{ width: `${(flagged / total) * 100}%` }} />
                  </div>
                </div>
              )}
              {/* Served next to the dashboard by the Pages deploy (dist/mockup.html) */}
              <a className="syncbtn addbtn" href="mockup.html" target="_blank" rel="noreferrer">Mockup ↗</a>
              <Link className="syncbtn addbtn" to="/add">＋ Add place</Link>
              <Link className="syncbtn addbtn" to="/scan">Scan city</Link>
              <button className="syncbtn" onClick={publishApproved} disabled={publishing}>
                {publishing ? 'Publishing…' : 'Publish approved'}
              </button>
              <button className="syncbtn" onClick={runSync} disabled={syncing}>
                {syncing ? 'Syncing…' : 'Sync mockup'}
              </button>
              <button className="signout" onClick={signOut} title="Sign out" aria-label="Sign out">⎋</button>
            </header>
            <Outlet />
            {toast && <div className="toast" role="status">{toast}</div>}
          </div>
        </CityCtx.Provider>
      </ProgressCtx.Provider>
    </ToastCtx.Provider>
  );
}
