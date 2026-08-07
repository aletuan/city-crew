import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { api } from './api.js';
import { signOut } from './auth.jsx';

const ToastCtx = createContext(() => {});
const ProgressCtx = createContext({ progress: null, refresh: () => {} });
export const useToast = () => useContext(ToastCtx);
export const useProgress = () => useContext(ProgressCtx);

export default function App() {
  const [toast, setToast] = useState(null);
  const [progress, setProgress] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(null), 2600);
  }, []);

  const refreshProgress = useCallback(() => {
    api.progress().then(setProgress).catch(() => {});
  }, []);
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

  const approved = progress?.by_status?.approved ?? 0;
  const flagged = progress?.by_status?.flagged ?? 0;
  const total = progress?.total ?? 0;

  return (
    <ToastCtx.Provider value={showToast}>
      <ProgressCtx.Provider value={{ progress, refresh: refreshProgress }}>
        <div className="shell">
          <header className="topbar">
            <Link to="/" aria-label="All places">
              <img className="logo" src="logo.png" alt="cityCrew" />
            </Link>
            <h1>
              Data desk <span>· Ho Chi Minh City</span>
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
            <button className="syncbtn" onClick={runSync} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync mockup'}
            </button>
            <button className="signout" onClick={signOut} title="Sign out" aria-label="Sign out">⎋</button>
          </header>
          <Outlet />
          {toast && <div className="toast" role="status">{toast}</div>}
        </div>
      </ProgressCtx.Provider>
    </ToastCtx.Provider>
  );
}
