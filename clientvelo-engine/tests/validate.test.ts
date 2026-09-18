import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { validateEmail, validateLeads, type DnsResolver } from '../src/validate.js';
import { writeLeads, readLeads } from '../src/store.js';
import type { Lead } from '../src/types.js';
import fs from 'node:fs/promises';
import path from 'node:path';

// Mock DNS Resolver
class MockDnsResolver implements DnsResolver {
  async resolveMx(domain: string): Promise<any[]> {
    if (domain === 'timeout.com') {
      return new Promise((resolve) => setTimeout(() => resolve([{ exchange: 'mail.timeout.com', priority: 10 }]), 6000));
    }
    if (domain === 'nomx.com') {
      const err: any = new Error('queryMx ENODATA nomx.com');
      err.code = 'ENODATA';
      throw err;
    }
    if (domain === 'notfound.com') {
      const err: any = new Error('queryMx ENOTFOUND notfound.com');
      err.code = 'ENOTFOUND';
      throw err;
    }
    // Default success
    return [{ exchange: `mail.${domain}`, priority: 10 }];
  }
}

const mockResolver = new MockDnsResolver();

describe('validateEmail', () => {
  test('returns not_checked for null email', async () => {
    assert.equal(await validateEmail(null, mockResolver), 'not_checked');
  });

  test('returns invalid for malformed email', async () => {
    assert.equal(await validateEmail('not-an-email', mockResolver), 'invalid');
    assert.equal(await validateEmail('missing@domain', mockResolver), 'invalid'); // Actually syntax check might pass missing@domain if TLD is allowed, let's see.
    assert.equal(await validateEmail('test@com', mockResolver), 'invalid'); // Our regex now requires TLD
    assert.equal(await validateEmail('space in@domain.com', mockResolver), 'invalid');
  });

  test('returns invalid for blocked prefixes', async () => {
    assert.equal(await validateEmail('noreply@test.com', mockResolver), 'invalid');
    assert.equal(await validateEmail('mailer-daemon@test.com', mockResolver), 'invalid');
  });

  test('returns role_address for role prefixes', async () => {
    assert.equal(await validateEmail('info@test.com', mockResolver), 'role_address');
    assert.equal(await validateEmail('SUPPORT@test.com', mockResolver), 'role_address'); // Tests lowercasing
  });

  test('returns domain_has_mx for valid personal/business emails', async () => {
    assert.equal(await validateEmail('john@test.com', mockResolver), 'domain_has_mx');
  });

  test('returns invalid when MX lookup fails (ENODATA / ENOTFOUND)', async () => {
    assert.equal(await validateEmail('john@nomx.com', mockResolver), 'invalid');
    assert.equal(await validateEmail('john@notfound.com', mockResolver), 'invalid');
  });

  // This test will take ~5 seconds because of the timeout in validateEmail
  test('returns invalid on DNS timeout', async () => {
    assert.equal(await validateEmail('john@timeout.com', mockResolver), 'invalid');
  });
});

describe('validateLeads orchestrator', () => {
  const tempDir = path.join(process.cwd(), 'data', 'tests_validate_tmp');
  const inPath = path.join(tempDir, 'in.json');
  const outPath = path.join(tempDir, 'out.json');

  before(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('processes leads and updates workflowStatus', async () => {
    const dummyLead: Lead = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      businessName: 'Test Business',
      category: 'Test',
      city: 'Test City',
      country: 'Test Country',
      websiteUrl: 'https://test.com',
      phone: null,
      source: 'csv',
      sourceUrl: null,
      sourceCheckedAt: new Date().toISOString(),
      rating: null,
      reviewCount: null,
      contactName: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      contactChannel: 'direct_email',
      emailCandidates: [],
      email: 'hello@test.com', // Should be role_address
      emailType: 'business_public',
      chosenEmailReason: 'test',
      requiresManualAction: false,
      emailValidationStatus: 'not_checked',
      auditStatus: 'complete',
      psiStatus: 'disabled',
      screenshotPath: null,
      audit: null,
      primaryIssue: null,
      evidenceUrl: null,
      evidenceText: null,
      personalizationNote: null,
      qualificationScore: null,
      qualificationReasons: [],
      workflowStatus: 'enriched', // Needs to be enriched to be validated
      placeId: null,
      osmSocial: null,
    };

    await writeLeads([dummyLead], inPath);

    await validateLeads(0, inPath, outPath, mockResolver);

    const outLeads = await readLeads(outPath);
    assert.equal(outLeads.length, 1);
    assert.equal(outLeads[0]?.emailValidationStatus, 'role_address');
    assert.equal(outLeads[0]?.workflowStatus, 'validated');
  });
});
