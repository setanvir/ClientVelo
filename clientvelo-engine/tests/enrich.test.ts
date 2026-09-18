import test from 'node:test';
import assert from 'node:assert/strict';
import { analysePageHtml, enrichLeads, type FetchedPage } from '../src/enrich.js';
import type { Lead, EmailCandidate } from '../src/types.js';
import { config } from '../src/config.js';
import { rm } from 'node:fs/promises';

test('enrich - contact extraction (analysePageHtml)', async (t) => {
  await t.test('extracts mailto links', () => {
    const html = `
      <html>
        <body>
          <a href="mailto:info@business.com">Email us</a>
          <a href="mailto:contact@business.com?subject=Hello">Contact</a>
        </body>
      </html>
    `;
    const result = analysePageHtml(html, 'business.com');
    assert.equal(result.candidates.length, 2);
    
    // Sort to ensure stable check
    const emails = result.candidates.map(c => c.email).sort();
    assert.deepEqual(emails, ['contact@business.com', 'info@business.com']);
    
    const infoCandidate = result.candidates.find(c => c.email === 'info@business.com');
    assert.equal(infoCandidate?.source, 'mailto_link');
    assert.equal(infoCandidate?.emailType, 'generic_role');
  });

  await t.test('extracts visible text emails', () => {
    const html = `Contact us at support@test.com or sales@test.com.`;
    const result = analysePageHtml(html, 'test.com');
    assert.equal(result.candidates.length, 2);
    assert.ok(result.candidates.some(c => c.email === 'support@test.com' && c.source === 'visible_text'));
  });

  await t.test('extracts obfuscated emails', () => {
    const html = `Reach out to owner [at] domain (dot) com or hello AT domain DOT com.`;
    const result = analysePageHtml(html, 'domain.com');
    assert.equal(result.candidates.length, 2);
    assert.ok(result.candidates.some(c => c.email === 'owner@domain.com' && c.source === 'obfuscated'));
    assert.ok(result.candidates.some(c => c.email === 'hello@domain.com' && c.source === 'obfuscated'));
  });

  await t.test('detects contact forms', () => {
    const htmlWithForm = `<form action="/submit-contact"><input type="text" name="msg"></form>`;
    const htmlWithEmailInput = `<form><input type="email" name="email"></form>`;
    const htmlWithKeyword = `<form><div>Get in touch</div></form>`;
    const htmlNoForm = `<div>Get in touch</div>`;

    assert.equal(analysePageHtml(htmlWithForm, null).hasContactForm, true);
    assert.equal(analysePageHtml(htmlWithEmailInput, null).hasContactForm, true);
    assert.equal(analysePageHtml(htmlWithKeyword, null).hasContactForm, true);
    assert.equal(analysePageHtml(htmlNoForm, null).hasContactForm, false);
  });

  await t.test('detects tel links', () => {
    const html = `<a href="tel:+1234567890">Call us</a>`;
    assert.equal(analysePageHtml(html, null).hasTelLink, true);
    assert.equal(analysePageHtml(`<div>Call us at 1234</div>`, null).hasTelLink, false);
  });

  await t.test('deduplicates emails from different sources, preferring mailto', () => {
    const html = `
      <a href="mailto:info@business.com">Email us</a>
      Text: info@business.com
      Obfuscated: info [at] business (dot) com
    `;
    const result = analysePageHtml(html, 'business.com');
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0]?.email, 'info@business.com');
    assert.equal(result.candidates[0]?.source, 'mailto_link'); // mailto is checked first
  });
});

