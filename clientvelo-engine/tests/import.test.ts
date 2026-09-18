/**
 * import.test.ts — Tests for CSV lead import (import.ts).
 *
 * No network calls. All I/O uses temp directories. Config is never imported
 * directly — campaignId is passed as a parameter.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importCsv } from '../src/import.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_CSV = [
  'businessName,category,city,country,websiteUrl,phone,rating,reviewCount,contactName,source,sourceUrl',
  'ABC Dental,Dental Clinic,Dhaka,Bangladesh,https://abcdental.com,+880123456789,4.5,120,Dr. Khan,manual,https://maps.example.com/abc',
  'XYZ Smile,Dental Clinic,Dhaka,Bangladesh,https://xyzsmile.com,+880987654321,4.2,85,,manual,',
].join('\n');

// ─── Helpers ──────────────────────────────────────────────────────────────────

let tmp: string;

before(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'cv-import-'));
});

after(async () => {
  await rm(tmp, { recursive: true, force: true });
});

/** Create unique paths so tests are fully isolated */
function makePaths(label: string) {
  const ts = `${Date.now()}_${label}`;
  return {
    leadsPath: join(tmp, `leads_${ts}.json`),
    errorsDir: join(tmp, `errors_${ts}`),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('import — happy path', () => {
  it('imports all valid rows', async () => {
    const csvPath = join(tmp, 'valid.csv');
    await writeFile(csvPath, VALID_CSV, 'utf8');
    const paths = makePaths('valid');

    const result = await importCsv({
      filePath: csvPath,
      campaignId: 'test-1',
      ...paths,
    });

    assert.equal(result.imported, 2);
    assert.equal(result.duplicates, 0);
    assert.equal(result.invalidRows, 0);
    assert.equal(result.errorReportPath, null);
  });

  it('assigns UUIDs and correct default field values to each lead', async () => {
    const csvPath = join(tmp, 'defaults.csv');
    await writeFile(csvPath, VALID_CSV, 'utf8');
    const paths = makePaths('defaults');
    await importCsv({ filePath: csvPath, campaignId: 'test-1', ...paths });

    const leads = JSON.parse(await readFile(paths.leadsPath, 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(leads.length, 2);

    const lead = leads[0]!;
    assert.match(String(lead['id']), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(lead['workflowStatus'], 'new');
    assert.equal(lead['emailValidationStatus'], 'not_checked');
    assert.equal(lead['auditStatus'], 'not_checked');
    assert.deepEqual(lead['emailCandidates'], []);
    assert.equal(lead['email'], null);
    assert.equal(lead['contactChannel'], null);
    assert.equal(lead['placeId'], null);
    assert.equal(lead['osmSocial'], null);
  });

  it('normalizes URLs (removes trailing slash from root)', async () => {
    const csv = [
      'businessName,category,city,country,websiteUrl',
      'Trail Corp,Dental Clinic,Dhaka,Bangladesh,https://trail.com/',
    ].join('\n');
    const csvPath = join(tmp, 'trail.csv');
    await writeFile(csvPath, csv, 'utf8');
    const paths = makePaths('trail');
    await importCsv({ filePath: csvPath, campaignId: 'test-1', ...paths });

    const leads = JSON.parse(await readFile(paths.leadsPath, 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(leads[0]!['websiteUrl'], 'https://trail.com');
  });

  it('sets rating and reviewCount to null when columns are blank', async () => {
    const csv = [
      'businessName,category,city,country,websiteUrl,phone,rating,reviewCount',
      'NullReview,Dental Clinic,Dhaka,Bangladesh,https://nullreview.com,,,',
    ].join('\n');
    const csvPath = join(tmp, 'null-review.csv');
    await writeFile(csvPath, csv, 'utf8');
    const paths = makePaths('null-review');
    await importCsv({ filePath: csvPath, campaignId: 'test-1', ...paths });

    const leads = JSON.parse(await readFile(paths.leadsPath, 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(leads[0]!['rating'], null);
    assert.equal(leads[0]!['reviewCount'], null);
  });

  it('sets source to "csv" when the source column is absent', async () => {
    const csv = [
      'businessName,category,city,country,websiteUrl',
      'NoSource Clinic,Dental Clinic,Dhaka,Bangladesh,https://nosource.com',
    ].join('\n');
    const csvPath = join(tmp, 'no-source.csv');
    await writeFile(csvPath, csv, 'utf8');
    const paths = makePaths('no-source');
    await importCsv({ filePath: csvPath, campaignId: 'test-1', ...paths });

    const leads = JSON.parse(await readFile(paths.leadsPath, 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(leads[0]!['source'], 'csv');
  });

  it('handles CSV with only a header row (no data rows)', async () => {
    const csv = 'businessName,category,city,country,websiteUrl\n';
    const csvPath = join(tmp, 'header-only.csv');
    await writeFile(csvPath, csv, 'utf8');
    const paths = makePaths('header-only');
    const result = await importCsv({ filePath: csvPath, campaignId: 'test-1', ...paths });
    assert.equal(result.imported, 0);
  });
});

describe('import — deduplication', () => {
  it('deduplicates by website domain on a re-run', async () => {
    const csvPath = join(tmp, 'dedup.csv');
    await writeFile(csvPath, VALID_CSV, 'utf8');
    const paths = makePaths('dedup');

    const r1 = await importCsv({ filePath: csvPath, campaignId: 'test-1', ...paths });
    assert.equal(r1.imported, 2);

    // Same CSV, same file — should skip both as duplicates
    const r2 = await importCsv({ filePath: csvPath, campaignId: 'test-1', ...paths });
    assert.equal(r2.imported, 0);
    assert.equal(r2.duplicates, 2);
  });

  it('deduplicates by businessName+city when no websiteUrl', async () => {
    const csv = [
      'businessName,category,city,country,websiteUrl',
      'My Salon,Salon,Dhaka,Bangladesh,',
      'My Salon,Salon,Dhaka,Bangladesh,',
    ].join('\n');
    const csvPath = join(tmp, 'nourl-dedup.csv');
    await writeFile(csvPath, csv, 'utf8');
    const paths = makePaths('nourl-dedup');

    const result = await importCsv({ filePath: csvPath, campaignId: 'test-1', ...paths });
    assert.equal(result.imported, 1);
    assert.equal(result.duplicates, 1);
  });

  it('treats URLs with same domain as duplicates regardless of path', async () => {
    const csv = [
      'businessName,category,city,country,websiteUrl',
      'Biz A,Dental Clinic,Dhaka,Bangladesh,https://samedomain.com/page1',
      'Biz B,Dental Clinic,Dhaka,Bangladesh,https://samedomain.com/page2',
    ].join('\n');
    const csvPath = join(tmp, 'same-domain.csv');
    await writeFile(csvPath, csv, 'utf8');
    const paths = makePaths('same-domain');

    const result = await importCsv({ filePath: csvPath, campaignId: 'test-1', ...paths });
    assert.equal(result.imported, 1);
    assert.equal(result.duplicates, 1);
  });
});

describe('import — validation and error reporting', () => {
  it('rejects a CSV with missing required columns (businessName)', async () => {
    const csv = 'websiteUrl,phone\nhttps://example.com,1234';
    const csvPath = join(tmp, 'missing-cols.csv');
    await writeFile(csvPath, csv, 'utf8');
    const paths = makePaths('missing-cols');

    await assert.rejects(
      () => importCsv({ filePath: csvPath, campaignId: 'test-1', ...paths }),
      (err: Error) => {
        assert.match(err.message, /missing required columns/i);
        return true;
      },
    );
  });

  it('writes invalid rows to an error report, does NOT import them', async () => {
    const csv = [
      'businessName,category,city,country,websiteUrl',
      ',Dental Clinic,Dhaka,Bangladesh,https://valid.com',  // missing businessName
      'GoodBiz,Dental Clinic,Dhaka,Bangladesh,https://goodbiz.com',
    ].join('\n');
    const csvPath = join(tmp, 'with-errors.csv');
    await writeFile(csvPath, csv, 'utf8');
    const paths = makePaths('with-errors');

    const result = await importCsv({ filePath: csvPath, campaignId: 'test-1', ...paths });

    assert.equal(result.imported, 1, 'Only GoodBiz should be imported');
    assert.equal(result.invalidRows, 1);
    assert.notEqual(result.errorReportPath, null);

    const report = await readFile(result.errorReportPath!, 'utf8');
    assert.ok(report.includes('rowNumber'));
    assert.ok(report.includes('Missing required field'));
  });

  it('flags an invalid URL in the error report', async () => {
    const csv = [
      'businessName,category,city,country,websiteUrl',
      'Bad URL Biz,Dental Clinic,Dhaka,Bangladesh,not-a-valid-url',
    ].join('\n');
    const csvPath = join(tmp, 'bad-url.csv');
    await writeFile(csvPath, csv, 'utf8');
    const paths = makePaths('bad-url');

    const result = await importCsv({ filePath: csvPath, campaignId: 'test-1', ...paths });
    assert.equal(result.imported, 0);
    assert.equal(result.invalidRows, 1);
    assert.notEqual(result.errorReportPath, null);
  });

  it('flags an out-of-range rating in the error report', async () => {
    const csv = [
      'businessName,category,city,country,websiteUrl,rating',
      'Bad Rating,Dental Clinic,Dhaka,Bangladesh,https://badrating.com,7.5',
    ].join('\n');
    const csvPath = join(tmp, 'bad-rating.csv');
    await writeFile(csvPath, csv, 'utf8');
    const paths = makePaths('bad-rating');

    const result = await importCsv({ filePath: csvPath, campaignId: 'test-1', ...paths });
    assert.equal(result.imported, 0);
    assert.equal(result.invalidRows, 1);
  });
});

describe('import — safety', () => {
  it('rejects file paths containing null bytes (path traversal protection)', async () => {
    const paths = makePaths('null-byte');
    await assert.rejects(
      () =>
        importCsv({
          filePath: '\x00../../etc/passwd',
          campaignId: 'test-1',
          ...paths,
        }),
      (err: Error) => {
        assert.match(err.message, /control characters|Invalid file path/i);
        return true;
      },
    );
  });

  it('throws with a clear message for a non-existent file', async () => {
    const paths = makePaths('ghost');
    await assert.rejects(
      () =>
        importCsv({
          filePath: join(tmp, 'ghost_file_that_does_not_exist.csv'),
          campaignId: 'test-1',
          ...paths,
        }),
      (err: Error) => {
        assert.match(err.message, /Cannot read file/i);
        return true;
      },
    );
  });

  it('throws on a completely empty file', async () => {
    const csvPath = join(tmp, 'empty-file.csv');
    await writeFile(csvPath, '', 'utf8');
    const paths = makePaths('empty-file');

    await assert.rejects(
      () => importCsv({ filePath: csvPath, campaignId: 'test-1', ...paths }),
      (err: Error) => {
        assert.match(err.message, /empty|no headers/i);
        return true;
      },
    );
  });

  it('handles CRLF line endings correctly', async () => {
    const csv =
      'businessName,category,city,country,websiteUrl\r\nCRLF Clinic,Dental Clinic,Dhaka,Bangladesh,https://crlfclinic.com\r\n';
    const csvPath = join(tmp, 'crlf.csv');
    await writeFile(csvPath, csv, 'utf8');
    const paths = makePaths('crlf');

    const result = await importCsv({ filePath: csvPath, campaignId: 'test-1', ...paths });
    assert.equal(result.imported, 1);
    assert.equal(result.invalidRows, 0);
  });
});
