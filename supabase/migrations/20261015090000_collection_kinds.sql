-- The owner's word on which categories a collection wears (15 Oct 2026).
--
-- A collection's chips are worked out from its places, in the app: a
-- category that covers a third of the list or more shows, three at most.
-- Nothing derived is stored, because a list is alive — five cafés added
-- to a list of restaurants should bring the Cafés chip with them, and a
-- stored copy of the chips would still describe the day it was saved.
--
-- What is stored is only what the owner decided, as two lists of keys:
-- `kinds_hidden`, the chips they took off, and `kinds_added`, the ones
-- they put on. Each decision sticks — a chip taken off stays off however
-- many more places of that kind arrive, and one put on stays on when the
-- places that earned it leave. The app reads the two over the derived set
-- (`collectionKinds` in app/src/lib/collectionKinds.ts).
--
-- Rejected: one stored list of the chips as shown. It is the shape a
-- form would most naturally write, and it freezes the list at its save.
--
-- Categories only, from the same closed vocabulary `places` holds — the
-- owner's ruling: no free words, nothing read out of titles. So the same
-- check, and a fourth copy of the list that app/src/lib/categories.ts
-- names as the place to change it.
--
-- No policy change: "owners update their collections" already lets an
-- owner write their own row, and these are two more columns of it.

alter table public.collections
  add column if not exists kinds_hidden text[] not null default '{}',
  add column if not exists kinds_added text[] not null default '{}';

alter table public.collections drop constraint if exists collections_kinds_known;
alter table public.collections add constraint collections_kinds_known check (
  kinds_hidden <@ array[
    'cafes', 'eats', 'views', 'heritage', 'nature', 'markets', 'nightlife',
    'focus', 'fun'
  ]
  and kinds_added <@ array[
    'cafes', 'eats', 'views', 'heritage', 'nature', 'markets', 'nightlife',
    'focus', 'fun'
  ]
);

-- One decision per key: a chip cannot be both taken off and put on.
alter table public.collections drop constraint if exists collections_kinds_one_word;
alter table public.collections add constraint collections_kinds_one_word check (
  not (kinds_hidden && kinds_added)
);
