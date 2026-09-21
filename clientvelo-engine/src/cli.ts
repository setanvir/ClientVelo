/**
 * cli.ts — Command router for ClientVelo Engine.
 *
 * Usage: tsx src/cli.ts <command> [options]
 *
 * Phase 1: import, discover, run-daily, status, test
 * Phase 2: enrich, audit
 * Phase 3+: validate, qualify, draft, preview, approve, send, mark-*, export-manual
 *
 * SAFETY: `send` is always dry-run unless DRY_RUN=false AND --send is passed.
 */

import { execSync } from 'node:child_process';
import { config } from './config.js';
import { importCsv } from './import.js';
import { discoverLeads } from './discover.js';
import { enrichLeads } from './enrich.js';
import { auditLeads } from './audit.js';
import { validateLeads } from './validate.js';
import { qualifyLeads } from './qualify.js';
import { generateDrafts, previewDrafts, approveDraft, approveAllPending } from './drafts.js';
import { exportManual } from './export.js';
import { addSuppression, markReplied } from './suppression.js';
import {
  readLeads,
  readDrafts,
  readDispatchLogs,
  readSuppression,
  PATHS,
} from './store.js';
import { processQueue } from './queue.js';
import { startServer } from './server.js';
import { log } from './utils.js';

// ─── Argument parser ──────────────────────────────────────────────────────────

interface ParsedArgs {
  command: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  const [, , rawCommand, ...rest] = argv;
  const command = rawCommand?.trim() ?? '';
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (typeof arg !== 'string') continue;

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = rest[i + 1];
      if (typeof next === 'string' && !next.startsWith('--')) {
        flags[key] = next;
        i++; // consume the value token
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, flags, positional };
}

function flagStr(
  flags: Record<string, string | boolean>,
  key: string,
): string | undefined {
  const val = flags[key];
  return typeof val === 'string' ? val : undefined;
}

// ─── Command handlers ─────────────────────────────────────────────────────────

async function cmdImport(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const filePath = flagStr(flags, 'file');
  if (!filePath) {
    throw new Error(
      'Usage: tsx src/cli.ts import --file <path-to-csv>\n' +
        'Example: tsx src/cli.ts import --file data/leads_input.example.csv',
    );
  }

  const result = await importCsv({
    filePath,
    campaignId: config.CAMPAIGN_ID,
  });

  console.log('');
  console.log('── Import Complete ──────────────────────────────────────');
  console.log(`  Imported:     ${result.imported}`);
  console.log(`  Duplicates:   ${result.duplicates}`);
  console.log(`  Invalid rows: ${result.invalidRows}`);
  if (result.errorReportPath) {
    console.log(`  Error report: ${result.errorReportPath}`);
  }
}

async function cmdDiscover(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const niche = flagStr(flags, 'niche') ?? config.NICHE;
  const city = flagStr(flags, 'city') ?? config.CITY;
  const limitRaw = flagStr(flags, 'limit');
  const limit = limitRaw ? parseInt(limitRaw, 10) : config.MAX_DISCOVER_PER_RUN;

  if (isNaN(limit) || limit <= 0) {
    throw new Error('--limit must be a positive integer');
  }

  const result = await discoverLeads({ niche, city, limit, config });

  console.log('');
  console.log('── Discover Complete ────────────────────────────────────');
  console.log(`  OSM elements:    ${result.total_osm}`);
  console.log(`  New leads added: ${result.added}`);
  console.log(`  Skipped (seen):  ${result.skipped_seen}`);
  console.log(`  Skipped (chain): ${result.skipped_chain}`);
  console.log(`  Skipped (cap):   ${result.skipped_cap}`);
}

