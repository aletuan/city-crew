import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { api } from './api.js';
import { DAYS } from './contributors.js';
import { signOut } from './auth.jsx';
import { CategoryIcon } from './icons.jsx';
import { newCount } from './reports.js';

const ToastCtx = createContext(() => {});
const ProgressCtx = createContext({ progress: null, refresh: () => {} });
// City is a workspace mode (like the session), not a list filter: header links
// drop URL params, so it lives in context + localStorage instead of the URL.
const CityCtx = createContext({ cities: [], city: null, setCity: () => {} });
export const useToast = () => useContext(ToastCtx);
export const useProgress = () => useContext(ProgressCtx);
export const useCity = () => useContext(CityCtx);

const CITY_KEY = 'citycrew.dashboard.city';

/* The screens whose content is scoped by the workspace city, and so the
   ones that show the control for it. Contributors and Coverage each had a
   chip row of their own until the three disagreed: the city was in
   localStorage here and in a `?city=` param there, so picking Hà Nội on
   Places and walking to Contributors showed all cities, under a page head
   that was still counting Hà Nội. */
// The stored value for "no city filter". `city` in context is null then —
// every query that keys off city?.id simply drops its filter, which is what
// "aggregate across all cities" means everywhere the desk counts anything.
const ALL = 'all';
/* Exported for the Places rail, which offers the same "no city filter"
   answer as a row in its City group rather than as a menu option. */
export const ALL_CITIES = ALL;

const UNFILED_SHOWN = 6;

/* What each room calls itself, and the sentence saying what it is for.
   It used to live here for Places and inside the component for the other
   two, which is why only Places had its name on the line with the counts
   and the actions — the analytics screens started theirs a whole band
   lower, under a head that named nothing.

   The subtitles are static; anything a screen has to say that depends on
   its own data (which city it fell back to, how the ranking is scoped)
   stays with the screen, under this. */
const PAGE_HEAD = {
  '/': {
    title: 'Places',
    sub: 'Discover, review and manage places for City Crew.',
  },
  '/analytics/contributors': {
    title: 'Contributors',
    sub: (
      <>
        Places added from the app that made it to <b className="contribem">approved</b>
        {' · '}<b className="contribem">published</b> — cumulative, last {DAYS} days.
      </>
    ),
  },
  '/analytics/coverage': {
    title: 'Coverage',
    sub: 'Where the catalog actually is — published places per district, so thin quận stand out before users notice.',
  },
};

// The chip spelling for each city — the desk's own abbreviations, matching
// the analytics screens.
const CHIP_LABEL = { hcmc: 'TP.HCM', hanoi: 'Hà Nội', danang: 'Đà Nẵng' };
// Exported for screens that draw their own city chips (City hero), so the
// desk abbreviates a city the same way everywhere.
export const chipLabel = (c) => CHIP_LABEL[c.id] ?? c.short_vi ?? c.id;

// NavLink hands us isActive; the class name is all we do with it.
const navCls = ({ isActive }) => `side-item${isActive ? ' active' : ''}`;
const tabCls = ({ isActive }) => `tab-item${isActive ? ' active' : ''}`;

/**
 * For the screens that cannot mean anything across all cities at once —
 * importing a place, scanning, editing a hero. With "All cities" selected
 * they would otherwise have to invent a scope; instead they ask, and the
 * answer sets the workspace city the whole desk then follows.
 */
/**
 * The workspace scope, as one control.
 *
 * It was a row of chips: one press instead of two, which is the right
 * trade while the row is short. It is not going to stay short — the
 * catalog has picked up Vũng Tàu, Hải Phòng and Melbourne since the chips
 * were written, and nine of them already wrap and eat a full page-head
 * row on the way to eating two. A menu costs the second press and then
 * stops costing anything as the list grows.
 *
 * One component rather than a copy per screen, because the abbreviation,
 * the "All cities" option and the empty-list fallback were three things
 * that had to agree and were written out three times.
 *
 * No label of its own: it sits on the line the screen's other controls
 * are already on, and a caption over it would push it off that line and
 * make the column it sits in top-heavy. The options name cities, which is
 * the only thing it could say.
 */
export function CityPicker({ allowAll = true }) {
  const { cities, city, setCity } = useCity();
  const list = cities.length ? cities : [{ id: 'hcmc' }];
  return (
    <select
      className="cityselect"
      aria-label="City"
      value={city?.id ?? ALL}
      onChange={(e) => setCity(e.target.value)}
    >
      {allowAll && <option value={ALL}>All cities</option>}
      {list.map((c) => <option key={c.id} value={c.id}>{chipLabel(c)}</option>)}
    </select>
  );
}

