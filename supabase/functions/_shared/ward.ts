// The ward, read out of the address string — the fallback for when
// Google's structured components have nothing to say.
//
// The import asks Google's addressComponents for a district-level name
// first (see NEIGHBORHOOD_TYPES in import-place.ts). That works wherever
// Google still models one — Hanoi's quận arrive as
// administrative_area_level_2 — and stopped working for Ho Chi Minh City
// after Vietnam's 2025 ward mergers: the city has no district tier any
// more, and Google's components for it carry none of the sublocality
// types either. Yet the ward is right there in the formatted address —
// "74 Hai Bà Trưng, Sài Gòn, Hồ Chí Minh 700000, Vietnam" — because the
// address *string* kept the tier the component model dropped.
//
// So this parses it, on the anatomy Vietnamese addresses actually have:
//
//     street part(s), ward, city [postal], country
//
// Take the segment before the city's, and the city's is the last once
// the country is dropped. The same anatomy the dashboard's coverage page
// reads for the same rows — two readers, one shape.
//
// Plain TypeScript with no imports and no Deno APIs, for the same reason
// `classify.ts` is: the test runner lives in the app, and this module
// runs in an Edge Function. Tested from `app/src/lib/ward.test.ts`.

/** Folded country names an address may end with. */
const COUNTRY = new Set(['vietnam', 'viet nam']);

const foldLite = (s: string) => s
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/đ/gi, 'd')
  .toLowerCase()
  .trim();

/**
 * The ward segment of a formatted address, or null.
 *
 * Null rather than a guess whenever the anatomy does not hold:
 * - fewer than three segments once the country is gone — a "street,
 *   city" address has no ward tier to read;
 * - a candidate that starts with a digit — that is a street number, so
 *   the address never had a ward segment and the tier before the city
 *   is street. ("Phường 7" and "District 1" stay: their digit is not
 *   leading.)
 *
 * The bare name is stored as it appears — "Bến Thành", "An Khánh",
 * "Sài Gòn". Google writes the merged wards without their Phường prefix
 * and inventing one would be wrong for the xã among them.
 */
export function wardFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length && COUNTRY.has(foldLite(parts[parts.length - 1]))) parts.pop();
  if (parts.length < 3) return null;
  const ward = parts[parts.length - 2];
  if (/^\d/.test(ward)) return null;
  return ward;
}
