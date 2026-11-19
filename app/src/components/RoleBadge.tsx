// The mark of a role — a local guide's star, an editor's medal — and what
// it means, wherever a person's name wears it.
//
// It was drawn in one place: on your own picture on Profile, where only
// you could see it (`profile/HeroFace`). On 16 Nov 2026 the owner asked
// for it on a person's page too, where it does its real work: it tells
// somebody else that the desk trusts this account to keep places. So the
// look and the words moved here, and both pages draw the one disc.
//
// ── two voices ──
//
// On your own Profile the sheet says "You can edit…". On a person's
// page it cannot — the page may be anybody's — so it says what a Local
// Guide can do. `roleSays` holds both, side by side, so a change to what
// a role allows is made to the pair.
//
// A person's page uses the third voice for its owner too: that page is
// yourself as other people see you, and it reads as they read it.
//
// ── after the name, not on the picture (owner, 17 Nov 2026) ──
//
// For a day the disc lay on a corner of the picture on both pages. The
// owner, with a reference that set it after the name, asked for that:
//
//   - a role is a thing about the account, and is read with its name,
//     as the tick after a name is wherever names are verified;
//   - on a person's page the corner it had was the one the bio's bubble
//     points at, so a disc and a tail met on the picture's foot, and
//     the disc covered part of the face;
//   - on Profile the picture carried the level's ring, the level's pill
//     and this — two marks about how much you keep and one about what
//     the desk allows. The picture now says the one thing.
//
// `WithRole` is the whole of it: the name it is given, the disc after
// it, and the sheet a press opens — the app's sheet, as the level's on
// Profile is, so that every badge explains itself one way.
//
// Taken from the reference: the place, and a smaller mark (`DISC`).
// Not taken:
//
//   - the disc's ground and edge removed. A bare star after a name is
//     a favourite or a rating before it is a rank; in its disc it is a
//     badge. And the two roles are told apart by the disc's colour as
//     well as by the glyph.
//   - a popover hung from the mark. Every pop-up in the app rises from
//     the bottom and closes one way (`CollectionDetailScreen`, 13 Nov
//     2026); the level's badge was made a sheet on that ground a day
//     before this (`profile/HeroFace`).
//
// ── what a long name does ──
//
// The name gives way, never the mark: the name's box shrinks
// (`d.name`) and the name is cut, or made smaller, inside it — as each
// page already cuts it — while the disc keeps its 20 and its place on
// the first line. Measured on the 130 profiles of 17 Nov 2026: the
// longest name is 19 characters, the median 7, and six are over 14; a
// person's page has about 240pt for the name at 22, and the mark and
// its gap take 26 of it.
//
// A name that wraps to a second line (Profile allows two) fills its
// box, so the disc then stands at the row's end rather than after the
// last word. Not seen in the data above; an inline mark in the text
// would follow the word, and cannot be pressed reliably inside a Text.
//
// ── arriving late ──
//
// The role is asked for and comes a round trip after the name. Nothing
// is drawn until the answer is in, and nothing if it fails or there is
// none. The row is there from the start and the name's box is as wide
// as the name, so the disc appears after it and moves nothing — except
// for a name long enough to be giving way already, which gives 26 more.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type Ionicons from '@expo/vector-icons/Ionicons';
import ActionSheet, { sheetBody, sheetTitleRow, sheetTitleText } from './ActionSheet';
import { PressableScale } from './ui';
import { Glyph, ICON } from './ui/glyph';
import { useRoleOfQuery } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors } from '../theme';

export type Role = 'editor' | 'guide';
type T = (en: string, vi: string, ja?: string, zh?: string, hant?: string) => string;

/** The disc's glyph and colours. A function, not a table: the colours
 *  are read when it is drawn. */
const dressOf = (role: Role): { icon: keyof typeof Ionicons.glyphMap; color: typeof colors.accent; dress: object } => (
  role === 'editor'
    ? { icon: 'medal', color: colors.accent, dress: d.editor }
    : { icon: 'star', color: colors.ok, dress: d.guide }
);

