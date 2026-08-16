-- Put a second account on the allow-list, and clear one desk row.
--
-- The actor backfill runs again after this. With two editors resolving,
-- nothing in the database can say which of them pressed Scan, so it has to
-- leave the row alone — and that is the assertion in `channel_guard_test`.
--
-- This is a separate file for one reason: the check has to re-run the
-- migration itself. Rehearsing its logic inline here would only ever prove
-- the rehearsal right, which is how the first version of this check passed
-- while the guard was deleted.

insert into auth.users (id, email, raw_user_meta_data)
     values ('eee00000-0000-0000-0000-00000000000f', 'desk2@x.com', '{}');
insert into public.editors (email) values ('desk2@x.com');

update public.places set added_by = null where slug = 'src-desk-a';
