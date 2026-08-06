# CityCrew Mockup — Organizer-First Redesign (Approach A)

**Date:** 2026-08-04
**File:** `CityCrew Mockup (standalone).html` (bundled standalone; app markup lives in the `__bundler/template` payload)

## Goal

Shift the first-stage mockup away from group voting. The primary persona is a
**single user** who either (a) organizes a city trip for their group, or
(b) uses the app alone to reference ideas for a trip. They can share plans and
collections with friends, and build their own collections.

## Decisions (confirmed with user)

1. **Share-only group model.** All voting/RSVP mechanics removed. The organizer
   builds the plan alone; a "Share plan" action sends a read-only link.
2. **Collections with two auth states.**
   - Guest: sees **public collections** (curated city idea lists) — the app has
     value with no account.
   - Signed in: sees a **combined view** — public collections + own collections
     + trips they organize.
3. **Both states demoed** via a Guest / Signed-in toggle next to the EN/VI toggle.

## Screen changes

- **Toggle:** new "Guest / Signed in" switch; `body.guest` class;
  `.auth-only` hidden for guests, `.guest-only` shown only for guests.
- **Home (Plans tab):**
  - Signed in: trip card ("Saturday in District 1") without RSVP/votes, with
    Share button; then "Your collections"; then "Public collections".
  - Guest: "Discover Ho Chi Minh City" hero, public collections, sign-in nudge.
  - "Pending votes" section removed.
- **Explore:** vote counts/buttons → bookmark "Save"; personal framing kept on
  same map + cards layout.
- **Ideas (wizard):** unchanged structurally — organizer still picks
  Friends/Family/Couple as trip context; output is a draft only they edit.
- **Itinerary:** "going/maybe" chips and "(3/5 voted)" removed; header gains
  Share (read-only link) action.
- **Place detail:** votes → saved count; buttons: "Add to plan" +
  "Save to collection".
- **Saved tab → Collections screen** (new `s-collections`): public collections
  for everyone; "My collections" (with per-collection share) signed-in only.
  Profile stays a stub.
- **Copy:** page intro and "What each screen demonstrates" notes updated
  (EN + VI) to describe the organizer/reference/collections concept.

## Out of scope

Real auth, backend, editing collections, group voting (future stage).
