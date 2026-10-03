// @vitest-environment jsdom
//
// The rail three screens share. Pinned: the paw on a first stop and a dot
// on any other, the line down to the next stop and none after the last,
// and that a landing value, when given, drives the mark's opacity.

import React from 'react';
import { Animated } from 'react-native';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../uitest/render';

import { RailColumn, StartMark } from './rail';

const paws = () => document.querySelectorAll('[data-icon="paw"]').length;

describe('RailColumn', () => {
  it('opens on the paw and runs a line down to the next stop', () => {
    render(<RailColumn first last={false} />);
    expect(paws()).toBe(1);
    expect(screen.queryByTestId('rail-dot')).toBeNull();
    expect(screen.getByTestId('rail-line')).toBeTruthy();
  });

  it('marks a later stop with a dot, and the last one with no line after it', () => {
    render(<RailColumn first={false} last />);
    expect(paws()).toBe(0);
    expect(screen.getByTestId('rail-dot')).toBeTruthy();
    expect(screen.queryByTestId('rail-line')).toBeNull();
  });

  it('is a single stop when it is both first and last', () => {
    render(<RailColumn first last />);
    expect(paws()).toBe(1);
    expect(screen.queryByTestId('rail-line')).toBeNull();
  });
});

describe('StartMark', () => {
  it('stands still when nothing is landing', () => {
    render(<StartMark />);
    expect((screen.getByTestId('rail-start') as HTMLElement).style.opacity).toBe('');
  });

  it('follows the landing value it is given', () => {
    render(<StartMark land={new Animated.Value(0)} />);
    expect((screen.getByTestId('rail-start') as HTMLElement).style.opacity).toBe('0');
  });
});
