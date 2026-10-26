import test from 'node:test';
import assert from 'node:assert/strict';
import { audienceConfig } from '../src/lib/audience-core.mjs';

test('defaults to education', () => {
  const c = audienceConfig({});
  assert.equal(c.audience, 'education');
  assert.equal(c.site, 'https://education.siteseer.education');
  assert.equal(c.other.audience, 'industry');
});

test('industry points across to education', () => {
  const c = audienceConfig({ SITE_AUDIENCE: 'industry' });
  assert.equal(c.site, 'https://industry.siteseer.education');
  assert.equal(c.other.href, 'https://education.siteseer.education/');
  assert.equal(c.other.label, 'SiteSeer for education');
});

test('rejects an unknown audience', () => {
  assert.throws(() => audienceConfig({ SITE_AUDIENCE: 'retail' }), /SITE_AUDIENCE/);
});
