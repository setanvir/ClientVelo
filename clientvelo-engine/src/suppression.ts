import { updateJson, PATHS, readSuppression } from './store.js';
import type { SuppressionEntry } from './types.js';
import { SuppressionEntrySchema, LeadSchema } from './types.js';
import { normalizeEmail } from './utils.js';
import { z } from 'zod';

export async function addSuppression(email: string, reason: string, source: string): Promise<void> {
  const normEmail = normalizeEmail(email);
  let added = false;

  await updateJson(PATHS.suppression, z.array(SuppressionEntrySchema), (suppressions) => {
    if (suppressions.some((s) => s.email === normEmail)) {
      console.log(`[suppression] ${normEmail} is already suppressed.`);
    } else {
      suppressions.push({
        email: normEmail,
        reason,
        createdAt: new Date().toISOString(),
        source,
      });
      added = true;
    }
    return suppressions;
  });

  if (added) {
    console.log(`[suppression] Added ${normEmail} (reason: ${reason})`);
  }

  // Update lead status if applicable
  await updateLeadStatusForEmail(normEmail, reason);
}

async function updateLeadStatusForEmail(normEmail: string, reason: string) {
  await updateJson(PATHS.leadsValidated, z.array(LeadSchema), (leads) => {
    for (const lead of leads) {
      if (lead.email && normalizeEmail(lead.email) === normEmail) {
        if (reason === 'opt_out') {
          lead.workflowStatus = 'opted_out';
        } else if (reason === 'bounce') {
          lead.workflowStatus = 'bounced';
        } else if (reason === 'invalid') {
          lead.emailValidationStatus = 'invalid';
        }
      }
    }
    return leads;
  });
}

export async function markReplied(email: string): Promise<void> {
  const normEmail = normalizeEmail(email);
  let changed = false;

  await updateJson(PATHS.leadsValidated, z.array(LeadSchema), (leads) => {
    for (const lead of leads) {
      if (lead.email && normalizeEmail(lead.email) === normEmail) {
        lead.workflowStatus = 'replied';
        changed = true;
      }
    }
    return leads;
  });

  if (changed) {
    console.log(`[suppression] Marked lead with email ${normEmail} as replied.`);
  } else {
    console.log(`[suppression] No lead found with email ${normEmail} to mark as replied.`);
  }
}
