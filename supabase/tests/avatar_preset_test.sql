-- A new profile wears one of the eight animals unless it arrived with a
-- face of its own; see 20261020090000_preset_avatar_at_signup.sql.
-- Inside a transaction that is rolled back: the accounts made here are
-- only for asking, and nothing after this file should count them.

-- The backfill first: the migration ran just before this file, over every
-- profile the blocks above left behind, and some of those were blank.
do $$
declare blank int; dealt int;
begin
  select count(*) into blank from public.profiles where avatar_url = '';
  select count(*) into dealt from public.profiles where avatar_url like 'preset:%';
  assert blank = 0, format('%s profiles are still blank after the backfill', blank);
  assert dealt > 0, 'the backfill dealt nothing, so it was not tested';
end $$;

-- A face someone already had is not replaced by the backfill.
do $$
begin
  assert (select avatar_url from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'http://x/a.jpg',
    'the backfill replaced a face that was already there';
end $$;

begin;

-- Sign-up with nothing to say about a face, through the real path: the
-- auth row, then `handle_new_user`, then this trigger on its insert.
insert into auth.users (id, email, raw_user_meta_data) values
 ('a7000000-0000-0000-0000-000000000001', 'ava1@x.com', '{"handle":"ava_one","full_name":"Ava One"}');

do $$
declare got text;
begin
  select avatar_url into got from public.profiles where id = 'a7000000-0000-0000-0000-000000000001';
  assert got = any (array['preset:koala', 'preset:kangaroo', 'preset:wombat', 'preset:quokka',
                          'preset:platypus', 'preset:echidna', 'preset:kookaburra', 'preset:emu']),
    format('a blank sign-up should wear one of the eight animals, got %L', got);
end $$;

-- A face that came with the account is kept, whatever it is.
insert into auth.users (id, email, raw_user_meta_data) values
 ('a7000000-0000-0000-0000-000000000002', 'ava2@x.com', '{"handle":"ava_two","avatar_url":"https://x/a.jpg"}');

do $$
begin
  assert (select avatar_url from public.profiles where id = 'a7000000-0000-0000-0000-000000000002') = 'https://x/a.jpg',
    'a sign-up that brought its own face lost it';
end $$;

-- Taking the animal off is still the person's choice: Remove photo is an
-- UPDATE to '', and an update is left as written.
update public.profiles set avatar_url = '' where id = 'a7000000-0000-0000-0000-000000000001';
do $$
begin
  assert (select avatar_url from public.profiles where id = 'a7000000-0000-0000-0000-000000000001') = '',
    'clearing the face was undone';
end $$;

-- Every animal can be dealt, not one of them always. Two hundred draws
-- miss one of eight with odds near 2e-11.
insert into auth.users (id, email, raw_user_meta_data)
select ('a7100000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'many' || g || '@x.com', '{}'::jsonb
  from generate_series(1, 200) g;

do $$
declare dealt text[];
begin
  select array_agg(distinct avatar_url order by avatar_url) into dealt
    from public.profiles where id::text like 'a7100000-%';
  assert dealt = array['preset:echidna', 'preset:emu', 'preset:kangaroo', 'preset:koala',
                       'preset:kookaburra', 'preset:platypus', 'preset:quokka', 'preset:wombat'],
    format('two hundred sign-ups were dealt %s', dealt);
end $$;

do $$
begin
  assert not has_function_privilege('anon', 'public.default_avatar_preset()', 'execute'),
    'the trigger function is callable signed out';
  assert not has_function_privilege('anon', 'public.random_avatar_preset()', 'execute'),
    'the dealer is callable signed out';
end $$;

rollback;
