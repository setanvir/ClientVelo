/**
 * discover.test.ts — Tests for OSM Overpass discovery (discover.ts).
 *
 * All network calls are mocked via the injectable fetchFn parameter.
 * All delays are mocked via the injectable delayFn parameter (instant no-ops).
 * All I/O uses temp directories. Config module is never imported directly.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverLeads } from '../src/discover.js';
import type { DiscoverOptions } from '../src/discover.js';

// ─── Test config (no .env required) ──────────────────────────────────────────

const TEST_CONFIG = {
  OVERPASS_URL: 'https://test.overpass.example/api',
  OVERPASS_TIMEOUT_SECONDS: 25,
  USER_AGENT: 'ClientVeloTest/0.1',
  chainBlocklist: ['McDonald', 'Starbucks', 'KFC'],
  nicheTagMap: {
    'Dental Clinic': ['amenity=dentist', 'healthcare=dentist'],
    Salon: ['shop=hairdresser', 'shop=beauty'],
  } as Record<string, string[]>,
  MAX_DISCOVER_PER_RUN: 50,
  COUNTRY: 'Bangladesh',
};

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/** Instantly-resolving delay for tests (avoids real backoff waits). */
const noopDelay = async (_ms: number): Promise<void> => {};

/** Build a valid Overpass API response wrapping the given elements. */
function makeOverpassResponse(elements: unknown[]): unknown {
  return { elements };
}

/** Build a mock dentist node element. Tags can be overridden. */
function makeDentistNode(
  id: number,
  tagOverrides: Record<string, string> = {},
): unknown {
  return {
    type: 'node',
    id,
    lat: 23.7,
    lon: 90.4,
    tags: {
      name: `Test Dental ${id}`,
      amenity: 'dentist',
      website: `https://testdental${id}.com`,
      phone: `+88017${id}`,
      ...tagOverrides,
    },
  };
}

/** Create a fetch function that always returns the given response body. */
function mockFetch(body: unknown, status = 200): typeof fetch {
  return async () => {
    if (status !== 200) return new Response(null, { status });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

// ─── Setup/teardown ───────────────────────────────────────────────────────────

let tmp: string;
before(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'cv-discover-'));
});
after(async () => {
  await rm(tmp, { recursive: true, force: true });
});

