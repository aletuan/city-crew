-- Rows that exist before the i18n migration runs, so its backfill has
-- something to carry over. Three shapes: a full Japanese row, a row with
-- one slot and whitespace in another, and a row with nothing Japanese at
-- all — which must come out with no "ja" key, not an empty one.
insert into public.places (slug, name_ja, desc_ja, neighborhood_ja) values
  ('i18n-full',  'カフェA', '川沿いのベンチ。', '1区'),
  ('i18n-desc',  '   ',    '木陰の芝生。',     null),
  ('i18n-none',  null,     null,              null);
