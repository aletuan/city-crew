-- The i18n column: what the backfill carried over, what the mirror does,
-- and what the shape refuses.
--
-- The mirror is the part that can be wrong in a way nobody notices: a
-- write through one door that the other door does not see is a row that
-- reads two ways, and the app reads the columns while the desk is about
-- to write the object. So every assertion below reads back through the
-- door that was *not* written.

-- --------------------------------------------------------------- the shape

do $$
declare def bool; nn bool; dflt text;
begin
  select p.prosecdef into def from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'sync_place_i18n';
  assert def is not null, 'sync_place_i18n does not exist';
  assert not def, 'sync_place_i18n became security definer; it has no need to see past RLS';

  select p.prosecdef into def from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'i18n_well_formed';
  assert def is not null, 'i18n_well_formed does not exist';
  assert not def, 'i18n_well_formed became security definer';

  select is_nullable = 'NO', column_default into nn, dflt
    from information_schema.columns
   where table_schema = 'public' and table_name = 'places' and column_name = 'i18n';
  assert nn, 'i18n must be not null: a null object is a second spelling of "nothing"';
  assert dflt like '%{}%', format('i18n default is %L, expected an empty object', dflt);
end $$;

-- ------------------------------------------------------------ the backfill

do $$
declare doc jsonb;
begin
  select i18n into doc from public.places where slug = 'i18n-full';
  assert doc = '{"ja": {"name": "カフェA", "desc": "川沿いのベンチ。", "neighborhood": "1区"}}'::jsonb,
    format('full row carried over as %s', doc);

  -- Whitespace is not a name; the key is absent rather than blank.
  select i18n into doc from public.places where slug = 'i18n-desc';
  assert doc = '{"ja": {"desc": "木陰の芝生。"}}'::jsonb,
    format('one-slot row carried over as %s', doc);

  -- No Japanese at all: no "ja" key, not an empty object under it.
  select i18n into doc from public.places where slug = 'i18n-none';
  assert doc = '{}'::jsonb, format('empty row carried over as %s', doc);
end $$;

-- -------------------------------------------------- the mirror, columns in

do $$
declare doc jsonb; got text;
begin
  -- An insert through the columns, as import-place writes name_ja.
  insert into public.places (slug, name_ja) values ('i18n-cols', 'サインの名前')
    returning i18n into doc;
  assert doc = '{"ja": {"name": "サインの名前"}}'::jsonb, format('column insert mirrored as %s', doc);

  -- An update through the columns, as the desk's Save does today. The
  -- object's other keys survive: `machine` is metadata the columns cannot
  -- carry, and a column-side write must not erase it.
  update public.places set i18n = '{"ja": {"name": "サインの名前", "machine": true}}'::jsonb
   where slug = 'i18n-cols';
  update public.places set desc_ja = '  静かな店です。 ' where slug = 'i18n-cols'
    returning i18n into doc;
  assert doc = '{"ja": {"name": "サインの名前", "desc": "静かな店です。", "machine": true}}'::jsonb,
    format('column update mirrored as %s', doc);

  -- Clearing every column clears the entry, flag included: there is no
  -- Japanese left for the flag to be about.
  update public.places set name_ja = null, desc_ja = '' where slug = 'i18n-cols'
    returning i18n into doc;
  assert doc = '{}'::jsonb, format('cleared columns left %s', doc);
end $$;

-- ------------------------------------------------- the mirror, object in

do $$
declare got_name text; got_desc text; got_nb text;
begin
  -- An insert through the object, as the desk will write.
  insert into public.places (slug, i18n)
    values ('i18n-obj', '{"ja": {"name": "店", "desc": "湖畔のカフェです。", "machine": true}}'::jsonb)
    returning name_ja, desc_ja, neighborhood_ja into got_name, got_desc, got_nb;
  assert got_name = '店' and got_desc = '湖畔のカフェです。' and got_nb is null,
    format('object insert read back as (%L, %L, %L)', got_name, got_desc, got_nb);

  -- An update through the object: the columns follow, and an empty
  -- string in the object is a cleared column.
  update public.places
     set i18n = '{"ja": {"name": "", "desc": "改訂。", "neighborhood": "1区"}}'::jsonb
   where slug = 'i18n-obj'
    returning name_ja, desc_ja, neighborhood_ja into got_name, got_desc, got_nb;
  assert got_name is null and got_desc = '改訂。' and got_nb = '1区',
    format('object update read back as (%L, %L, %L)', got_name, got_desc, got_nb);

  -- Removing the language removes the columns' values.
  update public.places set i18n = '{}'::jsonb where slug = 'i18n-obj'
    returning name_ja, desc_ja, neighborhood_ja into got_name, got_desc, got_nb;
  assert got_name is null and got_desc is null and got_nb is null,
    format('removed language read back as (%L, %L, %L)', got_name, got_desc, got_nb);

  -- A second language is just a key: it mirrors to nothing and is kept.
  update public.places set i18n = '{"ko": {"desc": "호수 옆 카페."}}'::jsonb where slug = 'i18n-obj'
    returning desc_ja into got_desc;
  assert got_desc is null, format('a Korean entry wrote desc_ja = %L', got_desc);
end $$;

-- -------------------------------------------- both sides in one statement

do $$
declare doc jsonb; got text;
begin
  -- The object wins. A caller sending both has already moved to the
  -- object and is sending the column out of habit.
  update public.places
     set i18n = '{"ja": {"desc": "オブジェクト側。"}}'::jsonb, desc_ja = 'column side'
   where slug = 'i18n-obj'
    returning i18n, desc_ja into doc, got;
  assert got = 'オブジェクト側。', format('column side won with %L', got);
  assert doc -> 'ja' ->> 'desc' = 'オブジェクト側。', format('object became %s', doc);
end $$;

-- ------------------------------------------------------------- the shape

do $$
begin
  begin
    update public.places set i18n = '[]'::jsonb where slug = 'i18n-obj';
    assert false, 'an array was accepted as i18n';
  exception when check_violation then null;
  end;
  begin
    update public.places set i18n = '{"ja": "text"}'::jsonb where slug = 'i18n-obj';
    assert false, 'a string under a language key was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.places set i18n = '{"japanese": {}}'::jsonb where slug = 'i18n-obj';
    assert false, 'a key that is not a two-letter code was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.places set i18n = null where slug = 'i18n-obj';
    assert false, 'null was accepted as i18n';
  exception when not_null_violation then null;
  end;
end $$;

-- Leave the stub as the blocks after this one expect it.
delete from public.places where slug like 'i18n-%';
