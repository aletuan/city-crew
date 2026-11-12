// How tall a card on Explore's collection shelf is, for its width.
//
// ── 4:5, and where it costs too much (owner, 12 Nov 2026) ──
//
// The shelf's cards are 4:5, and on most phones that is the right shape: a
// cover is a picture before it is a button, and portrait is what a phone
// photograph is. A review of the screen found the cards "nearly as tall as
// the place photographs under them" on a short iPhone, and asked for 1:1.
// Measured on Explore drawn at each size (react-native-web, the Hà Nội
// catalog, the tab bar and its insets), where the bottom of the "Places"
// heading lands against the top of the tab bar on first open:
//
//   height   phone            heading   bar top   with 4:5
//   667      SE, 8            649       598       51pt under the bar
//   812      mini, X, 11 Pro  709       733       24pt clear
//   844      12–16            732       765       33pt clear
//   852      15/16 Pro        739       773       34pt clear
//
// So only the 667 class loses the list to the shelf: on first open the
// reader sees no sign that there are places at all. 1:1 takes 38pt off a
// 150pt card there, which brings the heading to 611 (585 to its top),
// halfway out from under the bar. The 812 class already shows it, and
// keeps the shape the rest of the app's phones have.
//
// The line between them is where the heading meets the bar. From the
// table, the heading's bottom is the hero (`max(330, 0.48h)`) plus 319 on
// a 375pt phone, and the
// bar's top is `h − 69` without a home indicator and `h − 79` with one, so
// they cross between 746 and 765. 750 is in that gap and no iPhone stands
// in it. Android phones come in every height and are sorted by the same
// line, which is the right one for them by the same arithmetic.
//
// What 1:1 does to a cover, on the 20 covers the Hà Nội shelf drew: ten
// landscape, eight 3:4 portrait, two square. A landscape cover shows more
// of its width (a 3:2 from 53% to 67%), a portrait one less of its height
// (94% to 75%); on average 73% of a cover is visible at 4:5 and 74% at 1:1.
// The words over the photograph take a third of a square card rather than
// a quarter, which is the cost the owner accepted.
//
// Rejected: 1:1 below 820, which the first reading of the table proposed.
// It took the bar to sit 69pt off the screen's foot on every phone; with a
// home indicator it sits 79 off, and the 812 class turned out to show the
// heading already.

/** Below this window height the shelf's cards are square. */
export const SQUARE_BELOW = 750;

/** A shelf card's height as a multiple of its width. */
export function shelfRatio(winH: number): number {
  return winH < SQUARE_BELOW ? 1 : 1.25;
}
