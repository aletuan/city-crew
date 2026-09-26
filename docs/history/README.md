# Provenance, not instructions

Plans and design specs for work that has since shipped. They are kept
because the reasoning in them is real — what was considered, what was
measured, what was ruled out — and because a decision is easier to revisit
when the argument behind it survived.

**Nothing here describes the code as it is now.** Where a plan and the
code disagree, the code is right and this folder is a record of how it got
there. Do not implement from these files, and do not cite them as the
current design.

They were written by an agent workflow that no longer runs, which is why
they read as instructions to someone. That someone was an earlier session,
and the work is done.

| | |
|---|---|
| `2026-09-19-map-view.md` | Explore's map — shipped, now `components/PlacesMap.tsx` and `MapPlaceCard.tsx`. |
| `2026-09-21-map-pin-images.md`, `-design.md` | Photographs on the map pins — shipped, now `components/mapPins.ts`. |
| `2026-09-22-datadesk-google-maps-design.md` | The data desk's Google Maps search — shipped. |

Where the current design lives instead: beside the code, in the comments
that explain it. `docs/` holds the notes that answer a question no single
file can — see the table at the end of `CLAUDE.md`.
