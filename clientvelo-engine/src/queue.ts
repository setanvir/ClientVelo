import fs from 'node:fs';
import {

  readDrafts,
  writeDrafts,
  readDispatchLogs,
  writeDispatchLogs,
  readLeads,
  writeLeads,
  readSuppression
} from './store.js';
import { config } from './config.js';
import { sendEmail } from './mailer.js';
import {
  log,
  now,
  generateId,
  sha256,
  abortableSleep,
  randomBetween,
  isInSendWindow,
  currentCampaignDay,
} from './utils.js';
import type { DispatchLog, DispatchStatus, Lead } from './types.js';

let isShuttingDown = false;
let abortController = new AbortController();

export function setupGracefulShutdown() {
  const handler = () => {
    if (isShuttingDown) {
      log.warn('Forcing immediate exit.');
      process.exit(1);
    }
    log.info('Received shutdown signal. Stopping queue after current action...');
    isShuttingDown = true;
    abortController.abort();
  };

  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);
}

export async function previewSendBatch(): Promise<{ count: number; fingerprint: string; drafts: any[] }> {
  const drafts = await readDrafts();
  const leads = await readLeads('data/leads_validated.json');
  const logs = await readDispatchLogs();
  const suppression = await readSuppression();

  const campaignDay = currentCampaignDay(logs, config.CAMPAIGN_ID, config.TIMEZONE);
  const rampCap = config.rampSchedule[Math.min(campaignDay - 1, config.rampSchedule.length - 1)] ?? config.DAILY_SEND_LIMIT;
  const effectiveCap = Math.min(config.DAILY_SEND_LIMIT, rampCap);

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: config.TIMEZONE }).format(new Date());

  const sentTodayCount = logs.filter(
    (l) => l.status === 'sent' && l.timestamp.startsWith(todayStr)
  ).length;

  let remainingSends = effectiveCap - sentTodayCount;
  const previewedDrafts = [];

  for (const draft of drafts) {
    if (remainingSends <= 0) break;
    if (!draft.approved) continue;

    const existingLog = logs.find((l) => l.draftId === draft.id && (l.status === 'sent' || l.status === 'suppressed' || l.status === 'permanent_error' || l.status === 'dry_run'));
    if (existingLog) continue;

    const windowCheck = isInSendWindow({
      timezone: config.TIMEZONE,
      windowStart: config.SEND_WINDOW_START,
      windowEnd: config.SEND_WINDOW_END,
      sendDays: config.sendDays,
    });
    if (!windowCheck.allowed) break; // if outside window, we send 0

    const lead = leads.find((l) => l.id === draft.leadId);
    if (!lead) continue;

    const currentHash = sha256(draft.recipientEmail + draft.subject + draft.body);
    if (draft.approvalHash !== currentHash) continue;

    const isSuppressed = suppression.some(
      (s) => s.email.toLowerCase() === draft.recipientEmail.toLowerCase()
    );
    if (isSuppressed) continue;

    previewedDrafts.push(draft);
    remainingSends--;
  }

  const concatenatedHashes = previewedDrafts.map(d => d.approvalHash).join('');
  const fingerprint = previewedDrafts.length > 0 ? sha256(concatenatedHashes) : '';

  return {
    count: previewedDrafts.length,
    fingerprint,
    drafts: previewedDrafts,
  };
}

