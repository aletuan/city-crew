-- A place's own Threads account.
--
-- Stored bare: no leading "@", lowercase. The same rule
-- `20260815200000_bare_handles.sql` set for `collections.curator_handle` — a
-- handle is a handle, the @ is punctuation, and the renderer puts it back.
-- Bare means one canonical form to compare, and one place (the URL builder in
-- `dashboard/src/lib/threads.js`) that knows whether Threads answers on .com
-- or .net this year. Meta has moved it once already.
--
-- The shape here is deliberately NOT the shape `app/src/lib/handle.ts`
-- enforces on our own profiles (^[a-z0-9_]{3,20}$). Threads uses the
-- Instagram username, which allows dots and runs to thirty characters, and
-- every real venue handle found in the first batch would have failed the
-- profile rule: `arata.pasta_saigon` and `moncoeur.bakery` on the dot,
-- `salem_socialbar_thaodien` on the length. Reusing that regex would have
-- rejected the whole set.
--
-- Nothing fills this automatically. Google Places does not return it, so
-- `import-place.ts` leaves it null and it stays null until the desk looks the
-- venue up by hand.

alter table public.places
  add column if not exists threads_handle text;

comment on column public.places.threads_handle is
  'The venue''s own Threads username, stored bare (no @, lowercase). Null when the venue has no Threads account, or when nobody has looked yet.';

alter table public.places
  drop constraint if exists places_threads_handle_shape;

alter table public.places
  add constraint places_threads_handle_shape
  check (threads_handle is null or threads_handle ~ '^[a-z0-9._]{1,30}$');

-- Normalise on the way in, the way `stamp_curator` does for curator_handle.
-- The desk already strips the @ before it sends, but the desk is not the only
-- writer: RLS lets any editor session reach this table directly and the seed
-- scripts write it too. The constraint above is the gate; this is what keeps
-- the gate from rejecting a value whose only problem was its punctuation.
create or replace function public.stamp_threads_handle()
returns trigger
language plpgsql
as $$
begin
  if new.threads_handle is not null then
    -- A pasted profile URL is the likeliest input, here as well as in the
    -- desk: it is what the clipboard holds. Take the handle out of it rather
    -- than failing the constraint on punctuation, and keep this in step with
    -- `normalizeThreads` in dashboard/src/lib/threads.js — if the two
    -- disagree, the desk sends something the table refuses.
    new.threads_handle := regexp_replace(
      btrim(new.threads_handle),
      '^(https?://)?(www\.)?threads\.(net|com)/', '', 'i');
    new.threads_handle := lower(ltrim(split_part(new.threads_handle, '/', 1), '@'));
    new.threads_handle := split_part(split_part(new.threads_handle, '?', 1), '#', 1);
    if new.threads_handle = '' then
      new.threads_handle := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists places_stamp_threads_handle on public.places;
create trigger places_stamp_threads_handle
  before insert or update of threads_handle on public.places
  for each row execute function public.stamp_threads_handle();
