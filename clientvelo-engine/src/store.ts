/**
 * store.ts — Crash-safe atomic JSON read/write with Zod schema validation.
 *
 * Write protocol: write content → .tmp file → fsync → rename to target.
 * Read protocol: return [] for missing files; throw on malformed JSON or
 *   schema validation errors (never silently corrupt data).
 */

import { readFile, writeFile, mkdir, rename, open, stat, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import {
  LeadSchema,
  DraftEntrySchema,
  DispatchLogSchema,
  SuppressionEntrySchema,
  SeenEntrySchema,
  JobEntrySchema,
} from './types.js';
import type {
  Lead,
  DraftEntry,
  DispatchLog,
  SuppressionEntry,
  SeenEntry,
  JobEntry,
} from './types.js';

// ─── Default data paths ───────────────────────────────────────────────────────

const DATA_DIR = 'data';

export const PATHS = {
  leadsRaw: join(DATA_DIR, 'leads_raw.json'),
  leadsEnriched: join(DATA_DIR, 'leads_enriched.json'),
  leadsValidated: join(DATA_DIR, 'leads_validated.json'),
  drafts: join(DATA_DIR, 'drafts.json'),
  dispatchLogs: join(DATA_DIR, 'dispatch_logs.json'),
  suppression: join(DATA_DIR, 'suppression.json'),
  seen: join(DATA_DIR, 'seen.json'),
  screenshots: join(DATA_DIR, 'screenshots'),
  errors: join(DATA_DIR, 'errors'),
  osmCache: join(DATA_DIR, 'osm_cache'),
  jobsDir: join(DATA_DIR, 'jobs'),
} as const;

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Read a JSON array file and validate with a Zod schema.
 *
 * @returns Empty array if the file does not exist.
 * @throws  If the file exists but contains malformed JSON or fails schema validation.
 */
export async function readJsonArray<T>(
  filePath: string,
  schema: z.ZodType<T[]>,
): Promise<T[]> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`[store] Malformed JSON in ${filePath}`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const summary = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(
      `[store] Schema validation failed for ${filePath}: ${summary}`,
    );
  }
  return result.data;
}

/**
 * Atomically write a JSON array to disk.
 *
 * Protocol: write to <path>.tmp → fsync → rename.
 * Creates parent directories as needed.
 * On POSIX this is atomic; on Windows it is near-atomic (rename is not
 * atomic when the destination file already exists, but is crash-safe).
 */
export async function writeJsonArray<T>(
  filePath: string,
  data: T[],
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  const content = JSON.stringify(data, null, 2);

  // Write to temp file
  await writeFile(tmpPath, content, 'utf8');

  // fsync: flush OS write buffers to storage before the rename
  const fh = await open(tmpPath, 'r+');
  try {
    await fh.sync();
  } finally {
    await fh.close();
  }

  // Atomic rename
  await rename(tmpPath, filePath);
}

const LOCK_STALE_MS = 5000;
const LOCK_RETRY_MS = 50;

/**
 * Safely read-modify-write a JSON array using a lockfile.
 */
export async function updateJson<T>(
  filePath: string,
  schema: z.ZodType<T[]>,
  updater: (data: T[]) => T[] | Promise<T[]>
): Promise<void> {
  const lockPath = `${filePath}.lock`;

  while (true) {
    try {
      const fh = await open(lockPath, 'wx');
      await fh.close();
      break;
    } catch (err: any) {
      if (err.code !== 'EEXIST') throw err;
      try {
        const stats = await stat(lockPath);
        if (Date.now() - stats.mtimeMs > LOCK_STALE_MS) {
          try {
            await unlink(lockPath);
          } catch (unlinkErr: any) {
            if (unlinkErr.code !== 'ENOENT') throw unlinkErr;
          }
        }
      } catch (statErr: any) {
        if (statErr.code !== 'ENOENT') throw statErr;
      }
      // wait and retry
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    }
  }

  try {
    const data = await readJsonArray(filePath, schema);
    const updated = await updater(data);
    await writeJsonArray(filePath, updated);
  } finally {
    try {
      await unlink(lockPath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error(`[store] Failed to remove lockfile ${lockPath}:`, err.message);
      }
    }
  }
}

// ─── Typed convenience wrappers ───────────────────────────────────────────────

const LeadArraySchema = z.array(LeadSchema);
const DraftArraySchema = z.array(DraftEntrySchema);
const DispatchLogArraySchema = z.array(DispatchLogSchema);
const SuppressionArraySchema = z.array(SuppressionEntrySchema);
const SeenArraySchema = z.array(SeenEntrySchema);

export const readLeads = (
  filePath: string = PATHS.leadsRaw,
): Promise<Lead[]> => readJsonArray(filePath, LeadArraySchema);

export const writeLeads = (
  data: Lead[],
  filePath: string = PATHS.leadsRaw,
): Promise<void> => writeJsonArray(filePath, data);

export const readDrafts = (filePath: string = PATHS.drafts): Promise<DraftEntry[]> =>
  readJsonArray(filePath, DraftArraySchema);

export const writeDrafts = (data: DraftEntry[], filePath: string = PATHS.drafts): Promise<void> =>
  writeJsonArray(filePath, data);

export const readDispatchLogs = (filePath: string = PATHS.dispatchLogs): Promise<DispatchLog[]> =>
  readJsonArray(filePath, DispatchLogArraySchema);

export const writeDispatchLogs = (data: DispatchLog[], filePath: string = PATHS.dispatchLogs): Promise<void> =>
  writeJsonArray(filePath, data);

export const readSuppression = (filePath: string = PATHS.suppression): Promise<SuppressionEntry[]> =>
  readJsonArray(filePath, SuppressionArraySchema);

export const writeSuppression = (data: SuppressionEntry[], filePath: string = PATHS.suppression): Promise<void> =>
  writeJsonArray(filePath, data);

export const readSeen = (
  filePath: string = PATHS.seen,
): Promise<SeenEntry[]> => readJsonArray(filePath, SeenArraySchema);

export const writeSeen = (
  data: SeenEntry[],
  filePath: string = PATHS.seen,
): Promise<void> => writeJsonArray(filePath, data);
