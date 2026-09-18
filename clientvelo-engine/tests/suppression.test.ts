import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { addSuppression, markReplied } from '../src/suppression.js';
import { writeLeads, readLeads, writeSuppression, readSuppression, PATHS } from '../src/store.js';
import type { Lead } from '../src/types.js';

describe('Suppression', () => {
  const tempDir = path.join(process.cwd(), 'data', 'tests_suppression_tmp');
  const leadsPath = path.join(tempDir, 'leads_validated.json');
  const suppPath = path.join(tempDir, 'suppression.json');

  before(async () => {
    await fs.mkdir(tempDir, { recursive: true });
    PATHS.leadsValidated = leadsPath;
    PATHS.suppression = suppPath;
  });

  after(async () => {
    // We clean up specific test files, but we should be careful not to delete real data.
    // In our CI/test environment, it's fine, but let's just reset the files.
    await fs.rm(leadsPath, { force: true });
    await fs.rm(suppPath, { force: true });
  });

  test('addSuppression updates lead status to opted_out', async () => {
    const lead: Lead = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      businessName: 'Test',
      category: 'Test',
      city: 'Test',
      country: 'Test',
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
      email: 'test@test.com',
      emailType: 'business_public',
      chosenEmailReason: 'test',
      requiresManualAction: false,
      emailValidationStatus: 'domain_has_mx',
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
      workflowStatus: 'sent',
      placeId: null,
      osmSocial: null,
    };

    await writeLeads([lead], leadsPath);
    await writeSuppression([], suppPath);

    await addSuppression('TEST@test.com', 'opt_out', 'manual');

    const supps = await readSuppression(suppPath);
    assert.equal(supps.length, 1);
    assert.equal(supps[0]?.email, 'test@test.com');

    const leads = await readLeads(leadsPath);
    assert.equal(leads[0]?.workflowStatus, 'opted_out');
  });

  test('markReplied updates lead status', async () => {
    const lead: Lead = {
      id: '124e4567-e89b-12d3-a456-426614174000',
      businessName: 'Test',
      category: 'Test',
      city: 'Test',
      country: 'Test',
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
      email: 'reply@test.com',
      emailType: 'business_public',
      chosenEmailReason: 'test',
      requiresManualAction: false,
      emailValidationStatus: 'domain_has_mx',
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
      workflowStatus: 'sent',
      placeId: null,
      osmSocial: null,
    };

    await writeLeads([lead], leadsPath);

    await markReplied('REPLY@test.com');

    const leads = await readLeads(leadsPath);
    assert.equal(leads[0]?.workflowStatus, 'replied');
  });
});