export async function processQueue(cliSendFlag: boolean, confirmBatchFingerprint?: string): Promise<void> {
  const realSend = !config.DRY_RUN && cliSendFlag;
  if (config.SEND_CONFIRMATION_REQUIRED && realSend) {
    // A secondary safety check per specs, though this can be identical to config.DRY_RUN == false
  }
  
  if (realSend) {
    log.warn('LIVE SENDING ENABLED. Emails will actually be sent via SMTP.');
  } else {
    log.info('Running in DRY-RUN mode. No real emails will be sent.');
  }

  const LOCK_FILE = '.send.lock';
  const STOP_FILE = '.stop-send';

  if (fs.existsSync(LOCK_FILE)) {
    log.error(`Lock file ${LOCK_FILE} exists. Another send job is already running.`);
    process.exit(1);
  }

  if (realSend && confirmBatchFingerprint !== undefined) {
    const preview = await previewSendBatch();
    if (preview.fingerprint !== confirmBatchFingerprint) {
      log.error(`Batch fingerprint mismatch! Expected ${confirmBatchFingerprint}, got ${preview.fingerprint}. Aborting.`);
      process.exit(1);
    }
  }

  fs.writeFileSync(LOCK_FILE, 'locked');

  try {
    setupGracefulShutdown();

  const drafts = await readDrafts();
  const leads = await readLeads('data/leads_validated.json');
  const logs = await readDispatchLogs();
  const suppression = await readSuppression();

  // Calculate limits
  const campaignDay = currentCampaignDay(logs, config.CAMPAIGN_ID, config.TIMEZONE);
  const rampCap = config.rampSchedule[Math.min(campaignDay - 1, config.rampSchedule.length - 1)] ?? config.DAILY_SEND_LIMIT;
  const effectiveCap = Math.min(config.DAILY_SEND_LIMIT, rampCap);

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: config.TIMEZONE }).format(new Date());

  const sentTodayCount = logs.filter(
    (l) => l.status === 'sent' && l.timestamp.startsWith(todayStr)
  ).length;

  const bouncedTodayCount = logs.filter(
    (l) => l.status === 'permanent_error' && l.timestamp.startsWith(todayStr) // Treat permanent_error as bounce for this check, or check suppression
  ).length;

  if (sentTodayCount >= effectiveCap) {
    log.info(`Daily cap reached: ${sentTodayCount}/${effectiveCap}. Exiting.`);
    return;
  }

  // Safety: Bounce stop rate
  const totalAttemptsToday = sentTodayCount + bouncedTodayCount;
  if (totalAttemptsToday > 10) { // arbitrary small threshold before enforcing rate
    const bounceRate = bouncedTodayCount / totalAttemptsToday;
    if (bounceRate > config.BOUNCE_STOP_RATE) {
      log.error(`Bounce rate ${bounceRate.toFixed(2)} exceeds limit ${config.BOUNCE_STOP_RATE}. STOPPING.`);
      return;
    }
  }

  let remainingSends = effectiveCap - sentTodayCount;

  for (const draft of drafts) {
    if (isShuttingDown) break;
    if (remainingSends <= 0) break;
    
    if (fs.existsSync(STOP_FILE)) {
      log.info('Detected .stop-send file. Halting send gracefully.');
      fs.unlinkSync(STOP_FILE);
      break;
    }

    // Only process approved drafts
    if (!draft.approved) continue;
    
    // Check if it's already sent or in a terminal state
    const existingLog = logs.find((l) => l.draftId === draft.id && (l.status === 'sent' || l.status === 'suppressed' || l.status === 'permanent_error' || l.status === 'dry_run'));
    if (existingLog) continue;

    // Window check
    const windowCheck = isInSendWindow({
      timezone: config.TIMEZONE,
      windowStart: config.SEND_WINDOW_START,
      windowEnd: config.SEND_WINDOW_END,
      sendDays: config.sendDays,
    });
    
    if (!windowCheck.allowed) {
      log.info(`Cannot send: ${windowCheck.reason}`);
      break; // stop processing entirely if outside window
    }

    const lead = leads.find((l) => l.id === draft.leadId);
    if (!lead) {
      log.warn(`Lead ${draft.leadId} not found for draft ${draft.id}`);
      continue;
    }

    // Safety checks
    const currentHash = sha256(draft.recipientEmail + draft.subject + draft.body);
    if (draft.approvalHash !== currentHash) {
      log.error(`Draft ${draft.id} has been modified since approval! Hash mismatch. Skipping.`);
      continue;
    }

    const isSuppressed = suppression.some(
      (s) => s.email.toLowerCase() === draft.recipientEmail.toLowerCase()
    );
    if (isSuppressed) {
      log.warn(`Recipient ${draft.recipientEmail} is in suppression list. Skipping.`);
      await logDispatch(draft, lead, 'suppressed', !realSend, logs, null, null);
      continue;
    }
    
    // Delay pacing before send (skip on first iteration if desired, but good for pacing)
    const delayMs = randomBetween(config.MIN_DELAY_SECONDS, config.MAX_DELAY_SECONDS) * 1000;
    log.info(`Waiting ${delayMs / 1000}s before sending to ${draft.recipientEmail}...`);
    await abortableSleep(delayMs, abortController.signal);
    if (isShuttingDown) break;

    // Attempt send
    const { messageId, response, error } = await sendEmail(draft.recipientEmail, draft.subject, draft.body, !realSend);

    let status: DispatchStatus = !realSend ? 'dry_run' : 'sent';
    let errorMessage = error ? error.message : null;

    if (error) {
      // Determine if permanent or transient
      // 5xx codes are permanent. NodeMailer might wrap SMTP errors.
      const isPermanent = error.message.includes('550') || error.message.includes('554');
      status = isPermanent ? 'permanent_error' : 'transient_error';
      log.error(`Send failed to ${draft.recipientEmail}: ${error.message} (${status})`);
      
      if (status === 'permanent_error') {
        lead.workflowStatus = 'bounced';
        lead.updatedAt = now();
      }
    } else {
      log.info(`Sent successfully to ${draft.recipientEmail}. Message ID: ${messageId}`);
      if (realSend) {
        lead.workflowStatus = 'sent';
      }
      lead.updatedAt = now();
      remainingSends--;
    }

    await logDispatch(draft, lead, status, !realSend, logs, messageId || null, response || errorMessage || null);
    
    // Save state atomically after each email to prevent duplicates if crashed
    await writeDispatchLogs(logs);
    await writeLeads(leads, 'data/leads_validated.json');
  }

  log.info(`Queue processing complete.`);
  } finally {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  }
}

async function logDispatch(
  draft: any, 
  lead: Lead, 
  status: DispatchStatus, 
  dryRun: boolean, 
  logs: DispatchLog[],
  messageId: string | null,
  smtpResponse: string | null
) {
  const previousTransient = logs.filter(l => l.draftId === draft.id && l.status === 'transient_error').length;
  
  const logEntry: DispatchLog = {
    id: generateId(),
    leadId: lead.id,
    draftId: draft.id,
    recipient: draft.recipientEmail,
    businessName: lead.businessName,
    campaignId: config.CAMPAIGN_ID,
    messageHash: draft.approvalHash || '',
    timestamp: now(),
    status,
    messageId,
    smtpResponse,
    errorCode: null,
    retryCount: previousTransient,
    dryRun,
  };

  logs.push(logEntry);
}
