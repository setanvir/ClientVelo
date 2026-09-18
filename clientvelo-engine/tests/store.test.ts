/**
 * store.test.ts — Tests for atomic JSON read/write and locking (store.ts).
 *
 * All I/O uses a per-test temp directory. No mocks needed — tests exercise
 * real fs operations (readJsonArray, writeJsonArray, updateJson).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { readJsonArray, writeJsonArray, updateJson } from '../src/store.js';

const SimpleSchema = z.array(z.object({ id: z.string(), value: z.number() }));
type SimpleItem = z.infer<typeof SimpleSchema>[number];

describe('store — readJsonArray', () => {
  let tmp: string;
  before(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'cv-store-read-'));
  });
  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('returns [] for a missing file', async () => {
    const result = await readJsonArray(
      join(tmp, 'nonexistent.json'),
      SimpleSchema,
    );
    assert.deepEqual(result, []);
  });

  it('throws on malformed JSON', async () => {
    const p = join(tmp, 'bad.json');
    await writeFile(p, '{ this is not valid json', 'utf8');
    await assert.rejects(
      () => readJsonArray(p, SimpleSchema),
      (err: Error) => {
        assert.match(err.message, /Malformed JSON/i);
        return true;
      },
    );
  });

  it('throws when JSON is valid but fails the schema', async () => {
    const p = join(tmp, 'wrong-schema.json');
    await writeFile(
      p,
      JSON.stringify([{ wrong: 'field', nope: 999 }]),
      'utf8',
    );
    await assert.rejects(
      () => readJsonArray(p, SimpleSchema),
      (err: Error) => {
        assert.match(err.message, /Schema validation failed/i);
        return true;
      },
    );
  });

  it('handles an empty JSON array without error', async () => {
    const p = join(tmp, 'empty.json');
    await writeFile(p, '[]', 'utf8');
    const result = await readJsonArray(p, SimpleSchema);
    assert.deepEqual(result, []);
  });
});

describe('store — writeJsonArray', () => {
  let tmp: string;
  before(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'cv-store-write-'));
  });
  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('writes and reads back the same data (round trip)', async () => {
    const p = join(tmp, 'round-trip.json');
    const data: SimpleItem[] = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ];
    await writeJsonArray(p, data);
    const result = await readJsonArray(p, SimpleSchema);
    assert.deepEqual(result, data);
  });

  it('leaves no .tmp file after a successful write', async () => {
    const p = join(tmp, 'atomic.json');
    await writeJsonArray(p, [{ id: 'x', value: 42 }]);

    // Main file must exist
    const raw = await readFile(p, 'utf8');
    assert.ok(raw.includes('42'));

    // .tmp file must NOT exist
    await assert.rejects(
      () => readFile(`${p}.tmp`, 'utf8'),
      (err: NodeJS.ErrnoException) => {
        assert.equal(err.code, 'ENOENT');
        return true;
      },
    );
  });

  it('creates parent directories automatically', async () => {
    const p = join(tmp, 'nested', 'deep', 'data.json');
    await writeJsonArray(p, [{ id: 'n', value: 7 }]);
    const result = await readJsonArray(p, SimpleSchema);
    assert.equal(result[0]?.value, 7);
  });

  it('overwrites an existing file correctly', async () => {
    const p = join(tmp, 'overwrite.json');
    await writeJsonArray(p, [{ id: 'old', value: 1 }]);
    await writeJsonArray(p, [{ id: 'new', value: 99 }]);
    const result = await readJsonArray(p, SimpleSchema);
    assert.equal(result.length, 1);
    assert.equal(result[0]?.id, 'new');
    assert.equal(result[0]?.value, 99);
  });

  it('writes an empty array without error', async () => {
    const p = join(tmp, 'empty-write.json');
    await writeJsonArray<SimpleItem>(p, []);
    const result = await readJsonArray(p, SimpleSchema);
    assert.deepEqual(result, []);
  });

  it('writes valid JSON (pretty-printed, parseable)', async () => {
    const p = join(tmp, 'pretty.json');
    await writeJsonArray(p, [{ id: 'z', value: 0 }]);
    const raw = await readFile(p, 'utf8');
    // Should be parseable and contain newlines (pretty-printed)
    const parsed = JSON.parse(raw) as unknown[];
    assert.equal(parsed.length, 1);
    assert.ok(raw.includes('\n'), 'Expected pretty-printed JSON with newlines');
  });
});