/** What the role is called. English in every language: they are the
 *  desk's names for them, as "Level" is. */
export const roleName = (role: Role, t: T): string => (
  role === 'editor'
    ? t('Super User', 'Super User', 'スーパーユーザー', '超级用户', '超級使用者')
    : t('Local Guide', 'Local Guide', 'ローカルガイド', '本地向导', '在地嚮導')
);

/** What the role lets its holder do — to them (`yours`), or about them. */
export function roleSays(role: Role, whose: 'yours' | 'theirs', t: T): string {
  if (role === 'editor') {
    return whose === 'yours'
      ? t(
        'You can edit, and add photos to, every place in the app — new or already listed.',
        'Bạn có thể chỉnh sửa, thêm ảnh cho tất cả các địa điểm, mới hoặc đã có trong ứng dụng.',
        'アプリ内のすべての場所（新規・既存）を編集し、写真を追加できます。',
        '你可以编辑应用中的所有地点并为其添加照片，无论是新地点还是已收录的。', '你可以編輯 App 中的所有地點並為其新增照片，無論是新地點還是已收錄的。',
      )
      : t(
        'A Super User can edit, and add photos to, every place in the app.',
        'Super User có thể chỉnh sửa và thêm ảnh cho tất cả các địa điểm trong ứng dụng.',
        'スーパーユーザーは、アプリ内のすべての場所を編集し、写真を追加できます。',
        '超级用户可以编辑应用中的所有地点并为其添加照片。', '超級使用者可以編輯 App 中的所有地點並為其新增照片。',
      );
  }
  return whose === 'yours'
    ? t(
      'You can edit, and add photos to, places in your collections and places you imported.',
      'Bạn có thể chỉnh sửa và thêm ảnh cho các địa điểm trong bộ sưu tập của mình hoặc các địa điểm đã nhập.',
      '自分のコレクションの場所や、自分が追加した場所を編集し、写真を追加できます。',
      '你可以编辑你合集中的地点和你导入的地点，并为其添加照片。', '你可以編輯你合集中的地點和你匯入的地點，並為其新增照片。',
    )
    : t(
      'A Local Guide can edit, and add photos to, places in their collections and places they imported.',
      'Local Guide có thể chỉnh sửa và thêm ảnh cho các địa điểm trong bộ sưu tập của họ hoặc các địa điểm họ đã nhập.',
      'ローカルガイドは、自分のコレクションの場所や自分が追加した場所を編集し、写真を追加できます。',
      '本地向导可以编辑自己合集中的地点和自己导入的地点，并为其添加照片。', '在地嚮導可以編輯自己合集中的地點和自己匯入的地點，並為其新增照片。',
    );
}

/** The disc alone: the role's glyph in the role's colour. */
export function RoleDisc({ role }: { role: Role }) {
  const look = dressOf(role);
  return (
    <View style={[d.disc, look.dress]}>
      <Glyph name={look.icon} size={GLYPH} color={look.color} />
    </View>
  );
}

/** The disc as a press, under its name for VoiceOver. */
export function RoleButton({ role, onPress }: { role: Role; onPress: () => void }) {
  const { t } = useI18n();
  return (
    <PressableScale
      scaleTo={0.9}
      // The disc is 20; twelve more each way is the 44 a thumb is owed.
      // Around it are a name and a handle, neither of them pressed.
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={roleName(role, t)}
      accessibilityHint={t('Explains what this lets you do', 'Giải thích quyền này', 'この権限でできることを説明します', '说明这个身份可以做什么', '說明這個身份可以做什麼')}
      onPress={onPress}
      testID="role-badge"
    >
      <RoleDisc role={role} />
    </PressableScale>
  );
}

/** A sheet's header about a role: the disc that was pressed, then its
 *  name — the mark above what it means. On nothing, as a sheet's title
 *  is (`sheetTitleRow`); the one card under it holds the words. */
