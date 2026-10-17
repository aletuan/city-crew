---
name: photo-labels
description: Label a City Crew place's photographs — what each shows (food, interior, exterior, view, text, other) and the cover criteria (brand, wide, green, daylight, people, staged) — by looking at them, and store the labels as the `claude-labels` scorer in Supabase `photo_scores`. Use for one place by slug, a city, or every photograph not yet labelled; and after the Threads skill adds photographs to a place.
---

# Photo labels

Looks at a place's photographs and writes down what each one is. The
labels are judgements, not measurements, and live beside Apple Vision's
measurements in `photo_scores`, as a second scorer
(`docs/photo-labels.md`).

**This file holds the definitions.** `docs/photo-labels.md` §3 copies them
for reading, but a change is made here first, under the rules in "Growing
the set" below.

**Answer from the photograph alone.** Do not read Vision's stored labels,
rule v0, the place's category or its name before labelling. Those are the
other sources the labels are measured against, and a label copied from
them measures nothing. Round 2 (17 Oct 2026) reached 96/100 agreement with
the owner by looking and nothing else.

## Setup

- **Supabase MCP**, project `amdvitzpogaejzzqroco`, for the query and the
  write.
- **Network:** the session must be able to fetch from
  `amdvitzpogaejzzqroco.supabase.co`. Test it once:
  `curl -sS -o /dev/null -w "%{http_code}\n" <a photo_uri>` should print
  200. If it prints a 403 from the proxy, stop and say the environment's
  network access needs that domain under Allowed domains. Do not label
  from anything but the photograph.
- **Pillow** for `sheets.py`. If `import PIL` fails:
  `python3 -m pip install --target "$SCRATCH/pylib" Pillow`, then run the
  script with `PYTHONPATH="$SCRATCH/pylib"`.
- **Working files** go in the session's scratchpad, never in the repo.
  Downloaded photographs are other people's (Google's, Threads
  authors').

## 1. What needs labelling

A photograph needs labelling when it is not hidden and has no
`claude-labels` row at the current version, or has one that is missing a
key. A missing key means "not yet asked", not `false`.

```sql
select p.id, p.photo_uri as uri, pl.slug
from public.place_photos p
join public.places pl on pl.id = p.place_id
left join public.photo_scores s
  on s.photo_id = p.id and s.scorer = 'claude-labels'
where not p.is_hidden
  and pl.slug = any(array['<slug>'])          -- or: pl.city_id = '<city>' / drop for all
  and (s.photo_id is null
       or s.scorer_version < 1                 -- VERSION below
       or not (s.signals ?& array['kind','brand','wide','green','daylight','people','staged']))
order by pl.slug, p.sort_order;
```

Work in batches of at most about 100 photographs, eleven sheets.

**Getting the rows into a file.** An MCP result stays in the conversation
and cannot be piped anywhere. For places that are published, the same rows
come from the REST API with the public key in `dashboard/.env.example`,
straight to disk:

```bash
K=<VITE_SUPABASE_ANON_KEY from dashboard/.env.example>
curl -sS -H "apikey: $K" -H "Authorization: Bearer $K" \
  "https://amdvitzpogaejzzqroco.supabase.co/rest/v1/place_photos?select=id,photo_uri,sort_order,places!inner(slug)&is_hidden=eq.false&places.slug=in.(<slug>,<slug>)&order=place_id,sort_order"
```

Reshape it to `[{"id", "uri", "slug"}]` in the order of the query above,
and check the count against the SQL query. The REST API cannot see a place
that is still pending; for those, write the rows out from the MCP result.

**Do not read the file names.** A photograph the Threads skill added is
stored under a name that describes it (`…-threads-hem-entrance-vespa-sign-
plants.jpg`). That is somebody's label, and reading it first measures
nothing.

## 2. Sheets

Save the query's rows as JSON (`[{"id":…, "uri":…}, …]`), then:

```bash
python3 .claude/skills/photo-labels/sheets.py photos.json "$SCRATCH/labels-<batch>"
```

The script prints a path for each sheet and writes `index.json`, which
maps each yellow number to its photo id. Read every sheet. A
photograph reported `MISSING` gets no label; list it in the report.

## 3. The labels, v1

**`kind`** — exactly one, by the **subject**: what fills the frame and is
in focus. Never by whether the photograph merely contains sky or a tree.

| value | when |
|---|---|
| `food` | Food or drink is the subject, even with a view behind it. A tray of drinks counts; a bar back-wall of bottles does not |
| `interior` | Inside the place: rooms, seating, counters, shelves, a staircase. People in the room do not change it |
| `exterior` | The place from outside: the front, the entrance, the sign, the building, a terrace seen as part of the building |
| `view` | Scenery is the subject: sky, water, greenery, a skyline, a sunset. Any building is only a frame (a railing, a window edge). A garden or park that is the place itself, shown as landscape, is `view` |
| `text` | A menu, a board, a poster: something to read rather than look at |
| `other` | None of the above: a close portrait, an object with no place in it, a blank or broken image |

