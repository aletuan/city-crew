-- Four names that still carried a slogan, read back off a phone.
--
-- `docs/place-naming.md`, rule 5: no slogan and no word for the kind of
-- place in a name — the category chip sits beside the title and says
-- what kind it is. The 19 Sep audit applied that rule to the week it
-- read; these four were already in the catalog before that week, and
-- surfaced on 8 October 2026 when the owner opened Tables 157 and read
-- "Dine.Wine.Share (Ho Chi Minh City)" under the title as a second
-- line of nothing.
--
-- Found by listing every published name with a spaced dash whose
-- qualifier the detail screen would still print — 54 of 832, after
-- `subtitleBeside` drops the ones the address repeats — and reading
-- them. Fifty are what the line is for: a branch, a building, a mall,
-- a ward the city renamed under it ("Thảo Điền"), or the second half
-- of a two-part name the earlier audit kept on purpose ("To – Hidden
-- Cocktails Bar", "Meili – Mì Bò Đài Loan"). These four are the ones
-- that only say what the chip says, or sell.
--
-- `LA RENNA` and `XOCOATI` keep their capitals: rule 1's exception,
-- the owner's own styling. `name_vi` follows `name_en`, as it did
-- before. Keyed on `slug`, so the file is idempotent; applied to
-- production on 8 October 2026 before this copy was committed.

update public.places set name_en = 'Tables 157', name_vi = 'Tables 157'
 where slug = 'tables-157-dine-wine-share-ho-chi-minh-city';
update public.places set name_en = 'LA RENNA', name_vi = 'LA RENNA'
 where slug = 'la-renna-italian-restaurant-wine';
update public.places set name_en = 'Le Café des Stagiaires', name_vi = 'Le Café des Stagiaires'
 where slug = 'le-cafe-des-stagiaires-rooftop-bistro';
update public.places set name_en = 'XOCOATI', name_vi = 'XOCOATI'
 where slug = 'xocoati-artisan-cocoa-drinks';
