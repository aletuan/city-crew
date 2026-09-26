// Google's price level, as a number and as a price.
//
// Its own module so that what only needs the table does not have to carry
// the import with it: `refresh-place.ts` reads `PRICE_LEVELS`, and was
// bundling `import-place.ts` and all five of its imports — the classifier,
// the photo copy, the city finder — to get four lines. A function's bundle
// is every file it reaches.

export const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// Representative VND per Google price level, so every import speaks the
// same "150k₫" language as the curated seed data instead of "₫₫" glyphs.
// Rough by design — editors refine the number during review.
export const PRICE_LEVEL_VND: Record<number, number> = {
  1: 50000,
  2: 150000,
  3: 300000,
  4: 500000,
};
