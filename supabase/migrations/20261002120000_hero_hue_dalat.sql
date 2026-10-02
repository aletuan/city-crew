-- Two hero headlines rewritten to Melbourne's shape.
--
-- Melbourne's hero reads "Four seasons in one day" over "How Melburnians
-- talk about their own weather": a five-word saying that stands on its
-- own, and a line that says where the saying comes from. The six
-- Vietnamese cities read differently — the first half of a folk verse as
-- the headline, the second half plus a source as the line under it.
-- Beautiful in Vietnamese, where the reader knows the verse; in English
-- and Japanese, where nobody does, it is one strange line over another,
-- and the longest of them (Huế's, 77 characters in English; Đà Lạt's, 49
-- in Vietnamese) wrap onto a third line beside a 30pt weather pill.
--
-- The owner approved the rewrite for two cities to start. The shape:
-- a headline of five words or so that a local would actually say, a line
-- under it that says what the headline is, and each language written in
-- its own words rather than translated from the English. The other four
-- cities keep their verses until each has a line of its own worth having.

update public.cities set
  hero_title_en = 'The city of a thousand pine trees',
  hero_sub_en   = 'What the hill station is called by those who love it',
  hero_title_vi = 'Thành phố ngàn thông',
  hero_sub_vi   = 'Tên gọi những ai yêu Đà Lạt vẫn dùng',
  hero_title_ja = '千本の松の街',
  hero_sub_ja   = 'この高原の街を愛する人が今も使う呼び名'
where id = 'dalat';

update public.cities set
  hero_title_en = 'Where the river runs slow',
  hero_sub_en   = 'The Perfume River, and a city that keeps its pace',
  hero_title_vi = 'Nơi dòng sông chảy chậm',
  hero_sub_vi   = 'Sông Hương, và một thành phố giữ nhịp riêng',
  hero_title_ja = '川がゆっくり流れる場所',
  hero_sub_ja   = '香江と、自分の歩幅を守る街'
where id = 'hue';
