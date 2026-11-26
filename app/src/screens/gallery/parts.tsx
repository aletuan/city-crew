// Out of `GalleryScreen` on 27 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ScoreBadge, ScoreGlyph, tenText } from '../../components/PhotoScore';
import { Card, Empty, PressableScale, Screen } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import type { useAddPhoto } from '../../components/useAddPhoto';
import type { GalleryPhoto } from '../../lib/gallery';
import { MAX_PER_PLACE } from '../../lib/guide';
import { useI18n } from '../../lib/i18n';
import { toTen } from '../../lib/photoScore';
import { colors, onPhoto } from '../../theme';
import { s } from './styles';

export type Mode = 'view' | 'pick';

// The toolbar. One quiet pill while looking; in pick mode, the
// way out and the way through, and nothing else — a mode with a
// third button is a mode you can leave by accident.
export function GalleryTools({ mode, canScore, unscored, anyScored, picked, onSelect, onScore, onCancel, onDeletePicked }: {
  mode: Mode;
  /** The phone can read photographs, and the reader is signed in. */
  canScore: boolean;
  /** How many the shown scorer has not read. */
  unscored: number;
  anyScored: boolean;
  /** How many are ticked. */
  picked: number;
  onSelect: () => void;
  onScore: () => void;
  onCancel: () => void;
  onDeletePicked: () => void;
}) {
  const { t } = useI18n();
  return (
  <View style={s.tools} testID="gallery-tools">
    {mode === 'view' && (
      <Tool icon="checkmark-circle-outline" label={t('Select', 'Chọn', '選択', '选择', '選擇')} onPress={onSelect} testID="gallery-select" />
    )}
    {/* Drawn only where the phone can read, and only while there
        is something left to read — a button that would score
        nothing is a button that teaches the reader to doubt it. */}
    {mode === 'view' && canScore && unscored > 0 && (
      <Tool
        glyph={<ScoreGlyph size={15} color={colors.text} />}
        label={anyScored
          ? t(`Score ${unscored} new`, `Chấm ${unscored} ảnh mới`, `新しい${unscored}枚を採点`, `为 ${unscored} 张新照片评分`, `為 ${unscored} 張新照片評分`)
          : t('Score photos', 'Chấm ảnh', '写真を採点', '为照片评分', '為照片評分')}
        onPress={onScore}
        testID="gallery-score"
      />
    )}
    {mode === 'pick' && (
      <>
        <Tool icon="close" label={t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消')} onPress={onCancel} testID="gallery-cancel" />
        <Tool
          icon="trash-outline"
          label={picked
            ? t(`Delete ${picked}`, `Xoá ${picked}`, `${picked}枚を削除`, `删除 ${picked} 张`, `刪除 ${picked} 張`)
            : t('Delete', 'Xoá', '削除', '删除', '刪除')}
          onPress={onDeletePicked}
          destructive
          testID="gallery-delete-picked"
        />
      </>
    )}
  </View>
  );
}

/** The tiles, and the one where a photograph is on its way. */
export function GalleryGrid({ shown, mode, picked, lastOpened, cell, adder, onPick, onOpen }: {
  shown: GalleryPhoto[];
  mode: Mode;
  picked: string[];
  lastOpened: string | null;
  cell: number;
  adder: Pick<ReturnType<typeof useAddPhoto>, 'busy' | 'stage' | 'progress'>;
  onPick: (id: string) => void;
  onOpen: (p: GalleryPhoto) => void;
}) {
  const { t } = useI18n();
  return (
    <View style={s.grid} testID="gallery-grid">
      {shown.map((p, i) => {
        const picks = mode === 'pick';
        return (
          <PressableScale
            key={p.id}
            scaleTo={0.96}
            onPress={picks ? () => onPick(p.id) : () => onOpen(p)}
            accessibilityRole="button"
            accessibilityLabel={`${t('Photo', 'Ảnh', '写真', '照片', '照片')} ${i + 1}${p.is_cover ? ` · ${t('cover', 'ảnh bìa', 'カバー', '封面', '封面')}` : ''}${p.is_hidden ? ` · ${t('hidden', 'đã ẩn', '非表示', '已隐藏', '已隱藏')}` : ''}${p.score?.aesthetic != null ? ` · ${tenText(toTen(p.score.aesthetic))}/10` : ''}`}
            accessibilityState={picks ? { selected: picked.includes(p.id) } : undefined}
            style={{ width: cell, height: cell }}
            contentStyle={[s.tile, !picks && lastOpened === p.id && s.tileLast]}
            testID={`gallery-tile-${p.id}`}
          >
            <Image source={{ uri: p.photo_uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />

            {/* A hidden photograph is dimmed rather than removed:
                this is the one screen where hidden rows are the
                point, and the dimming says what the row says. */}
            {p.is_hidden && (
              <View style={[StyleSheet.absoluteFill, s.hiddenVeil]} testID="gallery-hidden">
                <Glyph name="eye-off" size={ICON.nav} color={onPhoto.text} />
              </View>
            )}

            {p.is_cover && (
              <View style={s.badge} testID="gallery-cover">
                <Glyph name="star" size={ICON.tiny} color={onPhoto.accent} />
                <Text style={s.badgeText}>{t('Cover', 'Ảnh bìa', 'カバー', '封面', '封面')}</Text>
              </View>
            )}

            {p.score && <ScoreBadge score={p.score} testID={`gallery-score-${p.id}`} />}

            {picks && (
              <View style={[s.tick, picked.includes(p.id) && s.tickOn]} testID={`gallery-tick-${p.id}`}>
                {picked.includes(p.id) && <Glyph name="checkmark" size={ICON.text} color={colors.accentInk} />}
              </View>
            )}
          </PressableScale>
        );
      })}
      {/* Where the photograph will land, while it is on its way.
          The grid used to do nothing until the read-back after the
          insert, and the one sign of the one-to-three seconds in
          between was the header pill's word turning into "…". The
          tile takes the new photograph's cell — the end of the
          grid, the size of every other cell — and names the step
          being waited on, in the two words the two slow steps
          actually divide into. Indeterminate, because the storage
          client reports no bytes; a bar that guessed would be
          worse than a word that is true. */}
      {adder.busy && (
        <View style={[s.tile, s.waiting, { width: cell, height: cell }]} testID="gallery-uploading">
          <ActivityIndicator color={colors.accent} />
          <Text style={s.waitingText}>
            {adder.stage === 'shrinking'
              ? t('Compressing…', 'Đang nén…', '圧縮中…', '压缩中…', '壓縮中…')
              : t('Uploading…', 'Đang tải lên…', 'アップロード中…', '上传中…', '上傳中…')}
            {/* "2/4" only when there is a batch to count. */}
            {adder.progress.total > 1 ? ` ${adder.progress.done + 1}/${adder.progress.total}` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

/** The rules, once, in the reader's language — the ones a menu cannot
 *  show because they are about what it does *not* offer. */
export function GalleryTips() {
  const { t } = useI18n();
  return (
  <Card style={s.tips}>
    {/* Cut to one line each with the owner (16 Oct 2026): what
        the screen shows by itself went — how to change the cover is
        the sheet's own row, which photo of several becomes it shows
        in the first tile, and which of two edits wins is the
        database's business, not the guide's.
        Rewritten with the owner before that (15 Oct 2026). "The desk" is a
        name only the team uses, so the second tip names City Crew.
        "JPG or PNG" went: the roll's HEIC is turned into JPEG on
        the way up, so the format was never the reader's to mind.
        "Pick them all at once" went too: the picker says so itself.
        The cover tip now says what adding does to the cover, which
        is the surprise the old wording only hinted at — the upload
        trigger (`20260921093000_guide_upload_becomes_cover.sql`)
        makes the newest photo the cover. */}
    <Text style={s.tipsTitle}>{t('Note', 'Chú ý', 'ご注意', '注意', '注意')}</Text>
    <Tip text={t(
      'A photo you add becomes the cover.',
      'Ảnh mới thêm sẽ thành ảnh bìa.',
      '追加した写真がカバーになります。',
      '你添加的照片会成为封面。', '你新增的照片會成為封面。',
    )} />
    <Tip text={t(
      'The City Crew team can edit these photos too.',
      'Đội ngũ City Crew cũng có thể chỉnh các ảnh này.',
      'City Crewのチームもこれらの写真を編集できます。',
      'City Crew 团队也可以编辑这些照片。', 'City Crew 團隊也可以編輯這些照片。',
    )} />
    <Tip text={t(
      `Up to ${MAX_PER_PLACE} photos per place.`,
      `Tối đa ${MAX_PER_PLACE} ảnh cho mỗi địa điểm.`,
      `1つの場所に${MAX_PER_PLACE}枚まで。`,
      `每个地点最多 ${MAX_PER_PLACE} 张照片。`, `每個地點最多 ${MAX_PER_PLACE} 張照片。`,
    )} />
  </Card>
  );
}

/** A toolbar pill. Quiet by default; `destructive` for the one that
 *  deletes. */
function Tool({ icon, glyph, label, onPress, destructive, testID }: {
  icon?: keyof typeof Ionicons.glyphMap;
  /** A drawn glyph in place of an Ionicons name — the scorer's bars. */
  glyph?: React.ReactNode;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  testID?: string;
}) {
  const ink = destructive ? colors.bad : colors.text;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={label}
      contentStyle={[s.tool, destructive && s.toolBad]}
      testID={testID}
    >
      {glyph ?? <Glyph name={icon} size={ICON.text} color={ink} />}
      <Text style={[s.toolText, { color: ink }]}>{label}</Text>
    </PressableScale>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <View style={s.tip}>
      <View style={s.tipDot} />
      <Text style={s.tipText}>{text}</Text>
    </View>
  );
}

/** The two faces before the gallery: the place still on its way, and a
 *  gallery the reader may not keep. */
export function NotYours({ waiting, onBack }: { waiting: boolean; onBack: () => void }) {
  const { t } = useI18n();
  return waiting ? (
    <Screen compactTitle title={t('Gallery', 'Gallery', 'ギャラリー', '相册', '相簿')} onBack={onBack} backBare>
      <ActivityIndicator color={colors.accent} style={{ marginTop: 64 }} />
    </Screen>
  ) : (
    <Screen compactTitle title={t('Gallery', 'Gallery', 'ギャラリー', '相册', '相簿')} onBack={onBack} backBare>
      <Empty text={t('This is not yours to keep.', 'Đây không phải gallery của bạn.', 'これはあなたのギャラリーではありません。', '你无权管理这个相册。', '你無權管理這個相簿。')} />
    </Screen>
  );
}
