import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseAuditPage, classifyPrimaryIssue, auditLeads, type AuditPageResult } from '../src/audit.js';
import type { Lead } from '../src/types.js';
import { config } from '../src/config.js';
import { rm } from 'node:fs/promises';

test('audit - classifyPrimaryIssue', () => {
  assert.equal(classifyPrimaryIssue({
    statusCode: 404,
    loadTimeMs: 100,
    psiMobileScore: 90,
    loadSlowMs: 4000,
    psiPoorScore: 50,
    bookingKeywordFound: true,
    whatsappOrSocialBookingLink: false,
    telLink: true,
    hasContactForm: false,
    contactFormFieldCount: 0,
  }), 'site_unreachable');

  assert.equal(classifyPrimaryIssue({
    statusCode: 200,
    loadTimeMs: 5000,
    psiMobileScore: null,
    loadSlowMs: 4000,
    psiPoorScore: 50,
    bookingKeywordFound: true,
    whatsappOrSocialBookingLink: false,
    telLink: true,
    hasContactForm: false,
    contactFormFieldCount: 0,
  }), 'slow_or_heavy_mobile_page');

  assert.equal(classifyPrimaryIssue({
    statusCode: 200,
    loadTimeMs: 1000,
    psiMobileScore: 40, // Poor PSI score
    loadSlowMs: 4000,
    psiPoorScore: 50,
    bookingKeywordFound: true,
    whatsappOrSocialBookingLink: false,
    telLink: true,
    hasContactForm: false,
    contactFormFieldCount: 0,
  }), 'slow_or_heavy_mobile_page');

  assert.equal(classifyPrimaryIssue({
    statusCode: 200,
    loadTimeMs: 1000,
    psiMobileScore: 90,
    loadSlowMs: 4000,
    psiPoorScore: 50,
    bookingKeywordFound: false,
    whatsappOrSocialBookingLink: false,
    telLink: true,
    hasContactForm: false,
    contactFormFieldCount: 0,
  }), 'no_visible_booking_cta');

  // Should NOT flag no CTA if social link exists
  assert.equal(classifyPrimaryIssue({
    statusCode: 200,
    loadTimeMs: 1000,
    psiMobileScore: 90,
    loadSlowMs: 4000,
    psiPoorScore: 50,
    bookingKeywordFound: false,
    whatsappOrSocialBookingLink: true,
    telLink: true,
    hasContactForm: false,
    contactFormFieldCount: 0,
  }), 'no_material_issue_detected');

  assert.equal(classifyPrimaryIssue({
    statusCode: 200,
    loadTimeMs: 1000,
    psiMobileScore: 90,
    loadSlowMs: 4000,
    psiPoorScore: 50,
    bookingKeywordFound: true,
    whatsappOrSocialBookingLink: false,
    telLink: false,
    hasContactForm: false,
    contactFormFieldCount: 0,
  }), 'no_click_to_call');
  
  assert.equal(classifyPrimaryIssue({
    statusCode: 200,
    loadTimeMs: 1000,
    psiMobileScore: 90,
    loadSlowMs: 4000,
    psiPoorScore: 50,
    bookingKeywordFound: true,
    whatsappOrSocialBookingLink: false,
    telLink: true,
    hasContactForm: true,
    contactFormFieldCount: 4,
  }), 'contact_path_has_friction');

  assert.equal(classifyPrimaryIssue({
    statusCode: 200,
    loadTimeMs: 1000,
    psiMobileScore: 90,
    loadSlowMs: 4000,
    psiPoorScore: 50,
    bookingKeywordFound: true,
    whatsappOrSocialBookingLink: false,
    telLink: true,
    hasContactForm: false,
    contactFormFieldCount: 0,
  }), 'no_material_issue_detected');
});

test('audit - analyseAuditPage', () => {
  const pageResult: AuditPageResult = {
    viewportMeta: true,
    horizontalOverflow: false,
    telLink: true,
    bookingKeywordFound: true,
    bookingCtaAboveFold: true,
    whatsappOrSocialBookingLink: false,
    loadTimeMs: 2500,
    statusCode: 200,
    screenshotBuffer: null,
  };

  const { auditData, primaryIssue } = analyseAuditPage({
    pageResult,
    psiMobileScore: null,
    loadSlowMs: 4000,
    psiPoorScore: 50,
  });

  assert.equal(auditData.loadTimeMs, 2500);
  assert.equal(auditData.httpStatuses['200'], 200);
  assert.equal(primaryIssue, 'no_material_issue_detected');
});

