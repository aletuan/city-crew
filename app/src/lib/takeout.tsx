// Gathering the export, writing it, and handing it to the share sheet.
//
// A `.tsx` for the reason `crew.tsx` and `save.tsx` are: it needs hooks,
// and the 100% gate covers `src/lib/*.ts` because a Node process has no
// renderer. Nothing here decides anything — the reads are in
// `data/export.ts`, the shape is in `export.ts`, and both of those are
// held to that gate. This is the wire between them and the phone.
//
// ── why a file and a share sheet, and not a link ──
//
// The other way to put a JSON file in somebody's hands is to upload it to
// storage and open a signed URL. It needs no native module, so it would
// have ridden out on an EAS update instead of waiting for a build. It was
// turned down on what it would have cost the privacy policy: a copy of
// somebody's personal data sitting in a bucket is a new retention promise
// — with no `pg_cron` to keep it — and a signed URL is a bearer token, so
// the policy would have had to warn that anyone holding the link can read
// the whole export. Writing to the app's own cache and handing the file
// straight to the system share sheet creates neither.

import { useCallback, useState } from 'react';
import { useAuth } from './auth';
import { useI18n } from './i18n';
import {
  fetchFriendships, fetchMyBlocks, fetchMyCollections, fetchMyTrips,
  fetchPreferences, fetchProfilesById,
} from './data';
import { fetchMyHistory, fetchMyLikedCollections, fetchMySubmittedPlaces } from './data/export';
import { buildExport, exportFilename, type ExportLang } from './export';

// ── why these two are required inside the function ──
//
// They are native modules, and this app ships JavaScript over EAS Update
// to binaries that were built before it. A static import here would sit in
// the module graph behind `App.tsx` → `DeleteAccountScreen` → this file,
// so the update that first carried this feature would have been evaluated
// at launch on every phone still running the previous build — and crashed
// it, on a screen nobody had opened, over a button nobody had pressed.
//
// Loaded at the tap instead, the same update is inert on an old binary
// until somebody asks for an export, and then it fails into the banner
// below like any other failure. The cost is one `await` on a path that is
// already waiting on eight queries.
async function nativeIO() {
  const [fs, sharing] = await Promise.all([
    import('expo-file-system'),
    import('expo-sharing'),
  ]);
  return { File: fs.File, Paths: fs.Paths, Sharing: sharing };
}

/** The other end of every edge this account is on, plus everyone it has
 *  blocked — the ids that have to become handles before anything is
 *  written. Rule 5 in `export.ts` is what this list is for. */
function othersIn(
  friendships: { requester: string; addressee: string }[],
  blocked: string[],
  me: string,
): string[] {
  const ids = new Set<string>();
  for (const f of friendships) ids.add(f.requester === me ? f.addressee : f.requester);
  for (const b of blocked) ids.add(b);
  ids.delete(me);
  return [...ids];
}

export function useTakeout() {
  const { session, email, profile } = useAuth();
  const { lang } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Both asked for before anything is gathered. On a binary without
      // these modules the import itself throws, and a share sheet the
      // platform cannot raise would leave a file written, a spinner
      // stopped, and nothing to show for it.
      const { File, Paths, Sharing } = await nativeIO();
      if (!(await Sharing.isAvailableAsync())) throw new Error('sharing_unavailable');

      const [collections, likes, trips, preferences, friendships, blocked, submitted, history] =
        await Promise.all([
          fetchMyCollections(uid),
          fetchMyLikedCollections(uid),
          fetchMyTrips(uid),
          fetchPreferences(uid),
          fetchFriendships(),
          fetchMyBlocks(),
          fetchMySubmittedPlaces(uid),
          fetchMyHistory(uid),
        ]);

      // Already keyed by id, and the export wants only the handle out of
      // each — rule 5 again: the name and the avatar this returns are the
      // other person's, and they do not travel.
      const people = await fetchProfilesById(othersIn(friendships, blocked, uid));
      const handles: Record<string, string> = {};
      for (const [id, p] of Object.entries(people)) handles[id] = p.handle;

      // One clock for the header and the filename both. Two calls to
      // `new Date()` are two different instants, and a run that straddled
      // midnight would name the file after one day and stamp it with the
      // other.
      const now = new Date();
      const bundle = buildExport({
        account: {
          id: uid,
          email: email ?? null,
          created_at: (session?.user as { created_at?: string } | undefined)?.created_at ?? null,
        },
        profile, preferences, collections, likes, trips,
        friendships, blocked, handles, submitted, history,
      }, now, lang as ExportLang);

      // The cache directory, not documents: this is a copy the reader is
      // taking somewhere else, and once it is in Files or in a mail draft
      // the app has no further use for it. `overwrite` because a second
      // export on the same day lands on the same name, and the newer one
      // is the one worth keeping.
      const file = new File(Paths.cache, exportFilename(profile.handle, now));
      file.create({ overwrite: true });
      file.write(JSON.stringify(bundle, null, 2));

      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        UTI: 'public.json',
        dialogTitle: 'City Crew',
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [session, email, profile, lang, busy]);

  return { run, busy, error };
}
