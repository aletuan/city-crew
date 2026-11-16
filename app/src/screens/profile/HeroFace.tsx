// The picture on your own profile, with its ring and the two badges on
// it — and the sheet that says what either badge is.
//
// ── the two badges explain themselves in one sheet (owner, 16 Nov 2026) ──
//
// The role's disc had always answered a press with a system alert. The
// level's pill answered with nothing until that day, then with an alert
// of its own for an hour — and the owner, seeing it on the phone, asked
// for the level drawn rather than written: its title, a bar, what the
// next level takes, the rule. An alert cannot draw a bar, wears iOS's
// grey whatever look the reader chose, and is the system's way of
// stopping someone for a thing that matters; a level is a note.
//
// So a sheet, in the reader's look, and for both badges: two marks on
// one picture that open two kinds of thing is one of them a surprise.
//
// A sheet from the bottom, not a bubble hung from the pill. A popover
// was what the owner was first shown, and it is the tidier picture — but
// the collection page's ⋯ was a popover until 13 Nov 2026 and was made a
// sheet so that every pop-up in the app rises and is closed the same way
// (`CollectionDetailScreen`). `ActionSheet` is that sheet: its backdrop,
// its spring, its grabber, and the header card naming what it is about.
//
// The bar is the ring's reading, not the count's — `levelSteps`.
//
// ── out of `AccountProfile` ──
//
// The role, the ring and the disc were drawn there, and its function is
// at its ceiling (`oversize.js`); a sheet's state and body had nowhere
// to go. They moved here together, and the ceiling came down by what
// left.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ActionSheet, { sheetHeader } from '../../components/ActionSheet';
import AvatarPicker from '../../components/AvatarPicker';
import EngagementRing from '../../components/EngagementRing';
import { PressableScale } from '../../components/ui';
import { Glyph } from '../../components/ui/glyph';
import { useI18n } from '../../lib/i18n';
import { levelFromSaves, levelSteps, levelWords } from '../../lib/level';
import { useIsEditor, useIsGuideAnywhere } from '../../lib/useGuideGrant';
import { colors, font, radius, space } from '../../theme';
import { s } from './styles';

