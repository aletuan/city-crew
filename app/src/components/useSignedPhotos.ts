// Links for check-in photos, wherever a visit is drawn with them (K4 of
// `docs/checkin-photos-plan.md`): a person's page, the check-ins list.
//
// ── one ask for a screenful ──
//
// The bucket is private, so every picture needs a signed link, and the
// link is a request. A page of twenty visits asks once, for every path
// it holds (`createSignedUrls` takes a list), not twenty times as the
// cards draw.
//
// ── kept for the app's life, not the screen's ──
//
// A link lives an hour (`SIGNED_FOR_S`). Held here, in the module, the
// list and the page and the page opened again share them: a path signed
// a minute ago is not asked for again, one signed fifty-five minutes ago
// is. Five minutes short of the hour, so a link handed to a card is not
// one that stops working while the card is looked at.
//
// The picture itself is cached by the photo's id (`cacheKey`, at the
// card), not by the link: the link changes every time it is asked for,
// and a cache keyed by it would fetch the same bytes each hour.
//
// A screen left open past the hour keeps the links it had. They are only
// read again by a picture that is not in the cache yet — a card scrolled
// to for the first time — and the next pull, or the next visit to the
// page, asks again. Rejected: a timer per screen to re-sign on the hour,
// for a case that costs one empty tile until a pull.

import { useEffect, useState } from 'react';
import type { CheckinPhoto } from '../lib/checkin';
import { SIGNED_FOR_S, signCheckinPhotos } from '../lib/data';

const kept = new Map<string, { url: string; until: number }>();
const MARGIN_S = 300;

/** Forget every link — for tests, which share the module. */
export function forgetSignedPhotos() { kept.clear(); }

/**
 * A link for each of `photos`' paths, once the bucket has signed it; null
 * before, for a path it would not sign, and for everything while `on` is
 * false (the switch off: nothing is asked).
 */
export function useSignedPhotos(photos: readonly CheckinPhoto[], on: boolean): (photo: CheckinPhoto) => string | null {
  const [, signed] = useState(0);
  const key = photos.map((p) => p.path).join('\n');

  useEffect(() => {
    if (!on) return undefined;
    const now = Date.now();
    const need = [...new Set(key.split('\n'))].filter((p) => p && !((kept.get(p)?.until ?? 0) > now));
    if (need.length === 0) return undefined;
    // An answer after the screen has gone is still kept, for the next
    // one; the render it asks for is nobody's, and React drops it.
    signCheckinPhotos(need).then((links) => {
      const until = Date.now() + (SIGNED_FOR_S - MARGIN_S) * 1000;
      for (const [path, url] of Object.entries(links)) kept.set(path, { url, until });
      signed((n) => n + 1);
    }, () => {});
    return undefined;
  }, [on, key]);

  return (photo) => (on ? kept.get(photo.path)?.url ?? null : null);
}
