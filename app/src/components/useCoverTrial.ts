// What a collection's cover sheet is trying on its cover (owner, 22 Nov
// 2026): the photographs on offer, the cover the list has, the one being
// looked at, and the picture the page should draw meanwhile.
//
// Out of `CollectionHero`, which stood over its complexity ceiling with it.

import { useState } from 'react';
import { usePlacePhotos } from '../lib/data';
import { chosenCoverOf, coverOf, coverUriOf, photosOf, withPhotos } from '../lib/place';
import type { Collection, Place } from '../lib/types';

export function useCoverTrial(list: Collection | undefined, members: readonly Place[], wanted: boolean) {
  // What is being tried: undefined is nothing, the cover as saved.
  const [look, setLook] = useState<{ id: string | null } | undefined>(undefined);
  // The rest of every place's photographs come only when the sheet is
  // asked for, as the form asked for them when it opened.
  const photos = usePlacePhotos(wanted && list ? members.map((p) => p.slug) : null);
  const choices = members.flatMap((p) => {
    const shots = photosOf(withPhotos(p, photos.data[p.slug])).filter((ph): ph is typeof ph & { id: string } => !!ph.id);
    return shots.map((ph, i) => ({ ph, place: p, n: i + 1, of: shots.length }));
  });
  // A cover whose place has left the list is no cover (`chosenCoverOf`).
  const current = list ? chosenCoverOf(list) : null;
  const opened = current ? current.id ?? choices.find((c) => c.ph.photo_uri === current.photo_uri)?.ph.id ?? null : null;
  const picked = look ? look.id : opened;
  const autoUri = members[0] ? coverOf(members[0])?.photo_uri : undefined;
  // Only a sheet that is open has a look, so `wanted` is the sheet's.
  const trying = wanted && picked !== opened;
  const tried = trying ? (picked ? choices.find((c) => c.ph.id === picked)?.ph.photo_uri : autoUri) : undefined;
  const uri = tried ?? (list ? coverUriOf(list, members) : undefined);
  return { choices, opened, picked, autoUri, trying, uri, pick: (id: string | null) => setLook({ id }), reset: () => setLook(undefined) };
}