async function cmdStatus(): Promise<void> {
  // Read all available lead files (return [] when file doesn't exist yet)
  const raw = await readLeads(PATHS.leadsRaw);
  const enriched = await readLeads(PATHS.leadsEnriched);
  const validated = await readLeads(PATHS.leadsValidated);
  const drafts = await readDrafts();
  const dispatchLogs = await readDispatchLogs();
  const suppression = await readSuppression();

  // Use the most-processed leads file available
  const allLeads = validated.length
    ? validated
    : enriched.length
    ? enriched
    : raw;

  // Tally by workflow status
  const statusCounts: Record<string, number> = {};
  for (const lead of allLeads) {
    statusCounts[lead.workflowStatus] =
      (statusCounts[lead.workflowStatus] ?? 0) + 1;
  }

  const sentCount = dispatchLogs.filter((l) => l.status === 'sent').length;
  const dryRunCount = dispatchLogs.filter((l) => l.status === 'dry_run').length;
  const approvedDrafts = drafts.filter((d) => d.approved).length;

  console.log('');
  console.log('── ClientVelo Engine — Status ────────────────────────────');
  console.log(`  Campaign:     ${config.CAMPAIGN_ID}`);
  console.log(`  Niche / City: ${config.NICHE} / ${config.CITY}, ${config.COUNTRY}`);
  console.log(`  DRY_RUN:      ${String(config.DRY_RUN)}`);
  console.log(`  Daily cap:    ${config.DAILY_SEND_LIMIT} (ramp: ${config.rampSchedule.join(',')})`);
  console.log('');
  console.log('  Leads by workflow status:');
  const statusOrder = [
    'new', 'enriched', 'validated', 'needs_review', 'approved',
    'drafted', 'sent', 'replied', 'bounced', 'opted_out', 'skipped',
  ];
  for (const status of statusOrder) {
    const count = statusCounts[status];
    if (count) {
      console.log(`    ${status.padEnd(20)} ${count}`);
    }
  }
  if (Object.keys(statusCounts).length === 0) {
    console.log('    (no leads yet — run: tsx src/cli.ts discover)');
  }
  console.log('');
  console.log(`  Drafts:       ${drafts.length} total, ${approvedDrafts} approved`);
  console.log(`  Dispatched:   ${sentCount} sent, ${dryRunCount} dry-run`);
  console.log(`  Suppressed:   ${suppression.length} address(es)`);
  console.log('');
  console.log(`  Raw leads file: ${PATHS.leadsRaw} (${raw.length} records)`);
}

async function cmdEnrich(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const limitRaw = flagStr(flags, 'limit');
  const limit = limitRaw ? parseInt(limitRaw, 10) : 50;
  if (isNaN(limit) || limit <= 0) throw new Error('--limit must be a positive integer');

  const result = await enrichLeads({ limit, config });

  console.log('');
  console.log('── Enrich Complete ──────────────────────────────────────');
  console.log(`  Processed:          ${result.processed}`);
  console.log(`  Already done:       ${result.skipped_already_done}`);
  console.log(`  No website:         ${result.skipped_no_website}`);
  console.log(`  Site unreachable:   ${result.site_unreachable}`);
  console.log(`  Contact found:      ${result.contact_found}`);
  console.log(`  Contact form only:  ${result.contact_form_only}`);
  console.log(`  Phone only:         ${result.phone_only}`);
  console.log(`  No contact found:   ${result.none_found}`);
}

async function cmdAudit(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const limitRaw = flagStr(flags, 'limit');
  const limit = limitRaw ? parseInt(limitRaw, 10) : 50;
  if (isNaN(limit) || limit <= 0) throw new Error('--limit must be a positive integer');

  const result = await auditLeads({ limit, config });

  console.log('');
  console.log('── Audit Complete ───────────────────────────────────────');
  console.log(`  Processed:        ${result.processed}`);
  console.log(`  Complete:         ${result.complete}`);
  console.log(`  Site unreachable: ${result.site_unreachable}`);
  console.log(`  Failed:           ${result.failed}`);
  console.log(`  No website:       ${result.skipped_no_website}`);
}

