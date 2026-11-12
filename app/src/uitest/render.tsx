// What the UI tests import instead of Testing Library directly.
//
// `@testing-library/react` rather than the React Native testing library,
// because the tree being rendered is `react-native-web`'s — real DOM in
// jsdom — and the DOM library is the one that speaks about it accurately.
// Queries are by accessible name and by text, which is what a reader
// actually has to find on the screen.
//
// What is added is the cleanup below, which is the reason this file
// exists rather than every test importing the library itself, and one
// reader jsdom cannot stand in for (`fontSizeOf`).

import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

export * from '@testing-library/react';

// Testing Library registers this itself only when Vitest's globals are on,
// and they are not: this suite is 1,200 tests of plain functions that have
// no use for a global `expect`. Without it every render is left in the
// document and the second test in a file finds two of everything.
afterEach(cleanup);

/**
 * The text style a Text was given, flattened, read off the props of the
 * nearest element that set a font size: jsdom resolves react-native-web's
 * font classes to its own default, so the computed style says 14 and 400
 * whatever was asked for.
 */
export function textStyleOf(el: HTMLElement): TextStyle | undefined {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'))!;
  type Fiber = { memoizedProps?: { style?: unknown }; return?: Fiber };
  const style = (x: Fiber) => StyleSheet.flatten(x.memoizedProps?.style as StyleProp<TextStyle>) ?? {};
  let f: Fiber | undefined = (el as unknown as Record<string, Fiber>)[key];
  while (f && style(f).fontSize == null) f = f.return;
  return f && style(f);
}

/**
 * The style a View was given, flattened: every style set by the
 * components that render this one DOM element, merged, with the outermost
 * component winning as `style` arrays do. Read off the fibers, because
 * react-native-web writes layout keys such as `gap` as classes jsdom does
 * not resolve, so the computed style has none of them. Stops at the next
 * DOM element up, so an ancestor's style is never mistaken for this one's.
 */
export function viewStyleOf(el: Element): ViewStyle {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'))!;
  type Fiber = { memoizedProps?: { style?: unknown }; return?: Fiber; stateNode?: unknown };
  const layers: ViewStyle[] = [];
  let f: Fiber | undefined = (el as unknown as Record<string, Fiber>)[key];
  while (f && (f.stateNode === el || !(f.stateNode instanceof Element))) {
    layers.unshift(StyleSheet.flatten(f.memoizedProps?.style as StyleProp<ViewStyle>) ?? {});
    f = f.return;
  }
  return Object.assign({}, ...layers.reverse());
}

/** The font size a Text was given — see `textStyleOf`. */
export function fontSizeOf(el: HTMLElement): number | undefined {
  return textStyleOf(el)?.fontSize;
}
