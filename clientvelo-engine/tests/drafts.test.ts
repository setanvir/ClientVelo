import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { renderDraft } from '../src/drafts.js';
import type { Lead } from '../src/types.js';

describe('renderDraft', () => {
  test('generates draft for slow_or_heavy_mobile_page', () => {
    const lead: Lead = {
      id: '123',
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
      audit: {
        loadTimeMs: 4000,
        resourcesCount: 50,
        mobileFriendly: true,
        viewportMeta: true,
        hasBookingCta: true,
        hasPhoneLink: true,
      },
      primaryIssue: 'slow_or_heavy_mobile_page',
      evidenceUrl: null,
      evidenceText: 'Slow mobile page',
      personalizationNote: null,
      qualificationScore: 80,
      qualificationReasons: [],
      workflowStatus: 'approved',
      placeId: null,
      osmSocial: null,
    };

    const draft = renderDraft(lead);
    
    assert.equal(draft.subject, `Question about Test Business's mobile site`);
    assert.ok(draft.body.includes('Hi John,'));
    assert.ok(draft.body.includes('4000ms'));
    assert.ok(!draft.body.includes('undefined'));
    assert.ok(!draft.body.includes('null'));
  });

  test('fails if banned phrase is present', () => {
    const lead: Lead = {
      id: '123',
      businessName: 'Guaranteed SEO', // Banned phrase "guaranteed"
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
      qualificationScore: 80,
      qualificationReasons: [],
      workflowStatus: 'approved',
      placeId: null,
      osmSocial: null,
    };

    assert.throws(() => renderDraft(lead), /banned phrase/);
  });

  test('fails if token is missing (null/undefined)', () => {
    const lead = {
      id: '123',
      businessName: null, // this will render as "null" or "undefined" in the template
      email: 'john@test.com',
      primaryIssue: 'slow_or_heavy_mobile_page',
      websiteUrl: 'https://test.com',
    } as unknown as Lead;

    assert.throws(() => renderDraft(lead), /(undefined|null)/);
  });
});
