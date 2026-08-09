import assert from 'node:assert/strict';
import test from 'node:test';

import { scanContent } from './secret-scan.mjs';

test('detects Supabase personal access tokens outside assignments', () => {
  const fakeToken = `sbp_${'0123456789abcdef'.repeat(3)}`;
  const findings = scanContent(
    '.codex/config.toml',
    `args = ["--access-token", "${fakeToken}"]`,
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].detector, 'Supabase personal access token');
});

test('allows documentation-safe Supabase placeholders', () => {
  const findings = scanContent(
    '.env.production.example',
    'SUPABASE_ACCESS_TOKEN=sbp_<your-supabase-access-token>',
  );

  assert.deepEqual(findings, []);
});

test('detects PEM private keys', () => {
  const begin = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
  const end = ['-----END ', 'PRIVATE KEY-----'].join('');
  const findings = scanContent(
    'credentials.pem',
    `${begin}\n${'A'.repeat(96)}\n${end}`,
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].detector, 'PEM private key');
});

test('allows PEM sanitizer regex source without private-key material', () => {
  const begin = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
  const end = ['-----END ', 'PRIVATE KEY-----'].join('');
  const findings = scanContent(
    'src/app/api/generate-assets/route.ts',
    `.replace(/${begin}[\\s\\S]*?${end}/g, "[redacted private key]")`,
  );

  assert.deepEqual(findings, []);
});

test('allows the documented booking-management placeholder', () => {
  const findings = scanContent(
    '.env.example',
    'BOOKING_MANAGEMENT_SECRET=replace-me-with-at-least-32-random-bytes\n',
  );

  assert.deepEqual(findings, []);
});

test('detects Google service-account JSON credentials', () => {
  const accountType = ['service', 'account'].join('_');
  const findings = scanContent(
    'service-account.json',
    JSON.stringify({
      type: accountType,
      project_id: 'tenant-project',
      private_key_id: '0123456789abcdef0123456789abcdef01234567',
      client_email: 'automation@tenant.invalid',
    }),
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].detector, 'Google service-account JSON');
});

test('does not treat test or sample prefixes as proof that a credential is fake', () => {
  for (const value of [
    'test_liveCredentialMaterialABCDEF0123456789',
    'sampleProductionCredentialABCDEF0123456789',
  ]) {
    const findings = scanContent('fixture.ts', `token = "${value}"`);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].detector, 'API key assignment literal');
  }
});

test('detects quoted and unquoted environment-style secret assignments', () => {
  const raw = 'liveCredentialMaterialABCDEF0123456789';
  const envFindings = scanContent('.env.local', `OPENAI_API_KEY=${raw}`);
  const codeFindings = scanContent('config.ts', `CLIENT_SECRET="${raw}"`);
  assert.equal(envFindings.length, 1);
  assert.equal(envFindings[0].detector, 'environment secret assignment literal');
  assert.equal(codeFindings.length, 1);
  assert.equal(codeFindings[0].detector, 'API key assignment literal');
});
