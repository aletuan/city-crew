-- A switch the app reads at launch, that can be thrown without a build.
--
-- ── the first switch ──
--
-- `photo_attribution`: whether the app draws the photographer's credit
-- over a Google place photo. Google's terms ask for that credit wherever
-- one of its photos is shown, and the app has always drawn it. The
-- switch exists so that the decision to stop drawing it — or to start
-- again — is one row in this table rather than a release: flipped here,
-- every phone follows on its next launch, App Store builds included,
-- with no update to publish and nothing to wait for. A reversible
-- decision about a legal exposure has to be reversible in minutes.
--
-- ── the shape ──
--
-- Anyone may read; nobody may write through the API. The rows are
-- product decisions, and a product decision is taken in the SQL editor
-- by whoever is allowed to sit at it, not by a client. RLS on with one
-- policy, select, for everyone; the writes have no policy at all, which
-- under RLS is a refusal.
--
-- The app carries its own default for every key it knows (see
-- `app/src/lib/flags.ts`) and only lets a row here override it. A phone
-- with no signal, or a key this table has not got yet, behaves as the
-- app was shipped to — and for this key that is: credit shown.
create table if not exists public.app_flags (
  key        text primary key,
  enabled    boolean not null,
  note       text,
  updated_at timestamptz not null default now()
);
alter table public.app_flags enable row level security;
-- The grant is what makes the policy reachable, and it is written out
-- rather than left to the platform's default privileges: what the anon
-- key may do to this table is meant to be readable from this file.
grant select on table public.app_flags to anon, authenticated;
create policy "app flags are public" on public.app_flags
  for select to anon, authenticated using (true);

insert into public.app_flags (key, enabled, note) values
  ('photo_attribution', true,
   'Draw the photographer''s credit over Google place photos. Google''s terms ask for it; off is a deliberate, reversible decision.')
on conflict (key) do nothing;
