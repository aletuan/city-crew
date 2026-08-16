-- The actor backfill has just run for a second time, with two accounts on
-- the allow-list. It must have declined.

do $$
begin
  assert (select added_by from public.places where slug = 'src-desk-a') is null,
    'the backfill picked an account while two editors could have done the work';
end $$;

-- And it must not have touched the rows it filled on the first pass either.
do $$
begin
  assert (select added_by from public.places where slug = 'src-desk-b')
         = 'eee00000-0000-0000-0000-00000000000e',
    'the second pass disturbed a row the first pass had already attributed';
end $$;

delete from public.places where slug like 'src-%' or slug in ('cafe-apartment', 'pho-le');
delete from public.editors where email in ('desk@x.com', 'desk2@x.com');

select 'all actor guard checks passed' as result;
