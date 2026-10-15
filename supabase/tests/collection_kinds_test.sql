-- The owner's chips on a collection: two lists of category keys, each
-- from the closed vocabulary, never sharing a key.

insert into public.collections (slug, city_id) values ('t-kinds', 'hanoi');

-- Empty by default, so every existing row reads as "no decisions".
do $$
declare h text[]; a text[];
begin
  select kinds_hidden, kinds_added into h, a from public.collections where slug = 't-kinds';
  if h <> '{}' or a <> '{}' then
    raise exception 'kinds default to %/% rather than empty', h, a;
  end if;
end $$;

-- The whole vocabulary, split across the two: accepted, or this throws.
update public.collections
   set kinds_hidden = '{cafes,eats,views,heritage}',
       kinds_added = '{nature,markets,nightlife,focus,fun}'
 where slug = 't-kinds';

-- An invented key, on either side, is refused.
do $$
begin
  begin
    update public.collections set kinds_added = '{cinema}' where slug = 't-kinds';
    raise exception 'collections_kinds_known accepted an unknown added key';
  exception when check_violation then null;
  end;
  begin
    update public.collections set kinds_hidden = '{rooftop}' where slug = 't-kinds';
    raise exception 'collections_kinds_known accepted an unknown hidden key';
  exception when check_violation then null;
  end;
end $$;

-- One key, both ways at once, is refused: off and on is not a decision.
do $$
begin
  begin
    update public.collections set kinds_hidden = '{cafes}', kinds_added = '{cafes,eats}' where slug = 't-kinds';
    raise exception 'collections_kinds_one_word accepted a key both hidden and added';
  exception when check_violation then null;
  end;
end $$;

-- Null is not "no decisions"; the column says so rather than the app.
do $$
begin
  begin
    update public.collections set kinds_added = null where slug = 't-kinds';
    raise exception 'kinds_added accepted null';
  exception when not_null_violation then null;
  end;
end $$;

delete from public.collections where slug = 't-kinds';
