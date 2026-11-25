// @vitest-environment jsdom
//
// The day picker's two fallbacks, which the planner itself never reaches:
// a day that does not parse opens the calendar on today rather than on
// nothing, and the ceiling of a day that does not parse is no ceiling.

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '../../uitest/render';

const picker = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
vi.mock('@react-native-community/datetimepicker', () => ({
  default: (props: Record<string, unknown>) => {
    picker.props = props;
    return <div data-stub="DateTimePicker" />;
  },
}));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ lang: 'vi', t: (_en: string, vi: string) => vi }) }));

import { DayPicker, endOfDay } from './DayPicker';

afterEach(() => { cleanup(); picker.props = {}; });

describe('DayPicker', () => {
  it('opens on today when the day it is given does not parse', () => {
    const before = Date.now();
    render(<DayPicker day="" onClose={() => {}} onPick={() => {}} />);
    const value = picker.props.value as Date;
    expect(value).toBeInstanceOf(Date);
    expect(value.getTime()).toBeGreaterThanOrEqual(before);
    expect(value.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('opens on the day it is given', () => {
    render(<DayPicker day="2026-12-24" onClose={() => {}} onPick={() => {}} />);
    const value = picker.props.value as Date;
    expect([value.getFullYear(), value.getMonth(), value.getDate()]).toEqual([2026, 11, 24]);
  });
});

describe('endOfDay', () => {
  it('is the last millisecond of the day', () => {
    const d = endOfDay('2026-11-25')!;
    expect([d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([25, 23, 59, 59, 999]);
  });

  it('is nothing for a day that does not parse', () => {
    expect(endOfDay('not a day')).toBeUndefined();
  });
});
