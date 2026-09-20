/**
 * audit.ts — Local mobile audit + optional PageSpeed Insights integration.
 *
 * Measures only observable, factual values. No revenue or loss claims.
 * The injectable `auditPageFn` parameter allows full unit testing without a
 * real browser.
 *
 * Wording constraint (enforced at draft-render time, documented here):
 *   Never claim a site is "losing customers" or causing "revenue loss".
 *   Use cautious phrasing like "may make it harder for mobile visitors to...".
 */

import { readLeads, writeLeads, PATHS } from './store.js';
import { now, log } from './utils.js';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  Lead,
  AuditData,
  AuditStatus,
  PsiStatus,
  PrimaryIssue,
} from './types.js';
import type { Config } from './config.js';

// ─── Injectable audit interface ───────────────────────────────────────────────

/**
 * Result of auditing a single URL for mobile characteristics.
 * The real implementation uses Playwright; tests inject a mock.
 */
export interface AuditPageResult {
  viewportMeta: boolean;
  horizontalOverflow: boolean;
  telLink: boolean;
  bookingKeywordFound: boolean;
  bookingCtaAboveFold: boolean;
  whatsappOrSocialBookingLink: boolean;
  loadTimeMs: number | null;
  statusCode: number;
  screenshotBuffer: Buffer | null;
}

export type AuditPageFn = (url: string) => Promise<AuditPageResult>;

// ─── Booking keywords ─────────────────────────────────────────────────────────

// Broad keywords covering English, Bengali booking intent
const BOOKING_KEYWORDS_RE =
  /appoint|book|schedul|reserv|হুট|নিবন্ধন|সাক্ষাৎ|সময়|slot|দর্শন/i;

// WhatsApp and social booking link patterns
const SOCIAL_BOOKING_RE = /wa\.me|wa\.link|m\.me|messenger|api\.whatsapp|t\.me\/|chat\.whatsapp/i;

// ─── Playwright-backed auditor (used in production) ───────────────────────────

