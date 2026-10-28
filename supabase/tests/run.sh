#!/usr/bin/env bash
# Run the migration against a throwaway Postgres and assert what it did.
#
# Not a Supabase stack — no GoTrue, no PostgREST, no JWT. `_harness.sql`
# stubs the two pieces of auth the migrations actually touch. That is
# enough to test the SQL we wrote, which is the part we can get wrong,
# and honest about not testing the part we did not.
#
#   supabase/tests/run.sh
#
# Needs a local postgres (any 14+) on PATH via pg_ctl/initdb.
# Set PG_URL to use a server that is already running (CI); leave it unset
# and a throwaway cluster is created and torn down here (a laptop).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA="${PGDATA:-/var/lib/postgresql/citycrew-test}"
PORT="${PORT:-55432}"
DB=citycrew_test

# Runs as whichever user owns the cluster; postgres refuses to start as root.
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$1"; else bash -c "$1"; fi; }

if [ -n "${PG_URL:-}" ]; then
  psql_() { psql "$PG_URL/$1" -q -v ON_ERROR_STOP=1 "${@:2}"; }
  admin() { psql "$PG_URL/postgres" -q -v ON_ERROR_STOP=1 "$@"; }
else
  psql_() { psql -h /tmp -p "$PORT" -U tester -d "$1" -q -v ON_ERROR_STOP=1 "${@:2}"; }
  admin() { psql -h /tmp -p "$PORT" -U tester -d postgres -q -v ON_ERROR_STOP=1 "$@"; }
fi

if [ -z "${PG_URL:-}" ]; then
echo "→ fresh cluster at $PGDATA"
as_pg "$PGBIN/pg_ctl -D $PGDATA stop -m immediate" >/dev/null 2>&1 || true
rm -rf "$PGDATA"; mkdir -p "$PGDATA"
[ "$(id -u)" = 0 ] && chown postgres:postgres "$PGDATA"
as_pg "$PGBIN/initdb -D $PGDATA -U tester --auth=trust" >/dev/null
as_pg "$PGBIN/pg_ctl -D $PGDATA -o '-k /tmp -p $PORT -h \"\"' -l $PGDATA/log start" >/dev/null
trap 'as_pg "$PGBIN/pg_ctl -D $PGDATA stop -m immediate" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 20); do
  psql -h /tmp -p "$PORT" -U tester -d postgres -c 'select 1' >/dev/null 2>&1 && break
  sleep 0.5
done
fi

# `ASK_ONCE_EVERY_STEP=1` is the second pass, which CI also runs:
# the ask-once rewrite is applied after every migration, so every RLS test
# below runs against rewritten policies. If the rewrite changed any rule,
# a test written for that rule fails.
ASK_ONCE="$(ls "$ROOT"/supabase/migrations/*_rls_ask_once.sql)"
run() {
  psql_ "$@"
  if [ -n "${ASK_ONCE_EVERY_STEP:-}" ] && [[ "$*" == *"/supabase/migrations/"* ]]; then
    psql_ "$1" -f "$ASK_ONCE" >/dev/null
  fi
}

admin -c "drop database if exists $DB;" -c "create database $DB;"
echo "→ auth stub"
run "$DB" -f "$HERE/_harness.sql"

echo "→ accounts that predate the table"
run "$DB" <<'SQL'
insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','a@x.com','{"full_name":"Tuan Anh Le","location":"Hanoi","bio":"Coffee","interests":"Cafe","avatar_url":"http://x/a.jpg"}'),
 ('22222222-2222-2222-2222-222222222222','b@x.com','{"full_name":"Minh Anh"}'),
 ('33333333-3333-3333-3333-333333333333','c@x.com','{}');
SQL

