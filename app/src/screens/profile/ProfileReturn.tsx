// Where the reader was before a theme restart, handed to the card that
// reopens the sheet. Its own file so the cards and the screen share it
// without importing each other.

import React, { createContext } from 'react';

// Neither is called outside a provider; one shared no-op stands in for both.
export const noop = () => {};

/**
 * What the restart a theme costs has to put back on this screen, and what
 * it needs from it: the sheet that was open and how far down the page was
 * (`Return` in lib/look). A context rather than props, because the
 * settings card sits in both the account's profile and the guest's, two
 * levels under the scroll view that knows the offset.
 */
export const ProfileReturn = createContext<{
  sheet: 'theme' | null;
  /** Spend the sheet: the first card to read it says so, and no card
   *  after it reads it again. */
  spendSheet: () => void;
  y: React.MutableRefObject<number>;
  scrollBy: (dy: number) => void;
}>({ sheet: null, spendSheet: noop, y: { current: 0 }, scrollBy: noop });
