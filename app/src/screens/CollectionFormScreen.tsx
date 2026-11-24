// Making one of your own lists, renaming it later — and saving a copy of
// somebody else's.
//
// One screen for all three: the fields are the same, only the verb
// changes. Two screens would be the same form twice, drifting apart the
// first time one of them gains a field. The copy is the odd one out only
// in when the row exists: rename edits a real row, create makes one on
// submit, and a copy is a row that does not exist yet being edited —
// prefilled from the source, born on save, and never born at all if the
// reader backs out.
//
// One required field. A collection is a name and, later, some places in
// it; asking for more up front is asking someone to fill a form before
// they have seen what the thing does. The description is there for people
// who want it and skipped by everyone else.
//
// The form pieces come from `authUi` — they were written for the auth
// screens but they are just a list-row field and a primary button, and the
// alternative is a second set that drifts from the first.

import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { AuthHeader, AuthScreen, FieldRow, FormError, useFailText } from '../components/authUi';
import { useSession } from '../lib/auth';
import { useCollections } from '../lib/catalog';
import { useCurrentCity } from '../lib/city';
import { useI18n } from '../lib/i18n';
import { useMyLists } from '../lib/save';
import { useNoteEvent } from '../lib/tasteProfile';
import type { Nav, RootRoute } from '../nav';
import { FieldRule, makingOwn, SaveHint, SeenLine, useAudience } from './collectionForm/formParts';
import { useFormSave } from './collectionForm/useFormSave';

/** Long enough for a real name, short enough to stay on one line in a row. */
const MAX_TITLE = 60;

