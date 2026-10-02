-- Saigon's hero: the verse everyone knows, and the shorter half of it.
--
-- "Đèn Sài Gòn ngọn xanh ngọn đỏ / Đèn Mỹ Tho ngọn tỏ ngọn lu" was the
-- hero since the city rows were seeded, and its second half is about
-- Mỹ Tho — a city two hours away, under Saigon's picture. The owner
-- chose the other verse every Saigonese knows: "Nhà Bè nước chảy chia
-- hai / Ai về Gia Định, Đồng Nai thì về", about the fork in the river
-- that made the city, and Gia Định is Saigon's own old name. Here the
-- second half stays as the line under the headline, because in
-- Vietnamese the reader hears the verse complete; the English and
-- Japanese lines carry the verse and say that it is one, since a reader
-- there does not know it.
--
-- 24 characters of Vietnamese headline against 29 before; the English
-- line under it 54 against 44, still one line on a 393pt phone.

update public.cities set
  hero_title_en = 'Nhà Bè, where the river parts in two',
  hero_sub_en   = 'Bound for Gia Định or Đồng Nai, go on home — a folk verse',
  hero_title_vi = 'Nhà Bè nước chảy chia hai',
  hero_sub_vi   = 'Ai về Gia Định, Đồng Nai thì về',
  hero_title_ja = 'ニャーベーで川は二つに分かれ',
  hero_sub_ja   = 'ジアディンへ、ドンナイへ、帰る人は帰れ — 民謡'
where id = 'hcmc';
