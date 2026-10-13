// The impure half of `review.ts`: read the memo, ask Apple, write it back.
//
// The native module is asked for with `requireOptionalNativeModule`, never
// `expo-store-review`'s own import, for the reason `appinfo.ts` gives: this
// file travels by OTA to every build on the same runtime, and the builds
// before 1.0.8 do not have `ExpoStoreReview` linked. There it is null and
// the ask is a no-op — no crash, and no fallback to opening the store page,
// which would throw the reader out of the app mid-task.
//
// Fire-and-forget and delayed: the call sites are a check-in's success
// haptic and a plan's save, and the sheet should arrive after the screen
// has settled, not on top of the tap that earned it.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { APP_INFO } from './appinfo';
import { afterAsk, parseMemo, REVIEW_KEY, shouldAsk, type Moment, type ReviewMemo } from './review';

type NativeStoreReview = {
  isAvailableAsync?: () => Promise<boolean>;
  requestReview?: () => Promise<void>;
};

const SETTLE_MS = 1500;

async function readMemo(): Promise<ReviewMemo> {
  try { return parseMemo(await AsyncStorage.getItem(REVIEW_KEY)); } catch { return parseMemo(null); }
}

async function writeMemo(m: ReviewMemo): Promise<void> {
  try { await AsyncStorage.setItem(REVIEW_KEY, JSON.stringify(m)); } catch { /* a lost memo asks once more; harmless */ }
}

async function run(moment: Moment | 'trip'): Promise<void> {
  let memo = await readMemo();
  // A trip's total is counted here: see `ReviewMemo.tripsSaved`.
  let m: Moment;
  if (moment === 'trip') {
    memo = { ...memo, tripsSaved: memo.tripsSaved + 1 };
    await writeMemo(memo);
    m = { kind: 'trip', total: memo.tripsSaved };
  } else {
    m = moment;
  }
  const version = APP_INFO.version;
  if (!version || !shouldAsk(memo, m, version, new Date())) return;
  const native = requireOptionalNativeModule<NativeStoreReview>('ExpoStoreReview');
  if (!native?.requestReview) return;
  if (native.isAvailableAsync && !(await native.isAvailableAsync())) return;
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  await native.requestReview();
  await writeMemo(afterAsk(memo, version, new Date()));
}

/** After a check-in succeeded; `total` is the reader's count including it. */
export function reviewAfterCheckin(total: number): void {
  run({ kind: 'checkin', total }).catch(() => {});
}

/** After a plan was saved by the reader. */
export function reviewAfterTripSaved(): void {
  run('trip').catch(() => {});
}
