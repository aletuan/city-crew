// The desk's moderation: the report queue and what it decides on —
// lists, profiles, comments and check-in photos hidden or shown — the
// banned words, and suspending an account.
//
// Out of `api.js` on 25 Nov 2026, the desk's one data file split by
// aggregate as the app's `lib/data/` is; the reasoning moved with the
// code. A factory that is handed the client, as `cityHero.js` is: the
// tests load `api.js` afresh for every case with a new fake client, and
// a module that imported the client itself would keep the first case's.

export function moderationApi({ supabase, db, invoke }) {
  return {
    /**
     * The report queue, newest facts about oldest complaints.
     *
     * Through a function rather than the table, because judging a report
     * needs the words it is about — and a collection hidden by a previous
     * decision would vanish from an ordinary read of `collections`, taking
     * the evidence for that decision with it. See `reports_queue`.
     */
    reports: async () => db(await supabase.rpc('reports_queue')) ?? [],

    /**
     * The week of Google calls `fetch-place` has counted, for the allowance
     * bell: day totals against their caps, and the accounts past their own.
     * Null for a reader who is not an editor. See `fetch_place_usage`.
     */
    fetchPlaceUsage: async () => db(await supabase.rpc('fetch_place_usage')),

    /** Mark one answered. `actioned` means the desk did something about
     *  the content; `dismissed` means it looked and found nothing wrong.
     *  Both are answers, and the queue counts neither. Who answered and
     *  when are set by the database as the status changes (the
     *  report_handler migration); the time sent here is overwritten. */
    markReport: async (id, status) => {
      db(await supabase
        .from('reports')
        .update({ status, handled_at: new Date().toISOString() })
        .eq('id', id));
    },

    /** Hide a public list, or put it back. Not a delete: it returns to its
     *  owner, intact and unpublished — see the moderation migration. */
    moderateCollection: async (id, hide) => {
      db(await supabase.rpc('moderate_collection', { target: id, hide }));
    },

    /** Blank one field of a profile. Each flag on its own, because a bio
     *  that breaks the rules is not a reason to take somebody's photo.
     *  `wall` puts the page's cover back to automatic (docs/wall-plan.md). */
    moderateProfile: async (id, flags) => {
      db(await supabase.rpc('moderate_profile', {
        target: id,
        clear_bio: !!flags.bio,
        clear_avatar: !!flags.avatar,
        clear_name: !!flags.name,
        clear_wall: !!flags.wall,
      }));
    },

    /**
     * Take a reported comment down, with the answers under it. The desk's
     * own door rather than the author's `delete_comment`, because this one
     * leaves a line in the moderation log — see the comment_desk migration.
     * Not reversible, unlike the two above.
     */
    moderateComment: async (id) => {
      db(await supabase.rpc('moderate_comment', { target: id }));
    },

    /**
     * Hide a reported check-in photo, or put it back (K5 of
     * docs/checkin-photos-plan.md). Reversible: the file stays, nobody is
     * signed a link to it — see the checkin_photo_desk migration.
     */
    moderateCheckinPhoto: async (id, hide) => {
      db(await supabase.rpc('moderate_checkin_photo', { target: id, hide }));
    },

    /**
     * Hide a reported check-in's note, or the whole visit, or put either
     * back (`part` is 'note' or 'visit'). Reversible, as a photo is: the
     * row stays, and its owner still sees it marked — see the
     * checkin_report migration.
     */
    moderateCheckin: async (id, part, hide) => {
      db(await supabase.rpc('moderate_checkin', { target: id, part, hide }));
    },

    /** A link to a check-in photo, for the desk's eyes: the bucket is
     *  private, and an editor may read it. An hour, as the app's are. */
    signCheckinPhoto: async (path) => {
      const { data, error } = await supabase.storage.from('checkin-photos').createSignedUrl(path, 3600);
      if (error) throw new Error(error.message);
      return data?.signedUrl ?? null;
    },

    /**
     * The words a comment may not contain, in the order they read.
     *
     * The table is the whole feature: `comment_clean` reads it on every
     * comment written, so a word added here stops the next one and a word
     * removed lets it through, with no release in between.
     */
    bannedWords: async () => {
      const rows = db(await supabase.from('banned_words').select('word').order('word'));
      return (rows ?? []).map((r) => r.word);
    },

    /** Add words, already cleaned (`cleanWords`). An upsert that ignores
     *  what is there: typing a word the list already has is not an error. */
    addBannedWords: async (words) => {
      if (!words.length) return;
      db(await supabase
        .from('banned_words')
        .upsert(words.map((word) => ({ word })), { onConflict: 'word', ignoreDuplicates: true }));
    },

    removeBannedWord: async (word) => {
      db(await supabase.from('banned_words').delete().eq('word', word));
    },

    /** Stop an account signing in, or let it back. The service role's
     *  work, so it goes through the edge function. */
    suspendUser: async (userId, suspend = true) => invoke('suspend-user', { user_id: userId, suspend }),
  };
}
