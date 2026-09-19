import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, appendFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { PATHS } from './store.js';
import { config } from './config.js';
import { generateId, now } from './utils.js';
import { JobEntrySchema, type JobEntry, type JobStatus } from './types.js';
import { existsSync } from 'node:fs';

const ALLOWED_COMMANDS = new Set([
  'status', 'discover', 'run-daily', 'enrich', 'audit', 
  'validate', 'qualify', 'draft', 'export-manual'
]);

// Map to hold running child processes by jobId
const activeJobs = new Map<string, ReturnType<typeof spawn>>();
let simulatedMode = false;
const simulatedTimers = new Map<string, NodeJS.Timeout>();

export function setJobsSimulatedMode(demo: boolean) {
  simulatedMode = demo;
}

async function ensureJobsDir() {
  await mkdir(PATHS.jobsDir, { recursive: true });
}

export async function recoverJobsOnStartup() {
  await ensureJobsDir();
  const files = await readdir(PATHS.jobsDir);
  for (const file of files) {
    if (file.endsWith('.json')) {
      const jobId = file.replace('.json', '');
      const jobPath = join(PATHS.jobsDir, file);
      try {
        const raw = await readFile(jobPath, 'utf8');
        const job = JobEntrySchema.parse(JSON.parse(raw));
        if (job.status === 'running' || job.status === 'queued') {
          // PID check would be complex since we don't store PID, but since we just started,
          // any previously 'running' job is dead.
          job.status = 'interrupted';
          job.endedAt = now();
          await writeFile(jobPath, JSON.stringify(job, null, 2), 'utf8');
          await appendLog(jobId, '\n[System] Job interrupted by server shutdown.\n');
        }
      } catch (err) {
        console.error(`[jobs] Failed to recover job file ${file}:`, err);
      }
    }
  }
}

export async function getJobs(): Promise<JobEntry[]> {
  await ensureJobsDir();
  const files = await readdir(PATHS.jobsDir);
  const jobs: JobEntry[] = [];
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const raw = await readFile(join(PATHS.jobsDir, file), 'utf8');
        jobs.push(JobEntrySchema.parse(JSON.parse(raw)));
      } catch {
        // skip corrupted
      }
    }
  }
  // Sort descending by startedAt
  jobs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  
  // Keep only 50
  if (jobs.length > 50) {
    const toDelete = jobs.slice(50);
    for (const job of toDelete) {
      await rm(join(PATHS.jobsDir, `${job.id}.json`), { force: true });
      await rm(join(PATHS.jobsDir, `${job.id}.log`), { force: true });
    }
    return jobs.slice(0, 50);
  }
  
  return jobs;
}

