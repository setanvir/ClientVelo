/**
 * discover.ts — OpenStreetMap Overpass API lead discovery.
 *
 * This is the primary lead source. OSM data is under the Open Database
 * License (ODbL). Attribution: © OpenStreetMap contributors.
 *
 * Etiquette observed:
 *   - Descriptive User-Agent including contact email
 *   - One query per run (all tags combined into a single QL statement)
 *   - 24-hour response cache in data/osm_cache/
 *   - Exponential backoff on HTTP 429 / 504
 *   - Never loops, hammers, or uses bounding boxes
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  normalizeUrl,
  extractDomain,
  generateId,
  now,
  log,
} from './utils.js';
import { readLeads, writeLeads, readSeen, writeSeen, PATHS } from './store.js';
import type { Lead, PrimaryIssue } from './types.js';
import type { Config } from './config.js';

// ─── OSM API types ────────────────────────────────────────────────────────────

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  /** Latitude — present for nodes */
  lat?: number;
  /** Longitude — present for nodes */
  lon?: number;
  /** Geometric center — present for ways/relations when using `out center` */
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OsmElement[];
}

// ─── Overpass QL query builder ────────────────────────────────────────────────

/**
 * Builds a single Overpass QL query covering all tag variants for the niche.
 * Uses a named area filter (not a bounding box) for better city coverage.
 *
 * Example output:
 *   [out:json][timeout:25];
 *   area["name"="Dhaka"]->.searchArea;
 *   (
 *     node["amenity"="dentist"](area.searchArea);
 *     way["amenity"="dentist"](area.searchArea);
 *     relation["amenity"="dentist"](area.searchArea);
 *   );
 *   out center;
 */
function buildOverpassQuery(
  tags: string[],
  city: string,
  timeoutSeconds: number,
): string {
  // Escape double quotes in city name for QL safety
  const safeCity = city.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const tagUnions = tags
    .map((tag) => {
      const eqIdx = tag.indexOf('=');
      const key = tag.slice(0, eqIdx);
      const value = tag.slice(eqIdx + 1);
      return [
        `  node["${key}"="${value}"](area.searchArea);`,
        `  way["${key}"="${value}"](area.searchArea);`,
        `  relation["${key}"="${value}"](area.searchArea);`,
      ].join('\n');
    })
    .join('\n');

  return (
    `[out:json][timeout:${timeoutSeconds}];\n` +
    `area["name"="${safeCity}"]->.searchArea;\n` +
    `(\n${tagUnions}\n);\n` +
    `out center;`
  );
}

// ─── 24-hour cache ────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function buildCacheKey(niche: string, city: string): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  const safe = (s: string) => s.replace(/[^a-z0-9]/gi, '_');
  return `${safe(niche)}-${safe(city)}-${dateStr}.json`;
}

async function readCache(
  cacheDir: string,
  cacheKey: string,
): Promise<OverpassResponse | null> {
  const cachePath = join(cacheDir, cacheKey);
  try {
    const stats = await stat(cachePath);
    const ageMs = Date.now() - stats.mtimeMs;
    if (ageMs > CACHE_TTL_MS) {
      log.info(
        `[discover] Cache expired (${Math.round(ageMs / 3_600_000)}h old), will re-fetch`,
      );
      return null;
    }
    const raw = await readFile(cachePath, 'utf8');
    const data = JSON.parse(raw) as OverpassResponse;
    log.info(`[discover] Using cached Overpass response (${cacheKey})`);
    return data;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    log.warn(
      `[discover] Cache read failed, will re-fetch: ${(err as Error).message}`,
    );
    return null;
  }
}

async function writeCache(
  cacheDir: string,
  cacheKey: string,
  data: OverpassResponse,
): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(join(cacheDir, cacheKey), JSON.stringify(data, null, 2), 'utf8');
}

// ─── HTTP fetch with exponential backoff ──────────────────────────────────────

/** Injectable delay function for testing (default: real setTimeout). */
type DelayFn = (ms: number) => Promise<void>;

