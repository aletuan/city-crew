// @vitest-environment jsdom
//
// The context's defaults, for a card read outside Profile's provider:
// nothing to reopen, nothing to spend, nowhere to scroll — and asking
// for either is harmless.

import React, { useContext, useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '../../uitest/render';
import { ProfileReturn } from './ProfileReturn';

describe('ProfileReturn outside a provider', () => {
  it('offers no sheet and does nothing when asked to spend it or scroll', () => {
    const seen = {} as { value: React.ContextType<typeof ProfileReturn> };
    function Probe() {
      const value = useContext(ProfileReturn);
      useEffect(() => { seen.value = value; });
      return null;
    }
    render(<Probe />);
    expect(seen.value.sheet).toBeNull();
    expect(seen.value.y.current).toBe(0);
    expect(() => { seen.value.spendSheet(); seen.value.scrollBy(120); }).not.toThrow();
  });
});
