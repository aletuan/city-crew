// What a photograph is, and the six things a cover is chosen by: the
// photo labels, v5 (docs/photo-labels.md §3).
//
// The one place they are defined. The `label-photos` function sends
// DEFINITIONS to the model as its instructions; the `photo-labels` skill
// (.claude/skills/photo-labels/SKILL.md) is a person-in-a-session reading
// the same text before looking at a sheet. Two copies drifted apart would
// make one scorer out of two sets of answers to different questions, so
// the skill points here and a test (photoLabels.fn.test.ts) holds the
// skill's `write.py` to KINDS, ATTRS and VERSION.
//
// Growing the set follows the four rules in docs/photo-labels.md §4: a new
// key is added here and to the skill's query; a new kind, or a changed
// meaning, bumps VERSION, and every older row is asked again.

export const VERSION = 5;

/** The scorer name the labels are stored under in `photo_scores`. */
export const SCORER = "claude-labels";

export const KINDS = ["food", "interior", "exterior", "garden", "view", "text", "other"] as const;
export type Kind = typeof KINDS[number];

export const ATTRS = ["brand", "wide", "green", "daylight", "people", "staged"] as const;
export type Attr = typeof ATTRS[number];

/** The definitions, as the model reads them. v1 was written from the
 *  owner's rounds 1, 1b and 2; v2 (17 Oct 2026) adds the owner's four
 *  rulings after round 3, where all three Claude sources agreed with each
 *  other (kappa 0.82-0.92) and not with the owner on the same groups:
 *  outdoor grounds with a building in them go by what fills the frame; a
 *  counter seen from the customer's side with the place's sign is the
 *  exterior; a table with food on it is food; a sign or logo that fills
 *  the frame is text. v3 (17 Oct 2026) does the same for the six
 *  attributes after round 3b, where the owner's answers and all five
 *  Claude answers parted on the meaning of the words, not on what was in
 *  the frame: brand is the place's own sign or name, not a logo on a cup
 *  or a plate; green is trees and leafy plants, not flowers or a few small
 *  pots; any person visible is people; staged is a posed model only, and
 *  text laid over a photograph is not staged. v4 (17 Oct 2026) narrows
 *  v2's counter ruling after round 3c, on photographs no definition had
 *  been written from: the owner called one indoor counter under the café's
 *  lit sign exterior and another interior, then ruled that a counter inside
 *  the room is interior and only one seen from the street is exterior.
 *  Both models had already answered interior for both. v5 (18 Oct 2026)
 *  adds `garden`: of the 725 photographs the model would not bet on under
 *  v4, 367 named a courtyard, garden, terrace, rooftop or balcony — the
 *  place's own outdoor seating, which no kind held, so the model wavered
 *  between interior, exterior and view. The owner made it a kind of its
 *  own, and one a cover may be. */
export const DEFINITIONS = `You label one photograph of a place in a city guide: a café, a restaurant, a bar, a shop, a museum, a park. Answer from the photograph alone.

KIND — exactly one, by the subject: what fills most of the frame and is in focus. Never by whether the photograph merely contains sky or a tree.
- food: food or drink is the subject, even with a view behind it. A tray of drinks counts; a bar's back wall of bottles does not. Drinks on a table in front of a city view are food. Food or drinks on a table are food even when part of the room shows around them.
- interior: inside the place: rooms, seating, counters, shelves, a staircase, with no food or drink as the subject. People in the room do not change it. A counter inside the room is interior, even with the place's sign lit on the wall behind it. A covered gallery looking into a courtyard is interior.
- exterior: the place from outside, where the building, its front, its entrance or its sign fills most of the frame. A counter or kiosk seen from the street, outside the building, with the place's sign on it is exterior. A church, library or museum whose building fills most of the frame is exterior even under a blue sky.
- garden: the place's own open-air space where its guests sit or walk: a courtyard, a garden, a terrace, a rooftop, a balcony, a leafy passage to its seats, with the place's tables, chairs, benches or paths in the frame. Greenery filling much of the frame does not change it while the place's seating or paths are part of what is shown. Seen from the street as the place's front, it is exterior; under a roof with walls around, it is interior.
- view: scenery fills most of the frame: sky, water, greenery, a lawn, a park, grounds, a skyline, a sunset, with none of the place's own seating as part of what is shown. A building, a gate, a statue or a monument standing in grounds that fill most of the frame does not change it: that is view. A rooftop or terrace with its seating in the frame is garden; the skyline beyond it alone is view.
- text: a menu, a board, a poster, or a sign or logo that fills the frame: something to read rather than look at.
- other: none of the above: a close portrait, an object with no place in it, a blank or broken image.

Set unsure to true whenever you would not bet on the kind.

ATTRIBUTES — each "yes", "no", or "unknown" when the photograph cannot say (too dark, too cropped, black and white):
- brand: the place's own sign or name is legible in the frame: a shop sign, a lit logo on its wall, its name over the door. A logo printed on a cup, a phin filter, a plate, a coaster or a bag, latte art, another company's logo and a small watermark are not brand.
- wide: the frame takes in the place as a whole (a room, a front, a terrace, a courtyard), not one dish, one corner or one shelf.
- green: trees or leafy plants are a noticeable part of the frame. Flowers, a vase, a single sprig or a few small pots are not green.
- daylight: lit mainly by natural daylight (sun, overcast sky, a window). Lamps or night is "no". A close-up of a dish with no window or sky in frame often cannot say: "unknown".
- people: any person can be seen in the frame, as the subject or not: a guest at a table, a barista behind the counter, a passer-by. A hand or arm reaching into a food photograph is not people.
- staged: a posed model, someone placed in the frame for the photograph. Text or graphics laid over the photograph are not staged.

note: one short sentence, only for a case worth explaining; otherwise an empty string.`;

const TRI = { type: "string", enum: ["yes", "no", "unknown"] } as const;

/** The answer's shape, for structured output: every key required, so a
 *  reply cannot leave one out and have it read as "not asked". */
export const SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: [...KINDS] },
    unsure: { type: "boolean" },
    ...Object.fromEntries(ATTRS.map((a) => [a, TRI])),
    note: { type: "string" },
  },
  required: ["kind", "unsure", ...ATTRS, "note"],
  additionalProperties: false,
} as const;

export type Answer = { kind: Kind; unsure: boolean; note: string } & Record<Attr, "yes" | "no" | "unknown">;

/** The row's `signals`, in the form the skill writes: true / false / null
 *  for the attributes, `unsure` and `note` only when they say something,
 *  and who answered, since the two scorers' agreement with the owner is
 *  measured apart (docs/photo-labels.md §10). */
export function toSignals(a: Answer, by: { by: "fn" | "skill"; model?: string }) {
  const tri = (v: Answer[Attr]) => (v === "yes" ? true : v === "no" ? false : null);
  return {
    v: VERSION,
    kind: a.kind,
    ...Object.fromEntries(ATTRS.map((k) => [k, tri(a[k])])),
    ...(a.unsure ? { unsure: true } : {}),
    ...(a.note.trim() ? { note: a.note.trim() } : {}),
    ...by,
  };
}