/** Create unique, isolated paths for each test. */
function makePaths(label: string): Pick<DiscoverOptions, 'osmCacheDir' | 'seenPath' | 'leadsPath'> {
  const ts = `${Date.now()}_${Math.random().toString(36).slice(2)}_${label}`;
  return {
    osmCacheDir: join(tmp, `cache_${ts}`),
    seenPath: join(tmp, `seen_${ts}.json`),
    leadsPath: join(tmp, `leads_${ts}.json`),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('discover — basic extraction', () => {
  it('discovers leads from a valid Overpass response', async () => {
    const paths = makePaths('basic');
    const response = makeOverpassResponse([makeDentistNode(1001)]);

    const result = await discoverLeads({
      niche: 'Dental Clinic',
      city: 'Dhaka',
      limit: 10,
      config: TEST_CONFIG,
      fetchFn: mockFetch(response),
      delayFn: noopDelay,
      ...paths,
    });

    assert.equal(result.added, 1);
    assert.equal(result.total_osm, 1);

    const leads = JSON.parse(
      await readFile(paths.leadsPath!, 'utf8'),
    ) as Array<Record<string, unknown>>;

    assert.equal(leads.length, 1);
    assert.equal(leads[0]!['businessName'], 'Test Dental 1001');
    assert.equal(leads[0]!['workflowStatus'], 'new');
    assert.equal(leads[0]!['source'], 'OpenStreetMap contributors (ODbL)');
    assert.match(String(leads[0]!['placeId']), /^osm:node\//);
    assert.match(String(leads[0]!['sourceUrl']), /openstreetmap\.org/);
  });

  it('uses contact:phone as fallback when phone is absent', async () => {
    const paths = makePaths('phone-fallback');
    const node = makeDentistNode(1002, {
      'contact:phone': '+8801799999999',
    });
    // Remove the default phone tag
    (node as Record<string, unknown>)['tags'] = {
      name: 'Phone Fallback Clinic',
      amenity: 'dentist',
      website: 'https://phonefallback.com',
      'contact:phone': '+8801799999999',
    };

    const result = await discoverLeads({
      niche: 'Dental Clinic',
      city: 'Dhaka',
      limit: 10,
      config: TEST_CONFIG,
      fetchFn: mockFetch(makeOverpassResponse([node])),
      delayFn: noopDelay,
      ...paths,
    });

    assert.equal(result.added, 1);
    const leads = JSON.parse(await readFile(paths.leadsPath!, 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(leads[0]!['phone'], '+8801799999999');
  });

  it('uses contact:mobile as fallback when phone and contact:phone are absent', async () => {
    const paths = makePaths('mobile-fallback');
    const node = {
      type: 'node', id: 1003, lat: 23.7, lon: 90.4,
      tags: { name: 'Mobile Clinic', amenity: 'dentist', 'contact:mobile': '+8801888888888', website: 'https://mobileclinic.com' },
    };
    await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: mockFetch(makeOverpassResponse([node])), delayFn: noopDelay, ...paths,
    });
    const leads = JSON.parse(await readFile(paths.leadsPath!, 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(leads[0]!['phone'], '+8801888888888');
  });

  it('uses contact:website as fallback when website is absent', async () => {
    const paths = makePaths('website-fallback');
    const node = {
      type: 'node', id: 1004, lat: 23.7, lon: 90.4,
      tags: { name: 'Website Fallback', amenity: 'dentist', 'contact:website': 'https://contactsite.com' },
    };
    await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: mockFetch(makeOverpassResponse([node])), delayFn: noopDelay, ...paths,
    });
    const leads = JSON.parse(await readFile(paths.leadsPath!, 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(leads[0]!['websiteUrl'], 'https://contactsite.com');
  });

  it('uses contact:email as fallback for email', async () => {
    const paths = makePaths('email-fallback');
    const node = {
      type: 'node', id: 1005, lat: 23.7, lon: 90.4,
      tags: { name: 'Email Fallback', amenity: 'dentist', 'contact:email': 'info@emailfallback.com', website: 'https://emailfallback.com' },
    };
    await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: mockFetch(makeOverpassResponse([node])), delayFn: noopDelay, ...paths,
    });
    const leads = JSON.parse(await readFile(paths.leadsPath!, 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(leads[0]!['email'], 'info@emailfallback.com');
  });

  it('records OSM email tag as a candidate with source=osm_tag', async () => {
    const paths = makePaths('osm-email-tag');
    const node = {
      type: 'node', id: 1006, lat: 23.7, lon: 90.4,
      tags: { name: 'Tagged Email', amenity: 'dentist', email: 'tagged@example.com', website: 'https://taggedemail.com' },
    };
    await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: mockFetch(makeOverpassResponse([node])), delayFn: noopDelay, ...paths,
    });
    const leads = JSON.parse(await readFile(paths.leadsPath!, 'utf8')) as Array<Record<string, unknown>>;
    const candidates = leads[0]!['emailCandidates'] as Array<Record<string, unknown>>;
    assert.ok(candidates.length > 0);
    assert.equal(candidates[0]!['source'], 'osm_tag');
    assert.equal(candidates[0]!['email'], 'tagged@example.com');
  });

  it('handles way elements (uses center coordinates)', async () => {
    const paths = makePaths('way-element');
    const way = {
      type: 'way', id: 2001,
      center: { lat: 23.8, lon: 90.5 },
      tags: { name: 'Way Dental', amenity: 'dentist', website: 'https://waydental.com' },
    };
    const result = await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: mockFetch(makeOverpassResponse([way])), delayFn: noopDelay, ...paths,
    });
    assert.equal(result.added, 1);
    const leads = JSON.parse(await readFile(paths.leadsPath!, 'utf8')) as Array<Record<string, unknown>>;
    assert.match(String(leads[0]!['placeId']), /^osm:way\//);
  });
});

describe('discover — filtering and deduplication', () => {
  it('skips elements with no name', async () => {
    const paths = makePaths('no-name');
    const noName = { type: 'node', id: 3001, lat: 23.7, lon: 90.4, tags: { amenity: 'dentist' } };
    const withName = makeDentistNode(3002);
    const result = await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: mockFetch(makeOverpassResponse([noName, withName])), delayFn: noopDelay, ...paths,
    });
    assert.equal(result.added, 1);
  });

  it('skips businesses matching the chain blocklist (partial, case-insensitive)', async () => {
    const paths = makePaths('chain-block');
    const chain = { type: 'node', id: 4001, lat: 23.7, lon: 90.4,
      tags: { name: "McDonald's Dental", amenity: 'dentist', website: 'https://mcdentist.com' } };
    const result = await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: mockFetch(makeOverpassResponse([chain])), delayFn: noopDelay, ...paths,
    });
    assert.equal(result.added, 0);
    assert.equal(result.skipped_chain, 1);
  });

  it('deduplicates by place_id within a single run', async () => {
    const paths = makePaths('dedup-placeid');
    // Same OSM id → same place_id
    const node1 = makeDentistNode(5001);
    const node2 = makeDentistNode(5001); // duplicate id
    const result = await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: mockFetch(makeOverpassResponse([node1, node2])), delayFn: noopDelay, ...paths,
    });
    assert.equal(result.added, 1);
  });

  it('seen.json prevents re-surfacing the same lead on a second run', async () => {
    const paths = makePaths('seen-json');
    const node = makeDentistNode(6001);
    const response = makeOverpassResponse([node]);

    // First run
    const r1 = await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: mockFetch(response), delayFn: noopDelay, ...paths,
    });
    assert.equal(r1.added, 1);

    // Second run — same cache, seen.json now has the entry
    const r2 = await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: mockFetch(response), delayFn: noopDelay, ...paths,
    });
    assert.equal(r2.added, 0);
    assert.equal(r2.skipped_seen, 1);
  });

  it('deduplicates by website domain against already-imported leads', async () => {
    const paths = makePaths('dedup-domain');
    // First node provides the domain
    const node1 = makeDentistNode(7001);
    // Second node has a different id but same domain
    const node2 = {
      type: 'node', id: 7002, lat: 23.7, lon: 90.4,
      tags: { name: 'Alt Dental', amenity: 'dentist', website: 'https://testdental7001.com' },
    };
    const result = await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: mockFetch(makeOverpassResponse([node1, node2])), delayFn: noopDelay, ...paths,
    });
    assert.equal(result.added, 1);
    assert.equal(result.skipped_seen, 1);
  });
});

