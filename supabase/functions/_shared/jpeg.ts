// A JPEG, checked and emptied of everything but the picture.
//
// For `checkin-photo` (K2 of `docs/checkin-photos-plan.md`), where every
// account can upload and nothing the phone says about a file is
// believed. Storage checks the type a client *declares*; this reads the
// bytes. Three things it is for:
//
//   · **Is it a JPEG?** It must open with SOI, carry a frame header (SOF)
//     with a size, at least one scan, and close with EOI. A zip, a video
//     or a script with `image/jpeg` on it fails here.
//   · **No metadata.** APP1–APP15 and COM are dropped: EXIF (where a
//     phone writes the GPS position and the time), XMP, IPTC, ICC
//     profiles, the multi-picture index that points at a second image,
//     and comments. Two stay, both the format's own and neither about
//     anybody: APP0 (JFIF), its header, and APP14 (Adobe), which says how
//     the colours were transformed. Done here, not trusted to the app,
//     because the app is not the only thing that can call the function.
//   · **Nothing after the end.** Bytes after EOI are cut. A picture with
//     an archive glued to its tail is a picture to every viewer and an
//     archive to anybody who looks — free hosting by another door.
//
// What is kept is copied as it came: the tables, the frame, the scans.
// The picture is not decoded or re-encoded, so it is bit-for-bit the one
// the phone made, and a Deno function needs no image library to do this.
//
// Measured on 25 Nov 2026 with Pillow-made 1200 × 900 files at quality
// 74, baseline and progressive, each carrying EXIF with a GPS block, a
// comment and (the progressive one) an ICC profile: every output decoded
// to the same 1200 × 900 pixels, identical to the input's, with no EXIF,
// GPS, comment or profile left; 171–674 bytes lighter; 2–7 ms a file in
// Node on this desk.
//
// Dropping the ICC profile can move colours slightly on a wide-gamut
// screen; the app's own encoder (`expo-image-manipulator`) writes sRGB,
// so in practice there is nothing to lose.

export type CleanJpeg =
  | { ok: true; bytes: Uint8Array; width: number; height: number }
  | { ok: false; why: "not_jpeg" | "malformed" | "truncated" | "no_image" };

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;

/** A frame header: SOF0–SOF15, which are C0–CF less the three markers in
 *  that range that are something else (DHT, JPG, DAC). */
const isFrame = (m: number) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
/** What is dropped: APP1–APP15 and the comment — but for APP14, Adobe's,
 *  which says only how the colours were transformed (a version and three
 *  flags) and without which a decoder can read a CMYK file's colours
 *  wrong. Nothing in it is about anybody. */
const ADOBE = 0xee;
const isDropped = (m: number) => ((m >= 0xe1 && m <= 0xef) && m !== ADOBE) || m === 0xfe;
/** Markers with no length after them: the restart markers and TEM. */
const isStandalone = (m: number) => (m >= 0xd0 && m <= 0xd7) || m === 0x01;
/** Inside a scan, `FF` followed by these is data, not a marker. */
const isInScan = (next: number) => next === 0x00 || (next >= 0xd0 && next <= 0xd7);

function joined(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

export function cleanJpeg(src: Uint8Array): CleanJpeg {
  if (src.length < 4 || src[0] !== 0xff || src[1] !== SOI) return { ok: false, why: "not_jpeg" };
  const out: Uint8Array[] = [Uint8Array.of(0xff, SOI)];
  let i = 2;
  let width = 0;
  let height = 0;
  let scanned = false;

  while (i < src.length) {
    if (src[i] !== 0xff) return { ok: false, why: "malformed" };
    // Any number of fill bytes may stand before a marker.
    while (i < src.length && src[i] === 0xff) i++;
    if (i >= src.length) return { ok: false, why: "truncated" };
    const m = src[i];
    i++;

    if (m === EOI) {
      if (!scanned || !width || !height) return { ok: false, why: "no_image" };
      out.push(Uint8Array.of(0xff, EOI));
      return { ok: true, bytes: joined(out), width, height };
    }
    if (isStandalone(m)) { out.push(Uint8Array.of(0xff, m)); continue; }

    if (i + 2 > src.length) return { ok: false, why: "truncated" };
    const len = (src[i] << 8) | src[i + 1];
    if (len < 2 || i + len > src.length) return { ok: false, why: "truncated" };
    if (isFrame(m)) {
      // Precision (1), then height (2) and width (2).
      if (len < 7) return { ok: false, why: "malformed" };
      height = (src[i + 3] << 8) | src[i + 4];
      width = (src[i + 5] << 8) | src[i + 6];
    }
    if (!isDropped(m)) out.push(Uint8Array.of(0xff, m), src.subarray(i, i + len));
    i += len;

    if (m === SOS) {
      // The scan's data runs to the next marker that is not data.
      scanned = true;
      const start = i;
      while (i + 1 < src.length && !(src[i] === 0xff && !isInScan(src[i + 1]))) i++;
      if (i + 1 >= src.length) return { ok: false, why: "truncated" };
      out.push(src.subarray(start, i));
    }
  }
  return { ok: false, why: "truncated" };
}