Edge cases settled by the owner's rounds:
- A church, library or museum under a blue sky is `exterior` or
  `interior`, never `view`.
- A barista at work or guests at a counter is `interior`.
- Drinks on a table in front of a city view are `food`.

Not yet settled. Mark these `unsure` until round 3 settles them:
- A monument in grounds: a fountain, a statue, a tank on display.
- A covered gallery looking into a courtyard.
- A garden that fills the frame, with a building only glimpsed: steps
  through it, benches in it, a pavilion among trees.

**Attributes** — `true`, `false`, or `null` when the photograph cannot
say (too dark, too cropped):

| key | true when |
|---|---|
| `brand` | A sign, logo or the place's name is legible in the frame |
| `wide` | The frame takes in the place as a whole (a room, a front, a terrace), not one dish, one corner or one shelf |
| `green` | Plants or trees are a noticeable part of the frame, not a single sprig |
| `daylight` | Lit mainly by natural daylight (sun, overcast sky, a window). Lamps or night makes it `false`. A close-up of a dish with no window or sky in frame often cannot say: `null` (31 of 137 in the trial) |
| `people` | One or more people are the subject or fill a large part of the frame. Passers-by in the distance are `false` |
| `staged` | It looks like an advertisement: a posed model, or text and graphics laid over the photograph |

Optional keys:
- `"unsure": true` when you would not bet on the `kind`. The app ignores
  unsure rows.
- `"note"` holds one short sentence, only for a case worth explaining.

## 4. Write

Write one line per sheet number into `labels.txt`, as you read each
sheet. `t`, `f` and `n` stand for true, false and null:

```
# n  kind      brand wide green daylight people staged  [unsure] ["note"]
12   food      f     f    f     n        f      f
27   interior  f     t    t     t        f      f       unsure "A covered gallery: inside or out."
```

Then:

```bash
python3 .claude/skills/photo-labels/write.py labels.txt "$SCRATCH/labels-<batch>/index.json" > write.sql
```

The script refuses a batch with a number missing or labelled twice. It
prints one statement, and you send that statement as a single MCP
`execute_sql` call. A relabel *merges* into the row, so keys added by a
later version survive an older run:

```sql
… on conflict (photo_id, scorer) do update
  set signals = public.photo_scores.signals || excluded.signals,
      scorer_version = greatest(public.photo_scores.scorer_version, excluded.scorer_version),
      scored_at = now();
```

Then read back the count for the batch's ids. A write that is reported as
failed but landed is common with MCP. Check before writing again.

## 5. Report

One query gives the numbers below. The cover is
`place_photos.is_cover`.

```sql
with l as (
  select pl.slug, p.is_cover, s.signals sg
  from public.photo_scores s
  join public.place_photos p on p.id = s.photo_id
  join public.places pl on pl.id = p.place_id
  where s.scorer = 'claude-labels' and pl.slug = any(array['<slug>']))
select
  (select json_object_agg(slug, n) from (select slug, count(*) n from l group by 1) x) per_place,
  (select json_object_agg(k, n) from (select sg->>'kind' k, count(*) n from l group by 1) x) kinds,
  (select json_agg(slug) from l where (sg->>'unsure')::boolean) unsure,
  (select json_agg(json_build_object('slug', slug, 'kind', sg->>'kind', 'wide', sg->'wide')) from l where is_cover) covers,
  (select json_agg(slug) from (select slug from l group by slug
     having not bool_or(sg->>'kind' = 'exterior') and not bool_or((sg->>'wide')::boolean)) x) no_establishing;
```

Report each of these:
- Photographs labelled, per place.
- The count per `kind`.
- Every `unsure`, and every `MISSING` photograph.
- Anything surprising: a cover that is `food`, `text` or `other` while the
  place has an `exterior` or `wide` photograph, or a place with no
  `exterior` and no `wide` photograph.

Do not change covers or hide photographs from here. That is the Threads
skill's and the desk's job, and it waits on round 3 (`docs/photo-labels.md`
§8).

## Growing the set

`VERSION` is 1. The `signals` of every row carry `"v"`. Four rules, from
`docs/photo-labels.md` §4:

1. **Never reuse a key for a new meaning.** A new meaning gets a new key.
2. **Adding a key changes nothing else.** Add it to the table in §3, to
   the `?&` list in step 1, and to `ATTRS` in `write.py`. Rows without the key come back from the query
   and are asked only for what they lack; the merge in step 4 keeps the
   rest.
3. **A new `kind` value, or a changed definition, means a new version.**
   Bump `VERSION` in `write.py` and the `scorer_version` in the query in
   step 1. Every older row then comes back to be labelled again.
4. **Write the change here first,** then copy it into
   `docs/photo-labels.md` §3, in the same PR.
