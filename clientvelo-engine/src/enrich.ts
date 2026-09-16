/**
 * enrich.ts — Bounded website fetcher and contact extraction.
 *
 * Visits at most MAX_PAGES_PER_DOMAIN pages per lead website.
 * Extracts only publicly visible contact information.
 * Never submits forms or bypasses any technical control.
 *
 * The `fetchPageFn` parameter is injectable so tests run without a real browser.
 */

import { readLeads, writeLeads, PATHS } from './store.js';
import { normalizeUrl, extractDomain, generateId, now, log, delay } from './utils.js';
import type { Lead, EmailCandidate, ContactChannel, EmailType } from './types.js';
import type { Config } from './config.js';

// ─── Role-address prefixes ────────────────────────────────────────────────────
// These addresses exist but are often monitored by multiple people.
// Flagged as generic_role, not rejected.

const ROLE_PREFIXES = [
  'info', 'contact', 'hello', 'office', 'support', 'sales', 'admin',
  'mail', 'enquir', 'enquir', 'reception', 'help', 'team', 'general',
];

// Blocked addresses — never contact these.
const BLOCKED_PREFIXES = [
  'noreply', 'no-reply', 'abuse', 'postmaster', 'mailer-daemon',
  'bounce', 'donotreply', 'do-not-reply',
];

// ─── Email extraction helpers ─────────────────────────────────────────────────

/** Basic email pattern — permissive enough to catch most real addresses. */
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/** Obfuscation patterns: "[at]", "(at)", "AT", "(dot)" etc. */
const OBFUSCATED_RE =
  /([a-zA-Z0-9._%+\-]+)\s*[\[(]?(?:at|@)[\])]?\s*([a-zA-Z0-9.\-]+)\s*[\[(]?(?:dot|\.)[\])]?\s*([a-zA-Z]{2,})/gi;

function isBlockedEmail(local: string): boolean {
  const l = local.toLowerCase();
  return BLOCKED_PREFIXES.some((prefix) => l === prefix || l.startsWith(prefix + '-') || l.startsWith(prefix + '.'));
}

function isRoleEmail(local: string): boolean {
  const l = local.toLowerCase();
  return ROLE_PREFIXES.some((prefix) => l === prefix || l.startsWith(prefix));
}

function classifyEmailType(email: string, websiteDomain: string | null): EmailType {
  const [local, domainPart] = email.toLowerCase().split('@');
  if (!local || !domainPart) return 'unknown';
  if (isRoleEmail(local)) return 'generic_role';
  if (websiteDomain && domainPart === websiteDomain) return 'business_public';
  if (websiteDomain && domainPart.endsWith(`.${websiteDomain}`)) return 'business_public';
  return 'personal_public';
}