export async function getJob(id: string): Promise<JobEntry | null> {
  const jobPath = join(PATHS.jobsDir, `${id}.json`);
  if (!existsSync(jobPath)) return null;
  try {
    const raw = await readFile(jobPath, 'utf8');
    return JobEntrySchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function getJobOutput(id: string, afterLine: number = 0): Promise<{ lines: string[], nextLine: number }> {
  const logPath = join(PATHS.jobsDir, `${id}.log`);
  if (!existsSync(logPath)) return { lines: [], nextLine: 0 };
  
  const raw = await readFile(logPath, 'utf8');
  const allLines = raw.split('\n');
  
  if (afterLine >= allLines.length) {
    return { lines: [], nextLine: allLines.length };
  }
  
  return {
    lines: allLines.slice(afterLine),
    nextLine: allLines.length
  };
}

async function saveJob(job: JobEntry) {
  await ensureJobsDir();
  await writeFile(join(PATHS.jobsDir, `${job.id}.json`), JSON.stringify(job, null, 2), 'utf8');
}

async function appendLog(id: string, text: string) {
  const logPath = join(PATHS.jobsDir, `${id}.log`);
  let cleanText = text.replace(/\x1B\[[0-9;]*m/g, ''); // strip ANSI
  
  // Redact secrets
  const secrets = [
    config.SMTP_APP_PASSWORD,
    config.PAGESPEED_INSIGHTS_API_KEY,
  ].filter(s => s && s.length > 3);
  
  for (const secret of secrets) {
    cleanText = cleanText.split(secret).join('***REDACTED***');
  }
  
  // Cap lines to 2000 chars
  const lines = cleanText.split('\n');
  const cappedLines = lines.map(l => l.length > 2000 ? l.substring(0, 2000) + '...[truncated]' : l);
  cleanText = cappedLines.join('\n');
  
  try {
    const stat = existsSync(logPath) ? await import('node:fs/promises').then(fs => fs.stat(logPath)) : null;
    if (stat && stat.size > 2 * 1024 * 1024) {
      if (!cleanText.includes('Log size limit reached')) {
        await appendFile(logPath, '\n[System] Log size limit reached (2MB).\n');
      }
      return;
    }
  } catch {}

  await appendFile(logPath, cleanText);
}

export async function stopJob(id: string) {
  const job = await getJob(id);
  if (!job) throw new Error('Job not found');
  if (job.status !== 'running') throw new Error('Job is not running');
  
  const child = activeJobs.get(id);
  if (child) {
    child.kill('SIGTERM'); // Send SIGTERM, cooperative exit if implemented, otherwise forced. (For non-send jobs it's ok)
  }

  const timer = simulatedTimers.get(id);
  if (timer) {
    clearInterval(timer);
    simulatedTimers.delete(id);
  }
  
  job.status = 'stopped';
  job.endedAt = now();
  await saveJob(job);
  await appendLog(id, '\n[System] Job stopped by user.\n');
  activeJobs.delete(id);
}

export async function spawnJob(command: string, args: string[]): Promise<JobEntry> {
  if (!ALLOWED_COMMANDS.has(command)) {
    throw new Error(`Command not allowed: ${command}`);
  }
  
  const jobs = await getJobs();
  const running = jobs.find(j => j.status === 'running');
  if (running) {
    throw new Error(`Another job is already running: ${running.command} (${running.id})`);
  }

  for (const arg of args) {
    if (arg.includes(';') || arg.includes('&') || arg.includes('|') || arg.includes('$') || arg.includes('`') || arg.includes('../')) {
       throw new Error(`Invalid character in arguments: ${arg}`);
    }
  }

  const job: JobEntry = {
    id: generateId(),
    command,
    args,
    status: 'running',
    startedAt: now(),
    endedAt: null,
    exitCode: null,
  };
  
  await saveJob(job);
  await appendLog(job.id, `[System] Starting job: ${command} ${args.join(' ')}\n`);

  if (simulatedMode) {
    runSimulatedJob(job);
    return job;
  }

  const child = spawn(process.execPath, ['--import', 'tsx', 'src/cli.ts', command, ...args], {
    shell: false,
    windowsHide: true,
    cwd: process.cwd()
  });

  activeJobs.set(job.id, child);

  child.stdout?.on('data', (data) => {
    appendLog(job.id, data.toString());
  });

  child.stderr?.on('data', (data) => {
    appendLog(job.id, data.toString());
  });

  child.on('close', async (code) => {
    activeJobs.delete(job.id);
    const updatedJob = await getJob(job.id);
    if (updatedJob && updatedJob.status === 'running') {
      updatedJob.status = code === 0 ? 'succeeded' : 'failed';
      updatedJob.endedAt = now();
      updatedJob.exitCode = code;
      await saveJob(updatedJob);
      await appendLog(job.id, `\n[System] Job finished with exit code ${code}.\n`);
    }
  });
  
  child.on('error', async (err) => {
    activeJobs.delete(job.id);
    const updatedJob = await getJob(job.id);
    if (updatedJob && updatedJob.status === 'running') {
      updatedJob.status = 'failed';
      updatedJob.endedAt = now();
      await saveJob(updatedJob);
      await appendLog(job.id, `\n[System] Job failed to start: ${err.message}\n`);
    }
  });

  return job;
}

function runSimulatedJob(job: JobEntry) {
  let count = 0;
  const timer = setInterval(async () => {
    count++;
    await appendLog(job.id, `[Demo] Simulated output line ${count} for ${job.command}...\n`);
    if (count >= 10) {
      clearInterval(timer);
      simulatedTimers.delete(job.id);
      const updatedJob = await getJob(job.id);
      if (updatedJob && updatedJob.status === 'running') {
        updatedJob.status = 'succeeded';
        updatedJob.endedAt = now();
        updatedJob.exitCode = 0;
        await saveJob(updatedJob);
        await appendLog(job.id, `\n[System] Simulated job finished.\n`);
      }
    }
  }, 1000);
  simulatedTimers.set(job.id, timer);
}