test('enrich - orchestrator (enrichLeads)', async (t) => {
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
    workflowStatus: 'new',
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

  const leadsInPath = 'data/tests_enrich_in.json';
  const leadsOutPath = 'data/tests_enrich_out.json';
  const { writeFile } = await import('node:fs/promises');

  await t.test('processes a lead and resolves contact channel (direct email)', async () => {
    await writeFile(leadsInPath, JSON.stringify([dummyLead]));
    await rm(leadsOutPath, { force: true });

    const mockFetch = async (url: string): Promise<FetchedPage> => {
      if (url.endsWith('/robots.txt')) {
        return { html: '', finalUrl: url, statusCode: 404 };
      }
      return {
        html: `<html><a href="mailto:owner@testbusiness.com">Owner</a><form action="/contact"></form></html>`,
        finalUrl: url,
        statusCode: 200,
      };
    };

    const res = await enrichLeads({
      limit: 1,
      config,
      fetchFn: mockFetch,
      leadsInPath,
      leadsOutPath,
      skipRobots: true,
    });

    assert.equal(res.processed, 1);
    assert.equal(res.contact_found, 1);

    const { readLeads } = await import('../src/store.js');
    const out = await readLeads(leadsOutPath);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.workflowStatus, 'enriched');
    assert.equal(out[0]?.contactChannel, 'direct_email');
    assert.equal(out[0]?.email, 'owner@testbusiness.com');
    assert.equal(out[0]?.requiresManualAction, false);
  });

  await t.test('processes a lead and resolves contact channel (contact form only)', async () => {
    await writeFile(leadsInPath, JSON.stringify([dummyLead]));
    await rm(leadsOutPath, { force: true });

    const mockFetch = async (url: string): Promise<FetchedPage> => {
      return {
        html: `<html><form action="/contact"></form></html>`,
        finalUrl: url,
        statusCode: 200,
      };
    };

    const res = await enrichLeads({
      limit: 1,
      config,
      fetchFn: mockFetch,
      leadsInPath,
      leadsOutPath,
      skipRobots: true,
    });

    assert.equal(res.contact_form_only, 1);
    
    const { readLeads } = await import('../src/store.js');
    const out = await readLeads(leadsOutPath);
    assert.equal(out[0]?.contactChannel, 'contact_form');
    assert.equal(out[0]?.email, null);
    assert.equal(out[0]?.requiresManualAction, true);
  });

  await t.test('handles site unreachable', async () => {
    await writeFile(leadsInPath, JSON.stringify([dummyLead]));
    await rm(leadsOutPath, { force: true });

    const mockFetch = async (url: string): Promise<FetchedPage> => {
      return { html: '', finalUrl: url, statusCode: 500 };
    };

    const res = await enrichLeads({
      limit: 1,
      config,
      fetchFn: mockFetch,
      leadsInPath,
      leadsOutPath,
      skipRobots: true,
    });

    assert.equal(res.site_unreachable, 1);
    
    const { readLeads } = await import('../src/store.js');
    const out = await readLeads(leadsOutPath);
    assert.equal(out[0]?.auditStatus, 'site_unreachable');
    assert.equal(out[0]?.primaryIssue, 'site_unreachable');
  });

  await t.test('handles no website', async () => {
    const noWebLead = { ...dummyLead, websiteUrl: null };
    await writeFile(leadsInPath, JSON.stringify([noWebLead]));
    await rm(leadsOutPath, { force: true });

    const res = await enrichLeads({
      limit: 1,
      config,
      fetchFn: async () => ({ html: '', finalUrl: '', statusCode: 200 }),
      leadsInPath,
      leadsOutPath,
      skipRobots: true,
    });

    assert.equal(res.skipped_no_website, 1);
  });
  
  await t.test('respects robots.txt disallow', async () => {
    await writeFile(leadsInPath, JSON.stringify([dummyLead]));
    await rm(leadsOutPath, { force: true });

    const mockFetch = async (url: string): Promise<FetchedPage> => {
      if (url.endsWith('/robots.txt')) {
        return { html: 'User-agent: *\nDisallow: /', finalUrl: url, statusCode: 200 };
      }
      return { html: 'Should not be fetched', finalUrl: url, statusCode: 200 };
    };

    const res = await enrichLeads({
      limit: 1,
      config,
      fetchFn: mockFetch,
      leadsInPath,
      leadsOutPath,
      skipRobots: false,
    });

    assert.equal(res.site_unreachable, 1); // Because it fetched 0 pages
  });

  await t.test('cleans up temp files', async () => {
    await rm(leadsInPath, { force: true }).catch(() => {});
    await rm(leadsOutPath, { force: true }).catch(() => {});
  });
});
