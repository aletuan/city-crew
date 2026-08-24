import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ageLabel, DUE_HOURS, hoursSince, newCount, previewOf, REASON_LABEL,
  SLA_HOURS, slaState, sortQueue,
} from '../src/reports.js';

const NOW = new Date('2026-08-23T12:00:00Z');
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600000).toISOString();
const row = (over = {}) => ({
  id: 'r1', kind: 'profile', reason: 'spam', status: 'new',
  created_at: hoursAgo(1), title: 'A name', body: 'A bio', ...over,
});

test('every stored reason has a label', () => {
  for (const k of ['spam', 'offensive', 'impersonation', 'other']) {
    assert.equal(typeof REASON_LABEL[k], 'string');
    assert.ok(REASON_LABEL[k].length > 0);
  }
});

test('hoursSince measures, and refuses to invent', () => {
  assert.equal(hoursSince(hoursAgo(3), NOW), 3);
  assert.equal(hoursSince('not a date', NOW), null);
  // A clock a little ahead of the row must not produce a negative age.
  assert.equal(hoursSince(new Date(NOW.getTime() + 60000).toISOString(), NOW), 0);
});

test('the clock verdict follows the guideline', () => {
  assert.equal(slaState(row({ created_at: hoursAgo(1) }), NOW), 'fresh');
  assert.equal(slaState(row({ created_at: hoursAgo(DUE_HOURS) }), NOW), 'due');
  assert.equal(slaState(row({ created_at: hoursAgo(SLA_HOURS) }), NOW), 'overdue');
  assert.equal(slaState(row({ created_at: hoursAgo(50) }), NOW), 'overdue');
});

test('an answered report has no deadline left to miss', () => {
  assert.equal(slaState(row({ status: 'actioned', created_at: hoursAgo(80) }), NOW), 'done');
  assert.equal(slaState(row({ status: 'dismissed', created_at: hoursAgo(80) }), NOW), 'done');
});

test('an unreadable timestamp reads as fresh rather than as late', () => {
  assert.equal(slaState(row({ created_at: 'someday' }), NOW), 'fresh');
  assert.equal(ageLabel('someday', NOW), '');
});

test('age speaks in the largest honest unit', () => {
  assert.equal(ageLabel(hoursAgo(0.25), NOW), '15m');
  assert.equal(ageLabel(hoursAgo(5), NOW), '5h');
  assert.equal(ageLabel(hoursAgo(30), NOW), '30h');
  assert.equal(ageLabel(hoursAgo(72), NOW), '3d');
  // Under a minute still says a minute: "0m ago" reads as broken.
  assert.equal(ageLabel(hoursAgo(0.001), NOW), '1m');
});

test('the count is of what still needs answering', () => {
  assert.equal(newCount([row(), row({ status: 'actioned' }), row()]), 2);
  assert.equal(newCount([]), 0);
  assert.equal(newCount(undefined), 0);
});

test('the queue puts the oldest unanswered first, and answered work last', () => {
  const rows = [
    row({ id: 'new-recent', created_at: hoursAgo(1) }),
    row({ id: 'done-old', status: 'actioned', created_at: hoursAgo(40) }),
    row({ id: 'new-old', created_at: hoursAgo(20) }),
    row({ id: 'done-recent', status: 'dismissed', created_at: hoursAgo(2) }),
  ];
  assert.deepEqual(sortQueue(rows).map((r) => r.id),
    ['new-old', 'new-recent', 'done-recent', 'done-old']);
  assert.deepEqual(sortQueue(undefined), []);
});

test('the preview carries the words being judged', () => {
  assert.equal(previewOf(row({ title: 'Best cafés', body: 'buy now' })), 'Best cafés — buy now');
  assert.equal(previewOf(row({ title: null, body: 'just a bio' })), 'just a bio');
  assert.equal(previewOf(row({ title: '  ', body: null })), '');
  assert.equal(previewOf(row({ title: 'x'.repeat(300), body: null }), 20), `${'x'.repeat(20)}…`);
});
