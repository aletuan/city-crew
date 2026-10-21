-- The Explore hero in Simplified Chinese.
--
-- The app has spoken Chinese since #1104–#1109 (21 Oct 2026), and the
-- hero is the first line of the first screen: until now it fell back to
-- English for a Chinese reader, a folk verse in a language that is
-- neither theirs nor the verse's. Three columns, the shape the Japanese
-- got in 20260810000000_city_hero and 20260815220000_city_hero_sub.
--
-- Place names stay as they are, in Latin letters — the owner's rule for
-- Chinese (21 Oct 2026): Nhà Bè, Sông Hàn, Bãi Sau, Melbourne. They are
-- the names on the signs and the map a visitor will be reading, and a
-- transliteration (岘港, 墨尔本) would be one more name to match against
-- them. The Japanese kept its katakana; Chinese does not follow it there.
--
-- Written in Chinese rather than turned out of the English, as the shape
-- in 20261002120000_hero_hue_dalat asks: the verse's line, then where it
-- comes from. No call to action is set for any city in any language yet,
-- so there is none to translate; the column is there for when there is.

alter table public.cities
  add column if not exists hero_title_zh text,
  add column if not exists hero_sub_zh text,
  add column if not exists hero_cta_zh text;

update public.cities set
  hero_title_zh = '在 Nhà Bè，河水一分为二',
  hero_sub_zh   = '去 Gia Định，去 Đồng Nai，归人自归 — 民谣'
where id = 'hcmc';

update public.cities set
  hero_title_zh = '风吹竹枝，低低摇曳',
  hero_sub_zh   = 'Trấn Vũ 的钟声，Thọ Xương 的鸡鸣 — 民谣'
where id = 'hanoi';

update public.cities set
  hero_title_zh = '我的家乡有 Sông Hàn',
  hero_sub_zh   = '有 Non Nước 的山，有 Sơn Trà 的洞。— 民谣'
where id = 'danang';

update public.cities set
  hero_title_zh = '千松之城',
  hero_sub_zh   = '爱这座高原小城的人，至今仍这样叫它'
where id = 'dalat';

update public.cities set
  hero_title_zh = '河水缓缓流过的地方',
  hero_sub_zh   = 'Sông Hương，和一座不慌不忙的城市'
where id = 'hue';

update public.cities set
  hero_title_zh = '傍晚，云雾笼罩 Núi Lớn',
  hero_sub_zh   = '船回旧码头，浪涌 Bãi Sau。— 民谣'
where id = 'vungtau';

update public.cities set
  hero_title_zh = 'Hải Phòng 有 Sáu Kho 码头',
  hero_sub_zh   = '有 Sông Tam Bạc，有水泥窑。— 民谣'
where id = 'haiphong';

update public.cities set
  hero_title_zh = '一天之内，四季轮转',
  hero_sub_zh   = 'Melbourne 人这样说自己城市的天气'
where id = 'melbourne';

update public.cities set
  hero_title_zh = 'Hội An 地窄人稠',
  hero_sub_zh   = '人情淳厚，花叶缤纷。— 民谣'
where id = 'hoian';
