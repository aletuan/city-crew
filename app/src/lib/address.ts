// The address as the detail screen prints it — the part a reader in the
// city can use, without the part Google wrote for a reader anywhere else.
//
// ── what the full string costs ──
//
// The place row stores Google's `formattedAddress` whole, and the detail
// card printed it whole:
//
//     10 Ng. Thọ Xương, Hoàn Kiếm, Hà Nội 100000, Vietnam
//
// Two lines on a phone, and the second line says nothing the screen has
// not already said. The country is the only country the app ships in. The
// city is the one the reader chose on the way here, and its name is in the
// tab bar's sense of place already. The postal code is Google's, not the
// reader's: nobody in Hanoi navigates by "100000", and nobody types it
// into a taxi app. What is left after the cut —
//
//     10 Ng. Thọ Xương, Hoàn Kiếm
//
// — is exactly how a local says an address out loud, and it fits on one
// line beside the Route button.
//
// ── the cut, on the anatomy Vietnamese addresses have ──
//
// The same anatomy `wardFromAddress` (supabase/functions/_shared/ward.ts)
// reads for the same rows:
//
//     street part(s), ward, city [postal], country
//
// Drop the country when the last segment is one. Then the last segment
// is the city's, and it goes whenever the anatomy says so — three or
// more segments left means street, ward, city at least — or, when the
// address is too short to be sure, whenever the segment names a city we
// know. "151 Đồng Khởi, Hồ Chí Minh" has no ward tier for the anatomy to
// lean on, but the second segment is still plainly the city.
//
// Never below one segment: an address that is only "Hồ Chí Minh, Vietnam"
// comes back as "Hồ Chí Minh", not as an empty line under the label.
// And never anything but the display: the share sheet and the Maps link
// keep the full string, because both leave the phone, and a message
// arriving in another country needs the country on it.
//
// Plain TypeScript with no imports, tested from `address.test.ts`.

/** Folded country names an address may end with. */
const COUNTRY = new Set(['vietnam', 'viet nam']);

/**
 * Folded names the city segment is known by, in the forms Google writes
 * them. Only consulted when the address is too short for the anatomy to
 * decide on its own; a longer address drops its city segment whatever
 * the city is called, so a city missing from this set costs a two-part
 * address its cut and nothing more.
 */
const CITIES = new Set([
  'ha noi', 'hanoi',
  'ho chi minh', 'ho chi minh city', 'thanh pho ho chi minh', 'tp. ho chi minh', 'tp ho chi minh', 'sai gon', 'saigon',
  'da nang', 'danang',
  'hai phong', 'hue', 'thua thien hue', 'can tho', 'nha trang', 'khanh hoa', 'da lat', 'lam dong',
  'hoi an', 'quang nam', 'vung tau', 'ba ria - vung tau',
]);

/** Case- and accent-insensitive form for comparing two Vietnamese names. */
export const fold = (s: string) => s
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/đ/gi, 'd')
  .toLowerCase()
  .trim();

/** "Hà Nội 100000" → "Hà Nội"; a postal code rides on the city segment. */
const withoutPostal = (s: string) => s.replace(/\s+\d{5,6}$/, '');

/**
 * The address without its city, postal code and country — the part a
 * reader already in the city has any use for. Null in, null out.
 *
 * `extraCities` lets a caller add the names it knows the current city by
 * (the catalog's `name_vi`, `name_en`, `short_vi`…), so a city that
 * joins the catalog later is recognised without a change here.
 */
export function shortAddress(
  address: string | null | undefined,
  extraCities: readonly string[] = [],
): string | null {
  if (!address) return null;
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1 && COUNTRY.has(fold(parts[parts.length - 1]))) parts.pop();
  if (parts.length > 1) {
    const last = fold(withoutPostal(parts[parts.length - 1]));
    const isCity = parts.length >= 3 || CITIES.has(last)
      || extraCities.some((c) => fold(c) === last);
    if (isCity) parts.pop();
  }
  return parts.join(', ') || address;
}
