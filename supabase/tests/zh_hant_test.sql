-- Traditional Chinese (20261021100000_zh_hant): the key `places.i18n`
-- now takes, and the hero columns the app asks for.

do $$
declare got text;
begin
  insert into public.places (slug) values ('hant-obj');

  -- A language and its script, as BCP 47 writes them.
  update public.places set i18n = '{"zh-Hant": {"desc": "湖邊的咖啡館。"}}'::jsonb
   where slug = 'hant-obj' returning i18n -> 'zh-Hant' ->> 'desc' into got;
  assert got = '湖邊的咖啡館。', format('a zh-Hant entry read back as %L', got);

  -- Two-letter codes still pass, beside it.
  update public.places set i18n = '{"zh": {"desc": "湖边。"}, "zh-Hant": {"desc": "湖邊。"}}'::jsonb
   where slug = 'hant-obj';

  -- Not a region, which the app has no row for; not the wrong case,
  -- which would be a second key beside the one the app reads; not a
  -- script longer or shorter than four letters.
  begin
    update public.places set i18n = '{"zh-TW": {}}'::jsonb where slug = 'hant-obj';
    assert false, 'a region was accepted as a key';
  exception when check_violation then null;
  end;
  begin
    update public.places set i18n = '{"zh-hant": {}}'::jsonb where slug = 'hant-obj';
    assert false, 'a script in the wrong case was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.places set i18n = '{"zh-Hants": {}}'::jsonb where slug = 'hant-obj';
    assert false, 'a five-letter script was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.places set i18n = '{"zh-Hant": "text"}'::jsonb where slug = 'hant-obj';
    assert false, 'a string under a script key was accepted';
  exception when check_violation then null;
  end;

  delete from public.places where slug = 'hant-obj';
end $$;

-- The hero: three columns, there to be read.
do $$
begin
  assert (select count(*) from information_schema.columns
           where table_schema = 'public' and table_name = 'cities'
             and column_name in ('hero_title_zh_hant', 'hero_sub_zh_hant', 'hero_cta_zh_hant')) = 3,
    'the Traditional hero columns are missing';
end $$;
