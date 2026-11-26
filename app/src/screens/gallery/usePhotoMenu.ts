// Out of `GalleryScreen` on 27 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import { Alert } from 'react-native';
import type { SheetAction } from '../../components/ActionSheet';
import type { GalleryAction, GalleryPhoto } from '../../lib/gallery';
import { useI18n } from '../../lib/i18n';

/** The menu on one photograph, and the confirmation before a delete. */
export function usePhotoMenu({ removePhotos, makeCover, hide, onDeleted }: {
  removePhotos: (ids: string[]) => void;
  makeCover: (id: string) => void;
  hide: (id: string, on: boolean) => void;
  /** Back to looking, the choice dropped, once a delete is confirmed. */
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const confirmDelete = (ids: string[]) => Alert.alert(
    ids.length === 1
      ? t('Delete this photo?', 'Xoá ảnh này?', 'この写真を削除しますか？', '删除这张照片？', '刪除這張照片？')
      : t(`Delete ${ids.length} photos?`, `Xoá ${ids.length} ảnh?`, `${ids.length}枚の写真を削除しますか？`, `删除 ${ids.length} 张照片？`, `刪除 ${ids.length} 張照片？`),
    t(
      'It comes off the place for everyone. This cannot be undone.',
      'Ảnh sẽ biến mất khỏi địa điểm với mọi người. Không hoàn tác được.',
      'この場所から全員に対して消えます。元に戻せません。',
      '所有人都将看不到这张照片。此操作无法撤销。', '所有人都將看不到這張照片。此操作無法復原。',
    ),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消'), style: 'cancel' },
      {
        text: t('Delete', 'Xoá', '削除', '删除', '刪除'),
        style: 'destructive',
        onPress: () => {
          // The paths from the rows on screen, so the files go with the
          // rows — see `removePlacePhotos` for why the rows go first.
          removePhotos(ids);
          onDeleted();
        },
      },
    ],
  );

  const actionRow = (photo: GalleryPhoto, a: GalleryAction): SheetAction => ({
    // On the cover, its own slot held: the star filled as it is beside
    // the kind, said as selected, and its tap refused by the strip — the
    // one act here would set what is already set.
    cover: {
      key: a,
      ...(photo.is_cover ? {
        icon: 'star' as const, selected: true,
        title: t('It is the cover', 'Đang là ảnh bìa', 'カバーです', '这是封面', '這是封面'),
        desc: t('The picture that stands for the place.', 'Ảnh đại diện cho địa điểm.', 'この場所を代表する写真です。', '代表这个地点的照片。', '代表這個地點的照片。'),
      } : {
        icon: 'star-outline' as const,
        title: t('Make it the cover', 'Đặt làm ảnh bìa', 'カバーにする', '设为封面', '設為封面'),
        desc: t('The picture that stands for the place, first wherever it appears.', 'Ảnh đại diện cho địa điểm, đứng đầu ở mọi nơi.', 'この場所を代表する写真になり、どこでも先頭に出ます。', '代表这个地点的照片，在任何地方都排在第一张。', '代表這個地點的照片，在任何地方都排在第一張。'),
      }),
      short: t('Cover', 'Ảnh bìa', 'カバー', '封面', '封面'),
      onPress: () => makeCover(photo.id),
    },
    hide: {
      key: a, icon: 'eye-off-outline' as const,
      title: t('Hide it', 'Ẩn ảnh', '非表示にする', '隐藏', '隱藏'),
      short: t('Hide', 'Ẩn', '非表示', '隐藏', '隱藏'),
      desc: t('Readers stop seeing it. You can show it again.', 'Người xem không thấy nữa. Bạn hiện lại được.', '読者には見えなくなります。再表示できます。', '其他人将看不到它。你可以重新显示。', '其他人將看不到它。你可以重新顯示。'),
      onPress: () => hide(photo.id, true),
    },
    unhide: {
      key: a, icon: 'eye-outline' as const,
      title: t('Show it again', 'Hiện lại', '再表示する', '重新显示', '重新顯示'),
      short: t('Show', 'Hiện lại', '再表示', '显示', '顯示'),
      desc: t('Back on the place for everyone.', 'Trở lại địa điểm với mọi người.', 'この場所に再び表示されます。', '重新对所有人显示。', '重新對所有人顯示。'),
      onPress: () => hide(photo.id, false),
    },
    delete: {
      key: a, icon: 'trash-outline' as const, destructive: true,
      title: t('Delete it', 'Xoá ảnh', '削除する', '删除', '刪除'),
      short: t('Delete', 'Xoá', '削除', '删除', '刪除'),
      desc: t('Gone from the place, for good.', 'Xoá hẳn khỏi địa điểm.', 'この場所から完全に消えます。', '从这个地点永久移除。', '從這個地點永久移除。'),
      onPress: () => confirmDelete([photo.id]),
    },
  }[a]);

  return { confirmDelete, actionRow };
}
