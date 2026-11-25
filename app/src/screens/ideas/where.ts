// Out of `IdeasScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import type { City } from '../../lib/city';
import type { useI18n } from '../../lib/i18n';
import type { TripDraft } from '../../lib/trip';

/** The words for where the day starts. */
export function whereLabelOf(draft: TripDraft, city: City | null, here: boolean, t: ReturnType<typeof useI18n>['t']): string {
  // Plain "near you" until the city resolves: "Around  · near you" printed
  // the hole where its name goes.
  //
  // "Near you", not "near me". The app addresses the reader everywhere
  // else it speaks — "Ghim bạn đã thả", "Lựa chọn của bạn" — and this one
  // row answered in their voice instead, which reads as the app quoting
  // them rather than telling them something.
  //
  // Capitalised after the separator, because that is what every other
  // pair in this app does: "Thứ Bảy, 26 T9 · Ban ngày". The lower
  // case here was the exception, and it showed once `SketchingScreen`
  // split the pair onto two lines and the second one opened with a small
  // letter.
  //
  // The city's name alone, not "Around Melbourne". The row already shows
  // a pin, and the plan subtitles repeat this string on three screens;
  // "Around" was the one word in it that said nothing a reader did not
  // know, and the owner asked for it to go. Japanese drops 周辺 with it.
  //
  // Only "near you" when it is: the reader standing in the city on screen.
  // Anywhere else — browsing another city, or no position to be had — the
  // day starts at the centre and the label says so (see `startPoint`).
  return draft.district
    ?? (draft.at
      ? (draft.atName ?? t('A pin you dropped', 'Ghim bạn đã thả', '置いたピン', '你放置的图钉', '你放置的圖釘'))
      : city
        ? here
          ? t(`${city.short_en} · Near you`, `${city.short_vi} · Gần bạn`, `${city.short_ja ?? city.short_en} · 現在地`, `${city.short_en} · 你附近`, `${city.short_en} · 你附近`)
          : t(`${city.short_en} · City centre`, `${city.short_vi} · Trung tâm`, `${city.short_ja ?? city.short_en} · 中心部`, `${city.short_en} · 市中心`, `${city.short_en} · 市中心`)
        : t('Near you', 'Gần bạn', '現在地', '你附近', '你附近'));
}
