// The picture each badge is drawn from: in colour once earned, and in
// grey until then.
//
// Static imports and a lookup, as `avatarImages.ts` is, for the same
// reason: Metro needs every asset path to be a literal it can see at
// build time.
//
// ── where the pictures came from (owner, 17 Nov 2026) ──
//
// Nine medals, drawn as one set in the avatars' hand: the eight animals
// `lib/avatars` names, each doing the thing its badge is for — a
// kangaroo with a backpack for a first trip — and a koala and a kangaroo
// together for a first friend, so that nine badges did not need a ninth
// animal. The prop says what was done; the animal is whose app it is.
//
// A scalloped edge, where an avatar is a plain circle: an animal's face
// in a circle is somebody's picture here, and a badge must not be read
// as one.
//
// Their own colours on their own ground, whatever look the reader wears
// (`palettes` has twenty-one, light and dark): each medal carries its
// ground inside its rim, as an avatar does, so nothing of the page shows
// through it. Rejected: one-colour marks tinted with the look's accent,
// which follow the look exactly and give up the illustration; and two
// sets, light and dark, which is eighteen pictures to keep in step for a
// difference nobody was shown.
//
// 192px WebP, 5 to 6 KB each: three device pixels for every point of
// the 56pt the sheet draws them at, and a little over. The grey twin is
// the same picture with its colour taken out, made from it and not drawn
// again; eighteen files are 148 KB in all.

import type { BadgeId } from '../lib/badges';

import firstFind from '../../assets/badges/first-find.webp';
import firstFindOff from '../../assets/badges/first-find-off.webp';
import curator from '../../assets/badges/curator.webp';
import curatorOff from '../../assets/badges/curator-off.webp';
import beenThere from '../../assets/badges/been-there.webp';
import beenThereOff from '../../assets/badges/been-there-off.webp';
import traveller from '../../assets/badges/traveller.webp';
import travellerOff from '../../assets/badges/traveller-off.webp';
import goodCompany from '../../assets/badges/good-company.webp';
import goodCompanyOff from '../../assets/badges/good-company-off.webp';
import onTheRoad from '../../assets/badges/on-the-road.webp';
import onTheRoadOff from '../../assets/badges/on-the-road-off.webp';
import contributor from '../../assets/badges/contributor.webp';
import contributorOff from '../../assets/badges/contributor-off.webp';
import wellLiked from '../../assets/badges/well-liked.webp';
import wellLikedOff from '../../assets/badges/well-liked-off.webp';
import trendsetter from '../../assets/badges/trendsetter.webp';
import trendsetterOff from '../../assets/badges/trendsetter-off.webp';

export const BADGE_IMAGES: Record<BadgeId, { on: number; off: number }> = {
  firstFind: { on: firstFind, off: firstFindOff },
  curator: { on: curator, off: curatorOff },
  beenThere: { on: beenThere, off: beenThereOff },
  traveller: { on: traveller, off: travellerOff },
  goodCompany: { on: goodCompany, off: goodCompanyOff },
  onTheRoad: { on: onTheRoad, off: onTheRoadOff },
  contributor: { on: contributor, off: contributorOff },
  wellLiked: { on: wellLiked, off: wellLikedOff },
  trendsetter: { on: trendsetter, off: trendsetterOff },
};
