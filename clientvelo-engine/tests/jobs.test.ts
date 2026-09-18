import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PATHS } from '../src/store.js';
import { spawnJob, getJobs, stopJob, recoverJobsOnStartup, setJobsSimulatedMode, getJobOutput, getJob } from '../src/jobs.js';
import { config } from '../src/config.js';

describe('Jobs Runner (Phase 6A)', () => {
  const TEST_JOBS_DIR = join(process.cwd(), 'data', 'jobs_test');
  
  beforeEach(async () => {
    // Override PATHS.jobsDir for tests
    (PATHS as any).jobsDir = TEST_JOBS_DIR;
    await mkdir(TEST_JOBS_DIR, { recursive: true });
    setJobsSimulatedMode(true); // Always use simulated mode in tests to avoid actual process spawn issues
  });

  afterEach(async () => {
    await rm(TEST_JOBS_DIR, { recursive: true, force: true });
  });

  test('Rejects unknown commands', async () => {
    await assert.rejects(
      async () => await spawnJob('haxor', []),
      /Command not allowed: haxor/
    );
  });

  test('Rejects shell injection payloads in args', async () => {
    await assert.rejects(
      async () => await spawnJob('discover', ['--city', 'Dhaka; calc']),
      /Invalid character in arguments/
    );
    await assert.rejects(
      async () => await spawnJob('discover', ['--city', 'Dhaka & whoami']),
      /Invalid character in arguments/
    );
    await assert.rejects(
      async () => await spawnJob('discover', ['--city', 'Dhaka | rm -rf /']),
      /Invalid character in arguments/
    );
    await assert.rejects(
      async () => await spawnJob('discover', ['--city', 'Dhaka $(calc)']),
      /Invalid character in arguments/
    );
    await assert.rejects(
      async () => await spawnJob('discover', ['--city', 'Dhaka `calc`']),
      /Invalid character in arguments/
    );
    await assert.rejects(
      async () => await spawnJob('discover', ['--city', '../etc/passwd']),
      /Invalid character in arguments/
    );
  });

  test('Enforces job concurrency (only one job running)', async () => {
    // Start first job
    const job1 = await spawnJob('discover', []);
    assert.strictEqual(job1.status, 'running');

    // Attempt second job
    await assert.rejects(
      async () => await spawnJob('status', []),
      /Another job is already running/
    );

    await stopJob(job1.id);
  });

  test('Startup recovery marks running jobs as interrupted', async () => {
    // Manually create a running job file with valid UUID
    const { randomUUID } = await import('node:crypto');
    const validId = randomUUID();
    const jobData = {
      id: validId,
      command: 'discover',
      args: [],
      status: 'running',
      startedAt: new Date().toISOString(),
      endedAt: null,
      exitCode: null,
    };
    
    await writeFile(join(TEST_JOBS_DIR, `${validId}.json`), JSON.stringify(jobData));
    
    // Run recovery
    await recoverJobsOnStartup();
    
    const recovered = await getJob(validId);
    assert.ok(recovered);
    assert.strictEqual(recovered!.status, 'interrupted');
    assert.ok(recovered!.endedAt);
  });
  
  test('stopJob successfully stops a simulated job', async () => {
    const job = await spawnJob('status', []);
    assert.strictEqual(job.status, 'running');
    
    await stopJob(job.id);
    
    const updated = await getJob(job.id);
    assert.strictEqual(updated!.status, 'stopped');
  });
});
