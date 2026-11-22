// Opening a collection from its tile, taking the tile's place with it.
//
// The tile is measured at the press, not before: a list scrolls, and a
// rectangle taken at layout is where the tile was, not where the finger
// found it. The page the press opens draws its cover growing from that
// rectangle (`CollectionHero`). A tile with no picture, or one that
// cannot be measured, opens the page as it always did.

import { type ComponentRef, useCallback, useRef } from 'react';
import type { View } from 'react-native';
import { measureWindow, usableRect, type CoverFrom } from './coverMorph';

type Node = ComponentRef<typeof View>;

export function useCoverOpen(
  go: (slug: string, from?: CoverFrom) => void,
): {
  /** The `ref` of the view that holds a tile's picture. */
  ref: (slug: string) => (node: Node | null) => void;
  /** The press: measure, then open. */
  open: (slug: string, uri: string | null | undefined) => void;
} {
  const nodes = useRef(new Map<string, Node>()).current;
  const refs = useRef(new Map<string, (node: Node | null) => void>()).current;
  const ref = useCallback((slug: string) => {
    let one = refs.get(slug);
    if (!one) {
      one = (node: Node | null) => { if (node) nodes.set(slug, node); else nodes.delete(slug); };
      refs.set(slug, one);
    }
    return one;
  }, [nodes, refs]);
  const open = useCallback((slug: string, uri: string | null | undefined) => {
    if (!uri) { go(slug); return; }
    measureWindow(nodes.get(slug)).then((rect) => go(slug, rect && usableRect(rect) ? { rect, uri } : undefined));
  }, [go, nodes]);
  return { ref, open };
}
