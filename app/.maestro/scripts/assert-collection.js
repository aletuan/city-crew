/* global FIXTURE_url, FIXTURE_key, FIXTURE_privacyId, FIXTURE_resumeId, TRIP_EMAIL, TRIP_EMAIL_2, TRIP_PASSWORD, TRIP_PASSWORD_2, MODE, http, json, FIXTURE_placeSlug */
// Read-only oracle: don't filter is_public/owner_id, which would hide RLS leaks.
// Errors must fail the flow; a failed request is never evidence of privacy.
(function () {
  function check(ok, message) { if (!ok) throw new Error(message); }
  check(/^https:\/\//.test(FIXTURE_url), 'Expected HTTPS fixture backend');
  check(/^maestro-e2e-[a-f0-9-]+@example\.com$/.test(TRIP_EMAIL), 'Expected disposable owner');
  check(/^maestro-e2e-[a-f0-9-]+@example\.com$/.test(TRIP_EMAIL_2) && TRIP_EMAIL !== TRIP_EMAIL_2, 'Expected distinct disposable reader');
  const privacy = MODE === 'private' || MODE === 'public';
  check(privacy || MODE === 'empty' || MODE === 'saved', 'Unknown assertion mode');
  const id = privacy ? FIXTURE_privacyId : FIXTURE_resumeId;
  check(/^[a-f0-9-]+$/.test(id), 'Invalid fixture id');
  function login(email, password) {
    const r = http.post(FIXTURE_url + '/auth/v1/token?grant_type=password', {
      headers: { apikey: FIXTURE_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    });
    check(r.status === 200, 'Fixture sign-in failed: HTTP ' + r.status);
    const auth = json(r.body);
    check(auth.access_token && auth.user && auth.user.email === email, 'Fixture identity mismatch');
    return auth;
  }
  function rows(path, auth) {
    const r = http.get(FIXTURE_url + '/rest/v1/' + path, {
      headers: { apikey: FIXTURE_key, Authorization: 'Bearer ' + auth.access_token }
    });
    check(r.status === 200, 'Fixture read failed: HTTP ' + r.status);
    const data = json(r.body);
    check(Array.isArray(data), 'Expected row array');
    return data;
  }
  const owner = login(TRIP_EMAIL, TRIP_PASSWORD);
  const collectionPath = 'collections?select=id,owner_id,is_public&id=eq.' + id;
  const memberPath = 'collection_places?select=place_id,places(slug)&collection_id=eq.' + id;
  const own = rows(collectionPath, owner), members = rows(memberPath, owner);
  check(own.length === 1 && own[0].id === id && own[0].owner_id === owner.user.id, 'Owner lost fixture collection');
  check(own[0].is_public === (MODE === 'public'), 'Visibility did not persist');
  check(members.length === (MODE === 'empty' ? 0 : 1), 'Unexpected membership count');
  if (MODE === 'saved') {
    check(members[0].places && members[0].places.slug === FIXTURE_placeSlug, 'Saved a different place');
  }
  if (privacy) {
    const reader = login(TRIP_EMAIL_2, TRIP_PASSWORD_2);
    check(reader.user.id !== owner.user.id, 'Reader is owner');
    const other = rows(collectionPath, reader), otherMembers = rows(memberPath, reader);
    check(other.length === (MODE === 'public' ? 1 : 0), 'Collection visibility leaked or public read missing');
    check(otherMembers.length === (MODE === 'public' ? 1 : 0), 'Member visibility leaked or public read missing');
    if (MODE === 'public') check(other[0].id === id && otherMembers[0].place_id === members[0].place_id, 'Wrong public fixture');
  }
})();
