// The two sheets a bookmark can open — the sign-in invitation and the
// list picker — drawn once for the whole app.
//
// What they show and what their buttons do is `lib/save`'s, read through
// `useSaveSheets`; this only draws it. It was drawn inside `SaveProvider`
// until 20 Oct 2026, which made that provider the one file in `lib/` that
// imported the UI. Mounted in `App.tsx` as the provider's last child, the
// spot the two sheets held inside it, so they paint over the same tree
// they always did.

import React from 'react';
import AuthSheet from './AuthSheet';
import SaveSheet from './SaveSheet';
import { useMyLists, useSaveSheets } from '../lib/save';

export default function SaveSheets() {
  const s = useSaveSheets();
  const mine = useMyLists();
  return (
    <>
      <AuthSheet visible={s.authSheet} why={s.signInWhy} onClose={s.closeAuth} onSignIn={s.signIn} />
      <SaveSheet
        place={s.target}
        collections={mine.data}
        onClose={s.closeSave}
        onToggle={s.toggle}
        onNew={s.newList}
      />
    </>
  );
}
