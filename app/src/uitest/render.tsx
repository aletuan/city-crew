// What the UI tests import instead of Testing Library directly.
//
// `@testing-library/react` rather than the React Native testing library,
// because the tree being rendered is `react-native-web`'s — real DOM in
// jsdom — and the DOM library is the one that speaks about it accurately.
// Queries are by accessible name and by text, which is what a reader
// actually has to find on the screen.
//
// The only thing added is the cleanup below, which is the reason this file
// exists rather than every test importing the library itself.

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

export * from '@testing-library/react';

// Testing Library registers this itself only when Vitest's globals are on,
// and they are not: this suite is 1,200 tests of plain functions that have
// no use for a global `expect`. Without it every render is left in the
// document and the second test in a file finds two of everything.
afterEach(cleanup);
