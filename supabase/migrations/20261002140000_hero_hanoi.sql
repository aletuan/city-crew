-- Hanoi's hero: the West Lake verse, with its shorter half on top.
--
-- "Mịt mù khói toả ngàn sương / Nhịp chày Yên Thái, mặt gương Tây Hồ"
-- was the hero since the city rows were seeded. Its English, "Smoke
-- drifts through a thousand mists", was the most opaque line on any
-- hero, and its line under ran to 59 characters. The owner chose the
-- other West Lake verse, the one every Hanoian can finish: "Gió đưa
-- cành trúc la đà / Tiếng chuông Trấn Vũ, canh gà Thọ Xương". Same lake,
-- same hour of the morning, and the hero photograph is the lake at
-- dusk. As with Saigon (20261002130000), the second half stays under
-- the headline, and the English and Japanese say the line is a verse.
--
-- Đà Nẵng and Vũng Tàu keep theirs, by the owner's word.

update public.cities set
  hero_title_en = 'The wind sways the bamboo low',
  hero_sub_en   = 'Trấn Vũ''s bell, the cock-crow of Thọ Xương — a folk verse',
  hero_title_vi = 'Gió đưa cành trúc la đà',
  hero_sub_vi   = 'Tiếng chuông Trấn Vũ, canh gà Thọ Xương',
  hero_title_ja = '風が竹の枝を低く揺らし',
  hero_sub_ja   = 'チャンヴーの鐘、トースーンの鶏の声 — 民謡'
where id = 'hanoi';
