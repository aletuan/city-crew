-- The category vocabulary, as the constraint enforces it.
--
-- The constraint is the third copy of a list that also lives in
-- app/src/lib/categories.ts and dashboard/src/categories.js, and it is the
-- copy that bites: a key the app offers but the constraint refuses fails
-- every import that uses it. This pins both directions for the 2026-08
-- additions — the new keys go in, an invented one still does not.

-- The whole new vocabulary in one row: accepted, or this block throws.
insert into public.places (slug, city_id, categories)
values ('t-cat-new', 'hcmc', '{focus,fun}');
delete from public.places where slug = 't-cat-new';

-- Widening must not have opened the door to arbitrary strings.
do $$
begin
  begin
    insert into public.places (slug, city_id, categories)
    values ('t-cat-bad', 'hcmc', '{cinema}');
    raise exception 'places_categories_known accepted an unknown key';
  exception
    when check_violation then null;  -- the constraint did its job
  end;
end $$;

delete from public.places where slug like 't-cat-%';
