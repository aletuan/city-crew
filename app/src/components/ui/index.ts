// Shared UI atoms — the City Crew design system in React Native.
//
// One file of 1,287 lines until 19 Oct 2026, holding five concerns every
// screen imports: the tab bar's geometry, haptics, motion, the controls
// and the surfaces. The SOLID review split it by concern (S); this index
// re-exports every name, so `import … from '../components/ui'` is
// unchanged at every call site.

export * from './layout';
export * from './haptics';
export * from './motion';
export * from './controls';
export * from './surfaces';
