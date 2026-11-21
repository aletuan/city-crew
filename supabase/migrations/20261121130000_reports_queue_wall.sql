-- The desk sees a reported person's cover (W4 of docs/wall-plan.md).
--
-- A profile report showed the name, the bio and the handle; since 1.0.18
-- a profile also wears a cover its owner may have uploaded, which is the
-- likeliest thing on it to be reported and was the one thing the desk
-- could not see. Two columns more, for a profile report only: what kind
-- of cover and which. The desk draws an upload as the picture itself; a
-- city or a collection is the catalog's own picture, already seen, and
-- is named rather than drawn.
--
-- Added at the end, so a reader that takes the columns by position reads
-- what it always did. The return type changes, so the function is dropped
-- and made again; its grants are stated again with it.
drop function if exists public.reports_queue();
create function public.reports_queue()
returns table (
  id uuid, kind text, target_id uuid, reason text, note text,
  status text, created_at timestamptz,
  title text, body text, owner_handle text, owner_id uuid,
  wall_kind text, wall_ref text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.kind, r.target_id, r.reason, r.note, r.status, r.created_at,
    case r.kind when 'collection' then c.title_en when 'comment' then on_list.title_en else p.full_name end,
    case r.kind when 'collection' then c.desc_en when 'comment' then k.body else p.bio end,
    case r.kind when 'collection' then owner.handle when 'comment' then author.handle else p.handle end,
    case r.kind when 'collection' then c.owner_id when 'comment' then k.author else p.id end,
    p.wall_kind, p.wall_ref
  from public.reports r
  left join public.collections c on r.kind = 'collection' and c.id = r.target_id
  left join public.profiles owner on owner.id = c.owner_id
  left join public.profiles p on r.kind = 'profile' and p.id = r.target_id
  left join public.comments k on r.kind = 'comment' and k.id = r.target_id
  left join public.collections on_list on on_list.id = k.collection_id
  left join public.profiles author on author.id = k.author
  where public.is_editor()
  order by (r.status = 'new') desc, r.created_at desc
  limit 200;
$$;

revoke all on function public.reports_queue() from public, anon;
grant execute on function public.reports_queue() to authenticated;
