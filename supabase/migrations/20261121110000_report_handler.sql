-- Who answered a report (21 Nov 2026).
--
-- `reports.handled_by` has been in the table since the first migration
-- and was never written: the desk's "Nothing wrong" and "Done" update
-- `status` and `handled_at` from the browser and nothing else. A removal
-- left its editor in `moderation_log`; a dismissal left nobody. With one
-- editor that is a curiosity; with two it is a queue nobody can audit.
--
-- Written here, by the database, and not by the desk sending its own id:
-- an id from the client is whatever the client says, and the row should
-- name whoever actually answered. `auth.uid()` at the moment `status`
-- leaves 'new' is that person. The time is set beside it for the same
-- reason, so the two cannot disagree. A report put back to 'new' (the
-- desk has no button for it; SQL could) is unanswered again, and says so.
--
-- Rejected: a column default or a check that `handled_by = auth.uid()`
-- on the update policy. A default does not apply to an update, and a
-- check would refuse the desk's update until the desk sent the field —
-- the same trust in the client, with a worse failure.

create or replace function public.reports_set_handler() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'new' then
      new.handled_by := null;
      new.handled_at := null;
    else
      new.handled_by := auth.uid();
      new.handled_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists reports_set_handler on public.reports;
create trigger reports_set_handler
  before update on public.reports
  for each row execute function public.reports_set_handler();

-- The answers already given. A removal's editor is in the log, against
-- the same target, written in the same second as the report was marked;
-- that is a fact and is copied. A dismissal left nothing to copy from,
-- and guessing the one editor there was would be a record of a guess, so
-- those rows keep their null.
update public.reports r
   set handled_by = m.actor
  from public.moderation_log m
 where r.status = 'actioned'
   and r.handled_by is null
   and m.target_id = r.target_id
   and m.actor is not null
   and m.created_at between r.handled_at - interval '1 minute' and r.handled_at + interval '1 minute';