describe('discover — OSM data quality', () => {
  it('rating and reviewCount are always null for OSM leads', async () => {
    const paths = makePaths('null-review');
    const node = makeDentistNode(8001);
    await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: mockFetch(makeOverpassResponse([node])), delayFn: noopDelay, ...paths,
    });
    const leads = JSON.parse(await readFile(paths.leadsPath!, 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(leads[0]!['rating'], null);
    assert.equal(leads[0]!['reviewCount'], null);
  });

  it('no_website: sets primaryIssue=no_website and contactChannel=phone_only', async () => {
    const paths = makePaths('no-website-phone');
    const node = {
      type: 'node', id: 9001, lat: 23.7, lon: 90.4,
      tags: { name: 'Phone Only Clinic', amenity: 'dentist', phone: '+8801700000001' },
      // no website tag
    };
    await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: mockFetch(makeOverpassResponse([node])), delayFn: noopDelay, ...paths,
    });
    const leads = JSON.parse(await readFile(paths.leadsPath!, 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(leads[0]!['primaryIssue'], 'no_website');
    assert.equal(leads[0]!['contactChannel'], 'phone_only');
    assert.equal(leads[0]!['requiresManualAction'], true);
    assert.equal(leads[0]!['websiteUrl'], null);
  });

  it('no_website with OSM email tag routes to direct_email (not phone_only)', async () => {
    const paths = makePaths('no-website-email');
    const node = {
      type: 'node', id: 9002, lat: 23.7, lon: 90.4,
      tags: { name: 'Email Only Clinic', amenity: 'dentist', 'contact:email': 'direct@emailclinic.com' },
    };
    await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: mockFetch(makeOverpassResponse([node])), delayFn: noopDelay, ...paths,
    });
    const leads = JSON.parse(await readFile(paths.leadsPath!, 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(leads[0]!['primaryIssue'], 'no_website');
    assert.equal(leads[0]!['contactChannel'], 'direct_email');
    assert.equal(leads[0]!['email'], 'direct@emailclinic.com');
  });
});