export function HeroFace({ saved }: {
  /** The distinct places the reader keeps — what the level is made of. */
  saved: number;
}) {
  const { t } = useI18n();
  // Which badge the sheet is about, kept while it closes: a sheet whose
  // words change as it fades reads as a flicker.
  const [sheet, setSheet] = useState<{ open: boolean; about: 'level' | 'role' }>({ open: false, about: 'level' });
  const { level, progress } = levelFromSaves(saved);
  // The reader's standing in the catalog, for the disc on the picture.
  // Editor outranks guide and is shown alone: the desk's hand keeps every
  // gallery, which includes the ones a guide keeps.
  const editor = useIsEditor();
  const guide = useIsGuideAnywhere();
  const role = editor
    ? {
      icon: 'medal' as const, color: colors.accent, dress: s.roleEditor,
      name: t('Super User', 'Super User', 'スーパーユーザー', '超级用户', '超級使用者'),
      says: t(
        'You can edit, and add photos to, every place in the app — new or already listed.',
        'Bạn có thể chỉnh sửa, thêm ảnh cho tất cả các địa điểm, mới hoặc đã có trong ứng dụng.',
        'アプリ内のすべての場所（新規・既存）を編集し、写真を追加できます。',
        '你可以编辑应用中的所有地点并为其添加照片，无论是新地点还是已收录的。', '你可以編輯 App 中的所有地點並為其新增照片，無論是新地點還是已收錄的。',
      ),
    }
    : guide
      ? {
        icon: 'star' as const, color: colors.ok, dress: s.roleGuide,
        name: t('Local Guide', 'Local Guide', 'ローカルガイド', '本地向导', '在地嚮導'),
        says: t(
          'You can edit, and add photos to, places in your collections and places you imported.',
          'Bạn có thể chỉnh sửa và thêm ảnh cho các địa điểm trong bộ sưu tập của mình hoặc các địa điểm đã nhập.',
          '自分のコレクションの場所や、自分が追加した場所を編集し、写真を追加できます。',
          '你可以编辑你合集中的地点和你导入的地点，并为其添加照片。', '你可以編輯你合集中的地點和你匯入的地點，並為其新增照片。',
        ),
      }
      : null;

  const words = levelWords(saved, t);
  const steps = levelSteps(saved);
  const open = (about: 'level' | 'role') => setSheet({ open: true, about });
  const close = () => setSheet((was) => ({ ...was, open: false }));
  const aboutRole = sheet.about === 'role' && role;

  return (
    <>
      {/* No camera badge here: the level badge takes that corner, and
          Edit profile shows the same picker with its badge intact.

          The reader's standing, on the picture. A guide, and an editor
          (the desk's hand), may keep galleries the panel would otherwise
          refuse; it used to be said in a pill under the name, beside
          Edit profile, and the owner found the pill loud for what it
          is — a mark, not a message. So: a small disc on the ring's
          top-right corner, the level's own halo at the opposite corner,
          with the role's glyph in the role's colour. Editor outranks
          guide and is the one disc shown; a reader with neither wears
          none. A tap still says what the grant lets them do, in the
          desk's words, and VoiceOver reads the role as the disc's name.

          And because the disc lies on the picture, its arriving a
          round-trip late moves nothing else on the page — which is
          what the pill's held room was for. */}
      <View style={s.avatarBox} testID="avatar-box">
        <EngagementRing size={88} level={level} progress={progress} onExplain={() => open('level')}>
          <AvatarPicker showCamera={false} />
        </EngagementRing>
        {role && (
          <View style={s.roleHalo}>
            <PressableScale
              scaleTo={0.9}
              contentStyle={[s.roleDisc, role.dress]}
              accessibilityRole="button"
              accessibilityLabel={role.name}
              accessibilityHint={t('Explains what this lets you do', 'Giải thích quyền này', 'この権限でできることを説明します', '说明这个身份可以做什么', '說明這個身份可以做什麼')}
              onPress={() => open('role')}
              testID="role-badge"
            >
              <Glyph name={role.icon} size={13} color={role.color} />
            </PressableScale>
          </View>
        )}
      </View>

      <ActionSheet
        visible={sheet.open}
        onClose={close}
        header={aboutRole ? (
          // The disc itself, then its name: the mark that was pressed,
          // above what it means.
          <View style={sheetHeader} testID="badge-sheet-head">
            <View style={[s.roleDisc, aboutRole.dress]}>
              <Glyph name={aboutRole.icon} size={13} color={aboutRole.color} />
            </View>
            <Text style={h.title} accessibilityRole="header">{aboutRole.name}</Text>
          </View>
        ) : (
          // No pill beside "Level 15": it would say the title twice. The
          // steps at the end are the bar's figure, read.
          <View style={sheetHeader} testID="badge-sheet-head">
            <Text style={h.title} accessibilityRole="header">{words.title}</Text>
            <View style={h.steps}>
              <Text style={h.stepsText} testID="level-steps">{`${steps.done} / ${steps.of}`}</Text>
            </View>
          </View>
        )}
      >
        {aboutRole ? (
          <View style={h.body} testID="badge-sheet-body">
            <Text style={h.lead}>{aboutRole.says}</Text>
          </View>
        ) : (
          <View style={h.body} testID="badge-sheet-body">
            <View
              style={h.track}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: steps.of, now: steps.done }}
              // Said, too: a bar's value alone is read as a percentage.
              accessibilityLabel={t(
                `${steps.done} of ${steps.of} places toward the next level`,
                `${steps.done} trên ${steps.of} địa điểm để lên level tiếp theo`,
                `次のレベルまで${steps.of}件中${steps.done}件`,
                `距下一级：${steps.of} 个地点中的 ${steps.done} 个`, `距下一級：${steps.of} 個地點中的 ${steps.done} 個`,
              )}
              testID="level-bar"
            >
              <View style={[h.fill, { width: `${(steps.done / steps.of) * 100}%` }]} testID="level-bar-fill" />
            </View>
            <Text style={h.lead}>{words.next}</Text>
            <Text style={h.rule}>{words.rule}</Text>
          </View>
        )}
      </ActionSheet>
    </>
  );
}

/** The bar's thickness. 8: the ring it repeats is a 4pt stroke seen from
 *  a hand's length on an 88pt picture; alone on a card the width of the
 *  phone, 4 is a hairline and 8 is a bar. */
const BAR = 8;

const h = StyleSheet.create({
  // The sheet's rows' title (16 semibold, `ActionSheet`), a step up: it
  // heads the sheet rather than naming one of several rows.
  title: { flex: 1, color: colors.text, fontSize: 18, fontWeight: font.bold },
  // The steps, on a tint of the accent — the reader's look, as the
  // Statistics well on the Activity page is. A count's pill in shape.
  steps: {
    minWidth: 32, height: 24, paddingHorizontal: 10, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft,
  },
  stepsText: { color: colors.accent, fontSize: 13, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },
  // The card the rows of other sheets stand on (`ActionSheet`'s group).
  body: {
    gap: 12, padding: space.cardPadding,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.card,
  },
  // The accent on its own tint: both follow the look the reader chose.
  track: { height: BAR, borderRadius: BAR / 2, backgroundColor: colors.accentSoft, overflow: 'hidden' },
  fill: { height: BAR, borderRadius: BAR / 2, backgroundColor: colors.accent },
  lead: { color: colors.text, fontSize: 16, lineHeight: 22 },
  rule: { color: colors.textTertiary, fontSize: 14, lineHeight: 19 },
});
