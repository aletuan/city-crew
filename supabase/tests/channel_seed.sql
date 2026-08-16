-- Rows shaped like the ones the `source` backfill had to attribute, put in
-- place *before* the migration runs — which is the only order that tests a
-- backfill rather than the insert path.
--
-- The shape is production's on the day the column was added: a seed minute,
-- two scan bursts capped at three photographs, isolated desk imports
-- reaching six, and phone rows carrying an account.

insert into public.places (slug, city_id, created_at, submitted_by) values
  -- seed: on the frozen candidate list, in the one minute it ran
  ('cafe-apartment', 'hcmc', timestamptz '2026-08-06 11:31Z', null),
  ('pho-le',         'hcmc', timestamptz '2026-08-06 11:31Z', null),
  -- scan: inside the Hanoi burst
  ('src-scan-a', 'hanoi', timestamptz '2026-08-08 07:01Z', null),
  ('src-scan-b', 'hanoi', timestamptz '2026-08-08 07:02Z', null),
  -- scan: inside the Da Nang burst
  ('src-scan-c', 'danang', timestamptz '2026-08-09 02:03Z', null),
  -- desk: outside every burst
  ('src-desk-a', 'hanoi', timestamptz '2026-08-09 15:41Z', null),
  ('src-desk-b', 'hanoi', timestamptz '2026-08-10 01:13Z', null),
  -- desk: *inside* a burst window, but with more photographs than
  -- scan-city ever asks for. The veto is what has to catch this one.
  ('src-desk-veto', 'hanoi', timestamptz '2026-08-08 07:01Z', null),
  -- phone: an account is on it
  ('src-phone-a', 'hanoi', timestamptz '2026-08-15 15:21Z', 'aaaaaaaa-0000-0000-0000-000000000001');

insert into public.place_photos (place_id, source)
select p.id, 'google' from public.places p, generate_series(1, 3)
 where p.slug in ('src-scan-a', 'src-scan-b', 'src-scan-c');
insert into public.place_photos (place_id, source)
select p.id, 'google' from public.places p, generate_series(1, 6)
 where p.slug in ('src-desk-a', 'src-desk-b', 'src-desk-veto', 'src-phone-a');

-- The allow-list the desk and scan channels are gated on. One account, and
-- it is what the actor backfill resolves against — with two it must decline
-- to guess, which the checks drive as well.
create table if not exists public.editors (email text primary key);
insert into auth.users (id, email, raw_user_meta_data)
     values ('eee00000-0000-0000-0000-00000000000e', 'desk@x.com', '{}')
on conflict (id) do nothing;
insert into public.editors (email) values ('desk@x.com') on conflict do nothing;
