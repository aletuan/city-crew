// @vitest-environment jsdom
//
// Found only in other cities: the not-found note names the cities chosen,
// and names none while the choice is All.

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '../../uitest/render';

const notes = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));
vi.mock('./parts', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  NoMatches: (props: Record<string, unknown>) => { notes.props.push(props); return null; },
}));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ lang: 'vi', t: (_en: string, vi: string) => vi }) }));

import { SearchEmpty } from './SearchEmpty';

afterEach(() => { cleanup(); notes.props = []; });

const show = (pick: 'all' | string[]) => render(
  <SearchEmpty
    searching
    elsewhere
    shown="phở"
    pick={pick}
    cityName={(id) => ({ hn: 'Hà Nội', sg: 'Sài Gòn' } as Record<string, string>)[id ?? ''] ?? null}
    addRow={null}
    googleEmpty={null}
    routes={[]}
    onSearch={() => {}}
    onBack={() => {}}
    toList={false}
  />,
);

describe('SearchEmpty', () => {
  it('names the cities chosen, leaving out one it cannot name', () => {
    show(['hn', 'xx', 'sg']);
    expect(notes.props[0]).toEqual({ term: 'phở', where: 'Hà Nội, Sài Gòn' });
  });

  it('names no city while the choice is All', () => {
    show('all');
    expect(notes.props[0]).toEqual({ term: 'phở', where: null });
  });
});
