// `_shared/jpeg.ts`: what is a JPEG to `checkin-photo`, and what of one is
// kept. Built by hand, segment by segment, so each test says exactly
// which bytes it is about — a real photo would hide the one segment the
// test is for among a hundred others.

import { describe, expect, it } from 'vitest';
import { cleanJpeg } from '../../../supabase/functions/_shared/jpeg';

const seg = (m: number, payload: number[]) => [0xff, m, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
const sof = (m: number, h: number, w: number) => seg(m, [8, h >> 8, h & 0xff, w >> 8, w & 0xff, 1, 1, 0x11, 0]);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const APP0 = seg(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const EXIF = seg(0xe1, [...ascii('Exif'), 0, 0, ...ascii('GPS 21.0285N 105.8542E')]);
const XMP = seg(0xe1, ascii('http://ns.adobe.com/xap/1.0/ <rdf/>'));
const ICC = seg(0xe2, [...ascii('ICC_PROFILE'), 0, 1, 1]);
const ADOBE = seg(0xee, [...ascii('Adobe'), 0, 100, 0, 0, 0, 0, 1]);
const COM = seg(0xfe, ascii('taken at home'));
// A Huffman table whose bytes, read as a frame header, would say 4096 × 4096.
const DHT = seg(0xc4, [0, 0x10, 0, 0x10, 0, 0, 0, 0, 0]);
const SOS = seg(0xda, [1, 1, 0, 0, 63, 0]);
// Scan data with a stuffed FF and a restart marker in it: both data.
const DATA = [0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56];
const SOI = [0xff, 0xd8];
const EOI = [0xff, 0xd9];
const jpeg = (...parts: number[][]) => Uint8Array.from([...SOI, ...parts.flat(), ...EOI]);
const has = (hay: Uint8Array, needle: number[]) => {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
};

describe('cleanJpeg', () => {
  it('reads the size, and keeps the picture byte for byte while dropping every word about anybody', () => {
    const got = cleanJpeg(jpeg(APP0, EXIF, XMP, ICC, ADOBE, COM, DHT, sof(0xc0, 900, 1200), SOS, DATA));
    expect(got).toMatchObject({ ok: true, width: 1200, height: 900 });
    if (!got.ok) return;
    expect([...got.bytes]).toEqual([...SOI, ...APP0, ...ADOBE, ...DHT, ...sof(0xc0, 900, 1200), ...SOS, ...DATA, ...EOI]);
    expect(has(got.bytes, ascii('GPS'))).toBe(false);
    expect(has(got.bytes, ascii('taken at home'))).toBe(false);
  });

  it('cuts whatever was glued on after the end', () => {
    const glued = Uint8Array.from([...jpeg(sof(0xc0, 10, 10), SOS, DATA), ...ascii('PK'), 3, 4, 0xff, 0xd9]);
    const got = cleanJpeg(glued);
    expect(got.ok && [...got.bytes.slice(-2)]).toEqual(EOI);
    expect(got.ok && has(got.bytes, ascii('PK'))).toBe(false);
  });

  it('reads a progressive file: several scans, tables between them, its own frame marker', () => {
    const got = cleanJpeg(jpeg(sof(0xc2, 640, 480), DHT, SOS, DATA, DHT, SOS, [0x77]));
    expect(got).toMatchObject({ ok: true, width: 480, height: 640 });
  });

  it('takes fill bytes before a marker, in the header and after a scan, and a marker with no length', () => {
    const got = cleanJpeg(Uint8Array.from([...SOI, 0xff, 0xff, ...sof(0xc0, 10, 20).slice(1), 0xff, 0x01, ...SOS, ...DATA, 0xff, 0xff, 0xff, 0xd9]));
    expect(got).toMatchObject({ ok: true, width: 20, height: 10 });
  });

  it('does not take a Huffman table, a JPG or an arithmetic table for the frame', () => {
    for (const m of [0xc4, 0xc8, 0xcc]) {
      expect(cleanJpeg(jpeg(seg(m, [8, 0x10, 0, 0x10, 0, 1]), SOS, DATA))).toEqual({ ok: false, why: 'no_image' });
    }
  });

  it('is not a JPEG without its opening, or too short to have one', () => {
    expect(cleanJpeg(Uint8Array.from(ascii('PK\u0003\u0004zip')))).toEqual({ ok: false, why: 'not_jpeg' });
    expect(cleanJpeg(Uint8Array.from([0xff, 0xd8, 0xff]))).toEqual({ ok: false, why: 'not_jpeg' });
    expect(cleanJpeg(Uint8Array.from([0x00, 0xd8, 0xff, 0xd9]))).toEqual({ ok: false, why: 'not_jpeg' });
  });

  it('is malformed where a marker should be and is not, or where a frame is too short to hold a size', () => {
    expect(cleanJpeg(Uint8Array.from([...SOI, 0x00, 0x00, ...EOI]))).toEqual({ ok: false, why: 'malformed' });
    expect(cleanJpeg(jpeg(seg(0xc0, [8, 0, 10]), SOS, DATA))).toEqual({ ok: false, why: 'malformed' });
  });

  it('is truncated wherever it stops before its end', () => {
    const cut = (...b: number[]) => cleanJpeg(Uint8Array.from([...SOI, ...b]));
    expect(cut(0xff, 0xff)).toEqual({ ok: false, why: 'truncated' }); // fill, then nothing
    expect(cut(0xff, 0xe0, 0x00)).toEqual({ ok: false, why: 'truncated' }); // half a length
    expect(cut(0xff, 0xe0, 0x00, 0x20, 1, 2)).toEqual({ ok: false, why: 'truncated' }); // a length past the end
    expect(cut(0xff, 0xe0, 0x00, 0x01, 1, 2)).toEqual({ ok: false, why: 'truncated' }); // a length under its own two bytes
    expect(cut(...sof(0xc0, 10, 10), ...SOS, ...DATA)).toEqual({ ok: false, why: 'truncated' }); // a scan with no end
    expect(cut(...sof(0xc0, 10, 10))).toEqual({ ok: false, why: 'truncated' }); // segments, and no end
  });

  it('has no image without a scan, a frame, or a size', () => {
    expect(cleanJpeg(jpeg(sof(0xc0, 10, 10)))).toEqual({ ok: false, why: 'no_image' });
    expect(cleanJpeg(jpeg(SOS, DATA))).toEqual({ ok: false, why: 'no_image' });
    expect(cleanJpeg(jpeg(sof(0xc0, 0, 10), SOS, DATA))).toEqual({ ok: false, why: 'no_image' });
    expect(cleanJpeg(jpeg(sof(0xc0, 10, 0), SOS, DATA))).toEqual({ ok: false, why: 'no_image' });
  });
});