test('audit - orchestrator (auditLeads)', async (t) => {
  const dummyLead: Lead = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    businessName: 'Test Business',
    category: 'Test',
    city: 'Test City',
    country: 'Test Country',
    websiteUrl: 'https://testbusiness.com',
    phone: '1234567890',
    source: 'test',
    sourceUrl: 'https://test.com',
    sourceCheckedAt: '2026-09-21T00:00:00.000Z',
    rating: null,
    reviewCount: null,
    contactName: null,
    workflowStatus: 'enriched', // Needs to be enriched to be audited
    createdAt: '2026-09-21T00:00:00.000Z',
    updatedAt: '2026-09-21T00:00:00.000Z',
    emailValidationStatus: 'not_checked',
    auditStatus: 'not_checked',
    psiStatus: 'disabled',
    emailCandidates: [],
    email: null,
    emailType: null,
    chosenEmailReason: null,
    requiresManualAction: false,
    contactChannel: 'none',
    screenshotPath: null,
    audit: null,
    primaryIssue: null,
    evidenceUrl: null,
    evidenceText: null,
    personalizationNote: null,
    qualificationScore: null,
    qualificationReasons: [],
    placeId: null,
    osmSocial: null,
  };

  const leadsInPath = 'data/tests_audit_in.json';
  const leadsOutPath = 'data/tests_audit_out.json';
  const screenshotsDir = 'data/tests_screenshots';
  const { writeFile } = await import('node:fs/promises');

  await t.test('processes an enriched lead and assigns issues', async () => {
    await writeFile(leadsInPath, JSON.stringify([dummyLead]));
    await rm(leadsOutPath, { force: true });
    await rm(screenshotsDir, { recursive: true, force: true });

    const mockAudit = async (url: string): Promise<AuditPageResult> => ({
      viewportMeta: true,
      horizontalOverflow: false,
      telLink: false, // Will trigger no_click_to_call
      bookingKeywordFound: true,
      bookingCtaAboveFold: true,
      whatsappOrSocialBookingLink: false,
      loadTimeMs: 1500,
      statusCode: 200,
      screenshotBuffer: Buffer.from('fake-image'),
    });

    const res = await auditLeads({
      limit: 1,
      config,
      auditFn: mockAudit,
      leadsInPath,
      leadsOutPath,
      screenshotsDir,
    });

    assert.equal(res.processed, 1);
    assert.equal(res.complete, 1);

    const { readLeads } = await import('../src/store.js');
    const out = await readLeads(leadsOutPath);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.auditStatus, 'complete');
    assert.equal(out[0]?.primaryIssue, 'no_click_to_call');
    assert.ok(out[0]?.screenshotPath?.includes('123e4567-e89b-12d3-a456-426614174000.png'));
    assert.ok(out[0]?.evidenceText?.includes('clickable phone'));
    assert.ok(out[0]?.personalizationNote?.includes('tap-to-call'));
  });

  await t.test('handles Playwright failure (site unreachable / error)', async () => {
    await writeFile(leadsInPath, JSON.stringify([dummyLead]));
    await rm(leadsOutPath, { force: true });
    
    const mockAudit = async (url: string): Promise<AuditPageResult> => {
      throw new Error('Navigation failed');
    };

    const res = await auditLeads({
      limit: 1,
      config,
      auditFn: mockAudit,
      leadsInPath,
      leadsOutPath,
      screenshotsDir,
    });

    assert.equal(res.failed, 1);
    
    const { readLeads } = await import('../src/store.js');
    const out = await readLeads(leadsOutPath);
    assert.equal(out[0]?.auditStatus, 'failed');
  });

  await t.test('cleans up temp files', async () => {
    await rm(leadsInPath, { force: true }).catch(() => {});
    await rm(leadsOutPath, { force: true }).catch(() => {});
    await rm(screenshotsDir, { recursive: true, force: true }).catch(() => {});
  });
});
