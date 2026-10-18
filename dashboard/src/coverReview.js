// Which covers to look at again, from the photo labels
// (docs/photo-labels.md §11, step 6A; owner, 17 Oct 2026).
//
// A place's cover should let somebody grasp the place at a glance: the
// Threads skill's first cover criterion. In the labels that is a
// photograph whose kind is the front, the inside, the garden or the
// view, and which takes in the place as a whole (`wide`). The garden —
// a courtyard, a terrace, a rooftop with the place's seats — is the
// labels' v5 kind, and a cover by the owner's word (18 Oct 2026). At a café or a place to eat the
// owner also takes the food (17 Oct 2026: "Được, với quán ăn uống") — a
// signature dish is what such a place is chosen for.
//
// A place comes to the desk when its cover is none of these and another
// of its photographs is. Nothing else: a cover that qualifies is the
// editor's choice, even when another qualifying photograph scores higher,
// because the score is a tie-breaker the owner has not yet seen tested
// against an editor's eye — this page is that test.
//
// Among the photographs that qualify, the suggestion is the one with the
// most of the other three criteria the labels measure well enough to use
// (§8's 85% for Haiku 5.5): the place's own sign, daylight, nobody in the
// frame. Green (84%) and staged (never measured) are not used. Ties go
// to the photograph earlier in the gallery, which is the order a person
// put them in.
//
// Measured before this was written (§11): on 1,000 places, a score built
// this way puts the human-chosen cover first 34% of the time and in the
// top three 73%, against 17% and 52% at random. With the food rule, 60
// places in the catalog qualify for review.

/** Categories where a photograph of the food may be the cover. */
export const FOOD_CATEGORIES = ['cafes', 'eats'];

const PLACE_KINDS = ['exterior', 'interior', 'garden', 'view'];

/** What the desk calls each kind, in the words the label rounds used. */
export const KIND_LABEL = {
  food: 'Food',
  interior: 'Inside',
  exterior: 'Front',
  garden: 'Garden',
  view: 'View',
  text: 'Text',
  other: 'Other',
};

/** Whether a place is one where the food may be its cover. */
export const isFoodPlace = (categories) => (categories ?? []).some((c) => FOOD_CATEGORIES.includes(c));

/** Whether a photograph, by its labels, may be this place's cover. A
 *  photograph with no labels may not: it has not been read. */
export function qualifies(labels, foodPlace) {
  if (!labels) return false;
  if (PLACE_KINDS.includes(labels.kind) && labels.wide === true) return true;
  return foodPlace && labels.kind === 'food';
}

/** The criteria a photograph meets, as the desk says them, in the order
 *  the Threads skill lists them. */
export function reasons(labels, foodPlace) {
  const out = [];
  if (PLACE_KINDS.includes(labels.kind) && labels.wide === true) out.push('Whole place');
  else if (foodPlace && labels.kind === 'food') out.push('The food');
  if (labels.brand === true) out.push('Its sign');
  if (labels.daylight === true) out.push('Daylight');
  if (labels.people === false) out.push('No people');
  return out;
}

/** How many of the three tie-breaking criteria a photograph meets. An
 *  answer of "can't tell" counts as not met. */
const points = (labels) =>
  (labels.brand === true) + (labels.daylight === true) + (labels.people === false);

/** Why the cover does not qualify, in a few words. */
export function why(labels) {
  if (!labels) return 'Not labelled';
  if (PLACE_KINDS.includes(labels.kind)) return `${KIND_LABEL[labels.kind]}, but only part of it`;
  return KIND_LABEL[labels.kind] ?? labels.kind;
}

/**
 * The review for one place, or null when there is nothing to ask.
 *
 * `place.photos` are the gallery's photographs with their labels
 * (`labels`, the `claude-labels` row's signals, or null). Hidden
 * photographs are neither a cover the reader sees nor a suggestion. A
 * place with no cover, or with two, is the cover's own bug and not this
 * page's question.
 */
export function reviewOf(place) {
  const food = isFoodPlace(place.categories);
  const shown = place.photos.filter((p) => !p.is_hidden);
  const covers = shown.filter((p) => p.is_cover);
  if (covers.length !== 1) return null;
  const [cover] = covers;
  if (qualifies(cover.labels, food)) return null;
  const best = shown
    .filter((p) => !p.is_cover && qualifies(p.labels, food))
    .sort((a, b) => points(b.labels) - points(a.labels) || a.sort_order - b.sort_order)[0];
  if (!best) return null;
  return {
    place,
    cover,
    suggestion: best,
    why: why(cover.labels),
    reasons: reasons(best.labels, food),
  };
}

/**
 * The places to ask about: every review, less the ones the desk already
 * answered "keep" about this same cover. A place whose cover changed
 * since it was kept is asked again; one answered "changed" no longer
 * qualifies on its own, since its cover now does.
 */
export function queue(places, answers) {
  const kept = new Map(answers.filter((a) => a.decision === 'kept').map((a) => [a.place_id, a.cover_photo_id]));
  return places
    .map(reviewOf)
    .filter((r) => r && kept.get(r.place.id) !== r.cover.id)
    .sort((a, b) => a.place.city_id.localeCompare(b.place.city_id) || a.place.name.localeCompare(b.place.name));
}

/** How the desk has answered so far: the measurement §11 asks for. */
export function tally(answers) {
  const changed = answers.filter((a) => a.decision === 'changed').length;
  return { changed, kept: answers.length - changed, total: answers.length };
}
