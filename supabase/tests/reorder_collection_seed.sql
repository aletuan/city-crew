-- Written before `reorder_collection.sql` runs, because half of that
-- migration settles rows that already exist: a list whose members share a
-- position. Seeded the way the app used to leave them — 0, 2, 2 after a
-- removal and a save — and checked by `reorder_collection_test.sql`.

insert into public.places (id, slug, city_id, is_published, review_status) values
  ('e7000000-0000-0000-0000-000000000001', 'ord-a', 'hanoi', true, 'approved'),
  ('e7000000-0000-0000-0000-000000000002', 'ord-b', 'hanoi', true, 'approved'),
  ('e7000000-0000-0000-0000-000000000003', 'ord-c', 'hanoi', true, 'approved'),
  ('e7000000-0000-0000-0000-000000000004', 'ord-d', 'hanoi', true, 'approved')
on conflict (slug) do nothing;

insert into public.collections (id, slug, city_id, owner_id, is_public) values
  ('e7000000-0000-0000-0000-0000000000c1', 'ord-mine', 'hanoi', '11111111-1111-1111-1111-111111111111', false),
  ('e7000000-0000-0000-0000-0000000000c2', 'ord-tied', 'hanoi', '11111111-1111-1111-1111-111111111111', false),
  ('e7000000-0000-0000-0000-0000000000c3', 'ord-gappy', 'hanoi', '11111111-1111-1111-1111-111111111111', false)
on conflict (slug) do nothing;

insert into public.collection_places (collection_id, place_id, sort_order) values
  -- A tidy list, for the function.
  ('e7000000-0000-0000-0000-0000000000c1', 'e7000000-0000-0000-0000-000000000001', 0),
  ('e7000000-0000-0000-0000-0000000000c1', 'e7000000-0000-0000-0000-000000000002', 1),
  ('e7000000-0000-0000-0000-0000000000c1', 'e7000000-0000-0000-0000-000000000003', 2),
  -- The tie the old append left: b and c both at 2.
  ('e7000000-0000-0000-0000-0000000000c2', 'e7000000-0000-0000-0000-000000000001', 0),
  ('e7000000-0000-0000-0000-0000000000c2', 'e7000000-0000-0000-0000-000000000002', 2),
  ('e7000000-0000-0000-0000-0000000000c2', 'e7000000-0000-0000-0000-000000000003', 2),
  -- Gaps but no tie: nothing to settle, and it must be left exactly so.
  ('e7000000-0000-0000-0000-0000000000c3', 'e7000000-0000-0000-0000-000000000001', 0),
  ('e7000000-0000-0000-0000-0000000000c3', 'e7000000-0000-0000-0000-000000000002', 5)
on conflict do nothing;