echo "→ migrations"
for f in "$ROOT"/supabase/migrations/*_profiles.sql; do
  run "$DB" -f "$f" >/dev/null
done

echo "→ checks"
run "$DB" -f "$HERE/profiles_test.sql"

# Publishing needs a collections table to attach policies to, and profiles
# to read a byline from — so it runs after the block above rather than
# beside it.
echo "→ collections stub"
run "$DB" -f "$HERE/_collections.sql"
for f in "$ROOT"/supabase/migrations/*_user_collections.sql \
         "$ROOT"/supabase/migrations/*_publish_collections.sql \
         "$ROOT"/supabase/migrations/*_place_submissions.sql \
         "$ROOT"/supabase/migrations/*_bare_handles.sql; do
  run "$DB" -f "$f" >/dev/null
done

echo "→ publish checks"
run "$DB" -f "$HERE/publish_test.sql"

echo "→ submission checks"
run "$DB" -f "$HERE/submissions_test.sql"

# The policies, exercised rather than read. Everything above asserts a
# policy's text; these three files sit a client that owns nothing at the
# tables and check what it can and cannot do. That needs the read side the
# public gets and the editor's key to everything — `mobile_editor_auth`,
# which the harness now has enough of auth and storage to run — plus the
# member writes and the avatar bucket, so the policies under test are the
# ones production runs and not a subset.
echo "→ rls, exercised"
for f in "$ROOT"/supabase/migrations/*_mobile_editor_auth.sql \
         "$ROOT"/supabase/migrations/*_own_collection_members.sql \
         "$ROOT"/supabase/migrations/*_avatars_bucket.sql \
         "$ROOT"/supabase/migrations/*_avatar_cooldown.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/profiles_rls_test.sql"
run "$DB" -f "$HERE/collections_rls_test.sql"
run "$DB" -f "$HERE/submissions_rls_test.sql"

# Trips need the accounts, the places stub and the cities stub — all of
# which the blocks above have already put in place.
echo "→ trips"
for f in "$ROOT"/supabase/migrations/*_trips.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/trips_test.sql"

# Preferences and history need the accounts and the places stub. Run after
# trips because both blocks insert into the shared places stub and this one
# clears only its own tables.
echo "→ preferences"
for f in "$ROOT"/supabase/migrations/*_preferences.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/preferences_test.sql"

# Independent of everything above — it needs only the places stub — but it
# runs last because it leaves the table as it found it and the checks
# before it do not expect extra rows.
# Nothing to seed and nothing to leave behind: the table is new and the
# checks read the catalog, not the rows.
echo "→ ops tokens"
for f in "$ROOT"/supabase/migrations/*_ops_tokens.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/ops_tokens_test.sql"

# Same again: a new table, and the checks read the catalog and one seed row.
echo "→ app flags"
for f in "$ROOT"/supabase/migrations/*_app_flags.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/app_flags_test.sql"

echo "→ classification"
for f in "$ROOT"/supabase/migrations/*_needs_classification.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/classification_test.sql"

# The vocabulary constraint, applied to the stub the blocks above have
# been writing into. Runs after classification because that block expects
# the table as it found it, and before channel because from here on every
# seeded row has to clear the constraint — which is itself part of the
# test: a seed that stops parsing is a vocabulary change nobody finished.
echo "→ category vocabulary"
for f in "$ROOT"/supabase/migrations/*_focus_fun_categories.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/categories_test.sql"

# The backfill reads rows that already exist, so its test inserts them
# first and the migration runs *after* — the reverse of every block above,
# and the only order that exercises what the migration actually did.
echo "→ channel"
run "$DB" -f "$HERE/channel_seed.sql"
for f in "$ROOT"/supabase/migrations/*_place_source.sql \
         "$ROOT"/supabase/migrations/*_place_channel.sql \
         "$ROOT"/supabase/migrations/*_desk_scan_actor.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/channel_test.sql"

# And the actor backfill's one guard, driven against the migration itself
# rather than a copy of it: put a second account on the allow-list, run the
# same file again, and check it declined to choose between them.
run "$DB" -f "$HERE/channel_two_editors.sql"
for f in "$ROOT"/supabase/migrations/*_desk_scan_actor.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/channel_guard_test.sql"

# Likes on a public collection, and the shelf order they decide. The
# migration needs `collections` to already exist, which the user-collections
# block above has done by here.
echo "→ collection likes"
# The second file narrowed the insert policy so a curator could not like
# their own list; the third widens it back and moves the curator's vote out
# of the ranking instead. Both are named for what they do rather than for
# the table — so they are listed, not globbed for. Order matters: each
# replaces a policy the one before it made.
for f in "$ROOT"/supabase/migrations/*_collection_likes.sql \
         "$ROOT"/supabase/migrations/*_own_collection_not_likeable.sql \
         "$ROOT"/supabase/migrations/*_self_likes_shown_not_ranked.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/collection_likes_test.sql"

# Trip invitations: a membership table, and the first migration in this
# schema that deliberately widens a read. Needs `trips` from the block
# above and `friendships` for the accepted-friend check its insert policy
# makes — friendships has not been run here before, so it comes with it.
# That is also what pins this block here rather than beside the trips one:
# `friendships` declares `likes_on_mine` over `collection_likes`, so it
# cannot run until the likes block below has made that table.
#
# Its test does something no other file here does: it forces RLS on and
# drives the policies as a role that owns nothing, because static policy
# text cannot show what a client actually gets back.
echo "→ trip invites"
for f in "$ROOT"/supabase/migrations/*_friendships.sql \
         "$ROOT"/supabase/migrations/*_trip_invites.sql \
         "$ROOT"/supabase/migrations/*_trip_invites_leave.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/trip_invites_test.sql"

# `updated_at` stamping. Late, because it attaches a trigger to four tables
# and every one of them has to exist by the time it runs — `places` and
# `category_terms` from the stub, `trips` and `preferences` from their own
# migrations above.
echo "→ updated_at"
for f in "$ROOT"/supabase/migrations/*_stamp_updated_at.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/updated_at_test.sql"

# Recording on by default, and a row for every account. After the block
# above rather than inside it, for the same reason the channel block runs
# after its seed: the backfill acts on rows that already exist, and
# `preferences_test.sql` inserts its own preference rows by hand — rows this
# migration would have made first, turning two of that file's checks into
# primary-key collisions.
#
# Its filename says what it does rather than which table it touches, so the
# `*_preferences.sql` glob above does not reach it. Listed, not globbed for
# — the same trap the collection-likes block notes, and the one this block
# was added to fix after CI caught the migration never running at all.
echo "→ history on by default"
for f in "$ROOT"/supabase/migrations/*_history_on_by_default.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/history_default_test.sql"

# The theme column (12 Oct 2026). After the block above for the same
# reason that block runs after `preferences_test.sql`: the test updates
# the rows the backfill made. Listed, not globbed, for the same trap.
echo "→ theme on the account"
for f in "$ROOT"/supabase/migrations/*_preferences_theme.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/preferences_theme_test.sql"

# The grid notice's column (22 Oct 2026), beside the theme and after it
# for the same reason. Listed, not globbed, for the same trap.
echo "→ grid notice on the account"
for f in "$ROOT"/supabase/migrations/*_preferences_grid_notice.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/preferences_grid_notice_test.sql"

# Which themes are popular (12 Oct 2026): the count function, then the
# share function that replaced it the same day. After the column they
# read; the test seeds and removes its own ten accounts.
echo "→ popular themes"
for f in "$ROOT"/supabase/migrations/*_theme_counts.sql \
         "$ROOT"/supabase/migrations/*_popular_themes.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/popular_themes_test.sql"

# Every language beyond EN and VI in one column (13 Oct 2026). The JA
# columns' own migration has never run on this bench — it also touches
# `collections` and `cities`, which the stubs above provide by now — so it
# runs first; then the seed, because the backfill carries over rows that
# already exist; then the column and its mirror. The test leaves the stub
# as it found it.
echo "→ place i18n"
for f in "$ROOT"/supabase/migrations/*_japanese_content_columns.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/place_i18n_seed.sql"
for f in "$ROOT"/supabase/migrations/*_place_i18n.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/place_i18n_test.sql"

# The daily caps. After preferences and the collection blocks, because the
# policies it rewrites count rows in those tables; it seeds and removes
# its own account.
echo "→ daily caps"
for f in "$ROOT"/supabase/migrations/*_daily_caps.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/daily_caps_test.sql"

# The editorial identities. Last of all, because it walks the whole path a
# real sign-up takes — reservations lifted, the trigger building profiles
# from metadata, reservations restored — and every block above expects the
# profile and reservation tables as the first block left them.
echo "→ editorial identities"
for f in "$ROOT"/supabase/migrations/*_editorial_identities.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/editorial_test.sql"

# The desk adopting those same identities' lists. Right after them: the
# function it adds only has anything to move once the editorial rows
# exist, and the test seeds a desk account of its own because a bench has
# none of the real one.
echo "→ editorial collections adopted"
for f in "$ROOT"/supabase/migrations/*_editorial_collections_to_owner.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/editorial_adopt_test.sql"

# The safety layer: blocking, reporting, the desk's moderation actions, and
# the launch traces. None of these migrations had run on this bench before
# — a block could have been refusing nothing, a report readable by the
# person it named, and nothing here would have said so. Last, after the
# editorial block, because every table they reach (profiles, collections,
# likes, friendships) is in place by then, and each file below makes and
# removes its own accounts rather than borrowing the ones above.
#
# Applied in the order production applied them: `named_applause` replaces
# `likes_on_mine`, and `blocks` replaces it again with the block filter,
# along with the friend-request policy — so the later file has to win.
echo "→ safety: blocks, reports, moderation"
# Supabase grants execute on every new function to `anon` and
# `authenticated` through default privileges, and `revoke ... from public`
# does not take that back — which is how a definer function granted only
# to `authenticated` in its migration ended up callable signed out. From
# here on the bench does the same, so a migration that means to close a
# function to `anon` has to say so, as it would on the real project.
run "$DB" -c "alter default privileges in schema public grant execute on functions to anon, authenticated;"
for f in "$ROOT"/supabase/migrations/*_named_applause.sql \
         "$ROOT"/supabase/migrations/*_blocks.sql \
         "$ROOT"/supabase/migrations/*_suggested_friends.sql \
         "$ROOT"/supabase/migrations/*_reports.sql \
         "$ROOT"/supabase/migrations/*_moderation_actions.sql \
         "$ROOT"/supabase/migrations/*_startup_traces.sql \
         "$ROOT"/supabase/migrations/*_report_cap_and_photo_reads.sql \
         "$ROOT"/supabase/migrations/*_block_pair_not_probeable.sql \
         "$ROOT"/supabase/migrations/*_close_signed_in_functions_to_anon.sql \
         "$ROOT"/supabase/migrations/*_moderation_log.sql \
         "$ROOT"/supabase/migrations/*_collection_copies.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/reports_rls_test.sql"
run "$DB" -f "$HERE/blocks_rls_test.sql"
run "$DB" -f "$HERE/likes_moderation_rls_test.sql"
run "$DB" -f "$HERE/moderation_log_test.sql"
run "$DB" -f "$HERE/collection_copies_test.sql"

# The second writer `place_photos` has ever had. Inside this block rather
# than after it, and the reason is the `alter default privileges` line
# above: that is what makes a newly created function callable by `anon`
# on the bench the way Supabase makes it on the project. Run before it
# and this migration's three revokes would be taking back a grant that
# was never made — passing `function_grants_test.sql` by accident and
# proving nothing. Run here and both that file and `search_path_test.sql`
# sweep these functions along with every other.
echo "→ local guides"
for f in "$ROOT"/supabase/migrations/*_local_guide_photos.sql \
         "$ROOT"/supabase/migrations/*_uploaders_read_own_photos.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/local_guide_test.sql"

run "$DB" -f "$HERE/function_grants_test.sql"

# The two social handles, and then search paths. The handle migrations are
# applied here rather than above because nothing earlier needs them — each
# only adds a column and a trigger to the stub's `places` — and applying
# them here puts both triggers in front of `search_path_test.sql`, which is
# the check that matters for a function with no `set search_path` of its own.
echo "→ social handles"
for f in "$ROOT"/supabase/migrations/*_place_threads_handle.sql \
         "$ROOT"/supabase/migrations/*_place_instagram_handle.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/instagram_handle_test.sql"

# Which picture stands for a place once a reader has added one. Before the
# search-path sweep on purpose: that block asserts every function in the
# schema pins its own path, and this one is a `security definer` that has
# to be in the database by the time it looks.
echo "→ upload covers"
for f in "$ROOT"/supabase/migrations/*_guide_upload_becomes_cover.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/upload_cover_test.sql"

# The gallery a guide keeps. After the upload-cover block, whose trigger
# the seed here has to undo first, and before the search-path sweep, which
# has to find these definer functions already in the schema.
echo "→ gallery rpcs"
for f in "$ROOT"/supabase/migrations/*_gallery_guide_rpcs.sql "$ROOT"/supabase/migrations/*_gallery_same_rights.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/gallery_rpc_test.sql"

# Per-city grants. Last of the four migrations that touch these policies,
# so it is applied last here too — the order production applies them in,
# and the only order in which the schema under test is the one we ship.
echo "→ local guides, per city"
for f in "$ROOT"/supabase/migrations/*_local_guides_per_city.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/local_guide_city_test.sql"

# The desk's hand on every gallery. After the per-city grants, which
# last redefined `guide_may_manage`, and before the search-path sweep,
# which has to find the function as it now stands.
echo "→ editors keep every gallery"
for f in "$ROOT"/supabase/migrations/*_editors_keep_every_gallery.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/editor_gallery_test.sql"

# Photo scores (15 Oct 2026). Right after the editors' gallery block:
# the write policies ask `guide_may_manage` as that block left it, and the
# test reuses its editor and guides.
echo "→ photo scores"
for f in "$ROOT"/supabase/migrations/*_photo_scores.sql; do
  run "$DB" -f "$f" >/dev/null
done
# Per scorer (16 Oct 2026), applied before either test: the first test
# passing unchanged on the re-keyed table is the proof that phones on
# the older JavaScript, which upsert on `photo_id` alone, still land.
for f in "$ROOT"/supabase/migrations/*_photo_scores_per_scorer.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/photo_scores_test.sql"
run "$DB" -f "$HERE/photo_scores_per_scorer_test.sql"
# The second scorer (17 Oct 2026), after both: they hold the table as it
# was, one row per photograph, and this drops that rule.
for f in "$ROOT"/supabase/migrations/*_photo_scores_second_scorer.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/photo_scores_second_scorer_test.sql"

# Cover reviews (17 Oct 2026): the desk's answer to a suggested cover.
# After the editors' gallery block, whose editor and guide it reuses.
echo "→ cover reviews"
for f in "$ROOT"/supabase/migrations/*_cover_reviews.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/cover_reviews_test.sql"

echo "→ search paths"
for f in "$ROOT"/supabase/migrations/*_pin_trigger_search_path.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/search_path_test.sql"

# One home for public identity. Last, because it redefines the sign-up
# trigger every block above has been creating accounts through, and adds a
# BEFORE UPDATE trigger on `auth.users` that nothing earlier should meet.
echo "→ profile metadata"
for f in "$ROOT"/supabase/migrations/*_profile_metadata_single_source.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/profile_metadata_test.sql"

# The Google refresh: five columns on `places` and the memory that tells
# Google's website and phone from the desk's. Needs only the stub table.
echo "→ google refresh"
for f in "$ROOT"/supabase/migrations/*_google_refresh.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/google_refresh_test.sql"

# Every policy asks who you are once per query. Last, so it rewrites every
# policy the blocks above created; a block added after it must write
# `(select auth.uid())` itself, and the test below fails until it does.
echo "→ rls asks once"
for f in "$ROOT"/supabase/migrations/*_rls_ask_once.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/rls_ask_once_test.sql"

# Ordering your own list. The migration settles ties that already exist,
# so — as for the channel backfill — the rows go in first and the
# migration runs after them.
echo "→ reorder collection"
run "$DB" -f "$HERE/reorder_collection_seed.sql"
for f in "$ROOT"/supabase/migrations/*_reorder_collection.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/reorder_collection_test.sql"
echo "→ guest narration"
for f in "$ROOT"/supabase/migrations/*_guest_narration.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/guest_narration_test.sql"

# Check-ins: a table of the reader's own visits. Needs `places` and the
# auth stub, and the ask-once convention, so after that block.
echo "→ check-ins"
for f in "$ROOT"/supabase/migrations/*_checkins.sql "$ROOT"/supabase/migrations/*_checkins_per_place.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/checkins_test.sql"

# The owner's chips on a collection (15 Oct 2026): two columns and their
# checks. Needs only `collections`, which every block above has had.
echo "→ collection kinds"
for f in "$ROOT"/supabase/migrations/*_collection_kinds.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/collection_kinds_test.sql"

# A new profile is dealt one of the bundled animals (20 Oct 2026). Last,
# because from here every blank sign-up gets a face, and the profile
# checks above expect the column as sign-up left it.
echo "→ avatar at sign-up"
for f in "$ROOT"/supabase/migrations/*_preset_avatar_at_signup.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/avatar_preset_test.sql"

# Traditional Chinese (21 Oct 2026): `places.i18n` takes a language and
# its script, `zh-Hant`, and cities gain the hero's three columns.
echo "→ traditional chinese"
for f in "$ROOT"/supabase/migrations/*_zh_hant.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/zh_hant_test.sql"

# A public list stays public around a place that is not live (23 Oct
# 2026): the place goes unseen instead of the list. Last, because it
# removes the triggers `submissions_test` above asserts, and changes the
# rule `blocks_rls_test`'s fixture was written around.
echo "→ lists stay public around places that are not live"
for f in "$ROOT"/supabase/migrations/*_lists_stay_public_around_unlive_places.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/lists_public_around_unlive_test.sql"

# A day's allowance for asking Google (24 Oct 2026): `fetch-place`'s search
# and reverse, counted per account and for everyone. Its own table and a
# definer function, needing nothing above but the roles.
echo "→ fetch-place allowance"
for f in "$ROOT"/supabase/migrations/*_fetch_place_allowance.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/fetch_place_allowance_test.sql"

# Friend suggestions from four sources, and the × (25 Oct 2026): likes,
# copies, shared places and check-ins, each with its reason, and a table of
# the people a reader put away. Reads likes, copies, check-ins, friendships
# and blocks, all in place by now.
echo "→ friend suggestions"
for f in "$ROOT"/supabase/migrations/*_friend_suggestions.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/friend_suggestions_test.sql"

# The review pace (28 Oct 2026): one column on `places` that
# `refresh-places` fills with new Google reviews per 30 days.
echo "→ review pace"
for f in "$ROOT"/supabase/migrations/*_review_pace.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/review_pace_test.sql"