export default function CollectionFormScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'CollectionForm'>;
}) {
  const { t } = useI18n();
  const { session } = useSession();
  const { city } = useCurrentCity();
  const mine = useMyLists();
  const cols = useCollections();
  const editing = route.params?.slug;
  const addPlaceSlug = route.params?.addPlaceSlug;
  const copyFrom = route.params?.copyFrom;
  // A copy opens with its provenance already written in: "Copy of X" as
  // the title — a suggestion sitting in an editable field, not a suffix
  // welded on — and the source's description as the curator wrote it.
  // Where the copy came from is `copiedFrom`, saved onto the row, not a
  // line of text. Truncated because the prefix can push a long source
  // title past what one row holds.
  const [title, setTitle] = useState(() => (copyFrom
    ? t(`Copy of ${copyFrom.title}`, `Bản sao của ${copyFrom.title}`, `「${copyFrom.title}」のコピー`, `${copyFrom.title}（副本）`, `${copyFrom.title}（副本）`).slice(0, MAX_TITLE)
    : route.params?.title ?? ''));
  const [desc, setDesc] = useState(copyFrom?.desc ?? route.params?.desc ?? '');
  // What the form opened on, which `changed` measures against.
  const [start] = useState({ title, desc });
  const failText = useFailText();
  const note = useNoteEvent();
  const uid = session?.user?.id;

  // No cover here (owner, 22 Nov 2026): the list page's camera chooses it.
  const col = editing ? mine.data.find((c) => c.slug === editing) ?? null : null;
  // Who sees it, kept for Save like the fields (`formParts`).
  const aud = useAudience(col, uid, makingOwn(editing, copyFrom));

  // Whether the form now says something it did not say on opening — the
  // one question both the ✓ and the discard guard ask, so the two can
  // never disagree, as on the profile form.
  //
  // A rename's ✓ waits for it: lit on an untouched rename, it offered a
  // save that would write back exactly what was there. A new list and a
  // copy need only a name — the copy is born on submit, so submitting
  // its prefilled suggestion unchanged is the whole point of the button.
  // Who sees it counts since 20 Nov 2026 (`useAudience`).
  const changed = [title.trim() !== start.title.trim(), desc.trim() !== start.desc.trim(), aud.moved].includes(true);

  // Leaving with changes asks first — header Back and iOS's swipe alike,
  // both of which go through `beforeRemove`. A form that has just saved
  // leaves without asking: `saved` is set before each `goBack`.
  // The save itself — copy, rename or create, and what each says when it
  // is refused: `useFormSave` (23 Nov 2026), which also holds `saved`.
  const { submit, busy, error, saved } = useFormSave({
    uid, cityId: city?.id, title, desc, editing, copyFrom, addPlaceSlug, col, aud, mine, cols, note, navigation, t,
  });
  useEffect(() => {
    if (!changed) return undefined;
    return navigation.addListener('beforeRemove', (e) => {
      if (saved.current) return;
      e.preventDefault();
      Alert.alert(
        t('Discard your changes?', 'Bỏ các thay đổi?', '変更を破棄しますか？', '放弃更改？', '放棄更改？'),
        t(
          'What you changed on this list has not been saved.',
          'Những gì bạn vừa đổi trên bộ sưu tập này chưa được lưu.',
          'このリストの変更はまだ保存されていません。',
          '你对这个清单的更改尚未保存。', '你對這個清單的更改尚未儲存。',
        ),
        [
          { text: t('Keep editing', 'Tiếp tục sửa', '編集を続ける', '继续编辑', '繼續編輯'), style: 'cancel' },
          {
            text: t('Discard', 'Bỏ', '破棄', '放弃', '放棄'),
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
  }, [changed, navigation, t, saved]);


  return (
    <AuthScreen>
      {/* Save in the header (`HeaderAction`): the cover grid below holds
          every photograph of every member, and with eleven of them the
          old full-width button sat under the fold. Lit once there is
          something to submit — see `changed`. */}
      <AuthHeader
        onBack={() => navigation.goBack()}
        // At 20, as the list's own page is (owner, 16 Nov 2026): the form
        // opened from a page titled at 20 and stood a size over it at 26
        // — see `type.titleCompact`, and `titles.test` for what holds it.
        backBare compactTitle
        title={copyFrom
          ? t('Save a copy', 'Lưu bản sao', 'コピーを保存', '保存副本', '儲存副本')
          : editing
            // Named for the thing the reader tapped "New" beside, in the
            // word the tab and every row of it use. "Name your list"
            // switched terms between the button and the form, and left a
            // new reader to work out whether a list was a collection
            // (UX-13, 17 Oct 2026). "Edit", not "Rename": the same form
            // changes the description, the chips and the cover too.
            ? t('Edit collection', 'Sửa bộ sưu tập', 'コレクションを編集', '编辑合集', '編輯合集')
            : t('New collection', 'Bộ sưu tập mới', '新しいコレクション', '新建合集', '新增合集')}
        action={{
          label: copyFrom
            ? t('Save the copy', 'Lưu bản sao', 'コピーを保存', '保存副本', '儲存副本')
            : editing
              ? t('Save changes', 'Lưu thay đổi', '変更を保存', '保存更改', '儲存更改')
              : t('Create collection', 'Tạo bộ sưu tập', 'コレクションを作成', '创建合集', '建立合集'),
          onPress: submit,
          busy,
          disabled: !title.trim() || (!!editing && !changed),
          testID: 'collection-submit',
        }}
      />
      {/* Beside the Save that raised it, rather than under the cover grid. */}
      {error ? <FormError>{failText(error)}</FormError> : null}
      <SaveHint kind={copyFrom ? 'copy' : addPlaceSlug ? 'place' : null} />
      {/* The fields on the page itself, between hairlines, with no box and
          no glyph (owner, 16 Nov 2026) — see `collectionForm/formParts`. */}
      <View>
      <FieldRule />
      <FieldRow
        grouped flush
        // "Collection name", not "Name": with the glyph gone the label is
        // all that says what the line is, and it is the small half now.
        label={t('Collection name', 'Tên bộ sưu tập', 'コレクション名', '合集名称', '合集名稱')}
        placeholder={t('Weekend coffee', 'Cà phê cuối tuần', '週末のコーヒー', '周末咖啡', '週末咖啡')}
        value={title}
        onChangeText={setTitle}
        maxLength={MAX_TITLE}
        autoFocus
        testID="collection-name"
        returnKeyType="next"
      />
      {/* "Description", with no "(optional)" after it (removed at the
          owner's request, 10 Oct 2026). The form already says it: only
          the name stops a save, and the placeholder below is a question
          that can go unanswered. */}
      <FieldRule />
      <FieldRow
        grouped flush
        label={t('Description', 'Mô tả', '説明', '简介', '簡介')}
        placeholder={t('What ties these together?', 'Điều gì gắn kết những nơi này?', '共通点は何ですか？', '这些地点有什么共同点？', '這些地點有什麼共同點？')}
        value={desc}
        onChangeText={setDesc}
        multiline
        style={fieldStyles.desc}
        returnKeyType="done"
      />
      <FieldRule />
      <SeenLine aud={aud} />
      <FieldRule />
      </View>
      {/* No chips here (owner, 16 Nov 2026). The list's kinds were shown
          between the description and the cover from 15 Oct, each a toggle
          that hid it from the list's page; they are worked out from the
          places now and the owner has no say — see `lib/collectionKinds`
          for the count that settled it. */}
    </AuthScreen>
  );
}

// The note's lines 24 apart at 16: a paragraph of 1.5 reads as a paragraph, not a stack.
const fieldStyles = StyleSheet.create({ desc: { lineHeight: 24 } });
