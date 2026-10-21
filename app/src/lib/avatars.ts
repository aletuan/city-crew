// The faces a person can wear without a photograph of their own.
//
// Eight Australian animals, drawn as one set, supplied by the owner on
// 19 Oct 2026. They ship inside the app (`assets/avatars`, 288px, 12 to
// 19 KB each) rather than in Storage, and `avatar_url` holds a name, not
// an address: `preset:koala`. Two reasons. A bundled picture is on the
// phone before anybody opens a screen, so the crew list draws it with no
// request at all, which was the whole complaint that started the avatar
// work (`CrewProvider` warms remote faces only). And nothing has to be
// uploaded, so the bucket's one-write-a-minute rule (`avatar_cooldown.sql`)
// never stands between a person and a second choice.
//
// Rejected: copying the eight files into the `avatars` bucket and storing
// their public URLs. Every renderer would have worked unchanged, but each
// face would cost a download per phone, and the files would sit in a
// bucket whose policy is one folder per person.
//
// Anything that is not a known name is not a preset: a row naming an
// animal this build does not have draws the blank disc, never a broken
// image.

export const AVATAR_PRESETS = [
  { key: 'koala', en: 'Koala', vi: 'Koala', ja: 'コアラ', zh: '考拉', hant: '無尾熊' },
  { key: 'kangaroo', en: 'Kangaroo', vi: 'Chuột túi', ja: 'カンガルー', zh: '袋鼠', hant: '袋鼠' },
  { key: 'wombat', en: 'Wombat', vi: 'Gấu túi wombat', ja: 'ウォンバット', zh: '袋熊', hant: '袋熊' },
  { key: 'quokka', en: 'Quokka', vi: 'Quokka', ja: 'クオッカ', zh: '短尾矮袋鼠', hant: '短尾矮袋鼠' },
  { key: 'platypus', en: 'Platypus', vi: 'Thú mỏ vịt', ja: 'カモノハシ', zh: '鸭嘴兽', hant: '鴨嘴獸' },
  { key: 'echidna', en: 'Echidna', vi: 'Thú lông nhím', ja: 'ハリモグラ', zh: '针鼹', hant: '針鼴' },
  { key: 'kookaburra', en: 'Kookaburra', vi: 'Chim kookaburra', ja: 'ワライカワセミ', zh: '笑翠鸟', hant: '笑翠鳥' },
  { key: 'emu', en: 'Emu', vi: 'Đà điểu emu', ja: 'エミュー', zh: '鸸鹋', hant: '鴯鶓' },
] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number]['key'];

const PREFIX = 'preset:';
const KEYS = new Set<string>(AVATAR_PRESETS.map((p) => p.key));

/** What `avatar_url` holds for a person wearing this animal. */
export const presetUrl = (key: AvatarPreset): string => `${PREFIX}${key}`;

/** The animal an `avatar_url` names, or null for a photograph, an empty
 *  value or a name this build does not know. */
export function presetOf(url: string | null | undefined): AvatarPreset | null {
  if (!url?.startsWith(PREFIX)) return null;
  const key = url.slice(PREFIX.length);
  return KEYS.has(key) ? (key as AvatarPreset) : null;
}

/** True for anything written as a preset, known to this build or not. */
export const namesPreset = (url: string | null | undefined): boolean => !!url?.startsWith(PREFIX);

/** A face that lives on a server, the only kind worth warming ahead. */
export const isRemote = (url: string | null | undefined): boolean => /^https?:\/\//.test(url ?? '');
