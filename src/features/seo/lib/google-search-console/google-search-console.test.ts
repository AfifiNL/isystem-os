import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGscUrl } from './normalize';
import { scoreGscOpportunity } from './scoring';

test('normalizeGscUrl correctly strips domain and locales', () => {
  const siteUrl = 'https://isystem.ai/';
  assert.strictEqual(normalizeGscUrl('https://isystem.ai/', siteUrl), 'home');
  assert.strictEqual(normalizeGscUrl('https://isystem.ai/en', siteUrl), 'home');
  assert.strictEqual(normalizeGscUrl('https://isystem.ai/nl/blog/tech', siteUrl), 'blog/tech');
  assert.strictEqual(normalizeGscUrl('https://isystem.ai/legal-digital-systems', siteUrl), 'legal-digital-systems');
  assert.strictEqual(normalizeGscUrl('https://isystem.ai/en/blog/x?ref=123#hash', siteUrl), 'blog/x');
  assert.strictEqual(normalizeGscUrl('https://other.com/foo', siteUrl), null);
});

test('scoreGscOpportunity uses standard thresholds', () => {
  // Near page one
  const result1 = scoreGscOpportunity(5, 25, 0.01, 'test query', 1.0);
  assert.ok(result1.types.includes('near-page-one'));

  // Low CTR
  const result2 = scoreGscOpportunity(1, 40, 0.01, 'test query', 1.0);
  assert.ok(result2.types.includes('low-ctr'));

  // Skip autonomous (impressions < 5)
  const result3 = scoreGscOpportunity(10, 3, 0.1, 'test query', 1.0);
  assert.ok(result3.skipAutonomous);
});

test('scoreGscOpportunity uses adaptive thresholds for new sites', () => {
  // With factor 0.1, min impressions for near page one drops to max(1, 2) = 2.
  const result1 = scoreGscOpportunity(5, 3, 0.01, 'test query', 0.1);
  assert.ok(result1.types.includes('near-page-one'));
  assert.strictEqual(result1.skipAutonomous, false);
});