describe('discover — cache', () => {
  it('uses the cache on the second run (fetch called only once)', async () => {
    const paths = makePaths('cache-reuse');
    const node = makeDentistNode(10001);
    let fetchCount = 0;

    const countingFetch: typeof fetch = async (url, init) => {
      fetchCount++;
      return mockFetch(makeOverpassResponse([node]))(url, init);
    };

    // First run — fetches and writes cache
    await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: countingFetch, delayFn: noopDelay, ...paths,
    });

    // Second run — different leads/seen paths to avoid seen dedup, same cache dir
    await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: countingFetch, delayFn: noopDelay,
      osmCacheDir: paths.osmCacheDir,
      seenPath: paths.seenPath! + '.2.json',
      leadsPath: paths.leadsPath! + '.2.json',
    });

    assert.equal(fetchCount, 1, 'fetch should only be called once; second run uses cache');
  });
});

describe('discover — backoff and errors', () => {
  it('retries on HTTP 429 and succeeds on the third attempt', async () => {
    const paths = makePaths('backoff-429');
    const node = makeDentistNode(11001);
    const goodResponse = makeOverpassResponse([node]);
    let callCount = 0;

    const backoffFetch: typeof fetch = async (_url, _init) => {
      callCount++;
      if (callCount <= 2) return new Response(null, { status: 429 });
      return new Response(JSON.stringify(goodResponse), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    };

    const result = await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
      fetchFn: backoffFetch, delayFn: noopDelay, ...paths,
    });

    assert.equal(result.added, 1);
    assert.equal(callCount, 3);
  });

  it('throws after exhausting all retry attempts on 429', async () => {
    const paths = makePaths('backoff-exhaust');
    const alwaysFail: typeof fetch = async () => new Response(null, { status: 429 });

    await assert.rejects(
      () =>
        discoverLeads({
          niche: 'Dental Clinic', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
          fetchFn: alwaysFail, delayFn: noopDelay, ...paths,
        }),
      (err: Error) => {
        assert.match(err.message, /429|retry|Max/i);
        return true;
      },
    );
  });

  it('throws when the niche has no configured OSM tags', async () => {
    const paths = makePaths('unknown-niche');
    await assert.rejects(
      () =>
        discoverLeads({
          niche: 'Unknown Niche XYZ', city: 'Dhaka', limit: 10, config: TEST_CONFIG,
          fetchFn: mockFetch(makeOverpassResponse([])), delayFn: noopDelay, ...paths,
        }),
      (err: Error) => {
        assert.match(err.message, /No OSM tags configured/i);
        return true;
      },
    );
  });
});

describe('discover — limits', () => {
  it('respects the hard cap (MAX_DISCOVER_PER_RUN / limit)', async () => {
    const paths = makePaths('hard-cap');
    const nodes = Array.from({ length: 20 }, (_, i) =>
      makeDentistNode(20000 + i, { website: `https://clinic${i}_cap.com` }),
    );
    const limitedConfig = { ...TEST_CONFIG, MAX_DISCOVER_PER_RUN: 5 };

    const result = await discoverLeads({
      niche: 'Dental Clinic', city: 'Dhaka', limit: 5, config: limitedConfig,
      fetchFn: mockFetch(makeOverpassResponse(nodes)), delayFn: noopDelay, ...paths,
    });

    assert.ok(result.added <= 5, `added ${result.added} but cap is 5`);
    assert.ok(result.skipped_cap > 0, 'expected some cap-skips');

    const leads = JSON.parse(await readFile(paths.leadsPath!, 'utf8')) as unknown[];
    assert.ok(leads.length <= 5);
  });
});
