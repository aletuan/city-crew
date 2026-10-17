// What a photograph is, and the six things a cover is chosen by: the
// photo labels, v1 (docs/photo-labels.md §3).
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

export const VERSION = 1;

/** The scorer name the labels are stored under in `photo_scores`. */
export const SCORER = "claude-labels";

export const KINDS = ["food", "interior", "exterior", "view", "text", "other"] as const;
export type Kind = typeof KINDS[number];

export const ATTRS = ["brand", "wide", "green", "daylight", "people", "staged"] as const;
export type Attr = typeof ATTRS[number];

/** The definitions, as the model reads them. Written as the owner settled
 *  them in rounds 1, 1b and 2 (17 Oct 2026), and the cases round 3 has not
 *  settled yet said as such, so they come back marked unsure rather than
 *  decided one way by accident. */
export const DEFINITIONS = `You label one photograph of a place in a city guide: a café, a restaurant, a bar, a shop, a museum, a park. Answer from the photograph alone.

KIND — exactly one, by the subject: what fills the frame and is in focus. Never by whether the photograph merely contains sky or a tree.
- food: food or drink is the subject, even with a view behind it. A tray of drinks counts; a bar's back wall of bottles does not. Drinks on a table in front of a city view are food.
- interior: inside the place: rooms, seating, counters, shelves, a staircase. People in the room do not change it; a barista at work or guests at a counter is interior.
- exterior: the place from outside: the front, the entrance, the sign, the building, a terrace seen as part of the building. A church, library or museum under a blue sky is exterior, never view.
- view: scenery is the subject: sky, water, greenery, a skyline, a sunset; any building is only a frame. A garden or park that is the place itself, shown as landscape, is view.
- text: a menu, a board, a poster: something to read rather than look at.
- other: none of the above: a close portrait, an object with no place in it, a blank or broken image.

Not yet settled — choose the closer kind and set unsure to true:
- a monument in grounds: a fountain, a statue, a tank on display;
- a covered gallery looking into a courtyard;
- a garden that fills the frame with a building only glimpsed.
Also set unsure to true whenever you would not bet on the kind.

ATTRIBUTES — each "yes", "no", or "unknown" when the photograph cannot say (too dark, too cropped, black and white):
- brand: a sign, logo or the place's name is legible in the frame. Another company's logo (a bottle, a poster) and a small watermark are not the place's brand.
- wide: the frame takes in the place as a whole (a room, a front, a terrace), not one dish, one corner or one shelf.
- green: plants or trees are a noticeable part of the frame, not a single sprig.
- daylight: lit mainly by natural daylight (sun, overcast sky, a window). Lamps or night is "no". A close-up of a dish with no window or sky in frame often cannot say: "unknown".
- people: one or more people are the subject or fill a large part of the frame. Passers-by in the distance are "no".
- staged: it looks like an advertisement: a posed model, or text and graphics laid over the photograph.

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
