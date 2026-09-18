import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { scoreLead, qualifyLeads } from '../src/qualify.js';
import type { Lead } from '../src/types.js';
import { writeLeads, readLeads } from '../src/store.js';
import path from 'node:path';
import fs from 'node:fs/promises';

describe('scoreLead', () => {
  test('scores a high quality lead correctly', () => {
    const lead: Lead = {
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
      rating: 4.5,
      reviewCount: 20,
      contactName: 'John',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      contactChannel: 'direct_email',
      emailCandidates: [],
      email: 'john@test.com',
      emailType: 'business_public',
      chosenEmailReason: 'test',
      requiresManualAction: false,
      emailValidationStatus: 'domain_has_mx',
      auditStatus: 'complete',
      psiStatus: 'disabled',
      screenshotPath: null,
      audit: null,
      primaryIssue: 'slow_or_heavy_mobile_page',
      evidenceUrl: null,
      evidenceText: 'Slow mobile page',
      personalizationNote: null,
      qualificationScore: null,
      qualificationReasons: [],
      workflowStatus: 'validated',
      placeId: null,
      osmSocial: null,
    };

    const result = scoreLead(lead);
    // Base: 10
    // Email domain_has_mx: 30
    // Audit complete: 20
    // Issue exists: 20
    // CSV Reviews (20 >= 10): 10
    // Rating (4.5 >= 4.0): 5
    // Total: 95
    assert.equal(result.score, 85);
  });

  test('penalizes unreachable sites', () => {
    const lead = {
      businessName: 'Test',
      emailValidationStatus: 'invalid',
      auditStatus: 'site_unreachable',
      source: 'csv',
      rating: null,
      reviewCount: null,
    } as unknown as Lead;

    const result = scoreLead(lead);
    // Base: 10
    // email: 0
    // Audit unreachable: -20
    // min is 0
    assert.equal(result.score, 0);
  });
});

describe('qualifyLeads orchestrator', () => {
  const tempDir = path.join(process.cwd(), 'data', 'tests_qualify_tmp');
  const inPath = path.join(tempDir, 'in.json');

  before(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('scores and transitions state to needs_review', async () => {
    const lead: Lead = {
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
      contactName: 'John',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      contactChannel: 'direct_email',
      emailCandidates: [],
      email: 'john@test.com',
      emailType: 'business_public',
      chosenEmailReason: 'test',
      requiresManualAction: false,
      emailValidationStatus: 'domain_has_mx',
      auditStatus: 'complete',
      psiStatus: 'disabled',
      screenshotPath: null,
      audit: null,
      primaryIssue: 'slow_or_heavy_mobile_page',
      evidenceUrl: null,
      evidenceText: 'Slow mobile page',
      personalizationNote: null,
      qualificationScore: null,
      qualificationReasons: [],
      workflowStatus: 'validated', // Needs to be validated to be qualified
      placeId: null,
      osmSocial: null,
    };

    await writeLeads([lead], inPath);
    await qualifyLeads(0, inPath, inPath);

    const outLeads = await readLeads(inPath);
    assert.equal(outLeads.length, 1);
    assert.equal(typeof outLeads[0]?.qualificationScore, 'number');
    assert.equal(outLeads[0]?.workflowStatus, 'needs_review');
  });
});
