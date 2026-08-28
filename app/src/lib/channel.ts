// Which release channel this copy of the app came from.
//
// The channel is stamped into a binary when EAS builds it (`eas.json`,
// per profile) and never changes for the life of that install: the
// TestFlight build says "preview", the App Store build says "production",
// and Expo Go — which is not a build of ours at all — says nothing.
//
// That stamp is the app's only honest notion of environment, so this is
// where the flags that should differ between "us trying things" and
// "readers using the app" come to ask. Null is deliberately grouped with
// the non-production channels: an install without a stamp is Expo Go or
// a bare dev build, which is always us.

import * as Updates from 'expo-updates';

export const CHANNEL: string | null = Updates.channel ?? null;

export const IS_PRODUCTION_CHANNEL = CHANNEL === 'production';