export function CityGate({ children }) {
  const { cities, city, setCity } = useCity();
  if (city) return children;
  return (
    <div className="panel citygate">
      <h3>One city at a time</h3>
      <p>This screen works on a single city. Pick one — the whole desk follows.</p>
      {/* The same menu as everywhere else, without "All cities" — that
          is the answer this screen cannot take, which is why it is here. */}
      <select
        className="cityselect"
        aria-label="City"
        defaultValue=""
        onChange={(e) => setCity(e.target.value)}
      >
        <option value="" disabled>Choose a city…</option>
        {cities.map((c) => (
          <option key={c.id} value={c.id}>{chipLabel(c)}</option>
        ))}
      </select>
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
  // The phone tab bar's "More" sheet. Escape closes it; so does going
  // anywhere — a sheet that outlives the navigation it caused is debris.
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => setSheetOpen(false), [location.pathname]);

  // How many reports are still unanswered, carried on the nav rather
  // than on the page they belong to — a queue with a day's deadline is
  // no use behind a link nobody has a reason to press. Re-read on every
  // navigation: it is one small call, and a count that only updates on
  // reload is a count that lies for the length of a session.
  const [waitingReports, setWaitingReports] = useState(0);
  useEffect(() => {
    let alive = true;
    api.reports()
      .then((rows) => { if (alive) setWaitingReports(newCount(rows)); })
      // Silent: an editor who cannot read the queue (or a database that
      // predates it) should get a desk that works, not an error about a
      // badge.
      .catch(() => {});
    return () => { alive = false; };
  }, [location.pathname]);
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setSheetOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  /**
   * The top bar's own height, published for anything that sticks below it.
   *
   * The Places toolbar is the caller: it sticks under this bar, and the
   * offset cannot be a constant. `.topbar-inner` wraps to a second row at
   * the widths where its controls stop fitting on one — which is exactly
   * the range where a hardcoded number would leave a slit of scrolling
   * rows showing above the toolbar, or hide the toolbar's own top edge.
   * Measured at mount and again whenever the bar changes size.
   */
  const topbarRef = useRef(null);
  useEffect(() => {
    const el = topbarRef.current;
    if (!el) return undefined;
    const publish = () =>
      document.documentElement.style.setProperty('--topbar-h', `${el.offsetHeight}px`);
    publish();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The bar ducks while you read and returns the moment you reach back —
  // scrolling down is "I'm looking at content", up is "I'm going somewhere".
  //
  // Hysteresis, not a single threshold. The first cut compared each event
  // against a mark that only moved past 6px — so a slow scroll, or iOS's
  // rubber-band handing back alternating deltas, crossed that stale mark in
  // both directions and strobed the bar mid-transition. Now the mark moves
  // every frame and *travel* accumulates per direction, resetting when the
  // direction flips: hiding takes 24px of committed descent, returning
  // takes 12px of ascent — going away should need more conviction than
  // coming back. Overscroll is clamped out at both ends so a bounce is not
  // a direction. The top always shows it; navigation resets it.
  const [barHidden, setBarHidden] = useState(false);
  useEffect(() => setBarHidden(false), [location.pathname]);
  useEffect(() => {
    let lastY = Math.max(0, window.scrollY);
    let travel = 0;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const y = Math.min(Math.max(0, window.scrollY), Math.max(0, max));
        const dy = y - lastY;
        lastY = y;
        if (dy === 0) return;
        travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
        if (y <= 80 || travel < -12) setBarHidden(false);
        else if (travel > 24) setBarHidden(true);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
  const pending = progress?.by_status?.pending ?? 0;

  /**
   * Where a status tile points.
   *
   * A tile is a door into a queue, so it leads to the list — from the
   * editor, from Reports, from wherever the rail happens to be showing.
   * It keeps the filters already in the URL rather than replacing them,
   * because "pending" is a narrowing of the question being asked, not a
   * new one; and it drops the page, because page four of the old answer
   * is not page four of the new one. Pressing the tile that is already on
   * turns it off, the way the chips in the rail do.
   */
  const [params] = useSearchParams();
  const status = params.get('status');
  const statTo = (next) => {
    const q = new URLSearchParams(params);
    if (next && q.get('status') !== next) q.set('status', next);
    else q.delete('status');
    q.delete('page');
    const search = q.toString();
    return { pathname: '/', search: search ? `?${search}` : '' };
  };

  return (
    <ToastCtx.Provider value={showToast}>
      <ProgressCtx.Provider value={{ progress, refresh: refreshProgress }}>
        <CityCtx.Provider value={{ cities, city, setCity }}>
          <div className="desk">
            {/* Destinations live here, visible, with the one thing the old
                overflow menu could never say: where you already are. Order
                is frequency — the daily list, the two measuring rooms, then
                the occasional tools — and the utilities sit at the bottom
                with sign-out behind its own separator, same as the menu
                this replaces. Hidden on phones; the tab bar takes over. */}
            <aside className="sidebar">
              <Link className="sidebrand" to="/" aria-label="All places">
                <img className="logo" src="logo.png" alt="" />
                <span>Data desk</span>
              </Link>
              <nav className="sidenav" aria-label="Main">
                <NavLink end to="/" className={navCls}><CategoryIcon name="pin" size={17} />Places</NavLink>
                <NavLink to="/analytics/contributors" className={navCls}><CategoryIcon name="users" size={17} />Contributors</NavLink>
                <NavLink to="/analytics/coverage" className={navCls}><CategoryIcon name="donut" size={17} />Coverage</NavLink>
                <div className="side-sep" />
                <NavLink to="/city" className={navCls}><CategoryIcon name="photo" size={17} />City hero</NavLink>
                <NavLink to="/scan" className={navCls}><CategoryIcon name="radar" size={17} />Scan city</NavLink>
                <NavLink to="/search-words" className={navCls}><CategoryIcon name="search" size={17} />Search words</NavLink>
                {/* The count is the feature, not the link: a queue with a
                    day's deadline has to say so from wherever the desk
                    happens to be standing. */}
                <NavLink to="/reports" className={navCls}>
                  <CategoryIcon name="alert" size={17} />Reports
                  {waitingReports > 0 ? <span className="navcount">{waitingReports}</span> : null}
                </NavLink>
              </nav>
              <div className="side-foot">
                {/* Served next to the dashboard by the Pages deploy (dist/mockup.html) */}
                <a className="side-item" href="mockup.html" target="_blank" rel="noreferrer">
                  <CategoryIcon name="external" size={17} />Mockup
                </a>
                <button className="side-item" disabled={syncing} onClick={runSync}>
                  <CategoryIcon name="refresh" size={17} />{syncing ? 'Syncing…' : 'Sync mockup'}
                </button>
                <div className="side-sep" />
                <button className="side-item" onClick={signOut}>
                  <CategoryIcon name="signout" size={17} />Sign out
                </button>
              </div>
            </aside>

            <div className="deskmain">
              {/* The phone's bar, and only the phone's: the desk hides it
                  above 960px, where the same two actions sit in the page
                  head beside the title. It stays here below that width
                  because it is sticky and the page head is not, and the
                  tab bar along the bottom carries navigation, not Add.
                  Hiding it also zeroes --topbar-h, which is measured from
                  this element, so the sticky offsets below collapse to the
                  viewport top on their own. */}
              <header className="topbar" ref={topbarRef}>
                <div className="topbar-inner">
                  {/* The brand belongs to the sidebar now; phones, which
                      have no sidebar, keep the logo here as the way home. */}
                  <Link className="mobilebrand" to="/" aria-label="All places">
                    <img className="logo" src="logo.png" alt="City Crew" />
                  </Link>
                  <div className="spacer" />
                  {/* Actions only — the one every session starts with, and
                      the one warning worth a badge. Navigation moved out. */}
                  <Link className="syncbtn addbtn primary" to="/add">
                    <span aria-hidden="true">＋</span>
                    <span className="btnlabel">Add<span className="btnlabel-more"> place</span></span>
                  </Link>
                  <UnfiledBell places={progress?.unclassified} />
                </div>
              </header>
              <div className="shell">
            {/* One row, the way the reference draws it: what the screen is,
                the four numbers it works from, and the actions — instead of
                a title on the left, a boxed rail of tiles on the right, and
                an almost empty bar above both holding one button.

                It always renders. The actions live here now, so a route
                that happens to have no title and no counts still needs the
                row they sit in. */}
            <div className="pagehead">
              <div className="pagehead-top">
{/* Every room that has a name says it here, on the line with the
                    counts and the actions — not just Places. */}
                {PAGE_HEAD[location.pathname] && (
                  <div className="pagetitles">
                    <h2 className="pagetitle">{PAGE_HEAD[location.pathname].title}</h2>
                    <p className="pagesub">{PAGE_HEAD[location.pathname].sub}</p>
                  </div>
                )}
                {total > 0 && (
                  /* The four numbers the desk works from, and each one is
                     the way into the work it counts. Bare, not boxed: four
                     filled tiles beside a title read as a second toolbar
                     competing with it, where the number alone is the thing
                     being read. What they lose in edge they take back in
                     size, and the selected one wears an underline.

                     The progress track and its "n/m approved" note went
                     with the boxes. Both said what the Approved tile now
                     says two inches to the left, and a bar that only ever
                     repeats its neighbour is decoration. */
                  <div className="stats" role="group" aria-label="Filter by review status">
                    <Link className={`stat${status ? '' : ' on'}`} to={statTo(null)}>
                      <b>{total}</b><span>places</span>
                    </Link>
                    <Link
                      className={`stat${approved ? ' approved' : ''}${status === 'approved' ? ' on' : ''}`}
                      to={statTo('approved')}
                    >
                      <b>{approved}</b><span>approved</span>
                    </Link>
                    {/* A queue with something in it wears its colour; an
                        empty one is not news and stays quiet. */}
                    <Link
                      className={`stat${pending ? ' pending' : ''}${status === 'pending' ? ' on' : ''}`}
                      to={statTo('pending')}
                    >
                      <b>{pending}</b><span>pending</span>
                    </Link>
                    <Link
                      className={`stat${flagged ? ' flagged' : ''}${status === 'flagged' ? ' on' : ''}`}
                      to={statTo('flagged')}
                    >
                      <b>{flagged}</b><span>flagged</span>
                    </Link>
                  </div>
                )}
                {/* The desk's actions, at the end of the row that names the
                    screen. The phone keeps its own copy in the top bar —
                    both are in the markup and CSS shows one, the way the
                    city chips and the city menu already work — because the
                    bar is sticky there and this row is not, and the tab bar
                    along the bottom has no Add of its own. */}
                <div className="pagehead-actions">
                  {/* Here rather than in the header, because this is the
                      number it changes. Pressed from the top bar, the only
                      evidence it had worked was a stamp in a row somewhere
                      below — which is how a published place and a hidden
                      one came to look identical to the person who had just
                      published it. */}
                  {unpublished > 0 && (
                    <button className="publishbtn" onClick={publishApproved} disabled={publishing}>
                      {publishing ? 'Publishing…' : `Publish ${unpublished}`}
                    </button>
                  )}
                  <Link className="syncbtn addbtn primary" to="/add">
                    <span aria-hidden="true">＋</span>
                    <span className="btnlabel">Add place</span>
                  </Link>
                  <UnfiledBell places={progress?.unclassified} />
                </div>
              </div>
            </div>
                <Outlet />
                {toast && <div className="toast" role="status">{toast}</div>}
              </div>
            </div>
          </div>

          {/* Phones: the three daily destinations one thumb-tap away, and a
              More sheet for the rest — visible beats hidden, and the burger
              this could have been hides exactly the screens people forget.
              Icon-first, the social-app grammar: no captions, and the tab
              you are on wears a pill wash instead of a tinted label. The
              names still exist — for screen readers and long-press. */}
          <nav className={`tabbar${barHidden && !sheetOpen ? ' ducked' : ''}`} aria-label="Main">
            <NavLink end to="/" className={tabCls} aria-label="Places" title="Places">
              <span className="tabpill"><CategoryIcon name="pin" size={22} /></span>
            </NavLink>
            <NavLink to="/analytics/contributors" className={tabCls} aria-label="Contributors" title="Contributors">
              <span className="tabpill"><CategoryIcon name="users" size={22} /></span>
            </NavLink>
            <NavLink to="/analytics/coverage" className={tabCls} aria-label="Coverage" title="Coverage">
              <span className="tabpill"><CategoryIcon name="donut" size={22} /></span>
            </NavLink>
            <button
              className={`tab-item${sheetOpen ? ' active' : ''}`}
              onClick={() => setSheetOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={sheetOpen}
              aria-label="More"
              title="More"
            >
              <span className="tabpill"><CategoryIcon name="dots" size={22} /></span>
            </button>
          </nav>
          {sheetOpen && (
            <>
              <div className="sheetback" onClick={() => setSheetOpen(false)} />
              <div className="sheet" role="menu" aria-label="More">
                <Link className="moremenu-item" to="/city" role="menuitem">City hero</Link>
                <Link className="moremenu-item" to="/scan" role="menuitem">Scan city</Link>
                <Link className="moremenu-item" to="/search-words" role="menuitem">Search words</Link>
                <Link className="moremenu-item" to="/reports" role="menuitem">
                  Reports{waitingReports > 0 ? ` · ${waitingReports}` : ''}
                </Link>
                <div className="moremenu-sep" />
                <a className="moremenu-item" href="mockup.html" target="_blank" rel="noreferrer" role="menuitem">Mockup ↗</a>
                <button
                  className="moremenu-item"
                  role="menuitem"
                  disabled={syncing}
                  onClick={() => { setSheetOpen(false); runSync(); }}
                >
                  {syncing ? 'Syncing…' : 'Sync mockup'}
                </button>
                <div className="moremenu-sep" />
                <button className="moremenu-item" role="menuitem" onClick={signOut}>Sign out</button>
              </div>
            </>
          )}
        </CityCtx.Provider>
      </ProgressCtx.Provider>
    </ToastCtx.Provider>
  );
}
