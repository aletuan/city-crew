// Saving the collection form: a copy of somebody's list, a rename of your
// own, or a new one — and what each says when it is refused.
//
// Out of `CollectionFormScreen` on 23 Nov 2026. The screen was one of the
// nine that called the data layer's writes itself, three of them here,
// and the save was more than half of the function that draws the form.
// The screen keeps the fields, the header and the question asked on the
// way out. The reasoning moved with the code unchanged.

import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { successHaptic } from '../../components/ui';
import type { useCollections } from '../../lib/catalog';
import { addPlaceToCollection, copyCollection, updateCollection, type Collection } from '../../lib/data';
import type { useI18n } from '../../lib/i18n';
import { DAILY_CAPS, isDailyLimit } from '../../lib/quota';
import type { useMyLists } from '../../lib/save';
import type { useNoteEvent } from '../../lib/tasteProfile';
import { goTo, type Nav, type RootRoute } from '../../nav';
import { createList, leaveForm, shareChosen, type useAudience } from './formParts';

type Params = NonNullable<RootRoute<'CollectionForm'>['params']>;

export function useFormSave({
  uid, cityId, title, desc, editing, copyFrom, addPlaceSlug, col, aud, mine, cols, note, navigation, t,
}: {
  uid: string | undefined;
  /** The city on screen, which a new list is filed under. */
  cityId: string | undefined;
  title: string;
  desc: string;
  editing: Params['slug'];
  copyFrom: Params['copyFrom'];
  addPlaceSlug: Params['addPlaceSlug'];
  /** The list being renamed, once it is in hand. */
  col: Collection | null;
  aud: ReturnType<typeof useAudience>;
  mine: ReturnType<typeof useMyLists>;
  cols: ReturnType<typeof useCollections>;
  note: ReturnType<typeof useNoteEvent>;
  navigation: Nav;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set before each `goBack`, so a form that has just saved leaves
  // without being asked whether to discard its changes.
  const saved = useRef(false);

  const submit = async () => {
    // Never empty: the header's button is dimmed until there is a name.
    const name = title.trim();
    // Both are true whenever the screen is reachable — it lives behind the
    // header control that only signed-in users see, and the city resolves
    // before any tab renders. Checked anyway so a failure is a sentence
    // rather than a crash.
    if (!uid || !cityId) {
      setError(t('Sign in first.', 'Hãy đăng nhập trước.', '先にサインインしてください。', '请先登录。', '請先登入。'));
      return;
    }
    setBusy(true);
    setError(null);
    // The list this save made, if it made one: where `leaveForm` goes.
    let made: Parameters<typeof leaveForm>[2] = null;
    try {
      if (copyFrom) {
        // The copy is born here, not when the menu row was tapped — this
        // form has been editing a list that did not exist, so backing out
        // at any point before this line left nothing behind.
        const slug = await copyCollection({
          ownerId: uid,
          cityId: copyFrom.cityId,
          title: name,
          desc,
          placeSlugs: copyFrom.placeSlugs,
          // The row remembers its original, so the curator hears about
          // the copy the way they hear about a like (7 Oct 2026).
          copiedFrom: copyFrom.sourceId,
        });
        successHaptic();
        mine.reload();
        saved.current = true;
        // Pop the form off the stack it was pushed onto, so the tab it
        // came from keeps the source list as its history — then land on
        // the copy in the Collections tab, where Back leads to your own
        // lists. The copy is a thing you now own, not a thing you were
        // browsing.
        navigation.goBack();
        goTo('Collections', { screen: 'CollectionDetail', initial: false, params: { slug } });
        return;
      }
      if (editing) {
        await updateCollection(editing, { title: name, desc });
        made = aud.friends && !(await shareChosen(aud, { id: col!.id as string, slug: editing }, t)) ? { slug: editing, audience: 'friends', renamed: true } : aud.handOn(editing);
        // A public list is drawn from the catalog's copy too — the
        // Community tab, Explore's shelf, Ideas — and that copy refreshes
        // only on a pull or a stale foreground. A rename went unseen there
        // until one came (owner, 5 Nov 2026, of a cover; the cover is the
        // page's own save now). Only when public: a private list is not
        // in that copy, and refetching the whole catalog for it would
        // change nothing anyone sees. A copy needs none; it is private.
        if (col?.is_public) cols.reload();
      } else {
        made = await createList(aud, { ownerId: uid, cityId, title: name, desc, isPublic: aud.seen === 'public' }, t);
        // Reached from a place's bookmark with nowhere to put it: the list
        // arrives holding the place that prompted it, rather than empty
        // with the save silently dropped on the way here.
        if (addPlaceSlug) {
          await addPlaceToCollection(made.slug, addPlaceSlug, 0);
          // The first save an account ever makes comes through here — the
          // save sheet routes to this form precisely when there is no
          // list yet — and it went unrecorded while every later save was
          // noted by `lib/save`. The clearest statement of taste the
          // account will ever make, and the profile never heard it (#315).
          // After the add, so a failed insert records nothing.
          note(addPlaceSlug, 'save');
        }
      }
      // Refresh the one shared copy before leaving. Without this the save
      // sheet keeps the list it fetched on launch, and a collection made
      // here never appears as somewhere to save to.
      mine.reload();
      // Back to the list, where the collection is now the first row of your own
      // section — unless Friends could not be written: then its page opens the picker.
      leaveForm(navigation, saved, made, cols.reload);
    } catch (e) {
      // The daily cap — twenty lists, three hundred saves — is the one
      // refusal that is nobody's fault and nothing to fix; it gets its
      // own words, the way the suggest flow's `daily_limit` does.
      if (isDailyLimit(e)) {
        const words = t(
          `You can make ${DAILY_CAPS.collections} lists and save ${DAILY_CAPS.placesIntoLists} places a day. Come back tomorrow.`,
          `Mỗi ngày bạn có thể tạo ${DAILY_CAPS.collections} bộ sưu tập và lưu ${DAILY_CAPS.placesIntoLists} địa điểm. Mai quay lại nhé.`,
          `1日に${DAILY_CAPS.collections}件のリストと${DAILY_CAPS.placesIntoLists}件の保存ができます。また明日どうぞ。`,
          `你每天可以创建 ${DAILY_CAPS.collections} 个清单、保存 ${DAILY_CAPS.placesIntoLists} 个地点。明天再来吧。`, `你每天可以建立 ${DAILY_CAPS.collections} 個清單、儲存 ${DAILY_CAPS.placesIntoLists} 個地點。明天再來吧。`,
        );
        setError(words);
        Alert.alert(t('That is enough for today', 'Hôm nay vậy là đủ', '本日はここまで', '今天就到这里吧', '今天就到這裡吧'), words);
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      Alert.alert(
        copyFrom
          ? t('Could not save a copy', 'Không lưu được bản sao', 'コピーを保存できませんでした', '无法保存副本', '無法儲存副本')
          : editing
            ? t('Could not save the changes', 'Không lưu được thay đổi', '変更を保存できませんでした', '无法保存更改', '無法儲存更改')
            : t('Could not create the collection', 'Không tạo được bộ sưu tập', 'コレクションを作成できませんでした', '无法创建合集', '無法建立合集'),
        message,
      );
    } finally {
      setBusy(false);
    }
  };

  return { submit, busy, error, saved };
}