async function cmdRunDaily(): Promise<void> {
  console.log('── run-daily ────────────────────────────────────────────');
  console.log('  Step 1/7: discover');
  await cmdDiscover({});

  console.log('');
  console.log('  Step 2/7: enrich');
  await cmdEnrich({});

  console.log('');
  console.log('  Step 3/7: audit');
  await cmdAudit({});

  console.log('');
  console.log('  Step 4/7: validate');
  await cmdValidate({});

  console.log('');
  console.log('  Step 5/7: qualify');
  await cmdQualify({});

  console.log('');
  console.log('  Step 6/7: draft');
  await cmdDraft({});

  console.log('');
  console.log('  Step 7/7: preview');
  await cmdPreview({});
  
  console.log('');
  console.log('  run-daily NEVER approves or sends automatically.');
}

async function cmdValidate(flags: Record<string, string | boolean>): Promise<void> {
  const limitRaw = flagStr(flags, 'limit');
  const limit = limitRaw ? parseInt(limitRaw, 10) : 0;
  await validateLeads(limit);
}

async function cmdQualify(flags: Record<string, string | boolean>): Promise<void> {
  const limitRaw = flagStr(flags, 'limit');
  const limit = limitRaw ? parseInt(limitRaw, 10) : 0;
  await qualifyLeads(limit);
}

async function cmdDraft(flags: Record<string, string | boolean>): Promise<void> {
  const limitRaw = flagStr(flags, 'limit');
  const limit = limitRaw ? parseInt(limitRaw, 10) : 0;
  await generateDrafts(limit);
}

async function cmdPreview(flags: Record<string, string | boolean>): Promise<void> {
  const limitRaw = flagStr(flags, 'limit');
  const limit = limitRaw ? parseInt(limitRaw, 10) : 0;
  await previewDrafts(limit);
}

async function cmdApprove(flags: Record<string, string | boolean>): Promise<void> {
  const id = flagStr(flags, 'id');
  const all = flags['all'] === true;

  if (all) {
    await approveAllPending();
  } else if (id) {
    await approveDraft(id);
  } else {
    throw new Error('Usage: tsx src/cli.ts approve --id <draftId> OR tsx src/cli.ts approve --all');
  }
}

async function cmdExportManual(): Promise<void> {
  await exportManual();
}

async function cmdMarkOptOut(flags: Record<string, string | boolean>): Promise<void> {
  const email = flagStr(flags, 'email');
  if (!email) throw new Error('Usage: tsx src/cli.ts mark-opt-out --email <email>');
  await addSuppression(email, 'opt_out', 'manual');
}

async function cmdMarkBounce(flags: Record<string, string | boolean>): Promise<void> {
  const email = flagStr(flags, 'email');
  if (!email) throw new Error('Usage: tsx src/cli.ts mark-bounce --email <email>');
  await addSuppression(email, 'bounce', 'manual');
}

async function cmdMarkInvalid(flags: Record<string, string | boolean>): Promise<void> {
  const email = flagStr(flags, 'email');
  if (!email) throw new Error('Usage: tsx src/cli.ts mark-invalid --email <email>');
  await addSuppression(email, 'invalid', 'manual');
}

async function cmdMarkReplied(flags: Record<string, string | boolean>): Promise<void> {
  const email = flagStr(flags, 'email');
  if (!email) throw new Error('Usage: tsx src/cli.ts mark-replied --email <email>');
  await markReplied(email);
}

function cmdTest(): void {
  console.log('Running test suite…');
  try {
    execSync('node --import tsx --test tests/*.test.ts', { stdio: 'inherit' });
  } catch {
    // execSync throws on non-zero exit; test runner output is already printed
    process.exit(1);
  }
}

// ─── Help text ────────────────────────────────────────────────────────────────

