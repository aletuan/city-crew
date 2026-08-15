-- A handle is a handle. The @ is punctuation.
--
-- `collections.curator_handle` held two different kinds of value: the seed
-- migrations wrote `@hanoicrew` into it, while `stamp_curator` writes what
-- `profiles.handle` holds, which is bare. Both rendered, side by side, as
-- "by @hanoicrew" and "by anh".
--
-- The display could paper over that, and did. What it could not fix is the
-- comparison. `curator_handle` and `profiles.handle` are the same fact in
-- two tables, and `@hanoicrew` does not equal `hanoicrew` — so the moment
-- anything wants to join a byline to the profile behind it, which is the
-- first thing Connect will want, the join silently returns nothing. A
-- column that cannot be compared to its own counterpart is the bug; the
-- mismatched rendering was only the symptom that showed first.
--
-- So the value loses the sign, and the sign moves to where punctuation
-- belongs — the client, at the moment of drawing.

-- ─────────────────────────────────────────────────────────── the rows

update public.collections
   set curator_handle = ltrim(curator_handle, '@')
 where curator_handle like '@%';

-- ───────────────────────────────────────────────────── and staying so

/**
 * The byline, stamped from the profile and always bare.
 *
 * Two changes from the version this replaces. The stamp is normalised
 * rather than copied, and it now runs for editorial rows too — not to
 * *set* their handle, which is the desk's to choose, but to strip a sign
 * off whatever the desk chose.
 *
 * That second part is what makes the backfill above hold. A seed
 * migration written next month is free to say `@hanoicrew` again, the way
 * every existing one does, and the column stays clean regardless. Fixing
 * the rows without this would be tidying a room with the window open.
 *
 * Lowercased for the same reason: `profiles.handle` is stored lowercase
 * and constrained to `^[a-z0-9_]{3,20}$`, so anything that is going to be
 * compared against it has to arrive in the same case.
 */
create or replace function public.stamp_curator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is not null then
    if new.is_public then
      select p.handle into new.curator_handle
      from public.profiles p where p.id = new.owner_id;
    else
      new.curator_handle := null;
    end if;
  end if;
  -- Applies to every row, whoever set it and whatever they set it to.
  if new.curator_handle is not null then
    new.curator_handle := lower(ltrim(btrim(new.curator_handle), '@'));
    if new.curator_handle = '' then new.curator_handle := null; end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_curator() from anon, authenticated, public;
