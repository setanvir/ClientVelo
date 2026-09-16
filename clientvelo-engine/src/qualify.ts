import { readLeads, writeLeads } from './store.js';
import type { Lead } from './types.js';
import { config } from './config.js';

export function scoreLead(lead: Lead): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Base points for existence
  if (lead.businessName) {
    score += 10;
  }

  // Contactability
  if (lead.emailValidationStatus === 'domain_has_mx') {
    score += 30;
    reasons.push('+30: Verified email domain (MX OK)');
  } else if (lead.emailValidationStatus === 'role_address') {
    score += 15;
    reasons.push('+15: Role-based email (MX OK)');
  } else if (lead.contactChannel === 'contact_form') {
    score += 10;
    reasons.push('+10: Contact form available');
  } else if (lead.contactChannel === 'phone_only') {
    score += 5;
    reasons.push('+5: Phone contact only');
  } else {
    reasons.push('+0: No reliable contact channel');
  }

  // Audit results
  if (lead.auditStatus === 'complete') {
    score += 20;
    reasons.push('+20: Website audit completed successfully');

    if (lead.primaryIssue && lead.primaryIssue !== 'no_material_issue_detected') {
      score += 20;
      reasons.push(`+20: Clear primary issue detected (${lead.primaryIssue})`);
    } else {
      reasons.push('+0: No material issue found on website');
    }
  } else if (lead.auditStatus === 'site_unreachable') {
    score -= 20;
    reasons.push('-20: Website unreachable');
  }

  // Source-specific scoring
  if (lead.source === 'OpenStreetMap contributors (ODbL)') {
    if (lead.websiteUrl) {
      score += 10;
      reasons.push('+10: OSM lead has website');
    }
    // Check if it had an explicit email tag (we'd have to look at emailCandidates or if emailType is business_public, but let's just keep it simple)
    if (lead.email) {
      score += 10;
      reasons.push('+10: OSM lead has email');
    }
  } else {
    // CSV leads
    if (lead.reviewCount !== null) {
      if (lead.reviewCount >= config.MIN_REVIEW_COUNT) {
        score += 10;
        reasons.push(`+10: Reviews (${lead.reviewCount}) >= MIN_REVIEW_COUNT (${config.MIN_REVIEW_COUNT})`);
      } else {
        reasons.push(`+0: Reviews (${lead.reviewCount}) < MIN_REVIEW_COUNT`);
      }
    }
    
    if (lead.rating !== null && lead.rating >= 4.0) {
      score += 5;
      reasons.push(`+5: Rating (${lead.rating}) is good`);
    }
  }

  // Cap score at 100, floor at 0
  score = Math.max(0, Math.min(100, score));

  return { score, reasons };
}

export async function qualifyLeads(
  limit: number = 0,
  inPath: string = 'data/leads_validated.json',
  outPath: string = 'data/leads_validated.json' // Overwrites by default as per the flow
): Promise<void> {
  const leads = await readLeads(inPath);
  let processed = 0;
  let qualifiedCount = 0;

  console.log(`[qualify] ${leads.length} lead(s) loaded from ${inPath}`);

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    if (!lead) continue;

    // We qualify after validate
    if (lead.workflowStatus !== 'validated') {
      continue;
    }

    if (limit > 0 && processed >= limit) {
      break;
    }

    const { score, reasons } = scoreLead(lead);
    lead.qualificationScore = score;
    lead.qualificationReasons = reasons;

    // Transition state
    // We always set to needs_review. Approval is strictly manual via `approve` command.
    lead.workflowStatus = 'needs_review';
    lead.updatedAt = new Date().toISOString();

    if (score >= 50) {
      qualifiedCount++;
    }

    processed++;
  }

  if (processed > 0) {
    await writeLeads(leads, outPath);
    console.log(`[qualify] Written ${leads.length} lead(s) to ${outPath}`);
  } else {
    console.log(`[qualify] No leads to process.`);
  }

  console.log(`\n── Qualify Complete ─────────────────────────────────────`);
  console.log(`  Processed:        ${processed}`);
  console.log(`  Score >= 50:      ${qualifiedCount}`);
}
