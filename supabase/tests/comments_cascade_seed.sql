-- What the first rule left behind, for 20261118150000 to clear: a
-- deleted comment kept as a husk because somebody answered it, the
-- answer under it, and a comment whose account has gone. Seeded before
-- the migration runs — which, with a husk in the table, cannot make a
-- body `not null` until it has deleted them.

insert into auth.users (id, email, raw_user_meta_data) values
 ('ca5e0000-0000-0000-0000-00000000000a', 'cs-owner@x.com', '{"handle":"csowner"}'),
 ('ca5e0000-0000-0000-0000-00000000000b', 'cs-b@x.com',     '{"handle":"csb"}');
insert into public.collections (id, slug, owner_id) values
 ('ca5e0000-0000-0000-0000-0000000000c1', 'cs-public', 'ca5e0000-0000-0000-0000-00000000000a');
update public.collections set is_public = true where id = 'ca5e0000-0000-0000-0000-0000000000c1';

insert into public.comments (id, author, collection_id, parent_id, body) values
 ('ca5e0000-0000-0000-0000-0000000000a1', 'ca5e0000-0000-0000-0000-00000000000b', 'ca5e0000-0000-0000-0000-0000000000c1', null, 'to be a husk'),
 ('ca5e0000-0000-0000-0000-0000000000a2', 'ca5e0000-0000-0000-0000-00000000000b', 'ca5e0000-0000-0000-0000-0000000000c1', null, 'stays');
insert into public.comments (id, author, collection_id, parent_id, body) values
 ('ca5e0000-0000-0000-0000-0000000000b1', 'ca5e0000-0000-0000-0000-00000000000a', 'ca5e0000-0000-0000-0000-0000000000c1', 'ca5e0000-0000-0000-0000-0000000000a1', 'an answer to a husk');
-- Deleted by its writer, as `delete_comment` did it: answered, so kept.
update public.comments set body = null, deleted_at = now() where id = 'ca5e0000-0000-0000-0000-0000000000a1';
