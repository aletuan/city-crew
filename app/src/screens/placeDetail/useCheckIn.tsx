// The tap that checks in, and the sheet that follows it.
//
// Out of `PlaceDetailScreen` on 24 Nov 2026, when the visit gained a
// note (`components/CheckinSheet`): the screen is held to the size it
// stood at (`oversize.js`), and the tap, its refusals and the sheet are
// one thing with one reason to change.
//
// The order is the point. The visit is written by the tap, and the
// reader feels it land (`successHaptic`) and sees the pill turn, before
// anything is asked of them; the sheet rises over a visit that already
// exists. `lib/checkin` has what that order was weighed against.
//
// When the sheet goes, a visit shared with friends is said to be on the
// reader's page, with a way there (`lib/notice`) — the page is not gone
// to for them, and why not is written there.
//
// The App Store's "enjoying the app?" waits for the sheet to go. It was
// asked a second and a half after the tap (`askReview`'s settle), which
// is now the moment the reader is looking at a field; Apple's sheet over
// ours, mid-word, is the one thing worse than not asking.

import React, { useRef, useState } from 'react';
import { Alert } from 'react-native';
import CheckinSheet, { type SheetVisit } from '../../components/CheckinSheet';
import { successHaptic } from '../../components/ui';
import { reviewAfterCheckin } from '../../lib/askReview';
import { AUDIENCE_ON, nextAudience, whyRefused, type Checkin } from '../../lib/checkin';
import { addCheckin, fetchMyCheckins, type Fetch } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { useNotice } from '../../lib/notice';
import { useFlag } from '../../lib/useFlag';
import { DAILY_CAPS, isDailyLimit } from '../../lib/quota';

/** The place as the tap needs it; the screen has all four to hand. */
export type CheckInAt = { slug: string; name: string; cover: string | null; cityId: string | null };

export function useCheckIn({ uid, visits, askToSignIn }: {
  uid: string | null;
  visits: Fetch<Checkin[]>;
  askToSignIn: (why: 'checkin') => void;
}): { checkIn: (at: CheckInAt) => Promise<void>; checking: boolean; sheet: React.ReactElement } {
  const { t } = useI18n();
  const { say } = useNotice();
  const [checking, setChecking] = useState(false);
  const [raised, setRaised] = useState<SheetVisit | null>(null);
  // Whether the sheet offers Public, and so opens a new visit on it.
  const publicOn = useFlag('checkin_public');
  // The reader's count with this visit in it, kept from the tap for the
  // review ask at the sheet's close: by then the list may or may not
  // have been asked again, and the ask's rule counts visits.
  const total = useRef(0);

  const refusal = (why: 'soon' | 'place' | 'day') => (why === 'soon'
    ? t(
      'You checked in here a moment ago. Try again in a few minutes.',
      'Bạn vừa check-in ở đây. Thử lại sau ít phút nhé.',
      'ついさっきここでチェックインしました。数分後にもう一度どうぞ。',
      '你刚在这里打过卡，几分钟后再试吧。', '你剛在這裡打過卡，幾分鐘後再試吧。',
    )
    : why === 'place'
      ? t(
        `You have checked in here ${DAILY_CAPS.checkinsPerPlace} times today. Come back tomorrow.`,
        `Hôm nay bạn đã check-in ở đây ${DAILY_CAPS.checkinsPerPlace} lần rồi. Mai quay lại nhé.`,
        `今日はここに${DAILY_CAPS.checkinsPerPlace}回チェックイン済みです。また明日どうぞ。`,
        `你今天已在这里打卡 ${DAILY_CAPS.checkinsPerPlace} 次，明天再来吧。`, `你今天已在這裡打卡 ${DAILY_CAPS.checkinsPerPlace} 次，明天再來吧。`,
      )
      : t(
        `You have checked in ${DAILY_CAPS.checkinsPerDay} times in the last day. Come back tomorrow.`,
        `Bạn đã check-in ${DAILY_CAPS.checkinsPerDay} lần trong một ngày qua. Mai quay lại nhé.`,
        `この1日で${DAILY_CAPS.checkinsPerDay}回チェックインしました。また明日どうぞ。`,
        `你在过去一天里已打卡 ${DAILY_CAPS.checkinsPerDay} 次，明天再来吧。`, `你在過去一天裡已打卡 ${DAILY_CAPS.checkinsPerDay} 次，明天再來吧。`,
      ));

  const checkIn = async (at: CheckInAt) => {
    // A guest's tap is the door, with its reason named, as the like's is.
    // Nothing resumes on the far side: signed in, the pill is the same
    // pill, and a visit written by a sign-in rather than by a tap would
    // be one the reader did not quite make.
    if (!uid) { askToSignIn('checkin'); return; }
    if (checking) return;
    setChecking(true);
    try {
      const id = await addCheckin({ ownerId: uid, placeSlug: at.slug, cityId: at.cityId });
      successHaptic();
      // The list is the one before this visit; the count includes it.
      total.current = visits.data.length + 1;
      setRaised({
        id, name: at.name, cover: at.cover, at: new Date().toISOString(),
        note: null, audience: nextAudience(visits.data, publicOn), fresh: true,
      });
      visits.reload();
    } catch (e) {
      // The cap gets its own words, as the collection form's does. Not
      // noted in the taste profile either way: `place_events` is the
      // private signal and this is the reader's own record — see
      // `lib/checkin` for why the two are kept apart.
      const why = isDailyLimit(e)
        ? whyRefused(await fetchMyCheckins(uid).catch(() => visits.data), at.slug, new Date())
        : null;
      // Asked again whatever the answer: a refusal from a rule this phone
      // could not see means another phone's visit is not in the list yet.
      if (why) visits.reload();
      Alert.alert(t('Could not check in', 'Không check-in được', 'チェックインできませんでした', '无法打卡', '無法打卡'), why ? refusal(why) : (e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const sheet = (
    <CheckinSheet
      visit={raised}
      withAudience={AUDIENCE_ON}
      onClose={(saved, shared) => {
        setRaised(null);
        if (saved) visits.reload();
        // Apple's sheet or the line, never both: the ask says at once
        // whether its sheet is coming (`askReview`).
        void reviewAfterCheckin(total.current).then((asks) => {
          // Only for a visit friends see. One kept private has no card
          // worth going to look at, and a line about it would be
          // telling the reader something they just chose not to share.
          if (asks || !shared) return;
          say({
            text: t('Added to your page', 'Đã thêm vào trang của bạn', 'あなたのページに追加しました', '已添加到你的主页', '已新增到你的主頁'),
            action: t('View', 'Xem', '見る', '查看', '檢視'),
          });
        });
      }}
    />
  );
  return { checkIn, checking, sheet };
}
