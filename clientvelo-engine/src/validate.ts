import dns from 'node:dns/promises';
import { readLeads, writeLeads } from './store.js';
import type { Lead, EmailValidationStatus, WorkflowStatus } from './types.js';

// --- Configuration ---
const DNS_TIMEOUT_MS = 5000;

const ROLE_PREFIXES = new Set([
  'info', 'contact', 'hello', 'office', 'support', 'sales', 'admin', 'inquiries', 'hi',
]);

const BLOCKED_PREFIXES = new Set([
  'noreply', 'no-reply', 'abuse', 'postmaster', 'mailer-daemon', 'donotreply', 'privacy',
]);

// Basic RFC 5322 regex for sanity check (not exhaustive, but catches obvious junk)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// --- Interfaces ---

// Dependency injection for testability
export interface DnsResolver {
  resolveMx(domain: string): Promise<dns.MxRecord[]>;
}

const defaultDnsResolver: DnsResolver = {
  resolveMx: (domain: string) => dns.resolveMx(domain),
};

export async function checkMxWithTimeout(domain: string, resolver: DnsResolver = defaultDnsResolver): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DNS_TIMEOUT_MS);
    
    // In Node 20, dns promises don't natively support AbortSignal in resolveMx.
    // We race the promise against a timeout.
    const lookupPromise = resolver.resolveMx(domain);
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error('DNS_TIMEOUT')));
    });

    const records = await Promise.race([lookupPromise, timeoutPromise]);
    clearTimeout(timeoutId);
    
    return Array.isArray(records) && records.length > 0;
  } catch (error: any) {
    // ENODATA or ENOTFOUND means no MX record exists
    if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
      return false;
    }
    // For timeouts or other errors (SERVFAIL), we assume it's unsafe or failed.
    return false;
  }
}

export async function validateEmail(email: string | null, resolver?: DnsResolver): Promise<EmailValidationStatus> {
  if (!email) {
    return 'not_checked';
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return 'invalid';
  }

  const [localPart, domain] = normalizedEmail.split('@');
  if (!localPart || !domain) {
    return 'invalid';
  }

  if (BLOCKED_PREFIXES.has(localPart)) {
    return 'invalid';
  }

  const hasMx = await checkMxWithTimeout(domain, resolver);
  if (!hasMx) {
    return 'invalid';
  }

  if (ROLE_PREFIXES.has(localPart)) {
    return 'role_address';
  }

  return 'domain_has_mx';
}

export async function validateLeads(
  limit: number = 0,
  inPath: string = 'data/leads_enriched.json',
  outPath: string = 'data/leads_validated.json',
  resolver?: DnsResolver
): Promise<void> {
  const leads = await readLeads(inPath);
  let processed = 0;
  let invalidCount = 0;
  let roleCount = 0;
  let validCount = 0;

  console.log(`[validate] ${leads.length} lead(s) loaded from ${inPath}`);

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    if (!lead) continue;
    
    if (lead.workflowStatus !== 'enriched') {
      continue;
    }

    if (limit > 0 && processed >= limit) {
      break;
    }

    if (lead.email) {
      // We have a chosen email, validate it
      const status = await validateEmail(lead.email, resolver);
      lead.emailValidationStatus = status;

      if (status === 'invalid') {
        invalidCount++;
        // If the chosen email is invalid, we might want to flag the lead for review or fallback
        // For now, we leave contactChannel as is, but it will fail the send queue if it's invalid.
        // The qualify step can penalize it.
      } else if (status === 'role_address') {
        roleCount++;
      } else if (status === 'domain_has_mx') {
        validCount++;
      }
    } else {
      lead.emailValidationStatus = 'not_checked';
    }

    // Move state to validated. It hasn't been scored yet (that's the qualify step),
    // but the email check is complete.
    lead.workflowStatus = 'validated';
    lead.updatedAt = new Date().toISOString();

    processed++;
  }

  if (processed > 0) {
    await writeLeads(leads, outPath);
    console.log(`[validate] Written ${leads.length} lead(s) to ${outPath}`);
  } else {
    console.log(`[validate] No leads to process.`);
  }

  console.log(`\n── Validate Complete ────────────────────────────────────`);
  console.log(`  Processed:        ${processed}`);
  console.log(`  Valid (MX OK):    ${validCount}`);
  console.log(`  Role addresses:   ${roleCount}`);
  console.log(`  Invalid:          ${invalidCount}`);
}
