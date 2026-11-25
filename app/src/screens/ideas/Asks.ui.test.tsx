// @vitest-environment jsdom
//
// A category the taxonomy has no glyph for still gets a tile, with the
// neutral dot, rather than a tile with no picture at all.

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '../../uitest/render';
import { EMPTY_DRAFT } from '../../lib/trip';
import { CATEGORIES, CATEGORY_ORDER } from '../../lib/categories';

const tiles = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));
vi.mock('../../components/ui', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  Tile: (props: Record<string, unknown>) => { tiles.props.push(props); return null; },
}));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ lang: 'vi', t: (_en: string, vi: string) => vi }) }));

import { Asks } from './Asks';

afterEach(() => { cleanup(); tiles.props = []; });

describe('Asks', () => {
  it('draws a category it has no glyph for with the neutral dot, and a known one with its own', () => {
    render(<Asks draft={EMPTY_DRAFT} cats={[CATEGORY_ORDER[0], 'not-a-category']} onCompany={() => {}} onCategories={() => {}} />);
    const icon = (id: string) => tiles.props.find((p) => p.testID === id)?.icon;
    expect(icon('ideas-cat-1')).toBe('ellipse-outline');
    expect(icon('ideas-cat-0')).toBe(CATEGORIES[CATEGORY_ORDER[0]].icon);
  });
});
