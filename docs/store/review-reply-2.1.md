# Reply to App Review — Guideline 2.1, Information Needed (submission de865382)

Apple asked for seven items after the 1.0.0 (6) submission. All seven were
answered on 1 Sep 2026: a 3999-character condensed version is in the Notes
field of App Review Information, the same text was posted as a Reply to App
Review, and the screen recording is attached to the version as
City-Crew-review.mp4 (H.264, 720x1560, 9.1 MB, 4m40s, captured on a physical
iPhone 15 Pro Max on iOS 26.3). The password typed during registration is
blurred between t=68s and t=115s. The blocks below are the long-form source
the submitted text was condensed from. Keep them in this
file rather than in `review-notes.md` until PR #450 lands, so the two do not
fight over the same lines.

## 2. Devices and iOS versions tested

```
Build 1.0.0 (6) has been installed and exercised through TestFlight on the
following physical devices. Both are running a current release of iOS.

  - iPhone 15 Pro Max - iOS 26.3 - 22 sessions
  - iPhone 17 Pro Max - iOS 26.6.1

Testing covered the full flow on each device: browsing Explore and the five
city guides signed out, opening place details and the map, running Search,
generating a plan, signing in with an email address and password, saving
places, creating and publishing a collection, saving a plan to Trips, and the
report and block controls in Collections and Crew.

The app is iPhone-only: iPad support is not declared (supportsTablet is false
in the Expo config) and the app is not submitted for iPad review.
```

## 3. What the app does, who it is for, what it solves

```
3. WHAT THE APP DOES, WHO IT IS FOR, WHAT IT SOLVES

What it does
City Crew is a city guide for five Vietnamese cities — Ho Chi Minh City,
Hanoi, Da Nang, Da Lat and Hue. It has four parts:

- EXPLORE: a catalog of cafes, restaurants, bars, viewpoints, parks and
  cultural sites, filtered by nine categories. Every place is approved by
  our editorial desk before it appears. No account needed.
- COLLECTIONS: themed lists — where to take a date, where to bring six
  friends, which cafes are worth the ride. Some are ours, some are
  published by users. Browsable signed out.
- PLANS: the feature that distinguishes the app. Pick a day, say afternoon
  or evening, say who is coming, and the app returns three short routes:
  places near each other, ordered so you reach each one while it is open.
  Edit the times, drop a stop, save it to Trips.
- CREW: add friends, invite them to a saved trip, see what they have been
  saving.

Who it is for
People deciding where to go out in a Vietnamese city today or this weekend
— residents more than tourists, though it works for both. The app ships in
English, Vietnamese and Japanese. It is rated 13+ because users can publish
collections and profiles, and because plan text is written by a language
model.

The problem it solves
Deciding where to go is not a search problem, it is a shortlisting problem.
The information already exists across review sites, map saves, Instagram
and group chats, and none of it answers "where should the four of us go on
Saturday evening". People end up with ten browser tabs, a map full of
unsorted pins, and a group chat where nobody decides. City Crew replaces
that with a short vetted catalog and a route that respects opening hours
and travel distance.

Scale
The catalog holds just over 400 editor-approved places across the five
cities, with more added weekly by our editorial desk.

What it is not
It is not a booking or reservation service. There are no transactions of
any kind in the app: no in-app purchases, no subscriptions, no payments,
and no commission from any venue. Listings are editorial choices, not paid
placements.
```

## 4. How to set up and reach the main features

Do not paste an account password into this file — it is committed. The demo
credentials live in the Sign-In Information fields on App Store Connect, and
the block below points Apple at them, which is what PR #450 requires.

```
4. SETTING UP AND REACHING THE MAIN FEATURES

No setup, no sample files and no configuration are needed. Install the
build and open it — the app opens straight onto browsable content.

Signed out, no account required
1. Launch the app. It asks once for location permission; allow or deny,
   either works. Denying opens the app on Ho Chi Minh City.
2. EXPLORE is the second tab and the default screen. Scroll to "Places" and
   use the nine category chips to filter.
3. Tap any place for its detail screen: photos, rating, price band,
   opening hours, address and a Route button.
4. COLLECTIONS tab > "Community" shows lists published by users. Tap one,
   then tap a place inside it.
5. Change city with the city chip at the top of Explore. Five cities are
   available: Ho Chi Minh City, Hanoi, Da Nang, Da Lat and Hue.
6. IDEAS tab makes a plan without an account: choose who is coming, pick
   one or more moods, pick a day and afternoon or evening, then tap
   "Sketch the plan". Three routes come back; tap one to open it.

Signed in
7. Sign in with the demo account provided in the Sign-In Information
   fields of this submission. It is an email address and a password.
8. Saving: tap the bookmark icon on any place card or detail screen.
9. Collections: COLLECTIONS tab > "Yours" > "New collection". A collection
   you create is private until you publish it from its detail screen.
10. Trips: open a plan from IDEAS and tap "Save to Trips". The TRIPS tab
    lists saved plans; invitations from friends appear at the top.
11. Crew: PROFILE tab > "Connect with friends".

Reporting, blocking and account deletion
12. To report a list: COLLECTIONS > "Community" > open any list you do not
    own > tap the "..." button in the header > "Report this list". Four
    reasons are offered: spam or advertising, offensive or hateful,
    pretending to be someone, something else.
13. To report or block a person: CREW tab > tap any person's row > the
    sheet offers "Report @handle", "Block @handle" and, for a friend,
    "Unfriend @handle". The same sheet opens from a request on the
    ACTIVITY screen. Blocking is silent and reversible from the Blocked
    list.
14. To delete the account: PROFILE tab > scroll to the bottom > "Delete
    account". The screen offers "Download your data" first, then deletes
    the account and all its content immediately and irreversibly.

If the demo account gives any trouble, contact us at anhlt1983@gmail.com
and we will provision another immediately.
```