function printHelp(): void {
  console.log('');
  console.log('ClientVelo Engine — CLI');
  console.log('');
  console.log('Usage: tsx src/cli.ts <command> [options]');
  console.log('');
  console.log('Available commands:');
  console.log('  import --file <path>                Import leads from a CSV file');
  console.log('  discover [--niche <n>] [--city <c>] Discover leads via OpenStreetMap');
  console.log('           [--limit <n>]');
  console.log('  enrich [--limit <n>]                Fetch websites and extract contacts');
  console.log('  audit [--limit <n>]                 Run local mobile audit + optional PSI');
  console.log('  run-daily                           Auto-pipeline (discover→enrich→audit→…)');
  console.log('  status                              Show current state summary');
  console.log('  test                                Run the test suite');
  console.log('');
  console.log('  validate [--limit <n>]              Validate emails and check MX records');
  console.log('  qualify [--limit <n>]               Score leads based on evidence');
  console.log('  draft [--limit <n>]                 Generate email drafts for qualified leads');
  console.log('  preview [--limit <n>]               Preview pending drafts');
  console.log('  approve [--id <id> | --all]         Approve drafts for sending');
  console.log('  export-manual                       Export phone/contact-form leads to CSV');
  console.log('  mark-opt-out --email <email>        Suppress email (opt-out)');
  console.log('  mark-bounce --email <email>         Suppress email (bounce)');
  console.log('  mark-invalid --email <email>        Suppress email (invalid)');
  console.log('  mark-replied --email <email>        Mark lead as replied');
  console.log('');
  console.log('  send [--send]                       Dispatch approved drafts');
  console.log('  serve [--port <port>] [--demo]      Start the local dashboard server\n');
}

async function cmdSend(flags: Record<string, string | boolean>) {
  const isSend = flags['send'] === true;
  const confirmBatch = flagStr(flags, 'confirm-batch');
  
  if (isSend && !confirmBatch && !config.DRY_RUN) {
    throw new Error('Usage: tsx src/cli.ts send --send --confirm-batch <fingerprint>');
  }

  await processQueue(isSend, confirmBatch);
}

async function cmdServe(flags: Record<string, string | boolean>) {
  const portRaw = flagStr(flags, 'port');
  const port = portRaw ? parseInt(portRaw, 10) : 3000;
  const demo = flags['demo'] === true;
  startServer(port, demo);
}

// ─── Entry ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv);
  const args = process.argv;

  if (!command || command === 'help' || command === '--help') {
    printHelp();
    return;
  }

  try {
    switch (command) {
      case 'import':
        await cmdImport(flags);
        break;

      case 'discover':
        await cmdDiscover(flags);
        break;

      case 'enrich':
        await cmdEnrich(flags);
        break;

      case 'audit':
        await cmdAudit(flags);
        break;

      case 'run-daily':
        await cmdRunDaily();
        break;

      case 'send':
        await cmdSend(flags);
        break;

      case 'serve':
        await cmdServe(flags);
        break;

      case 'status':
        await cmdStatus();
        break;

      case 'test':
        cmdTest();
        break;

      case 'validate':
        await cmdValidate(flags);
        break;
        
      case 'qualify':
        await cmdQualify(flags);
        break;

      case 'draft':
        await cmdDraft(flags);
        break;

      case 'preview':
        await cmdPreview(flags);
        break;

      case 'approve':
        await cmdApprove(flags);
        break;

      case 'export-manual':
        await cmdExportManual();
        break;

      case 'mark-opt-out':
        await cmdMarkOptOut(flags);
        break;

      case 'mark-bounce':
        await cmdMarkBounce(flags);
        break;

      case 'mark-invalid':
        await cmdMarkInvalid(flags);
        break;

      case 'mark-replied':
        await cmdMarkReplied(flags);
        break;

      default:
        console.error(`Unknown command: "${command}"`);
        printHelp();
        process.exit(1);
    }
  } catch (err: unknown) {
    log.error((err as Error).message);
    if (config.NODE_ENV === 'development') {
      console.error((err as Error).stack);
    }
    process.exit(1);
  }
}

main();
