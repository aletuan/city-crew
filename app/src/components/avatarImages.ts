// The picture each face is drawn from.
//
// Static imports and a lookup, as `mapPins.ts` is, for the same reason:
// Metro needs every asset path to be a literal it can see at build time.
// What a value of `avatar_url` means is `lib/avatars`'s question.

import type { ImageSource } from 'expo-image';
import { namesPreset, presetOf, type AvatarPreset } from '../lib/avatars';

import koala from '../../assets/avatars/koala.jpg';
import kangaroo from '../../assets/avatars/kangaroo.jpg';
import wombat from '../../assets/avatars/wombat.jpg';
import quokka from '../../assets/avatars/quokka.jpg';
import platypus from '../../assets/avatars/platypus.jpg';
import echidna from '../../assets/avatars/echidna.jpg';
import kookaburra from '../../assets/avatars/kookaburra.jpg';
import emu from '../../assets/avatars/emu.jpg';

export const PRESET_IMAGES: Record<AvatarPreset, number> = {
  koala, kangaroo, wombat, quokka, platypus, echidna, kookaburra, emu,
};

/** What to draw for an `avatar_url`: the bundled animal, the photograph,
 *  or nothing — and nothing means the blank disc. An animal this build
 *  does not have is nothing too, not an address to fetch. */
export function avatarSource(url: string | null | undefined): ImageSource | number | null {
  const preset = presetOf(url);
  if (preset) return PRESET_IMAGES[preset];
  return url && !namesPreset(url) ? { uri: url } : null;
}