async function fetchOverpass(opts: {
  url: string;
  query: string;
  userAgent: string;
  maxAttempts?: number;
  fetchFn?: typeof fetch;
  delayFn?: DelayFn;
}): Promise<OverpassResponse> {
  const {
    url,
    query,
    userAgent,
    maxAttempts = 3,
    fetchFn = globalThis.fetch,
    delayFn = (ms) => new Promise<void>((r) => setTimeout(r, ms)),
  } = opts;

  let backoffMs = 5_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: Response;

    try {
      response = await fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent,
        },
        body: `data=${encodeURIComponent(query)}`,
      });
    } catch (err: unknown) {
      if (attempt >= maxAttempts) {
        throw new Error(
          `[discover] Network error after ${attempt} attempt(s): ${(err as Error).message}`,
        );
      }
      log.warn(
        `[discover] Network error (attempt ${attempt}/${maxAttempts}): ${(err as Error).message}. Retrying in ${backoffMs / 1000}s…`,
      );
      await delayFn(backoffMs);
      backoffMs *= 2;
      continue;
    }

    if (response.ok) {
      return (await response.json()) as OverpassResponse;
    }

    const { status } = response;

    if ((status === 429 || status === 504) && attempt < maxAttempts) {
      log.warn(
        `[discover] HTTP ${status} from Overpass (attempt ${attempt}/${maxAttempts}). Retrying in ${backoffMs / 1000}s…`,
      );
      await delayFn(backoffMs);
      backoffMs *= 2;
      continue;
    }

    throw new Error(`[discover] Overpass API returned HTTP ${status}`);
  }

  throw new Error('[discover] Max retry attempts exceeded');
}

// ─── OSM tag extraction helpers ───────────────────────────────────────────────

/** Return the first non-empty value from a prioritized list of tag keys. */
function getTag(
  tags: Record<string, string>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const val = tags[key];
    if (val && val.trim()) return val.trim();
  }
  return null;
}

// ─── Element → partial Lead ───────────────────────────────────────────────────

function elementToPartialLead(
  element: OsmElement,
  niche: string,
  city: string,
  country: string,
  chainBlocklist: string[],
): Partial<Lead> | null {
  const tags = element.tags ?? {};

  // Skip elements with no name
  const name = getTag(tags, 'name');
  if (!name) return null;

  // Skip chain businesses (partial, case-insensitive name match)
  if (
    chainBlocklist.some((chain) =>
      chain.length > 0 && name.toLowerCase().includes(chain.toLowerCase()),
    )
  ) {
    return null;
  }

  const placeId = `osm:${element.type}/${element.id}`;

  // Extract contact fields (primary then contact:* fallbacks)
  const phone = getTag(tags, 'phone', 'contact:phone', 'contact:mobile');
  const rawWebsite = getTag(tags, 'website', 'contact:website', 'url');
  const websiteUrl = rawWebsite ? normalizeUrl(rawWebsite) : null;
  const emailRaw = getTag(tags, 'email', 'contact:email');
  const email = emailRaw ? emailRaw.toLowerCase().trim() : null;

  // Social links
  const facebook = getTag(tags, 'contact:facebook') ?? null;
  const instagram = getTag(tags, 'contact:instagram') ?? null;
  const whatsapp = getTag(tags, 'contact:whatsapp') ?? null;

  // Build human-readable address from addr:* tags
  const addrParts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'],
    tags['addr:city'] ?? city,
    tags['addr:postcode'],
  ].filter(Boolean);
  const addressText = addrParts.join(', ') || null;

  // Determine primary issue and contact channel for no-website leads
  let primaryIssue: PrimaryIssue | null = null;
  let contactChannel: Lead['contactChannel'] = null;
  let requiresManualAction = false;

  if (!websiteUrl) {
    primaryIssue = 'no_website';
    if (email) {
      // Has an email tag — can contact directly, but note there is no website
      contactChannel = 'direct_email';
    } else {
      contactChannel = 'phone_only';
      requiresManualAction = true;
    }
  }

  const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
  const timestamp = now();

  const partial: Partial<Lead> = {
    businessName: name,
    category: niche,
    city,
    country,
    websiteUrl: websiteUrl ?? null,
    phone,
    source: 'OpenStreetMap contributors (ODbL)',
    sourceUrl,
    sourceCheckedAt: timestamp,
    // OSM leads have no rating or review count
    rating: null,
    reviewCount: null,
    contactName: null,

    contactChannel,
    // OSM-tagged email is a candidate; it must still pass validate and MX
    emailCandidates: email
      ? [{ email, emailType: 'business_public', source: 'osm_tag' }]
      : [],
    email,
    emailType: email ? 'business_public' : null,
    chosenEmailReason: email ? 'OSM contact email tag' : null,
    requiresManualAction,

    emailValidationStatus: 'not_checked',
    auditStatus: 'not_checked',
    psiStatus: 'disabled',
    screenshotPath: null,
    audit: null,
    primaryIssue,
    evidenceUrl: sourceUrl,
    evidenceText: addressText,
    personalizationNote: null,

    qualificationScore: null,
    qualificationReasons: [],

    workflowStatus: 'new',

    placeId,
    osmSocial: { facebook, instagram, whatsapp },
  };

  return partial;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type DiscoverConfig = Pick<
  Config,
  | 'OVERPASS_URL'
  | 'OVERPASS_TIMEOUT_SECONDS'
  | 'USER_AGENT'
  | 'chainBlocklist'
  | 'nicheTagMap'
  | 'MAX_DISCOVER_PER_RUN'
  | 'COUNTRY'
