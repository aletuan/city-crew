-- The five names the October audit left alone, answered by the owner.
--
-- `20261002090000_place_import_audit_20261002.sql` set aside five names
-- whose half after the hyphen might be half the shop's name rather than
-- a suffix, and asked. The answer was: keep them. So both halves stay,
-- and the only change is the separator — the catalog's dash, which
-- `docs/place-naming.md` makes a typographic rule rather than a reading.
-- Keyed on slug; idempotent.

update public.places set name_en = 'Phát Ký — Mỳ gia Sài Gòn',             name_vi = 'Phát Ký — Mỳ gia Sài Gòn'             where slug = 'phat-ky-my-gia-sai-gon';
update public.places set name_en = 'Gòn — Bites & Veggies',                name_vi = 'Gòn — Bites & Veggies'                where slug = 'gon-bites-veggies';
update public.places set name_en = 'Tròn — Tondo',                         name_vi = 'Tròn — Tondo'                         where slug = 'tron-tondo';
update public.places set name_en = 'Tiệm nướng N&B — Pezzi coffee & Grill', name_vi = 'Tiệm nướng N&B — Pezzi coffee & Grill' where slug = 'tiem-nuong-n-b-pezzi-coffee-grill';
update public.places set name_en = 'Royal Botanic Gardens Victoria — Melbourne Gardens', name_vi = 'Royal Botanic Gardens Victoria — Melbourne Gardens' where slug = 'royal-botanic-gardens-victoria-melbourne-gardens';
