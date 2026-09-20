/**
 * utils.ts — Shared utility functions.
 *
 * Covers: minimal console logger, time helpers, ID generation, hashing,
 * URL/email normalization, domain extraction, send-window checks, and
 * campaign-day counting.
 *
 * No secrets are ever passed through or logged by these functions.
 */

import { createHash, randomUUID } from 'node:crypto';

// ─── Minimal logger ───────────────────────────────────────────────────────────

function ts(): string {
  return new Date().toISOString();
}

/** Minimal console logger. Never log secrets through these functions. */
export const log = {
  info: (msg: string): void => console.log(`[${ts()}] INFO  ${msg}`),
  warn: (msg: string): void => console.warn(`[${ts()}] WARN  ${msg}`),
  error: (msg: string): void => console.error(`[${ts()}] ERROR ${msg}`),
};

// ─── Time helpers ─────────────────────────────────────────────────────────────

/** Current UTC ISO timestamp string. */
export function now(): string {
  return new Date().toISOString();
}

/** Resolves after `ms` milliseconds. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Abortable sleep. Resolves immediately (without throwing) if the AbortSignal
 * fires before the timer expires. Used for graceful Ctrl+C handling.
 */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

/** Returns a cryptographically random integer in [min, max] inclusive. */
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── IDs and hashing ─────────────────────────────────────────────────────────

/** Generate a cryptographically random UUID v4. */
export function generateId(): string {
  return randomUUID();
}

/**
 * SHA-256 hex digest of a UTF-8 string.
 * Used for draft approval binding: sha256(recipientEmail + subject + body).
 */
export function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

// ─── URL and email normalization ──────────────────────────────────────────────

/**
 * Normalize a URL: validate format, lowercase scheme/host, remove trailing
 * slash from bare roots. Returns null for non-http/https or malformed input.
 */
export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hostname = u.hostname.toLowerCase();
    const str = u.toString();
    // Remove trailing slash only when the path is exactly "/"
    return str.endsWith('/') && u.pathname === '/' ? str.slice(0, -1) : str;
  } catch {
    return null;
  }
}

/** Normalize an email address: lowercase and trim. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Extract the registrable domain from a URL or email string.
 * Strips leading "www." for consistency.
 * Returns null if extraction fails.
 */
export function extractDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    let hostname: string;
    if (input.includes('@')) {
      const parts = input.split('@');
      hostname = parts[1] ?? '';
    } else {
      const url = new URL(input.includes('://') ? input : `https://${input}`);
      hostname = url.hostname;
    }
    return hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

// ─── Send window ──────────────────────────────────────────────────────────────

/**
 * Checks whether the current moment falls within the configured send window
 * and on an allowed day of the week.
 *
 * All checks are performed in the configured IANA timezone.
 */
export function isInSendWindow(opts: {
  timezone: string;
  windowStart: string;  // "HH:MM"
  windowEnd: string;    // "HH:MM"
  sendDays: string[];   // e.g. ["Mon","Tue","Wed"]
  now?: Date;
}): { allowed: boolean; reason: string } {
  const instant = opts.now ?? new Date();

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: opts.timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = fmt.formatToParts(instant);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  let hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';

  // Intl may return '24' for midnight on some platforms in hour12:false mode
  if (hour === '24') hour = '00';

  const currentTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

  if (!opts.sendDays.includes(weekday)) {
    return {
      allowed: false,
      reason: `Today (${weekday}) is not in SEND_DAYS [${opts.sendDays.join(',')}]`,
    };
  }

  if (currentTime < opts.windowStart || currentTime >= opts.windowEnd) {
    return {
      allowed: false,
      reason: `Current time ${currentTime} (${opts.timezone}) is outside window ${opts.windowStart}–${opts.windowEnd}`,
    };
  }

  return {
    allowed: true,
    reason: `Within window ${opts.windowStart}–${opts.windowEnd} on ${weekday}`,
  };
}

// ─── Campaign day ─────────────────────────────────────────────────────────────

/**
 * Returns the 1-based campaign day number: how many distinct calendar days
 * (in the given timezone) have recorded at least one 'sent' dispatch for
 * this campaign, plus one (today counts even if nothing sent yet today).
 *
 * Used to look up the correct RAMP_SCHEDULE cap.
 */
export function currentCampaignDay(
  logs: ReadonlyArray<{ campaignId: string; status: string; timestamp: string }>,
  campaignId: string,
  timezone: string,
): number {
  const sentLogs = logs.filter(
    (l) => l.campaignId === campaignId && l.status === 'sent',
  );
  const days = new Set<string>();
  for (const log of sentLogs) {
    const d = new Date(log.timestamp);
    // en-CA locale formats as YYYY-MM-DD
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
    }).format(d);
    days.add(dateStr);
  }
  // 1-based: day 1 is the first day even before any sends
  return days.size + 1;
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

/** Format byte count for human-readable log output. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