>;

export interface DiscoverOptions {
  niche: string;
  city: string;
  limit: number;
  config: DiscoverConfig;
  /** Injectable fetch function (default: globalThis.fetch). */
  fetchFn?: typeof fetch;
  /** Injectable delay function for backoff (default: real setTimeout). */
  delayFn?: DelayFn;
  /** Override cache directory path for testing. */
  osmCacheDir?: string;
  /** Override seen.json path for testing. */
  seenPath?: string;
  /** Override leads_raw.json path for testing. */
  leadsPath?: string;
}

export interface DiscoverResult {
  added: number;
  skipped_chain: number;
  skipped_seen: number;
  skipped_cap: number;
  total_osm: number;
}

export async function discoverLeads(
  opts: DiscoverOptions,
): Promise<DiscoverResult> {
  const { niche, config } = opts;
  const city = opts.city;
  const hardLimit = Math.min(opts.limit, config.MAX_DISCOVER_PER_RUN);
  const osmCacheDir = opts.osmCacheDir ?? PATHS.osmCache;
  const seenPath = opts.seenPath ?? PATHS.seen;
  const leadsPath = opts.leadsPath ?? PATHS.leadsRaw;

  // ── Resolve OSM tags ──────────────────────────────────────────────────────
  const tags = config.nicheTagMap[niche];
  if (!tags || tags.length === 0) {
    throw new Error(
      `[discover] No OSM tags configured for niche "${niche}". ` +
        `Add it to nicheTagMap in config.ts. ` +
        `Verify tags at https://taginfo.openstreetmap.org/`,
    );
  }

  const query = buildOverpassQuery(tags, city, config.OVERPASS_TIMEOUT_SECONDS);
  log.info(
    `[discover] Query: niche="${niche}" city="${city}" tags=[${tags.join(', ')}]`,
  );

  // ── Cache check ─────────────────────────────────────────────────────────────
  const cacheKey = buildCacheKey(niche, city);
  let osmData = await readCache(osmCacheDir, cacheKey);

  if (!osmData) {
    log.info(`[discover] Fetching from Overpass: ${config.OVERPASS_URL}`);
    osmData = await fetchOverpass({
      url: config.OVERPASS_URL,
      query,
      userAgent: config.USER_AGENT,
      maxAttempts: 3,
      fetchFn: opts.fetchFn,
      delayFn: opts.delayFn,
    });
    await writeCache(osmCacheDir, cacheKey, osmData);
    log.info(
      `[discover] Received ${osmData.elements.length} Overpass element(s), cached to ${cacheKey}`,
    );
  }

  // ── Load existing state ──────────────────────────────────────────────────────
  const existing = await readLeads(leadsPath);
  const seen = await readSeen(seenPath);

  const seenPlaceIds = new Set(seen.map((s) => s.placeId));
  const existingDomains = new Set<string>(
    existing
      .map((l) => (l.websiteUrl ? extractDomain(l.websiteUrl) : null))
      .filter((d): d is string => d !== null),
  );

  // ── Process elements ─────────────────────────────────────────────────────────
  const newLeads: Lead[] = [];
  const newSeen: (typeof seen)[number][] = [];
  let skippedChain = 0;
  let skippedSeen = 0;
  let skippedCap = 0;

  for (const element of osmData.elements) {
    if (newLeads.length >= hardLimit) {
      skippedCap++;
      continue;
    }

    const partial = elementToPartialLead(
      element,
      niche,
      city,
      config.COUNTRY,
      config.chainBlocklist,
    );

    if (!partial) {
      // Either no name, or name matched chain blocklist
      const name = element.tags?.['name'];
      if (name) {
        skippedChain++;
        log.info(`[discover] Skipping chain: "${name}"`);
      }
      // No name — silently skip (not a chain, just incomplete OSM data)
      continue;
    }

    const placeId = partial.placeId!;
    const domain = partial.websiteUrl ? extractDomain(partial.websiteUrl) : null;

    // ── Deduplication ─────────────────────────────────────────────────────────
    if (seenPlaceIds.has(placeId)) {
      skippedSeen++;
      log.info(
        `[discover] Already seen: ${placeId} (${partial.businessName})`,
      );
      continue;
    }
    if (domain && existingDomains.has(domain)) {
      skippedSeen++;
      log.info(
        `[discover] Domain already imported: ${domain} (${partial.businessName})`,
      );
      continue;
    }

    // ── Build full Lead ───────────────────────────────────────────────────────
    const leadId = generateId();
    const timestamp = now();
    const lead: Lead = {
      id: leadId,
      businessName: partial.businessName ?? 'Unknown',
      category: partial.category ?? niche,
      city: partial.city ?? city,
      country: partial.country ?? config.COUNTRY,
      websiteUrl: partial.websiteUrl ?? null,
      phone: partial.phone ?? null,
      source: partial.source ?? 'OpenStreetMap contributors (ODbL)',
      sourceUrl: partial.sourceUrl ?? null,
      sourceCheckedAt: partial.sourceCheckedAt ?? timestamp,
      rating: null,
      reviewCount: null,
      contactName: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      contactChannel: partial.contactChannel ?? null,
      emailCandidates: partial.emailCandidates ?? [],
      email: partial.email ?? null,
      emailType: partial.emailType ?? null,
      chosenEmailReason: partial.chosenEmailReason ?? null,
      requiresManualAction: partial.requiresManualAction ?? false,
      emailValidationStatus: 'not_checked',
      auditStatus: 'not_checked',
      psiStatus: 'disabled',
      screenshotPath: null,
      audit: null,
      primaryIssue: partial.primaryIssue ?? null,
      evidenceUrl: partial.evidenceUrl ?? null,
      evidenceText: partial.evidenceText ?? null,
      personalizationNote: null,
      qualificationScore: null,
      qualificationReasons: [],
      workflowStatus: 'new',
      placeId,
      osmSocial: partial.osmSocial ?? null,
    };

    newLeads.push(lead);
    seenPlaceIds.add(placeId);
    if (domain) existingDomains.add(domain);
    newSeen.push({ placeId, domain, businessName: lead.businessName, seenAt: timestamp, leadId });
  }

  // ── Persist ───────────────────────────────────────────────────────────────────
  if (newLeads.length > 0) {
    await writeLeads([...existing, ...newLeads], leadsPath);
    log.info(
      `[discover] Saved ${existing.length + newLeads.length} total lead(s) (${newLeads.length} new)`,
    );
    await writeSeen([...seen, ...newSeen], seenPath);
    log.info(
      `[discover] Updated seen.json: ${seen.length + newSeen.length} total entries`,
    );
  } else {
    log.info(`[discover] No new leads discovered.`);
  }

  return {
    added: newLeads.length,
    skipped_chain: skippedChain,
    skipped_seen: skippedSeen,
    skipped_cap: skippedCap,
    total_osm: osmData.elements.length,
  };
}
