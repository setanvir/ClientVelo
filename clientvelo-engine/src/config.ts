/**
 * config.ts — Environment variable loading and Zod validation.
 *
 * Imported at startup by cli.ts. Fails clearly with actionable messages if any
 * variable is missing or invalid. Never logs secret values.
 */

import 'dotenv/config';
import { z } from 'zod';

// ─── Helper: boolean env-var schema ──────────────────────────────────────────
// Accepts "true"/"false" strings; substitutes the default when unset or empty.

const boolStr = (defaultVal: 'true' | 'false') =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === '' ? defaultVal : v),
    z
      .enum(['true', 'false'], { message: 'Must be "true" or "false"' })
      .transform((v) => v === 'true'),
  );

// ─── Schema ───────────────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Safety guards — both must be satisfied before a real email is sent
  DRY_RUN: boolStr('true'),
  SEND_CONFIRMATION_REQUIRED: boolStr('true'),

  // Campaign identity
  CAMPAIGN_ID: z.string().min(1).default('campaign-1'),
  NICHE: z.string().min(1).default('Dental Clinic'),
  CITY: z.string().min(1).default('Dhaka'),
  COUNTRY: z.string().min(1).default('Bangladesh'),
  TIMEZONE: z.string().min(1).default('Asia/Dhaka'),

  // Lead qualification thresholds
  MIN_REVIEW_COUNT: z.coerce.number().int().nonnegative().default(30),

  // Sending limits
  DAILY_SEND_LIMIT: z.coerce.number().int().positive().max(20).default(10),
  MIN_DELAY_SECONDS: z.coerce.number().int().positive().default(240),
  MAX_DELAY_SECONDS: z.coerce.number().int().positive().default(360),
  MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
  DOMAIN_COOLDOWN_DAYS: z.coerce.number().int().nonnegative().default(30),
  BOUNCE_STOP_RATE: z.coerce.number().min(0).max(1).default(0.02),

  // Send window (HH:MM strings; timezone-aware enforcement in utils.ts)
  SEND_WINDOW_START: z.string().default('09:00'),
  SEND_WINDOW_END: z.string().default('17:00'),
  SEND_DAYS: z.string().default('Sun,Mon,Tue,Wed,Thu'),

  // SMTP (validated at send time, not here — empty strings are accepted)
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: boolStr('true'),
  SMTP_USER: z.string().default(''),
  SMTP_APP_PASSWORD: z.string().default(''),

  // Sender identity (validated at send time; empty strings accepted at startup)
  FROM_NAME: z.string().default(''),
  FROM_EMAIL: z.string().default(''),
  REPLY_TO: z.string().default(''),
  BUSINESS_NAME: z.string().default(''),
  POSTAL_ADDRESS: z.string().default(''),
  OPT_OUT_LINE: z
    .string()
    .default(
      'Reply with "unsubscribe" if you would prefer not to receive messages from me.',
    ),

  // Audit / PSI
  AUDIT_PSI_ENABLED: boolStr('false'),
  PAGESPEED_INSIGHTS_API_KEY: z.string().default(''),
  LOAD_SLOW_MS: z.coerce.number().int().positive().default(4000),
  PSI_POOR_SCORE: z.coerce.number().int().min(0).max(100).default(50),

  // Playwright / enrichment
  MAX_PAGES_PER_DOMAIN: z.coerce.number().int().positive().max(10).default(4),
  PAGE_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  PER_DOMAIN_DELAY_MS: z.coerce.number().int().nonnegative().default(2000),

  // OSM / Discover
  OVERPASS_URL: z
    .string()
    .url()
    .default('https://overpass-api.de/api/interpreter'),
  OVERPASS_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(25),
  MAX_DISCOVER_PER_RUN: z.coerce.number().int().positive().max(50).default(50),
  CHAIN_BLOCKLIST: z.string().default(''),
  USER_AGENT: z
    .string()
    .default('ClientVeloEngine/0.1 (contact: your-email@example.com)'),
});

// ─── Parse RAMP_SCHEDULE separately ───────────────────────────────────────────
// Comma-separated list of positive integers, one per campaign day.

function parseRampSchedule(raw: string | undefined): number[] {
  const fallback = [5, 8, 10, 12, 15, 18, 20];
  if (!raw || raw.trim() === '') return fallback;

  const parts = raw.split(',').map((s) => s.trim());
  const nums: number[] = [];

  for (let i = 0; i < parts.length; i++) {
    const s = parts[i] ?? '';
    const n = parseInt(s, 10);
    if (isNaN(n) || n <= 0) {
      throw new Error(
        `RAMP_SCHEDULE[${i}] must be a positive integer, got: "${s}"`,
      );
    }
    nums.push(n);
  }
  return nums;
}

// ─── Helper: split comma-separated env var ────────────────────────────────────

function splitTrim(raw: string | undefined, fallback: string[]): string[] {
  if (!raw || raw.trim() === '') return fallback;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Niche → OSM tag map ──────────────────────────────────────────────────────
// Each niche maps to one or more OSM key=value tag filters.
// Verify tags for new niches at: https://taginfo.openstreetmap.org/

const NICHE_TAG_MAP: Record<string, string[]> = {
  'Dental Clinic': ['amenity=dentist', 'healthcare=dentist'],
  Salon: ['shop=hairdresser', 'shop=beauty'],
  HVAC: ['craft=hvac'],
  Restaurant: ['amenity=restaurant', 'amenity=fast_food'],
  Gym: ['leisure=fitness_centre', 'leisure=sports_centre'],
  Pharmacy: ['amenity=pharmacy'],
  Optician: ['shop=optician'],
  Physiotherapy: ['healthcare=physiotherapist'],
  Veterinary: ['amenity=veterinary'],
};

// ─── Validate and export ──────────────────────────────────────────────────────

// RAMP_SCHEDULE must be parsed before the main schema validation
let rampSchedule: number[];
try {
  rampSchedule = parseRampSchedule(process.env['RAMP_SCHEDULE']);
} catch (err) {
  console.error(`[config] ${(err as Error).message}`);
  process.exit(1);
}

const result = ConfigSchema.safeParse(process.env);
if (!result.success) {
  console.error('[config] Invalid environment configuration:');
  for (const issue of result.error.issues) {
    const field = issue.path.join('.') || '(root)';
    console.error(`  ${field}: ${issue.message}`);
  }
  process.exit(1);
}

const raw = result.data;

export const config = Object.freeze({
  ...raw,
  rampSchedule,
  sendDays: splitTrim(process.env['SEND_DAYS'], [
    'Sun',
    'Mon',
    'Tue',
    'Wed',
    'Thu',
  ]),
  chainBlocklist: splitTrim(process.env['CHAIN_BLOCKLIST'], []),
  nicheTagMap: NICHE_TAG_MAP,
});

export type Config = typeof config;
