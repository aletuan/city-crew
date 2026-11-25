// Out of `SearchScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import React from 'react';
import { Text, type TextInput } from 'react-native';
import CandidateRow from '../../components/CandidateRow';
import type { Candidates } from '../../lib/candidates';
import { type Collection, holds, type Place } from '../../lib/data';
import { namesCities, type CityPick } from '../../lib/searchCities';
import type { SearchRow } from '../../lib/searchRows';
import type { Nav } from '../../nav';
import { SearchPlaceCard } from './parts';
import { Browse, CollectionRow, Eyebrow, RecentRow, ShelfRow } from './rows';
import { s } from './styles';

/** What a row needs from the screen. */
export type RowContext = {
  keepRecents: (next: string[]) => void;
  setQuery: (q: string) => void;
  inputRef: React.RefObject<React.ComponentRef<typeof TextInput> | null>;
  cats: string[];
  now: Date;
  tz: string;
  inList: (pl: Place) => { on: boolean; title: string; onPress: () => void } | undefined;
  navigation: Nav;
  google: Candidates;
  picked: string[];
  setPicked: React.Dispatch<React.SetStateAction<string[]>>;
  noteSearch: () => void;
  placeIndex: Map<string, number>;
  pick: CityPick;
  cityName: (id: string | null | undefined) => string | null;
  list: Collection | null;
  listTitle: string;
  openPlace: (pl: Place) => void;
  togglePlace: (pl: Place) => void;
};

/** One row of the list, whichever kind it is. */
export function Row({ item, at }: { item: SearchRow; at: RowContext }) {
  const {
    keepRecents, setQuery, inputRef, cats, now, tz, inList, navigation, google, picked, setPicked,
    noteSearch, placeIndex, pick, cityName, list, listTitle, openPlace, togglePlace,
  } = at;
  if (item.kind === 'eyebrow') return <Eyebrow label={item.label} clear={item.clear} onClear={() => keepRecents([])} />;
  if (item.kind === 'recent') {
    return (
      <RecentRow
        term={item.term}
        onRun={() => setQuery(item.term)}
        onEdit={() => { setQuery(item.term); inputRef.current?.focus(); }}
      />
    );
  }
  if (item.kind === 'chips') return <Browse cats={cats} onPick={setQuery} />;
  if (item.kind === 'popular' || item.kind === 'latest') {
    return (
      <ShelfRow
        place={item.place}
        kind={item.kind}
        now={now}
        tz={tz}
        toggle={inList(item.place)}
        onOpen={() => navigation.navigate('PlaceDetail', { slug: item.place.slug })}
      />
    );
  }
  if (item.kind === 'header') return <Text style={s.section}>{item.label}</Text>;
  if (item.kind === 'candidate') {
    return (
      <CandidateRow
        c={item.candidate}
        known={google.known[item.candidate.place_id] ?? { state: 'none' }}
        busy={google.adding === item.candidate.place_id}
        away={google.awayFrom(item.candidate)}
        item={google.batch.state[item.candidate.place_id]}
        selected={picked.includes(item.candidate.place_id)}
        onToggle={() => setPicked((p) => (
          p.includes(item.candidate.place_id)
            ? p.filter((x) => x !== item.candidate.place_id)
            : [...p, item.candidate.place_id]
        ))}
        onOpen={(slug) => { noteSearch(); navigation.navigate('PlaceDetail', { slug }); }}
      />
    );
  }
  if (item.kind === 'place') {
    return (
      <SearchPlaceCard
        place={item.place}
        index={placeIndex.get(item.key) ?? 0}
        city={namesCities(pick) ? cityName(item.place.city_id) : null}
        on={list ? holds(list, item.place.slug) : null}
        listTitle={listTitle}
        open={openPlace}
        toggle={togglePlace}
      />
    );
  }
  return (
    <CollectionRow
      collection={item.collection}
      count={item.count}
      cover={item.cover}
      now={now}
      onOpen={() => {
        noteSearch();
        navigation.navigate('CollectionDetail', { slug: item.collection.slug });
      }}
    />
  );
}
