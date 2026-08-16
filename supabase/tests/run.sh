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

run() { psql_ "$@"; }

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

# Independent of everything above — it needs only the places stub — but it
# runs last because it leaves the table as it found it and the checks
# before it do not expect extra rows.
echo "→ classification"
for f in "$ROOT"/supabase/migrations/*_needs_classification.sql; do
  run "$DB" -f "$f" >/dev/null
done
run "$DB" -f "$HERE/classification_test.sql"

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
