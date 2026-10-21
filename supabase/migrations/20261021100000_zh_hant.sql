-- Traditional Chinese, as Taiwan writes it: the catalog's half.
--
-- The app has spoken it since #1113 (21 Oct 2026), as its own language,
-- `zh-Hant` — never standing in for Simplified, nor Simplified for it.
-- Two things here.
--
-- ── the key ──
--
-- `places.i18n` took two-letter keys only (20261013150000_place_i18n),
-- and `zh-Hant` is not one. The rule becomes a language and, optionally,
-- a script, as BCP 47 writes them: `zh-Hant`, and one day `sr-Latn`. A
-- region is still refused (`zh-TW`): the app chooses a language by its
-- script and has no row for a region, so a key it can never read is a
-- mistake, not a language. The case is BCP 47's own, a capital and three
-- small letters, so `zh-hant` is refused rather than kept beside the
-- `zh-Hant` the app reads.
--
-- ── the hero ──
--
-- Three columns, the shape the Simplified got in
-- 20261021061236_city_hero_zh, suffixed `_zh_hant` because a column name
-- has no hyphen (`localized.ts` maps the one to the other). The text is
-- the Simplified hero put through `app/scripts/hant.ts`, the converter
-- the interface's Traditional comes from, so the two read as one voice;
-- place names stay in Latin letters, as they do in Simplified.

create or replace function public.i18n_well_formed(doc jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(doc) = 'object'
     and not exists (
       select 1 from jsonb_each(doc) e
        where e.key !~ '^[a-z]{2}(-[A-Z][a-z]{3})?$' or jsonb_typeof(e.value) <> 'object'
     );
$$;

alter table public.cities
  add column if not exists hero_title_zh_hant text,
  add column if not exists hero_sub_zh_hant text,
  add column if not exists hero_cta_zh_hant text;

update public.cities set
  hero_title_zh_hant = '在 Nhà Bè，河水一分為二',
  hero_sub_zh_hant   = '去 Gia Định，去 Đồng Nai，歸人自歸 — 民謠'
where id = 'hcmc';

update public.cities set
  hero_title_zh_hant = '風吹竹枝，低低搖曳',
  hero_sub_zh_hant   = 'Trấn Vũ 的鐘聲，Thọ Xương 的雞鳴 — 民謠'
where id = 'hanoi';

update public.cities set
  hero_title_zh_hant = '我的家鄉有 Sông Hàn',
  hero_sub_zh_hant   = '有 Non Nước 的山，有 Sơn Trà 的洞。— 民謠'
where id = 'danang';

update public.cities set
  hero_title_zh_hant = '千松之城',
  hero_sub_zh_hant   = '愛這座高原小城的人，至今仍這樣叫它'
where id = 'dalat';

update public.cities set
  hero_title_zh_hant = '河水緩緩流過的地方',
  hero_sub_zh_hant   = 'Sông Hương，和一座不慌不忙的城市'
where id = 'hue';

update public.cities set
  hero_title_zh_hant = '傍晚，雲霧籠罩 Núi Lớn',
  hero_sub_zh_hant   = '船回舊碼頭，浪湧 Bãi Sau。— 民謠'
where id = 'vungtau';

update public.cities set
  hero_title_zh_hant = 'Hải Phòng 有 Sáu Kho 碼頭',
  hero_sub_zh_hant   = '有 Sông Tam Bạc，有水泥窯。— 民謠'
where id = 'haiphong';

update public.cities set
  hero_title_zh_hant = '一天之內，四季輪轉',
  hero_sub_zh_hant   = 'Melbourne 人這樣說自己城市的天氣'
where id = 'melbourne';

update public.cities set
  hero_title_zh_hant = 'Hội An 地窄人稠',
  hero_sub_zh_hant   = '人情淳厚，花葉繽紛。— 民謠'
where id = 'hoian';
