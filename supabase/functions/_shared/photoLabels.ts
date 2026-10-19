// What a photograph is, and the six things a cover is chosen by: the
// photo labels, v15 (docs/photo-labels.md §3).
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

export const VERSION = 15;

/** The scorer name the labels are stored under in `photo_scores`. */
export const SCORER = "claude-labels";

export const KINDS = ["food", "interior", "exterior", "garden", "heritage", "view", "text", "collage", "other"] as const;
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
 *  own, and one a cover may be. v6 (18 Oct 2026) narrows it to seating:
 *  v5 let a path or a deck count, and "greenery filling the frame does not
 *  change it", so a forest trail, a lake jetty and a park bench read as a
 *  garden. Of 21 photographs read as garden by v5's words, the owner saw
 *  12 as scenery: what a cover wants from a garden is the place's seats.
 *  v7 (18 Oct 2026) adds `heritage`: a tomb's gate, a pagoda's Buddha, a
 *  cathedral behind its statue were exterior when they filled the frame
 *  and view when grounds did, so the catalog's monuments were split
 *  between a café's front and a lake. The owner named it "Văn hóa". It
 *  goes by what the photograph shows, not by the place: a lawn in a park
 *  is view, a Cham tower in the same park is heritage. v8 (18 Oct 2026)
 *  adds `collage`: a grid of a café's front, a latte and a room was
 *  labelled by whichever panel led, and the model said so in 106 notes.
 *  The owner made it a kind, and one a cover may be: a grid is how some
 *  places choose to show themselves. v9 (18 Oct 2026) adds the owner's
 *  ruling on Bold Brew's red gate: a tree canopy over the place's own
 *  gate, its courtyard tables beyond, read as view or exterior; the owner
 *  called it garden, "because the gate is the house's", and added that a
 *  garden usually has greenery. v10 (18 Oct 2026) settles the two
 *  boundaries most of the remaining unsure labels sat on: a covered
 *  terrace or veranda open to the outside is garden (65 unsure labels
 *  named a roof), and a room seen from outside through glass or a window
 *  is exterior (27 named the glass) — both the owner's rulings. v11
 *  (18 Oct 2026) draws the line v10's roof sentence blurred: the owner
 *  reviewed 126 v10 labels and moved 15 of 62 gardens to exterior, nearly
 *  all of them a place's seats on the pavement or along its own front.
 *  Seats facing the street are the front, roof or no roof; a garden is
 *  seating inside the place's own grounds. v12 (18 Oct 2026) adds the
 *  two boundaries both models still missed on that review, as the owner
 *  confirmed them: the place's gate or front filling the frame, its
 *  courtyard seen beyond, is exterior (Bold Brew stays garden, its gate
 *  all but hidden by the trees); seats before a beach, a river, a skyline
 *  or a landscaped garden that fills the frame are view. v13 (18 Oct
 *  2026) moves the museum: v2 had a library, a museum or a mall filling
 *  the frame as exterior, and the owner, reviewing v12, called the Fine
 *  Arts Museum, Scots' Church and a silk village's gate heritage. The
 *  front is now the business's: a shop, a café, a restaurant, a library or
 *  a modern mall; a museum, a historic building and a craft village are
 *  heritage. v14 (19 Oct 2026) is the owner's review of the 11 photographs
 *  v13 was unsure of. Two were decor inside a room that the model read as
 *  something else: A Mà Kitchen's mural of its grandmother under a tiled
 *  eave, read as the outside wall, and its neon sign, read as text. The
 *  owner called both interior. The other nine kept their kinds, among
 *  them three views of St Joseph's Cathedral from 99/81's windows, which
 *  stayed view. Beside the owner's earlier heritage for the cathedral's
 *  face seen plainly from the same balcony, that draws the line: the
 *  monument as what the photograph shows is heritage; the monument as one
 *  part of the scene, or a glimpse through a window, is view. v15 (19 Oct
 *  2026) rewrites the kinds as an order to go down, the first that fits,
 *  and keeps every ruling. The owner's review of v14 found three things
 *  the sentence-by-sentence growth had caused: exterior ("its sign fills
 *  most of the frame") and text ("a sign or logo that fills the frame")
 *  both claimed a close shot of the place's sign, and the owner settled it:
 *  the sign on its front with wall, door or windows in view is exterior, a
 *  sign or logo alone is text. Garden, exterior and view, patched six
 *  times, were 59 of v14's 134 misses on the 458 owner-labelled
 *  photographs, the pavement rule written twice; they are now three places
 *  to stand (the street side, the grounds, the room). And `other` was a
 *  place to hide: 26 of 26 `other` answers in the 189-photo review were
 *  something else, so it is now the last resort, and unsure the way to
 *  say not sure. */
export const DEFINITIONS = `You label one photograph of a place in a city guide: a café, a restaurant, a bar, a shop, a museum, a park. Answer from the photograph alone.

KIND — exactly one, by the subject: what fills most of the frame and is in focus. Never by whether the photograph merely contains sky or a tree. The kinds are listed in the order to check them: go down the list and take the first that fits.
- collage: two or more photographs joined into one image: a grid, a split frame, stacked panels, whatever each panel shows. One photograph with text or a logo laid over it is not a collage.
- text: something to read rather than look at: a menu, a board, a poster or a banner whose words are its point, even with photographs in it; or a sign or logo on its own that fills the frame, with nothing of the building around it. The place's sign on its front, with its wall, door or windows in the frame, is exterior. A neon or painted sign hung among a room's decor is interior: text is read, decor is looked at.
- food: food or drink is the subject: a dish, a drink, a tray of drinks, food or drinks on a table, even when part of the room or a view shows around them. A bar's back wall of bottles is not food.
- heritage: a monument, a place of worship or a place of culture is the subject, seen from outside: a temple, a pagoda, a shrine, a church, a tomb or mausoleum, a citadel or a royal palace, a historic gate or tower, a statue, a memorial, a museum, a historic or colonial building visited for itself, a traditional craft village's gate or house. It stays heritage standing in its grounds, so long as it is what the photograph is of. Seen from the place's window, arch or balcony, it is heritage only when its face plainly fills the frame; as one part of the scene, among trees, the street and other buildings, or a glimpse through the opening, it is view. A café, a shop, a restaurant or a hotel housed in an old or colonial building is not heritage: the business is the subject, so it is exterior. Inside such a building is interior. A park, a garden, a lawn or a lake with no such structure as its subject is view, even inside a heritage site.
Then the place itself, by where the photograph is taken from: its street side, its grounds or its room.
- exterior: from outside the place, at its street side: its building, front, entrance, gate or sign fills most of the frame. A shop, a café, a restaurant, a library or a modern mall is exterior even under a blue sky. A counter or kiosk seen from the street with the place's sign on it is exterior. A room seen from outside through its glass front or a window is exterior, even when the room fills the view. The place's seats on the pavement or along its front facing the street are exterior, covered or not: the front is what they show. Its gate, entrance or front filling most of the frame is exterior even when its courtyard, garden or seats show through or beyond it. Decor built indoors, a brick wall, a tiled eave or lanterns under a ceiling, is not outside: that is interior.
- garden: inside the place's own grounds, in the open air: its tables, chairs, sofas, benches or loungers are the subject, on a courtyard, a garden, a terrace, a rooftop, a balcony, a deck, by a pool, or on a veranda facing them. A covered terrace, veranda, porch or pergola there, open to the outside on at least one side, is garden, roof and all. The place's own gate is garden only when trees and greenery hide most of it and its courtyard seats show beyond.
- interior: inside the room: rooms, seating, counters, shelves, a staircase, closed in by walls or glass on every side. People in the room do not change it. A counter inside is interior, even with the place's sign lit on the wall behind it. A wall, a mural, a neon or painted sign, lanterns or a decorative eave inside the room are interior, even when they fill the frame: under a ceiling and lit by lamps, the decoration is the room.
- view: scenery fills most of the frame: sky, water, greenery, a lawn, a park, grounds, a path or a bridge through them, a skyline, a sunset. A building or a monument small in the scenery does not change it. A public park, a lake shore or grounds open to everyone are view, benches and all. A path, steps, a bridge, a jetty or a lawn with no seats is view. Seats only at the edge of a frame that scenery fills are view, and so are the place's own tables and seats before a beach, the sea, a river, a skyline or a landscaped garden that fills most of the frame; when the tables and chairs are the subject, it is garden.
- other: the last resort, for a photograph that fits none of the above even in part: a close portrait, an object with no place in it, a blank or broken image. When a photograph partly fits a kind above, take the nearest one and set unsure; other is not a way to say "not sure".

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
