// @vitest-environment jsdom
//
// Whether the sheet that explains trip reminders is up: raised from a
// save, closed by the reader, and never stacked.

import React from 'react';
import { act, render, screen } from '../uitest/render';
import { beforeEach, describe, expect, it } from 'vitest';
import { closeReminderAsk, offerReminderAsk, resetReminderAsk, useReminderAsk } from './reminderAsk';

function Probe() { return <span data-testid="s">{String(useReminderAsk())}</span>; }
const shown = () => screen.getByTestId('s').textContent;

beforeEach(() => { act(() => resetReminderAsk()); });

describe('reminderAsk', () => {
  it('is down until a save offers it, and down again when closed', () => {
    render(<Probe />);
    expect(shown()).toBe('false');
    act(() => offerReminderAsk());
    expect(shown()).toBe('true');
    act(() => closeReminderAsk());
    expect(shown()).toBe('false');
  });

  it('does not notify twice for an offer made while it is already up', () => {
    let commits = 0;
    render(<React.Profiler id="p" onRender={() => { commits += 1; }}><Probe /></React.Profiler>);
    act(() => offerReminderAsk());
    const after = commits;
    act(() => offerReminderAsk());
    expect(commits).toBe(after);
  });
});
