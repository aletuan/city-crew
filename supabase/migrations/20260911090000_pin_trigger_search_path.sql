-- Pin the search path of the last two functions that did not.
--
-- The security advisor flags a function whose `search_path` is left to the
-- caller: a name inside it resolves against whatever schemas the calling
-- session happens to put first, so an object planted earlier in that list
-- could stand in for the one the function meant.
--
-- For these two the risk was close to nothing. Both are plain triggers,
-- not security definer, and both call only built-ins — `now()`, `lower()`,
-- `regexp_replace()` and the like — which live in `pg_catalog`, the one
-- schema Postgres searches ahead of any path. Pinned anyway: it is what
-- every other function here already does, it costs one line, and it keeps
-- the advisor's list down to what is worth reading.
--
-- The empty path is safe precisely because of that: `pg_catalog` is
-- searched even when the path names nothing, and neither body refers to a
-- table or function of this schema by an unqualified name.

alter function public.stamp_updated_at() set search_path = '';
alter function public.stamp_threads_handle() set search_path = '';

-- `pg_net` stays where it is. The advisor also lists it as installed in
-- `public`, but only its registration is: its functions are in `net`, out
-- of the API's reach. And it is not relocatable — moving it means dropping
-- and recreating it, which would break the cron job that drives the photo
-- work through it. A warning to accept, not a fix to make.
