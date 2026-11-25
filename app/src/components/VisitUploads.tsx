// What becomes of a check-in photo after its sheet has gone (owner, 25
// Nov 2026). Renders nothing; mounted once, under the check-ins it asks
// again.
//
// Done no longer waits for an upload (`lib/visitUploads` has why and the
// numbers). So the end of one may come with no sheet up to show it, and
// this is who answers then:
//
//   · up — the reader's visits are asked again, so their page and the
//     check-ins list draw the photo. With a sheet still up over the visit
//     nothing is asked here: the sheet says it changed the visit as it
//     closes, and its caller asks.
//   · refused — the cap or the file, said once, as the sheet says it.
//   · failed — the network, most likely. The bytes are still held, so
//     the reader is asked whether to try again or let the photo go.
//     Nothing else would ever ask: the tile that could be pressed went
//     with the sheet.
//
// Not a line in the notice bar (`lib/notice`). That bar says where a
// visit went and closes itself after six seconds; an upload takes two to
// four, and a second line saying it had landed would be a line about
// nothing the reader can see from where they are. A failure, which needs
// an answer, is an alert, as it is in the sheet.

import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useMyCheckins } from '../lib/checkins';
import { useI18n } from '../lib/i18n';
import { dropVisitPhoto, isWatched, onVisitUpload, retryVisitPhoto } from '../lib/visitUploads';
import { couldNotAdd, refusalText } from './useVisitPhotos';

export default function VisitUploads() {
  const { t } = useI18n();
  const mine = useMyCheckins();
  const reload = mine.reload;

  useEffect(() => onVisitUpload((e) => {
    if (isWatched(e.visitId)) return;
    if (e.kind === 'up') { reload(); return; }
    if (e.kind === 'refused') { Alert.alert(couldNotAdd(t), refusalText(t, e.why)); return; }
    Alert.alert(
      t('A photo did not upload', 'Một ảnh chưa tải lên được', '写真をアップロードできませんでした', '有一张照片未能上传', '有一張照片未能上傳'),
      t(
        'The connection dropped while it was on its way to your check-in.',
        'Mạng bị ngắt khi ảnh đang được tải lên lần check-in của bạn.',
        'チェックインへのアップロード中に接続が切れました。',
        '照片上传到你的打卡时网络中断了。', '照片上傳到你的打卡時網路中斷了。',
      ),
      [
        { text: t('Discard photo', 'Bỏ ảnh', '写真を破棄', '放弃照片', '放棄照片'), style: 'destructive', onPress: () => dropVisitPhoto(e.key) },
        { text: t('Try again', 'Thử lại', '再試行', '重试', '重試'), onPress: () => retryVisitPhoto(e.key) },
      ],
    );
  // `t` is new each render and reads nothing that changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [reload]);

  return null;
}