export function RoleHead({ role }: { role: Role }) {
  const { t } = useI18n();
  return (
    <View style={sheetTitleRow} testID="badge-sheet-head">
      <RoleDisc role={role} />
      <Text style={sheetTitleText} accessibilityRole="header">{roleName(role, t)}</Text>
    </View>
  );
}

/** A sheet's body about a role: what it lets its holder do. */
export function RoleBody({ role, whose }: { role: Role; whose: 'yours' | 'theirs' }) {
  const { t } = useI18n();
  return (
    <View style={sheetBody} testID="badge-sheet-body">
      <Text style={d.says}>{roleSays(role, whose, t)}</Text>
    </View>
  );
}

/**
 * A name, the role's disc after it, and the sheet the disc opens — see
 * the header.
 *
 * `line` is the name's line height: the disc is centred on the name's
 * first line, whatever the name's size.
 */
export function WithRole({ role, whose, line, children }: {
  role: Role | null;
  whose: 'yours' | 'theirs';
  line: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={d.row} testID="role-row">
      <View style={d.name}>{children}</View>
      {role ? (
        <>
          <View style={[d.mark, { height: line }]} testID="role-mark">
            <RoleButton role={role} onPress={() => setOpen(true)} />
          </View>
          <ActionSheet visible={open} onClose={() => setOpen(false)} header={<RoleHead role={role} />}>
            <RoleBody role={role} whose={whose} />
          </ActionSheet>
        </>
      ) : null}
    </View>
  );
}

/** A person's name on their page, with the mark the database says they
 *  wear — the question (`useRoleOfQuery`), then `WithRole`.
 *
 *  Your own page says it to you ("You can edit…"), as the Account page's
 *  name did until 19 Nov 2026, when your name, and the mark after it,
 *  left Account for your own page (docs/profile-home-plan.md, P3): read
 *  as "A Super User can…", your own mark spoke about you as a stranger. */
export default function PersonRole({ me, personId, line, children }: {
  me: string | null;
  personId: string;
  line: number;
  children: React.ReactNode;
}) {
  const role = useRoleOfQuery(me, personId).data ?? null;
  return <WithRole role={role} whose={me === personId ? 'yours' : 'theirs'} line={line}>{children}</WithRole>;
}

/** The disc: 20, from the 24 it was on a picture's corner, where it
 *  matched the level pill's height. After a name it stands in the
 *  name's line — 25 on Profile, 28 on a person's page — and 20 leaves
 *  room above and below in the shorter of them, a little taller than
 *  the capitals beside it (about 15 at 22pt). Not yet seen on a phone. */
const DISC = 20;
/** Its glyph: 11, the 13 it was, in the disc's proportion (13 × 20/24). */
const GLYPH = ICON.tiny;

const d = StyleSheet.create({
  disc: {
    width: DISC, height: DISC, borderRadius: DISC / 2, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  guide: { borderColor: colors.ok, backgroundColor: colors.okSoft },
  editor: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  // The name, then the mark: 6 between, the near end of the reference's
  // 6 to 8, so the disc reads as the name's and not as a thing beside
  // it. From the top, so a second line of name falls under the first
  // and the disc stays level with the first.
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  // As wide as the name and no wider, and the one that gives way.
  name: { flexShrink: 1 },
  // The first line's height, with the disc in its middle. No halo and no
  // shadow now: those parted it from a photograph, and it is on the page.
  mark: { justifyContent: 'center' },
  // The size the level's sheet set its first sentence in when the two
  // badges shared a sheet (`profile/HeroFace`, 16 Nov 2026); kept, as a
  // sentence that is the whole of its card.
  //
  // Justified (owner, 17 Nov 2026), as a list's description is
  // (`collectionDetail/styles`, 3 Nov): in its box the sentence ran three
  // lines with each stopping short at a different place, and the owner
  // read the box as weighted to one side. The same cost as there — iOS
  // does not hyphenate Vietnamese, so the slack goes into the spaces —
  // and the last line stays ragged, as justified text always ends.
  says: { color: colors.text, fontSize: 16, lineHeight: 22, textAlign: 'justify' },
});