export async function buildPlaywrightAuditor(opts: {
  timeoutMs: number;
  screenshotsDir: string;
}): Promise<{ auditor: AuditPageFn; close: () => Promise<void> }> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: true,
  });

  const auditor: AuditPageFn = async (url: string): Promise<AuditPageResult> => {
    const page = await context.newPage();
    let statusCode = 0;
    let screenshotBuffer: Buffer | null = null;

    try {
      // Abort non-essential resources to speed up load
      await page.route('**/*', async (route) => {
        const t = route.request().resourceType();
        if (['image', 'font', 'media'].includes(t)) {
          await route.abort();
          return;
        }
        await route.continue();
      });

      const response = await page.goto(url, {
        timeout: opts.timeoutMs,
        waitUntil: 'domcontentloaded',
      });

      statusCode = response?.status() ?? 0;

      if (statusCode < 200 || statusCode >= 400) {
        return {
          viewportMeta: false,
          horizontalOverflow: false,
          telLink: false,
          bookingKeywordFound: false,
          bookingCtaAboveFold: false,
          whatsappOrSocialBookingLink: false,
          loadTimeMs: null,
          statusCode,
          screenshotBuffer: null,
        };
      }

      // ── Measure observable values via page.evaluate() ─────────────────────
      const metrics = await page.evaluate(() => {
        const domLoadTime =
          (window.performance?.timing?.loadEventEnd ?? 0) -
          (window.performance?.timing?.navigationStart ?? 0);

        const viewportMeta = !!document.querySelector(
          'meta[name="viewport"][content*="width=device-width"]',
        );

        const horizontalOverflow =
          document.documentElement.scrollWidth > window.innerWidth;

        const telLink = !!document.querySelector('a[href^="tel:"]');

        // Search page text for booking keywords
        const bodyText = document.body?.innerText ?? '';
        const bookingKeywordFound =
          /appoint|book|schedul|reserv|\u09B9\u09C1\u099F|\u09A8\u09BF\u09AC\u09A8\u09CD\u09A7\u09A8|\u09B8\u09BE\u0995\u09CD\u09B7\u09BE\u09CE|\u09B8\u09AE\u09AF\u09BC|slot|\u09A6\u09B0\u09CD\u09B6\u09A8/i.test(bodyText);

        // Check if a booking CTA is above the fold (844px)
        let bookingCtaAboveFold = false;
        if (bookingKeywordFound) {
          const allText = document.querySelectorAll('a, button, [role="button"]');
          for (const el of Array.from(allText)) {
            if (/appoint|book|schedul|reserv|slot/i.test(el.textContent ?? '')) {
              const rect = el.getBoundingClientRect();
              if (rect.top < 844 && rect.bottom > 0) {
                bookingCtaAboveFold = true;
                break;
              }
            }
          }
        }

        // WhatsApp or social booking links
        const links = Array.from(document.querySelectorAll('a[href]'));
        const whatsappOrSocialBookingLink = links.some((a) =>
          /wa\.me|wa\.link|m\.me|messenger|api\.whatsapp|t\.me\/|chat\.whatsapp/i.test(
            (a as HTMLAnchorElement).href,
          ),
        );

        return {
          loadTimeMs: domLoadTime > 0 ? domLoadTime : null,
          viewportMeta,
          horizontalOverflow,
          telLink,
          bookingKeywordFound,
          bookingCtaAboveFold,
          whatsappOrSocialBookingLink,
        };
      });

      // ── Screenshot (full page, clipped to 844px) ──────────────────────────
      try {
        const buf = await page.screenshot({
          fullPage: false,
          clip: { x: 0, y: 0, width: 390, height: 844 },
        });
        screenshotBuffer = Buffer.from(buf);
      } catch (err) {
        log.warn(`[audit] Screenshot failed for ${url}: ${(err as Error).message}`);
      }

      return { ...metrics, statusCode, screenshotBuffer };
    } finally {
      await page.close().catch(() => {});
    }
  };

  return {
    auditor,
    close: async () => {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

// ─── Primary issue classification ─────────────────────────────────────────────

/**
 * Determine the single primary issue from observed audit data.
 * Priority order matches the spec exactly.
 */
export function classifyPrimaryIssue(opts: {
  statusCode: number;
  loadTimeMs: number | null;
  psiMobileScore: number | null;
  loadSlowMs: number;
  psiPoorScore: number;
  bookingKeywordFound: boolean;
  whatsappOrSocialBookingLink: boolean;
  telLink: boolean;
  hasContactForm: boolean;
  contactFormFieldCount: number;
}): PrimaryIssue {
  if (opts.statusCode < 200 || opts.statusCode >= 400) {
    return 'site_unreachable';
  }

  const slowLoad =
    (opts.loadTimeMs !== null && opts.loadTimeMs > opts.loadSlowMs) ||
    (opts.psiMobileScore !== null && opts.psiMobileScore < opts.psiPoorScore);

  if (slowLoad) {
    return 'slow_or_heavy_mobile_page';
  }

  if (!opts.bookingKeywordFound && !opts.whatsappOrSocialBookingLink) {
    return 'no_visible_booking_cta';
  }

  if (!opts.telLink) {
    return 'no_click_to_call';
  }

  if (opts.hasContactForm && opts.contactFormFieldCount >= 3) {
    return 'contact_path_has_friction';
  }

  return 'no_material_issue_detected';
}

// ─── Pure audit analysis (testable) ──────────────────────────────────────────

export interface AuditAnalysisInput {
  pageResult: AuditPageResult;
  psiMobileScore: number | null;
  loadSlowMs: number;
  psiPoorScore: number;
  hasContactForm?: boolean;
  contactFormFieldCount?: number;
}

export function analyseAuditPage(input: AuditAnalysisInput): {
  auditData: AuditData;
  primaryIssue: PrimaryIssue;
} {
  const {
    pageResult,
    psiMobileScore,
    loadSlowMs,
    psiPoorScore,
    hasContactForm = false,
    contactFormFieldCount = 0,
  } = input;

  const auditData: AuditData = {
    viewportMeta: pageResult.viewportMeta,
    horizontalOverflow: pageResult.horizontalOverflow,
    telLink: pageResult.telLink,
    bookingKeywordFound: pageResult.bookingKeywordFound,
    bookingCtaAboveFold: pageResult.bookingCtaAboveFold,
    whatsappOrSocialBookingLink: pageResult.whatsappOrSocialBookingLink,
    loadTimeMs: pageResult.loadTimeMs,
    psiMobileScore,
    httpStatuses: { [pageResult.statusCode.toString()]: pageResult.statusCode },
  };

  const primaryIssue = classifyPrimaryIssue({
    statusCode: pageResult.statusCode,
    loadTimeMs: pageResult.loadTimeMs,
    psiMobileScore,
    loadSlowMs,
    psiPoorScore,
    bookingKeywordFound: pageResult.bookingKeywordFound,
    whatsappOrSocialBookingLink: pageResult.whatsappOrSocialBookingLink,
    telLink: pageResult.telLink,
    hasContactForm,
    contactFormFieldCount,
  });

  return { auditData, primaryIssue };
}

// ─── Optional PSI integration ─────────────────────────────────────────────────

export type PsiFetchFn = (url: string) => Promise<Response>;

async function fetchPsiScore(opts: {
  websiteUrl: string;
  apiKey: string;
  fetchFn?: PsiFetchFn;
}): Promise<{ score: number | null; status: PsiStatus }> {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(opts.websiteUrl)}&strategy=mobile&key=${opts.apiKey}`;
  const fetchFn = opts.fetchFn ?? globalThis.fetch;

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20_000);
    let response: Response;

    try {
      response = await fetchFn(apiUrl);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      log.warn(`[audit] PSI API returned ${response.status} for ${opts.websiteUrl}`);
      return { score: null, status: 'unavailable' };
    }

    const data = (await response.json()) as { lighthouseResult?: { categories?: { performance?: { score?: number } } } };
    const raw = data?.lighthouseResult?.categories?.performance?.score;
    if (typeof raw !== 'number') {
      return { score: null, status: 'unavailable' };
    }

    // PSI scores are 0.0–1.0; multiply by 100 for comparison
    return { score: Math.round(raw * 100), status: 'complete' };
  } catch (err: unknown) {
    log.warn(`[audit] PSI fetch failed for ${opts.websiteUrl}: ${(err as Error).message}`);
    return { score: null, status: 'unavailable' };
  }
}

// ─── Audit orchestration ──────────────────────────────────────────────────────

export interface AuditOptions {
  limit: number;
  config: Pick<
    Config,
    | 'LOAD_SLOW_MS'
    | 'PSI_POOR_SCORE'
    | 'AUDIT_PSI_ENABLED'
    | 'PAGESPEED_INSIGHTS_API_KEY'
    | 'PAGE_TIMEOUT_MS'
  >;
  /** Injectable Playwright auditor (tests provide a mock). */
  auditFn?: AuditPageFn;
  /** Injectable PSI fetch function (tests provide a mock). */
  psiFetchFn?: PsiFetchFn;
  leadsInPath?: string;
  leadsOutPath?: string;
  screenshotsDir?: string;
}

export interface AuditResult {
  processed: number;
  skipped_already_done: number;
  skipped_no_website: number;
  complete: number;
  site_unreachable: number;
  failed: number;
}

export async function auditLeads(opts: AuditOptions): Promise<AuditResult> {
  const leadsInPath = opts.leadsInPath ?? PATHS.leadsEnriched;
  const leadsOutPath = opts.leadsOutPath ?? PATHS.leadsEnriched;
  const screenshotsDir = opts.screenshotsDir ?? PATHS.screenshots;

  await mkdir(screenshotsDir, { recursive: true });

  const leads = await readLeads(leadsInPath);

  const result: AuditResult = {
    processed: 0,
    skipped_already_done: 0,
    skipped_no_website: 0,
    complete: 0,
    site_unreachable: 0,
    failed: 0,
  };

  // Filter leads that need auditing
  const toAudit = leads.filter((l) => {
    if (l.auditStatus === 'complete' || l.auditStatus === 'site_unreachable') {
      return false;
    }
    return l.workflowStatus === 'enriched';
  }).slice(0, opts.limit);

  log.info(
    `[audit] ${leads.length} lead(s) loaded, ${toAudit.length} to audit (limit ${opts.limit})`,
  );

  // Build the real Playwright auditor if no mock was injected
  let playwright: Awaited<ReturnType<typeof buildPlaywrightAuditor>> | null = null;
  let auditPage: AuditPageFn;

  if (opts.auditFn) {
    auditPage = opts.auditFn;
  } else {
    playwright = await buildPlaywrightAuditor({
      timeoutMs: opts.config.PAGE_TIMEOUT_MS,
      screenshotsDir,
    });
    auditPage = playwright.auditor;
  }

  try {
    for (const lead of toAudit) {
      result.processed++;

      // ── No website ──────────────────────────────────────────────────────────
      if (!lead.websiteUrl) {
        result.skipped_no_website++;
        lead.auditStatus = 'not_checked';
        lead.psiStatus = 'disabled';
        lead.updatedAt = now();
        continue;
      }

      log.info(`[audit] Auditing: ${lead.businessName} (${lead.websiteUrl})`);

      let auditStatus: AuditStatus = 'failed';
      let psiStatus: PsiStatus = 'disabled';
      let psiScore: number | null = null;
      let pageResult: AuditPageResult | null = null;

      try {
        pageResult = await auditPage(lead.websiteUrl);
        auditStatus = 'complete';
      } catch (err: unknown) {
        log.warn(
          `[audit] ${lead.businessName}: Playwright error: ${(err as Error).message}`,
        );
        result.failed++;
        lead.auditStatus = 'failed';
        lead.updatedAt = now();
        continue;
      }

      // ── Optional PSI ────────────────────────────────────────────────────────
      if (
        opts.config.AUDIT_PSI_ENABLED &&
        opts.config.PAGESPEED_INSIGHTS_API_KEY &&
        pageResult.statusCode >= 200 &&
        pageResult.statusCode < 400
      ) {
        const psi = await fetchPsiScore({
          websiteUrl: lead.websiteUrl,
          apiKey: opts.config.PAGESPEED_INSIGHTS_API_KEY,
          fetchFn: opts.psiFetchFn,
        });
        psiScore = psi.score;
        psiStatus = psi.status;
      } else if (
        opts.config.AUDIT_PSI_ENABLED &&
        !opts.config.PAGESPEED_INSIGHTS_API_KEY
      ) {
        psiStatus = 'unavailable';
      }

      // ── Analyse ─────────────────────────────────────────────────────────────
      const { auditData, primaryIssue } = analyseAuditPage({
        pageResult,
        psiMobileScore: psiScore,
        loadSlowMs: opts.config.LOAD_SLOW_MS,
        psiPoorScore: opts.config.PSI_POOR_SCORE,
      });

      // ── Screenshot ──────────────────────────────────────────────────────────
      let screenshotPath: string | null = null;
      if (pageResult.screenshotBuffer) {
        screenshotPath = join(screenshotsDir, `${lead.id}.png`);
        try {
          const { writeFile } = await import('node:fs/promises');
          await writeFile(screenshotPath, pageResult.screenshotBuffer);
        } catch (err) {
          log.warn(
            `[audit] Failed to save screenshot for ${lead.businessName}: ${(err as Error).message}`,
          );
          screenshotPath = null;
        }
      }

      if (primaryIssue === 'site_unreachable') {
        auditStatus = 'site_unreachable';
        result.site_unreachable++;
      } else {
        result.complete++;
      }

      // ── Update lead ─────────────────────────────────────────────────────────
      lead.audit = auditData;
      lead.auditStatus = auditStatus;
      lead.psiStatus = psiStatus;
      lead.primaryIssue = primaryIssue;
      lead.screenshotPath = screenshotPath;
      lead.evidenceUrl = lead.websiteUrl;
      lead.evidenceText = buildEvidenceText(auditData, primaryIssue);
      lead.personalizationNote = buildPersonalizationNote(auditData, primaryIssue);
      lead.updatedAt = now();

      log.info(
        `[audit] ${lead.businessName}: status=${auditStatus} issue=${primaryIssue} loadMs=${auditData.loadTimeMs ?? 'n/a'} psi=${psiScore ?? 'n/a'}`,
      );
    }
  } finally {
    if (playwright) {
      await playwright.close().catch(() => {});
    }
  }

  await writeLeads(leads, leadsOutPath);
  log.info(`[audit] Written ${leads.length} lead(s) to ${leadsOutPath}`);

  return result;
}

// ─── Evidence text builders ───────────────────────────────────────────────────

/**
 * Build a factual, measured evidence text from audit data.
 * Language is deliberately cautious — never claims revenue loss.
 */
function buildEvidenceText(data: AuditData, issue: PrimaryIssue): string {
  switch (issue) {
    case 'slow_or_heavy_mobile_page':
      if (data.loadTimeMs !== null && data.loadTimeMs > 0) {
        return `Mobile page load measured at ${data.loadTimeMs} ms on a simulated mobile connection.`;
      }
      if (data.psiMobileScore !== null) {
        return `PageSpeed Insights mobile score: ${data.psiMobileScore}/100.`;
      }
      return 'Page load appears slow on mobile.';

    case 'no_visible_booking_cta':
      return 'No booking, appointment, or scheduling link found above the fold on a mobile viewport (390×844).';

    case 'no_click_to_call':
      return 'No clickable phone (tel:) link found on the page — mobile visitors cannot tap to call directly.';

    case 'contact_path_has_friction':
      return 'Contact form requires multiple fields before reaching the email field, which may reduce form completion on mobile.';

    case 'site_unreachable':
      return 'The website could not be reached during the audit.';

    case 'no_material_issue_detected':
      return 'No significant mobile usability issues were detected during the audit.';

    default:
      return '';
  }
}

/**
 * Build a short personalization note for use in draft templates.
 * Phrasing is cautious and factual — no guarantee language.
 */
function buildPersonalizationNote(data: AuditData, issue: PrimaryIssue): string {
  switch (issue) {
    case 'slow_or_heavy_mobile_page':
      if (data.loadTimeMs !== null && data.loadTimeMs > 0) {
        return `The homepage took approximately ${Math.round(data.loadTimeMs / 100) / 10}s to load on mobile, which may make it harder for mobile visitors to stay on the page.`;
      }
      return 'The page appears slow on mobile, which may affect how easily visitors can find your contact details.';

    case 'no_visible_booking_cta':
      return 'I did not spot a booking or appointment button in the visible area on a mobile screen, which may make it harder for visitors to take the next step.';

    case 'no_click_to_call':
      return 'The phone number on the page is not set up as a tap-to-call link, which may make it harder for mobile visitors to contact you directly.';

    case 'contact_path_has_friction':
      return 'The contact form asks for several details before reaching the email field, which can reduce completion rates on small screens.';

    case 'site_unreachable':
      return 'The website appeared to be unreachable during my check.';

    default:
      return '';
  }
}
