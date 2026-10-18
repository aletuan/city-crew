// How good a photograph is, among photographs of its own kind: the
// criteria of round 4 (docs/photo-labels.md §12), as the `rate-photos`
// function sends them to the model.
//
// The question is narrower than "which photograph makes the cover". The
// cover review (§11, part A) found that which *kind* of photograph a place
// shows first is the editor's taste — interiors at bars, fronts and rooms
// at cafés, food at a third of restaurants — so the kind is left to the
// editor and the machine is asked only which photograph of that kind is
// the best. Each kind has its own idea of good: a latte is not judged by
// its vertical lines, nor a room by whether it looks fresh.
//
// The criteria are the owner's, approved on 18 Oct 2026 in Vietnamese
// (§12) and written here in English for the model, criterion for
// criterion. Warm lamps at night are not marked down: the interior and
// front criteria both name them, which settles a bar's evening room.
//
// Only the three kinds a cover is drawn from are rated. View and text
// photographs are too few to measure (§12), and "other" has nothing to
// judge.
//
// A score is asked of one photograph alone, never of a pair side by side:
// a pair can only be judged where there is a pair, and the point is a
// number for every photograph in the catalog, from which the best of a
// kind at a place is simply the highest.

export const VERSION = 1;

export const KINDS = ["food", "interior", "exterior"] as const;
export type BeautyKind = typeof KINDS[number];

/** True for a kind this file has criteria for. */
export const isBeautyKind = (k: unknown): k is BeautyKind => KINDS.includes(k as BeautyKind);

const COMMON = [
  "The subject is sharp: no shake, no blur.",
  "Well exposed: not murky dark, not blown to white with the detail lost.",
  "Natural colour: no heavy colour cast, no overdone filter.",
  "No text or watermark laid over the photograph.",
];

/** The owner's criteria, per kind (§12). */
export const CRITERIA: Record<BeautyKind, { name: string; points: string[] }> = {
  food: {
    name: "food and drink",
    points: [
      "The dish or drink is clearly the subject and fills most of the frame.",
      "It looks appetising: fresh colour, a sheen or freshness, not soggy, not wilted.",
      "A tidy composition with an uncluttered background: no crumpled napkins, dirty plates or leftovers.",
      "Soft light, with no harsh shadow over the food.",
      "An angle that suits the dish: at eye level, or from directly above.",
    ],
  },
  interior: {
    name: "interior",
    points: [
      "Vertical lines (columns, walls, door frames) stand straight, not tilted or distorted.",
      "There is depth: a sense of the space.",
      "Good light: natural, or warm lamps used with intent. Not murky dark, no windows blown to white.",
      "Tidy, not cluttered, with no people blocking most of the frame.",
      "There is a point of focus: the counter, a plant, a design detail.",
    ],
  },
  exterior: {
    name: "storefront",
    points: [
      "The entrance and the place's sign can be seen clearly.",
      "Straight, not tilted.",
      "Not mostly blocked by vehicles, people or power lines.",
      "Good light: daylight, or attractive lighting in the evening.",
      "It conveys the feel of the place, not just a wall.",
    ],
  },
};

const list = (points: string[]) => points.map((p) => `- ${p}`).join("\n");

/** The model's instructions for one kind of photograph. */
export function instructions(kind: BeautyKind): string {
  const c = CRITERIA[kind];
  return `You judge one photograph from a city guide: how good it is as a ${c.name} photograph. It has already been sorted as ${c.name}; judge it only against other ${c.name} photographs, by the criteria below, and from the photograph alone.

For every photograph:
${list(COMMON)}

For a ${c.name} photograph:
${list(c.points)}

score: a whole number from 1 to 10. 1 to 3: it fails several of the criteria. 4 to 6: an ordinary photograph, some met and some not. 7 to 8: a good photograph that meets most of them. 9 to 10: it meets all of them, and a guide would be proud to show it.

why: one short sentence naming what decided the score.`;
}

/** The answer's shape, for structured output. */
export const SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    why: { type: "string" },
  },
  required: ["score", "why"],
  additionalProperties: false,
} as const;

export type Answer = { score: number; why: string };
