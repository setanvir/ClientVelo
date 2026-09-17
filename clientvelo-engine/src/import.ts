/**
 * import.ts — CSV lead import command.
 *
 * Validates required columns, normalizes URLs, deduplicates against existing
 * leads, and writes invalid rows to a timestamped error report (never silent
 * drops). Safe to re-run — already-imported leads are skipped.
 *
 * Implements the LeadProvider interface for use as a source adapter.
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { normalizeUrl, generateId, now, extractDomain, log } from './utils.js';
import { readLeads, writeLeads, PATHS } from './store.js';
import type { Lead } from './types.js';

// ─── Column definitions ───────────────────────────────────────────────────────

const REQUIRED_COLUMNS = [
  'businessName',
  'category',
  'city',
  'country',
] as const;

const ALL_COLUMNS = [
  'businessName',
  'category',
  'city',
  'country',
  'websiteUrl',
  'phone',
  'rating',
  'reviewCount',
  'contactName',
  'source',
  'sourceUrl',
] as const;

type CsvRow = Record<string, string>;

// ─── CSV parsing ──────────────────────────────────────────────────────────────

/** Parse a single CSV line, handling RFC 4180 quoted fields and escaped quotes. */
function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped double-quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/** Parse full CSV content into header + row objects. */
function parseCsv(content: string): { headers: string[]; rows: CsvRow[] } {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '');

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvRow(lines[0] ?? '').map((h) => h.trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvRow(lines[i] ?? '');
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() ?? '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

// ─── Row validation ───────────────────────────────────────────────────────────

interface RowError {
  rowNumber: number;
  row: CsvRow;
  errors: string[];
}

function validateRow(row: CsvRow, rowNumber: number): RowError | null {
  const errors: string[] = [];

  // Required fields must be non-empty
  for (const col of REQUIRED_COLUMNS) {
    if (!row[col] || row[col]!.trim() === '') {
      errors.push(`Missing required field: ${col}`);
    }
  }

  // URL must be valid http/https if provided
  if (row['websiteUrl'] && row['websiteUrl'].trim()) {
    const normalized = normalizeUrl(row['websiteUrl']!);
    if (normalized === null) {
      errors.push(`Invalid URL: "${row['websiteUrl']}"`);
    }
  }

  // Rating must be 0–5 if provided
  if (row['rating'] && row['rating'].trim()) {
    const r = parseFloat(row['rating']!);
    if (isNaN(r) || r < 0 || r > 5) {
      errors.push(`Invalid rating (expected 0–5): "${row['rating']}"`);
    }
  }

  // reviewCount must be a non-negative integer if provided
  if (row['reviewCount'] && row['reviewCount'].trim()) {
    const c = parseInt(row['reviewCount']!, 10);
    if (isNaN(c) || c < 0) {
      errors.push(`Invalid reviewCount: "${row['reviewCount']}"`);
    }
  }

  return errors.length > 0 ? { rowNumber, row, errors } : null;
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * A lead is a duplicate if any existing lead shares:
 *   - The same normalized website domain, OR
 *   - The same businessName + city (case-insensitive).
 */
function isDuplicate(row: CsvRow, existing: Lead[]): boolean {
  const rawUrl = row['websiteUrl'];
  const normalized = rawUrl ? normalizeUrl(rawUrl) : null;
  const domain = normalized ? extractDomain(normalized) : null;
  const nameCity = `${(row['businessName'] ?? '').toLowerCase().trim()}|${(row['city'] ?? '').toLowerCase().trim()}`;

  return existing.some((lead) => {
    if (domain && lead.websiteUrl) {
      const existingDomain = extractDomain(lead.websiteUrl);
      if (existingDomain && existingDomain === domain) return true;
    }
    const existingNameCity = `${lead.businessName.toLowerCase().trim()}|${lead.city.toLowerCase().trim()}`;
    return existingNameCity === nameCity;
  });
}

// ─── Row → Lead ───────────────────────────────────────────────────────────────

function rowToLead(row: CsvRow): Lead {
  const rawWebsite = row['websiteUrl'];
  const websiteUrl = rawWebsite ? normalizeUrl(rawWebsite) : null;
  const rawRating = row['rating'];
  const rawReviewCount = row['reviewCount'];
  const rating = rawRating && rawRating.trim() ? parseFloat(rawRating) : null;
  const reviewCount =
    rawReviewCount && rawReviewCount.trim()
      ? parseInt(rawReviewCount, 10)
      : null;

  const timestamp = now();

  return {
    id: generateId(),
    businessName: (row['businessName'] ?? '').trim(),
    category: (row['category'] ?? '').trim(),
    city: (row['city'] ?? '').trim(),
    country: (row['country'] ?? '').trim(),
    websiteUrl: websiteUrl,
    phone: row['phone']?.trim() || null,
    source: row['source']?.trim() || 'csv',
    sourceUrl: row['sourceUrl']?.trim() || null,
    sourceCheckedAt: timestamp,
    rating: rating !== null && !isNaN(rating) ? rating : null,
    reviewCount:
      reviewCount !== null && !isNaN(reviewCount) ? reviewCount : null,
    contactName: row['contactName']?.trim() || null,
    createdAt: timestamp,
    updatedAt: timestamp,

    // Contact (filled by enrich in Phase 2)
    contactChannel: null,
    emailCandidates: [],
    email: null,
    emailType: null,
    chosenEmailReason: null,
    requiresManualAction: false,

    // Validation (filled by validate in Phase 3)
    emailValidationStatus: 'not_checked',

    // Audit (filled by audit in Phase 2)
    auditStatus: 'not_checked',
    psiStatus: 'disabled',
    screenshotPath: null,
    audit: null,
    primaryIssue: null,
    evidenceUrl: null,
    evidenceText: null,
    personalizationNote: null,

    // Scoring (filled by qualify in Phase 3)
    qualificationScore: null,
    qualificationReasons: [],

    workflowStatus: 'new',

    // OSM fields are null for CSV-imported leads
    placeId: null,
    osmSocial: null,
  };
}

// ─── Error report ─────────────────────────────────────────────────────────────

async function writeErrorReport(
  errorsDir: string,
  errors: RowError[],
): Promise<string> {
  await mkdir(errorsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = join(errorsDir, `import_errors_${timestamp}.csv`);

  const headerRow = ['rowNumber', 'errors', ...ALL_COLUMNS].join(',');
  const dataRows = errors.map((e) => {
    const errCell = `"${e.errors.join('; ').replace(/"/g, '""')}"`;
    const rowCells = ALL_COLUMNS.map(
      (col) => `"${(e.row[col] ?? '').replace(/"/g, '""')}"`,
    ).join(',');
    return `${e.rowNumber},${errCell},${rowCells}`;
  });

  await writeFile(reportPath, [headerRow, ...dataRows].join('\n'), 'utf8');
  return reportPath;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ImportResult {
  imported: number;
  duplicates: number;
  invalidRows: number;
  errorReportPath: string | null;
}

export interface ImportOptions {
  filePath: string;
  campaignId: string;
  /** Override for testing (defaults to PATHS.leadsRaw) */
  leadsPath?: string;
  /** Override for testing (defaults to PATHS.errors) */
  errorsDir?: string;
}

export async function importCsv(opts: ImportOptions): Promise<ImportResult> {
  const leadsPath = opts.leadsPath ?? PATHS.leadsRaw;
  const errorsDir = opts.errorsDir ?? PATHS.errors;

  // ── Path safety ─────────────────────────────────────────────────────────────
  // Reject paths containing null bytes or other ASCII control characters
  if (/[\x00-\x1f]/.test(opts.filePath)) {
    throw new Error(
      `[import] Invalid file path: contains control characters`,
    );
  }
  const resolvedPath = resolve(opts.filePath);

  // ── Read CSV ────────────────────────────────────────────────────────────────
  let content: string;
  try {
    content = await readFile(resolvedPath, 'utf8');
  } catch (err: unknown) {
    throw new Error(
      `[import] Cannot read file "${opts.filePath}": ${(err as Error).message}`,
    );
  }

  const { headers, rows } = parseCsv(content);

  if (headers.length === 0) {
    throw new Error(
      `[import] CSV file is empty or has no headers: ${opts.filePath}`,
    );
  }

  // ── Validate required column headers ────────────────────────────────────────
  const missingCols = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  if (missingCols.length > 0) {
    throw new Error(
      `[import] CSV is missing required columns: ${missingCols.join(', ')}`,
    );
  }

  // ── Load existing leads ──────────────────────────────────────────────────────
  const existing = await readLeads(leadsPath);
  log.info(
    `[import] Loaded ${existing.length} existing lead(s) from ${leadsPath}`,
  );

  // ── Process rows ──────────────────────────────────────────────────────────────
  const newLeads: Lead[] = [];
  const errors: RowError[] = [];
  let duplicateCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNumber = i + 2; // 1-based, accounting for the header row

    const rowError = validateRow(row, rowNumber);
    if (rowError) {
      errors.push(rowError);
      log.warn(
        `[import] Row ${rowNumber}: invalid — ${rowError.errors.join('; ')}`,
      );
      continue;
    }

    // Check for duplicates against both existing leads and already-queued new leads
    const allSoFar = [...existing, ...newLeads];
    if (isDuplicate(row, allSoFar)) {
      duplicateCount++;
      log.info(
        `[import] Row ${rowNumber}: duplicate skipped (${row['businessName']})`,
      );
      continue;
    }

    newLeads.push(rowToLead(row));
  }

  // ── Write error report (never silently drop invalid rows) ─────────────────────
  let errorReportPath: string | null = null;
  if (errors.length > 0) {
    errorReportPath = await writeErrorReport(errorsDir, errors);
    log.warn(
      `[import] ${errors.length} invalid row(s) written to ${errorReportPath}`,
    );
  }

  // ── Persist ───────────────────────────────────────────────────────────────────
  if (newLeads.length > 0) {
    const merged = [...existing, ...newLeads];
    await writeLeads(merged, leadsPath);
    log.info(
      `[import] Saved ${merged.length} total lead(s) (${newLeads.length} new) to ${leadsPath}`,
    );
  } else {
    log.info(`[import] No new leads to save.`);
  }

  return {
    imported: newLeads.length,
    duplicates: duplicateCount,
    invalidRows: errors.length,
    errorReportPath,
  };
}
