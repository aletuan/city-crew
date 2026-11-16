// The mark of a role — a local guide's star, an editor's medal — and what
// it means, wherever a person's picture wears it.
//
// It was drawn in one place: on your own picture on Profile, where only
// you could see it (`profile/HeroFace`). On 16 Nov 2026 the owner asked
// for it on a person's page too, where it does its real work: it tells
// somebody else that the desk trusts this account to keep places. So the
// look and the words moved here, and both pictures draw the one disc.
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
// ── on a person's page ──
//
// `PersonRole` is the whole of it for that page: the question
// (`useRoleOfQuery`), the disc on the picture's corner, and the sheet a
// press opens — the app's sheet, as the level's and the role's on
// Profile are, so that every badge on a picture explains itself one way.
//
// Bottom right, where Profile puts the level's pill. A person's page
// shows no level, so the corner is free — and the top of that picture
// lies over the cover photograph, where a small disc is lost against
// whatever the photograph is; the bottom lies on the page.
//
// Nothing is drawn until the answer is in, and nothing if it fails or
// there is none: a disc arriving a round trip late lies on the picture
// and moves nothing.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type Ionicons from '@expo/vector-icons/Ionicons';
import ActionSheet, { sheetBody, sheetTitleRow, sheetTitleText } from './ActionSheet';
import { PressableScale } from './ui';
import { Glyph } from './ui/glyph';
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
      <Glyph name={look.icon} size={13} color={look.color} />
    </View>
  );
}

/** The disc as a press, under its name for VoiceOver. */
export function RoleButton({ role, onPress }: { role: Role; onPress: () => void }) {
  const { t } = useI18n();
  return (
    <PressableScale
      scaleTo={0.9}
      // The disc is 24; ten more each way is the 44 a thumb is owed.
      hitSlop={10}
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

/** The mark on a person's page, and its sheet — see the header. */
export default function PersonRole({ me, personId }: {
  me: string | null;
  personId: string;
}) {
  const role = useRoleOfQuery(me, personId).data;
  const [open, setOpen] = useState(false);
  if (!role) return null;
  return (
    <>
      <View style={d.corner} testID="person-role">
        <RoleButton role={role} onPress={() => setOpen(true)} />
      </View>
      <ActionSheet visible={open} onClose={() => setOpen(false)} header={<RoleHead role={role} />}>
        <RoleBody role={role} whose="theirs" />
      </ActionSheet>
    </>
  );
}

const d = StyleSheet.create({
  // 24pt: the level pill's height on Profile, so the two corners of that
  // picture read as a pair.
  disc: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  guide: { borderColor: colors.ok, backgroundColor: colors.okSoft },
  editor: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  // A ring of page round the disc, as Profile's has (`roleHalo` there):
  // background, not a border, which can come back stale after a change
  // of look. Its edge on the picture's: the picture's own ring is 4 wide,
  // and the halo's 2.5 sits inside it.
  corner: {
    position: 'absolute', right: -2, bottom: -2,
    backgroundColor: colors.bg, borderRadius: 999, padding: 2.5,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  // The level sheet's lead (`profile/HeroFace`): one sheet, one type,
  // whichever badge it is about.
  says: { color: colors.text, fontSize: 16, lineHeight: 22 },
});
