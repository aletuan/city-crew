import { describe, expect, it } from 'vitest';
import {
  canAddPhoto, photoPath, refusePhoto, MAX_PER_DAY, MAX_PER_PLACE,
  PHOTO_PX, PHOTO_QUALITY,
} from './guide';

const ME = { uid: 'u1', granted: true };

describe('who may add a photograph', () => {
  it('lets a granted guide onto a place they imported', () => {
    expect(canAddPhoto({ submitted_by: 'u1' }, ME)).toBe(true);
  });

  // The whole point of rolling this out by hand: being signed in is not
  // the same as having been given it.
  it('refuses a signed-in person the desk has not granted', () => {
    expect(canAddPhoto({ submitted_by: 'u1' }, { uid: 'u1', granted: false })).toBe(false);
  });

  it('refuses a guest', () => {
    expect(canAddPhoto({ submitted_by: 'u1' }, { uid: null, granted: true })).toBe(false);
  });

  // A guide is not an editor. The grant says "you may add photographs",
  // not "you may add them anywhere".
  it('refuses a guide on somebody else’s place', () => {
    expect(canAddPhoto({ submitted_by: 'u2' }, ME)).toBe(false);
  });

  // Every place the importer brought in has a null here. Without this
  // clause a guide would reach the entire catalog.
  it('refuses a place nobody in the app imported', () => {
    expect(canAddPhoto({ submitted_by: null }, ME)).toBe(false);
    expect(canAddPhoto({}, ME)).toBe(false);
  });

  // The requirement that shaped the policy: approval is not a condition.
  // A place still at the desk is where the better photograph is.
  it('says nothing about whether the place is published', () => {
    expect(canAddPhoto({ submitted_by: 'u1' }, ME)).toBe(true);
  });
});

describe('the path in the bucket', () => {
  it('puts the file under the uploader’s own id', () => {
    expect(photoPath('u1', 'cong-caphe', 1700000000000))
      .toBe('u1/cong-caphe-1700000000000.jpg');
  });

  // Two photographs of one place, seconds apart, must not be one file.
  it('does not collide with the same place a moment later', () => {
    expect(photoPath('u1', 'x', 1)).not.toBe(photoPath('u1', 'x', 2));
  });
});

describe('what to say when it cannot go ahead', () => {
  const room = { mineHere: 0, mineToday: 0 };

  it('is silent when there is nothing to refuse', () => {
    expect(refusePhoto({ submitted_by: 'u1' }, ME, room)).toBeNull();
  });

  // Order is the assertion here: somebody who is not a guide hears that,
  // rather than being told a place they could never post to is full.
  it('names the grant before anything else', () => {
    const full = { mineHere: 99, mineToday: 99 };
    expect(refusePhoto({ submitted_by: 'u2' }, { uid: 'u1', granted: false }, full))
      .toBe('not_a_guide');
  });

  it('names whose place it is before the counts', () => {
    const full = { mineHere: 99, mineToday: 99 };
    expect(refusePhoto({ submitted_by: 'u2' }, ME, full)).toBe('not_your_place');
  });

  it('stops at five on one place', () => {
    expect(refusePhoto({ submitted_by: 'u1' }, ME, { mineHere: MAX_PER_PLACE - 1, mineToday: 0 }))
      .toBeNull();
    expect(refusePhoto({ submitted_by: 'u1' }, ME, { mineHere: MAX_PER_PLACE, mineToday: 0 }))
      .toBe('place_full');
  });

  it('stops at ten in a day', () => {
    expect(refusePhoto({ submitted_by: 'u1' }, ME, { mineHere: 0, mineToday: MAX_PER_DAY - 1 }))
      .toBeNull();
    expect(refusePhoto({ submitted_by: 'u1' }, ME, { mineHere: 0, mineToday: MAX_PER_DAY }))
      .toBe('day_full');
  });

  // The per-place cap is the one that protects the reader, so it is the
  // one named when both are reached.
  it('names the place before the day when both are full', () => {
    expect(refusePhoto({ submitted_by: 'u1' }, ME, { mineHere: 9, mineToday: 99 }))
      .toBe('place_full');
  });
});

// The numbers the policy counts against. Pinned because they live in two
// files — here and in the migration — and a change to one that misses the
// other turns a clear refusal into a silent one.
describe('the limits, as the policy states them', () => {
  it('are five and ten', () => {
    expect(MAX_PER_PLACE).toBe(5);
    expect(MAX_PER_DAY).toBe(10);
  });

  it('shrinks to a size a phone screen can use', () => {
    expect(PHOTO_PX).toBe(1600);
    expect(PHOTO_QUALITY).toBe(0.8);
  });
});
