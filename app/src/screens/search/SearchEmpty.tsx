// Out of `SearchScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import React from 'react';
import { Empty } from '../../components/ui';
import type { escapeRoutes } from '../../lib/deadend';
import { useI18n } from '../../lib/i18n';
import type { CityPick } from '../../lib/searchCities';
import { Fork, NoMatches } from './parts';

// The end of a search that found nothing, and the end of one that
// found the wrong things, are the same dead end — and until now
// both of them ended here, with the app reporting the absence and
// offering no way through it. Explore has had that way out since
// it got a footer; this screen, which is where someone goes when
// they have a specific place in mind, did not.
//
// Nothing at all: the offer belongs in the empty state, because
// the empty state is the whole screen. Something, but not the
// right thing: the offer goes under the results by the same rule
// Explore uses — reaching the end is the moment you have seen
// everything there is, and it is the only honest moment to say
// "then let us go and find it".
export function SearchEmpty({ searching, elsewhere, shown, pick, cityName, addRow, googleEmpty, routes, onSearch, onBack, toList }: {
  searching: boolean;
  elsewhere: boolean;
  shown: string;
  pick: CityPick;
  cityName: (id: string | null | undefined) => string | null;
  addRow: React.ReactNode;
  googleEmpty: React.ReactNode;
  routes: ReturnType<typeof escapeRoutes>;
  onSearch: (q: string) => void;
  onBack: () => void;
  toList: boolean;
}) {
  const { t } = useI18n();
  return (
  searching && elsewhere
    ? (
      <>
        <NoMatches term={shown} where={pick === 'all' ? null : pick.map(cityName).filter(Boolean).join(', ')} />
        {addRow}
        {googleEmpty}
      </>
    )
  : searching
    ? (
      <>
        <NoMatches term={shown} />
        {addRow}
        {googleEmpty}
        {/* Under the Google row, not above it: the primary door
            stays primary, and the fork is the "or try" it reads
            as. Rendered after the not-found note too, so the
            chips survive Google coming back empty-handed — that
            is the moment they matter most. */}
        <Fork
          routes={routes}
          onSearch={onSearch}
          onBack={onBack}
          toList={toList}
        />
      </>
    )
    // Reached only while the catalog is still loading, or in a
    // city with nothing in it yet: with places come chips and a
    // ranking, and with either the zero-state rows exist instead.
    : <Empty text={t(
        'Try a name, a neighbourhood, or a vibe — cafés, museums, rooftops.',
        'Thử tên quán, tên khu, hay một kiểu vibe — cà phê, bảo tàng, rooftop.',
        '名前・エリア・雰囲気で検索 — カフェ、博物館、ルーフトップ。',
        '试试名称、街区或氛围 — 咖啡馆、博物馆、天台。', '試試名稱、街區或氛圍 — 咖啡館、博物館、頂樓。',
      )} />
  );
}