/** Extract all emails from HTML text via regex, returning unique candidates. */
function extractEmailsFromText(
  html: string,
  websiteDomain: string | null,
  source: EmailCandidate['source'],
): EmailCandidate[] {
  const results: EmailCandidate[] = [];
  const seen = new Set<string>();

  const matches = html.matchAll(EMAIL_RE);
  for (const match of matches) {
    const email = match[0]!.toLowerCase().trim();
    const [local] = email.split('@');
    if (!local) continue;
    if (isBlockedEmail(local)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    results.push({
      email,
      emailType: classifyEmailType(email, websiteDomain),
      source,
    });
  }
  return results;
}

/** Extract obfuscated emails like "name [at] domain (dot) com". */
function extractObfuscatedEmails(
  text: string,
  websiteDomain: string | null,
): EmailCandidate[] {
  const results: EmailCandidate[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  // Reset lastIndex since we're using a global regex
  OBFUSCATED_RE.lastIndex = 0;

  while ((match = OBFUSCATED_RE.exec(text)) !== null) {
    const local = match[1]!.toLowerCase();
    const domain = match[2]!.toLowerCase();
    const tld = match[3]!.toLowerCase();
    const email = `${local}@${domain}.${tld}`;

    if (isBlockedEmail(local)) continue;
    if (seen.has(email)) continue;
    seen.add(email);

    results.push({
      email,
      emailType: classifyEmailType(email, websiteDomain),
      source: 'obfuscated',
    });
  }
  return results;
}

/** Extract mailto: href emails from raw HTML. */
function extractMailtoEmails(
  html: string,
  websiteDomain: string | null,
): EmailCandidate[] {
  const results: EmailCandidate[] = [];
  const seen = new Set<string>();
  const mailtoRe = /href=["']mailto:([^"'?>\s]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = mailtoRe.exec(html)) !== null) {
    const raw = match[1]!.toLowerCase().trim();
    // Strip query params like ?subject=...
    const email = raw.split('?')[0] ?? raw;
    if (!EMAIL_RE.test(email)) continue;
    EMAIL_RE.lastIndex = 0; // reset global state

    const [local] = email.split('@');
    if (!local) continue;
    if (isBlockedEmail(local)) continue;
    if (seen.has(email)) continue;
    seen.add(email);

    results.push({
      email,
      emailType: classifyEmailType(email, websiteDomain),
      source: 'mailto_link',
    });
  }
  return results;
}

// ─── Contact-form detection ───────────────────────────────────────────────────

/** Detect the presence of a contact form (not submission). */
function detectContactForm(html: string): boolean {
  const lower = html.toLowerCase();
  // Form that contains an email input OR targets a mail-handler endpoint
  const hasForm = /<form[\s\S]*?<\/form>/i.test(html);
  if (!hasForm) return false;

  const hasEmailInput = /<input[^>]+type=["']email["']/i.test(html);
  const hasMailAction = /action=["'][^"']*(?:mail|contact|send|submit|form)[^"']*["']/i.test(html);
  const hasContactKeyword = /contact.*?form|send.*?message|get.*?in.*?touch/i.test(lower);

  return hasEmailInput || hasMailAction || hasContactKeyword;
}

// ─── Phone extraction ─────────────────────────────────────────────────────────

/** Check if html contains a tel: link. */
function detectTelLink(html: string): boolean {
  return /href=["']tel:/i.test(html);
}

// ─── robots.txt parser ────────────────────────────────────────────────────────

/** Minimal robots.txt parser — checks only the '*' (wildcard) user-agent. */
function parseRobotsTxt(content: string): Set<string> {
  const disallowed = new Set<string>();
  let inWildcard = false;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.split('#')[0]!.trim();
    if (!line) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const field = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (field === 'user-agent') {
      inWildcard = value === '*';
    } else if (field === 'disallow' && inWildcard && value) {
      disallowed.add(value);
    }
  }
  return disallowed;
}

function isDisallowedByRobots(path: string, disallowed: Set<string>): boolean {
  for (const rule of disallowed) {
    if (path.startsWith(rule)) return true;
  }
  return false;
}

// ─── Candidate deduplication ──────────────────────────────────────────────────

function deduplicateCandidates(candidates: EmailCandidate[]): EmailCandidate[] {
  const seen = new Set<string>();
  const result: EmailCandidate[] = [];
  for (const c of candidates) {
    if (seen.has(c.email)) continue;
    seen.add(c.email);
    result.push(c);
  }
  return result;
}

// ─── Contact channel resolution ───────────────────────────────────────────────

function resolveContactChannel(
  candidates: EmailCandidate[],
  hasContactForm: boolean,
  hasPhone: boolean,
): { channel: ContactChannel; chosenEmail: EmailCandidate | null; reason: string } {
  // Business or personal email (non-role)
  const direct = candidates.find(
    (c) => c.emailType === 'business_public' || c.emailType === 'personal_public',
  );
  if (direct) {
    return {
      channel: 'direct_email',
      chosenEmail: direct,
      reason: `Non-role email found via ${direct.source}: ${direct.email}`,
    };
  }

  // Generic/role email
  const role = candidates.find((c) => c.emailType === 'generic_role');
  if (role) {
    return {
      channel: 'generic_email',
      chosenEmail: role,
      reason: `Role-prefix email found via ${role.source}: ${role.email} (ranked lower)`,
    };
  }

  // Contact form only
  if (hasContactForm) {
    return {
      channel: 'contact_form',
      chosenEmail: null,
      reason: 'Contact form detected; no direct email found — requires manual submission',
    };
  }

  // Phone only
  if (hasPhone) {
    return {
      channel: 'phone_only',
      chosenEmail: null,
      reason: 'Phone found but no email or contact form — requires manual outreach',
    };
  }

  return {
    channel: 'none',
    chosenEmail: null,
    reason: 'No contact information found on public pages',
  };
}

// ─── Injectable page fetcher interface ───────────────────────────────────────

/**
 * Result of fetching a single page.
 * The `html` should be the full rendered HTML text content.
 * `statusCode` is the HTTP response status.
 * `finalUrl` is the post-redirect URL.
 */
export interface FetchedPage {
  html: string;
  finalUrl: string;
  statusCode: number;
}

/**
 * Fetch a page for enrichment purposes.
 * Injectable so tests can provide a mock without a real browser.
 */
export type FetchPageFn = (url: string) => Promise<FetchedPage>;

// ─── Playwright-backed page fetcher (used in production) ─────────────────────

/**
 * Build the real Playwright-backed fetcher.
 * Lazy-imported so the module can be imported by tests without Playwright.
 */
export async function buildPlaywrightFetcher(opts: {
  timeoutMs: number;
  maxResponseBytes?: number;
}): Promise<{ fetcher: FetchPageFn; close: () => Promise<void> }> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: true,
  });

  const maxBytes = opts.maxResponseBytes ?? 500 * 1024; // 500 KB default

  const fetcher: FetchPageFn = async (url: string): Promise<FetchedPage> => {
    const page = await context.newPage();
    let statusCode = 0;
    let finalUrl = url;

    try {
      // Intercept responses to enforce max response size
      await page.route('**/*', async (route) => {
        const req = route.request();
        // Only guard document and script responses; images/fonts → abort
        if (['image', 'font', 'media'].includes(req.resourceType())) {
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
      finalUrl = page.url();

      const html = await page.content();

      // Enforce max response size via content length
      const byteLen = Buffer.byteLength(html, 'utf8');
      if (byteLen > maxBytes) {
        log.warn(
          `[enrich] Response for ${url} is ${byteLen} bytes (>${maxBytes}), using truncated content`,
        );
        // Truncate — we already have what we need for email/form detection
        return { html: html.slice(0, maxBytes), finalUrl, statusCode };
      }

      return { html, finalUrl, statusCode };
    } finally {
      await page.close().catch(() => {});
    }
  };

  return {
    fetcher,
    close: async () => {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

// ─── Core enrichment logic (testable, no Playwright dependency) ───────────────

export interface EnrichPageData {
  candidates: EmailCandidate[];
  hasContactForm: boolean;
  hasTelLink: boolean;
}

/**
 * Analyse a single page's HTML to extract contact data.
 * Pure function — no I/O, fully testable.
 */
export function analysePageHtml(
  html: string,
  websiteDomain: string | null,
): EnrichPageData {
  // Priority order: mailto links → visible text → obfuscated
  const mailtoEmails = extractMailtoEmails(html, websiteDomain);
  const visibleEmails = extractEmailsFromText(html, websiteDomain, 'visible_text');
  const obfuscatedEmails = extractObfuscatedEmails(html, websiteDomain);

  const allCandidates = deduplicateCandidates([
    ...mailtoEmails,
    ...visibleEmails,
    ...obfuscatedEmails,
  ]);

  return {
    candidates: allCandidates,
    hasContactForm: detectContactForm(html),
    hasTelLink: detectTelLink(html),
  };
}

// ─── Page-link discovery (internal link heuristics) ──────────────────────────

const CONTACT_KEYWORDS = /contact|reach|connect|touch|email|write/i;
const ABOUT_KEYWORDS = /about|who.*we|our.*team|company/i;
const SERVICE_KEYWORDS = /service|treatment|procedure|offer|care|special/i;

/**
 * Extract internal links from HTML, prioritising contact/about/service pages.
 * Returns at most `maxLinks` unique normalized paths.
 */
function extractInternalLinks(
  html: string,
  baseUrl: string,
  maxLinks: number,
): string[] {
  const base = new URL(baseUrl);
  const hrefRe = /href=["']([^"'#?\s]+)["']/gi;
  const found: Array<{ url: string; priority: number }> = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = hrefRe.exec(html)) !== null) {
    let href = match[1]!.trim();
    if (!href || href === '/') continue;

    let full: string;
    try {
      full = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }

    const u = new URL(full);
    // Same-origin only
    if (u.hostname !== base.hostname) continue;
    // Skip file downloads and known non-HTML resources
    if (/\.(pdf|jpg|jpeg|png|gif|svg|webp|ico|css|js|zip|doc|docx)$/i.test(u.pathname)) continue;

    const normalized = `${u.origin}${u.pathname}`;
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const path = u.pathname.toLowerCase();
    let priority = 0;
    if (CONTACT_KEYWORDS.test(path)) priority = 3;
    else if (ABOUT_KEYWORDS.test(path)) priority = 2;
    else if (SERVICE_KEYWORDS.test(path)) priority = 1;

    found.push({ url: normalized, priority });
  }

  return found
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxLinks)
    .map((f) => f.url);
}

// ─── Robots.txt fetcher ───────────────────────────────────────────────────────

async function fetchRobotsTxt(
  baseUrl: string,
  fetchFn: FetchPageFn,
): Promise<Set<string>> {
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).toString();
    const { html, statusCode } = await fetchFn(robotsUrl);
    if (statusCode === 200) {
      return parseRobotsTxt(html);
    }
  } catch {
    // robots.txt is optional; proceed without it
  }
  return new Set<string>();
}

// ─── Lead enrichment ──────────────────────────────────────────────────────────

export interface EnrichOptions {
  limit: number;
  config: Pick<Config, 'MAX_PAGES_PER_DOMAIN' | 'PAGE_TIMEOUT_MS' | 'PER_DOMAIN_DELAY_MS'>;
  fetchFn?: FetchPageFn;
  leadsInPath?: string;
  leadsOutPath?: string;
  /** If true, skip robots.txt fetching (for tests). */
  skipRobots?: boolean;
}

export interface EnrichResult {
  processed: number;
  skipped_already_done: number;
  skipped_no_website: number;
  site_unreachable: number;
  contact_found: number;
  contact_form_only: number;
  phone_only: number;
  none_found: number;
}

export async function enrichLeads(opts: EnrichOptions): Promise<EnrichResult> {
  const leadsInPath = opts.leadsInPath ?? PATHS.leadsRaw;
  const leadsOutPath = opts.leadsOutPath ?? PATHS.leadsEnriched;

  // Load source leads
  const leads = await readLeads(leadsInPath);
  // Load existing enriched leads (for merging)
  let enriched: Lead[] = [];
  try {
    enriched = await readLeads(leadsOutPath);
  } catch {
    enriched = [];
  }

  const enrichedIds = new Set(enriched.map((l) => l.id));

  const result: EnrichResult = {
    processed: 0,
    skipped_already_done: 0,
    skipped_no_website: 0,
    site_unreachable: 0,
    contact_found: 0,
    contact_form_only: 0,
    phone_only: 0,
    none_found: 0,
  };

  // Pick leads to process: status=new (or enriched-from-raw) and not yet in enriched file
  const toProcess = leads.filter(
    (l) =>
      (l.workflowStatus === 'new') &&
      !enrichedIds.has(l.id),
  ).slice(0, opts.limit);

  log.info(
    `[enrich] ${leads.length} lead(s) loaded, ${toProcess.length} to process (limit ${opts.limit})`,
  );

  // Determine whether to use a real browser or the injected mock
  let playwright: Awaited<ReturnType<typeof buildPlaywrightFetcher>> | null = null;
  let fetchPage: FetchPageFn;

  if (opts.fetchFn) {
    fetchPage = opts.fetchFn;
  } else {
    playwright = await buildPlaywrightFetcher({
      timeoutMs: opts.config.PAGE_TIMEOUT_MS,
    });
    fetchPage = playwright.fetcher;
  }

  try {
    for (const lead of toProcess) {
      result.processed++;

      // ── No website ──────────────────────────────────────────────────────────
      if (!lead.websiteUrl) {
        result.skipped_no_website++;
        log.info(`[enrich] ${lead.businessName}: no website — skipping enrichment`);
        // Still moves to enriched status so audit doesn't try to visit it
        enriched.push({
          ...lead,
          workflowStatus: 'enriched',
          updatedAt: now(),
          auditStatus: 'not_checked',
        });
        continue;
      }

      const domain = extractDomain(lead.websiteUrl);
      log.info(`[enrich] Processing: ${lead.businessName} (${lead.websiteUrl})`);

      // ── robots.txt ──────────────────────────────────────────────────────────
      const disallowed = opts.skipRobots
        ? new Set<string>()
        : await fetchRobotsTxt(lead.websiteUrl, fetchPage);

      // ── Fetch pages ─────────────────────────────────────────────────────────
      const pagesVisited: FetchedPage[] = [];
      const urlsToVisit: string[] = [lead.websiteUrl];
      const httpStatuses: Record<string, number> = {};
      let homepageUnreachable = false;

      for (let i = 0; i < urlsToVisit.length && pagesVisited.length < opts.config.MAX_PAGES_PER_DOMAIN; i++) {
        const pageUrl = urlsToVisit[i]!;
        const urlPath = (() => {
          try { return new URL(pageUrl).pathname; } catch { return '/'; }
        })();

        if (isDisallowedByRobots(urlPath, disallowed)) {
          log.info(`[enrich] robots.txt disallows ${pageUrl} — skipping`);
          continue;
        }

        try {
          const page = await fetchPage(pageUrl);
          httpStatuses[page.finalUrl] = page.statusCode;

          if (i === 0 && (page.statusCode < 200 || page.statusCode >= 400)) {
            // Homepage unreachable
            homepageUnreachable = true;
            log.warn(`[enrich] ${lead.businessName}: homepage returned ${page.statusCode}`);
            break;
          }

          if (page.statusCode >= 200 && page.statusCode < 400) {
            pagesVisited.push(page);

            // Discover additional links from homepage
            if (i === 0) {
              const additionalLinks = extractInternalLinks(
                page.html,
                page.finalUrl,
                opts.config.MAX_PAGES_PER_DOMAIN - 1,
              );
              urlsToVisit.push(...additionalLinks);
            }
          }

          // Per-page delay (skip for last page or when mocked)
          if (!opts.fetchFn && i < urlsToVisit.length - 1) {
            await delay(opts.config.PER_DOMAIN_DELAY_MS);
          }
        } catch (err: unknown) {
          log.warn(
            `[enrich] ${lead.businessName}: failed to fetch ${pageUrl}: ${(err as Error).message}`,
          );
          if (i === 0) {
            homepageUnreachable = true;
            break;
          }
        }
      }

      // ── Handle unreachable site ─────────────────────────────────────────────
      if (homepageUnreachable || pagesVisited.length === 0) {
        result.site_unreachable++;
        enriched.push({
          ...lead,
          auditStatus: 'site_unreachable',
          primaryIssue: 'site_unreachable',
          workflowStatus: 'enriched',
          contactChannel: lead.phone ? 'phone_only' : 'none',
          requiresManualAction: true,
          updatedAt: now(),
        });
        continue;
      }

      // ── Analyse all pages ───────────────────────────────────────────────────
      const allCandidates: EmailCandidate[] = [];
      let hasContactForm = false;

      for (const page of pagesVisited) {
        const pageData = analysePageHtml(page.html, domain);
        allCandidates.push(...pageData.candidates);
        if (pageData.hasContactForm) hasContactForm = true;
      }

      const finalCandidates = deduplicateCandidates(allCandidates);

      // ── Resolve contact channel ─────────────────────────────────────────────
      const { channel, chosenEmail, reason } = resolveContactChannel(
        finalCandidates,
        hasContactForm,
        !!lead.phone,
      );

      // ── Tally result type ───────────────────────────────────────────────────
      if (channel === 'direct_email' || channel === 'generic_email') {
        result.contact_found++;
      } else if (channel === 'contact_form') {
        result.contact_form_only++;
      } else if (channel === 'phone_only') {
        result.phone_only++;
      } else {
        result.none_found++;
      }

      const requiresManualAction =
        channel === 'contact_form' ||
        channel === 'phone_only' ||
        channel === 'none';

      const ts = now();
      enriched.push({
        ...lead,
        contactChannel: channel,
        emailCandidates: finalCandidates,
        email: chosenEmail?.email ?? null,
        emailType: chosenEmail?.emailType ?? null,
        chosenEmailReason: reason,
        requiresManualAction,
        workflowStatus: 'enriched',
        updatedAt: ts,
        sourceCheckedAt: ts,
      });

      log.info(
        `[enrich] ${lead.businessName}: channel=${channel} email=${chosenEmail?.email ?? 'none'} candidates=${finalCandidates.length}`,
      );
    }
  } finally {
    if (playwright) {
      await playwright.close().catch(() => {});
    }
  }

  // Merge: keep existing enriched leads, add new ones
  const existingNonProcessed = enriched.filter((l) => enrichedIds.has(l.id));
  // toProcess IDs that got updated
  const processedIds = new Set(toProcess.map((l) => l.id));
  const newlyEnriched = enriched.filter((l) => processedIds.has(l.id));
  const finalLeads = [...existingNonProcessed, ...newlyEnriched];

  await writeLeads(finalLeads, leadsOutPath);
  log.info(
    `[enrich] Written ${finalLeads.length} lead(s) to ${leadsOutPath}`,
  );

  return result;
}
