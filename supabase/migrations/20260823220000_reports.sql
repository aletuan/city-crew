-- Reporting what somebody wrote — the last of the four things the App
-- Store asks of an app carrying other people's content (1.2: a filter,
-- a way to report, a way to block, and a way to reach the developer).
-- Blocking shipped with the crew; this is the report, and the desk page
-- that answers it inside a day is the other half of the same rule.
--
-- ── the small surface this has to cover ──
--
-- Places already pass the desk before anyone sees them, so the largest
-- body of content in this app is moderated before publication. What
-- reaches the public unreviewed is exactly two things: a public
-- collection's title and description, and a profile — name, handle,
-- avatar, bio. So `kind` has two values and will not grow without a new
-- kind of publishing to go with it.
--
-- ── who may see a report ──
--
-- The desk, and nobody else. Not the reported party, for obvious
-- reasons; and not the reporter either, once it is filed — a report is
-- not a conversation, and a readable queue would turn "who reported me"
-- into a question with an answer. The app's confirmation is the whole
-- of the reporter's receipt.
--
-- `reporter` is `on delete set null` rather than cascade, and that is
-- deliberate: a report is about the content, not about the person who
-- noticed it, and it must survive them deleting their account. Losing
-- the queue when a reporter leaves would be a way to erase evidence.

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter    uuid references auth.users(id) on delete set null,
  kind        text not null check (kind in ('collection', 'profile')),
  -- collections.id or profiles.id. Not a foreign key on purpose: the
  -- row must outlive the thing it accuses, or acting on a report would
  -- delete the record of why.
  target_id   uuid not null,
  reason      text not null check (reason in ('spam', 'offensive', 'impersonation', 'other')),
  note        text check (note is null or length(note) <= 500),
  status      text not null default 'new' check (status in ('new', 'actioned', 'dismissed')),
  created_at  timestamptz not null default now(),
  handled_at  timestamptz,
  handled_by  uuid references auth.users(id) on delete set null
);

-- The queue reads new-first; the index that matters is the one that
-- orders it.
create index if not exists reports_queue on public.reports (status, created_at desc);

alter table public.reports enable row level security;

-- File as yourself, about somebody else, and not endlessly. Twenty a day
-- is far past any honest use and short of a script; counted off the rows
-- themselves like every other cap in this schema — no counter to reset,
-- nothing that can drift out of step with what was actually filed.
drop policy if exists "readers file reports" on public.reports;
create policy "readers file reports" on public.reports
  for insert with check (
    auth.uid() = reporter
    and status = 'new'
    and not (kind = 'profile' and target_id = auth.uid())
    and (
      select count(*) from public.reports r
      where r.reporter = auth.uid()
        and r.created_at > now() - interval '1 day'
    ) < 20
  );

-- The desk reads the queue and marks what it has done. Nobody else can
-- see a report at all — see the note above on why not even its author.
drop policy if exists "editors read reports" on public.reports;
create policy "editors read reports" on public.reports
  for select using (public.is_editor());

drop policy if exists "editors handle reports" on public.reports;
create policy "editors handle reports" on public.reports
  for update using (public.is_editor()) with check (public.is_editor());

-- ── what the desk needs to see beside each report ──
--
-- A report is an id and an accusation; judging it needs the words
-- themselves. Security definer so the desk sees a *reported* collection
-- even after it is unpublished — the moment it stops being public is
-- the moment its ordinary read policy would hide the evidence from the
-- person deciding whether hiding it was right.
--
-- Editor-gated inside the body rather than by grant alone, so the
-- definer's reach cannot be borrowed by an ordinary caller.
create or replace function public.reports_queue()
returns table (
  id uuid, kind text, target_id uuid, reason text, note text,
  status text, created_at timestamptz,
  title text, body text, owner_handle text, owner_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.kind, r.target_id, r.reason, r.note, r.status, r.created_at,
    case when r.kind = 'collection' then c.title_en else p.full_name end,
    case when r.kind = 'collection' then c.desc_en else p.bio end,
    case when r.kind = 'collection' then owner.handle else p.handle end,
    case when r.kind = 'collection' then c.owner_id else p.id end
  from public.reports r
  left join public.collections c on r.kind = 'collection' and c.id = r.target_id
  left join public.profiles owner on owner.id = c.owner_id
  left join public.profiles p on r.kind = 'profile' and p.id = r.target_id
  where public.is_editor()
  order by (r.status = 'new') desc, r.created_at desc
  limit 200;
$$;

revoke all on function public.reports_queue() from public;
grant execute on function public.reports_queue() to authenticated;
