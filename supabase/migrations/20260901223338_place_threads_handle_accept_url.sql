-- A fix applied to the live project and never committed; its change was
-- later folded into the file it fixes. Copied from the live history on
-- 25 Nov 2026, byte for byte, so the two histories name the same rows.
--
-- CI does not run this file: supabase/tests/run.sh picks its files by name.

create or replace function public.stamp_threads_handle()
returns trigger
language plpgsql
as $$
begin
  if new.threads_handle is not null then
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