## 5. External services, tools and platforms

```
5. EXTERNAL SERVICES

Backend and account services
- Supabase (supabase.com) — Postgres database, authentication (email +
  password), file storage for profile photos, and Edge Functions. This is our
  own project and holds the place catalog, user accounts, collections and
  trips.

AI
- Anthropic Claude (model claude-opus-5, via the official Anthropic SDK) —
  called only from our own Supabase Edge Function "plan-assist", never from
  the device. It writes the title of a plan and the one-line note under each
  stop, and parses a free-text request into the same answers the wizard chips
  produce. The model never selects a place: it receives the stops our own
  algorithm already chose from our editor-approved catalog, and the output
  schema restricts it to exactly those places. No personal data is sent with
  the call — no name, email, account id or location.

Place data
- Google Places API (places.googleapis.com) — supplies a place's name,
  address, coordinates, rating, opening hours and photos when a place is
  added to the catalog. Reached through our Edge Functions "fetch-place" and
  "scan-city" so the API key stays on our server; the app never calls Google
  directly. Photos are served from Google's place media endpoint with the
  attribution Google requires.

Geocoding
- Photon by Komoot (photon.komoot.io) and Nominatim by OpenStreetMap
  (nominatim.openstreetmap.org) — turn a typed address into coordinates in
  our "find-address" Edge Function. Both are open, keyless services.

Weather
- Open-Meteo (api.open-meteo.com) — the temperature shown on the Explore
  header. Free, keyless, and sent only a city's coordinates, never a user's.

Maps
- Apple MapKit — the map view uses react-native-maps, which on iOS renders
  with Apple's own map provider. No Google Maps SDK is bundled.

Build and delivery
- Expo Application Services (expo.dev) — builds the app and serves
  over-the-air JavaScript updates via expo-updates.

Static pages
- GitHub Pages (aletuan.github.io) — hosts our privacy policy, terms of
  service and support page.

The app contains no payment processor, no advertising network, and no
analytics or crash-reporting SDK. Nothing is sent to a third party for
tracking, and the app does not request App Tracking Transparency permission.
```

## 6. Regional differences

```
6. REGIONAL DIFFERENCES

The app functions identically in every region. There is no geo-gating, no
country check, and no region-specific feature, price or content anywhere in
the code.

- Content: the catalog is the same for every user in every country — five
  Vietnamese cities (Ho Chi Minh City, Hanoi, Da Nang, Da Lat, Hue). A user
  in Tokyo or New York sees exactly what a user in Saigon sees.
- Language: the interface and place descriptions are available in English,
  Vietnamese and Japanese. The app follows the device language and falls back
  to English for any other language. This is a device setting, not a regional
  one, and the user can change it by hand at Profile > Language.
- Location: the location permission is used once, on device, only to open the
  app on the nearest of the five supported cities. Denying it changes nothing
  else — the app opens on Ho Chi Minh City and the user picks a city by hand.
  Coordinates are never transmitted or stored.
- Price and availability: the app is free everywhere, with no in-app
  purchases or subscriptions, and is submitted for all 175 territories on the
  same terms.
```

## 7. Regulated industry and protected third-party material

```
7. REGULATED INDUSTRY AND THIRD-PARTY MATERIAL

City Crew does not operate in a regulated industry. It is a city guide: no
financial services, no healthcare, no gambling, no alcohol sales, no
ticketing, no transport booking and no transactions of any kind. Bars
appear as listings the same way cafes and museums do; nothing can be
ordered, reserved or purchased through the app.

Third-party material we display, and our authorisation for it:

- Place photos, names, addresses, ratings and opening hours come from the
  Google Places API under a Google Cloud project we own, used within the
  Google Maps Platform Terms of Service. Photographer attribution supplied
  by Google is stored with each photo and shown wherever that photo
  appears — on place detail screens, on trip cards and in the add-a-place
  flow.
- Place descriptions and collection copy are written by our own editorial
  desk. They are original text, not copied from review sites.
- Plan titles and the one-line note under each stop are generated by
  Anthropic's Claude through our own API account, from the stops our
  algorithm already selected. Output is ours to use commercially under
  Anthropic's commercial terms.
- User-published collections and profile content belong to the users who
  wrote them, published under the terms they accept at sign-up
  (https://aletuan.github.io/city-crew/terms.html).

No licence, permit or regulatory approval is required for any of this, and
we hold no protected material that would need one.
```
