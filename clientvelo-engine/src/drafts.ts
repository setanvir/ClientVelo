import { readDrafts, updateJson, PATHS } from './store.js';
import type { Lead, DraftEntry, PrimaryIssue } from './types.js';
import { LeadSchema, DraftEntrySchema } from './types.js';
import { z } from 'zod';
import { sha256, generateId, now } from './utils.js';
import { config } from './config.js';

const BANNED_PHRASES = [
  'losing customers',
  'you are losing',
  'guaranteed',
  'revenue',
  'redesign',
  'verified'
];

interface TemplateContext {
  lead: Lead;
}

function getGreeting(lead: Lead): string {
  if (lead.customOpener) return lead.customOpener;
  return lead.contactName ? `Hi ${lead.contactName},` : `Hi there,`;
}

function getTemplate(issue: PrimaryIssue, lead: Lead): { subject: string; sentences: string[] } {
  const businessName = lead.businessName;

  switch (issue) {
    case 'slow_or_heavy_mobile_page':
      return {
        subject: `Question about ${businessName}'s mobile site`,
        sentences: [
          `I was looking at ${lead.websiteUrl} on my phone and noticed it took ${lead.audit?.loadTimeMs}ms to load.`,
          `This delay may make it harder for mobile visitors to quickly find what they need and book your services.`,
          `Would you like me to send a 60-second video showing one possible fix?`,
        ]
      };
    case 'no_visible_booking_cta':
      return {
        subject: `Booking question for ${businessName}`,
        sentences: [
          `I was looking at ${lead.websiteUrl} on my phone and noticed there wasn't a visible booking button when the page first loads.`,
          `This extra friction may make it harder for mobile visitors to schedule an appointment.`,
          `Would you like me to send a 60-second video showing one possible fix?`,
        ]
      };
    case 'no_click_to_call':
      return {
        subject: `Phone link question for ${businessName}`,
        sentences: [
          `I was looking at ${lead.websiteUrl} on my phone and noticed the phone number isn't a clickable link.`,
          `This extra step may make it harder for mobile visitors to quickly call your office.`,
          `Would you like me to send a 60-second video showing one possible fix?`,
        ]
      };
    case 'contact_path_has_friction':
      return {
        subject: `Contact page question for ${businessName}`,
        sentences: [
          `I was looking at ${lead.websiteUrl} on my phone and noticed the contact form requires zooming to use comfortably.`,
          `This layout issue may make it harder for mobile visitors to send you inquiries.`,
          `Would you like me to send a 60-second video showing one possible fix?`,
        ]
      };
    case 'no_material_issue_detected':
      return {
        subject: `Quick question about ${businessName}`,
        sentences: [
          `I was looking at ${lead.websiteUrl} on my phone and noticed how well the site is put together.`,
          `However, there might be a few small mobile optimizations that could further improve the visitor experience.`,
          `Would you like me to send a 60-second video showing one possible fix?`,
        ]
      };
    default:
      // Fallback
      return {
        subject: `Website question for ${businessName}`,
        sentences: [
          `I was looking at ${lead.websiteUrl} on my phone and noticed a few layout details.`,
          `These details may make it harder for mobile visitors to easily navigate your site.`,
          `Would you like me to send a 60-second video showing one possible fix?`,
        ]
      };
  }
}

export function renderDraft(lead: Lead): Omit<DraftEntry, 'id' | 'createdAt' | 'updatedAt' | 'approvalHash' | 'approved'> {
  if (!lead.email) {
    throw new Error('Lead has no chosen email address');
  }
  
  if (!lead.primaryIssue) {
    throw new Error('Lead has no primary issue identified');
  }

  if (lead.primaryIssue === 'no_website' || lead.primaryIssue === 'site_unreachable') {
    throw new Error(`Cannot render draft for issue type: ${lead.primaryIssue}`);
  }

  const { subject, sentences } = getTemplate(lead.primaryIssue, lead);

  const greeting = getGreeting(lead);

  const body = `${greeting}\n\n${sentences[0]}\n\n${sentences[1]}\n\n${sentences[2]}\n\n--\n${config.FROM_NAME}\n${config.BUSINESS_NAME}\n${config.POSTAL_ADDRESS}\n${config.OPT_OUT_LINE}`;

  // Validation
  const fullText = (subject + ' ' + body).toLowerCase();

  for (const banned of BANNED_PHRASES) {
    if (fullText.includes(banned.toLowerCase())) {
      throw new Error(`Draft contains banned phrase: "${banned}"`);
    }
  }

  if (fullText.includes('undefined') || fullText.includes('null')) {
    throw new Error(`Draft contains undefined or null token. Body: ${body}`);
  }

  if (subject.toLowerCase().startsWith('re:') || subject.toLowerCase().startsWith('fwd:')) {
    throw new Error(`Draft subject contains banned prefix: "${subject}"`);
  }

  return {
    leadId: lead.id,
    campaignId: config.CAMPAIGN_ID,
    recipientEmail: lead.email,
    recipientName: lead.contactName,
    businessName: lead.businessName,
    subject,
    body,
    primaryIssue: lead.primaryIssue,
    evidenceText: lead.evidenceText,
    customOpener: null,
  };
}

export async function generateDrafts(limit: number = 0): Promise<void> {
  const generatedDrafts: DraftEntry[] = [];
  const modifiedLeadIds = new Set<string>();

  await updateJson(PATHS.leadsValidated, z.array(LeadSchema), async (leads) => {
    let processed = 0;
    
    // We also need to know existing drafts to not duplicate
    const existingDrafts = await readDrafts(PATHS.drafts);
    const existingLeadIds = new Set(existingDrafts.map(d => d.leadId));

    for (const lead of leads) {
      if (lead.workflowStatus !== 'needs_review' && lead.workflowStatus !== 'approved') {
        continue;
      }

      if (limit > 0 && processed >= limit) {
        break;
      }

      if (existingLeadIds.has(lead.id)) {
        continue;
      }

      try {
        const draftBase = renderDraft(lead);
        const draft: DraftEntry = {
          ...draftBase,
          id: generateId(),
          createdAt: now(),
          updatedAt: now(),
          approvalHash: null,
          approved: false,
        };

        generatedDrafts.push(draft);
        
        lead.workflowStatus = 'drafted';
        lead.updatedAt = now();
        modifiedLeadIds.add(lead.id);
      } catch (e: any) {
        console.log(`[drafts] Failed to generate draft for ${lead.businessName}: ${e.message}`);
      }

      processed++;
    }
    
    return leads;
  });

  if (generatedDrafts.length > 0) {
    await updateJson(PATHS.drafts, z.array(DraftEntrySchema), (drafts) => {
      return [...drafts, ...generatedDrafts];
    });
    console.log(`[drafts] Generated ${generatedDrafts.length} new drafts.`);
  } else {
    console.log(`[drafts] No new drafts generated.`);
  }
}

export async function previewDrafts(limit: number = 0): Promise<void> {
  const drafts = await readDrafts();
  let count = 0;
  
  for (const draft of drafts) {
    if (limit > 0 && count >= limit) break;

    console.log(`\n── Draft Preview ───────────────────────────────────────`);
    console.log(`Recipient: ${draft.recipientName ? draft.recipientName + ' ' : ''}<${draft.recipientEmail}>`);
    console.log(`Business:  ${draft.businessName}`);
    console.log(`Issue:     ${draft.primaryIssue}`);
    console.log(`Evidence:  ${draft.evidenceText}`);
    console.log(`Status:    ${draft.approved ? 'APPROVED' : 'PENDING'}`);
    console.log(`\nSubject:   ${draft.subject}`);
    console.log(`\n${draft.body}`);
    console.log(`────────────────────────────────────────────────────────`);

    count++;
  }

  console.log(`\nPreviewed ${count} draft(s).`);
}

export async function approveDraft(draftId: string): Promise<void> {
  let draftBusinessName = '';
  let leadId = '';

  await updateJson(PATHS.drafts, z.array(DraftEntrySchema), (drafts) => {
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) throw new Error(`Draft ${draftId} not found.`);
    
    // We must validate the current body text for banned phrases, missing tokens, etc.
    const fullText = (draft.subject + ' ' + draft.body).toLowerCase();
    for (const banned of BANNED_PHRASES) {
      if (fullText.includes(banned.toLowerCase())) {
        throw new Error(`Draft contains banned phrase: "${banned}"`);
      }
    }
    if (fullText.includes('undefined') || fullText.includes('null')) {
      throw new Error(`Draft contains undefined or null token. Body: ${draft.body}`);
    }
    if (draft.subject.toLowerCase().startsWith('re:') || draft.subject.toLowerCase().startsWith('fwd:')) {
      throw new Error(`Draft subject contains banned prefix: "${draft.subject}"`);
    }
    
    draft.approved = true;
    draft.approvalHash = sha256(draft.recipientEmail + draft.subject + draft.body);
    draft.updatedAt = now();
    
    draftBusinessName = draft.businessName;
    leadId = draft.leadId;
    return drafts;
  });

  if (leadId) {
    await updateJson(PATHS.leadsValidated, z.array(LeadSchema), (leads) => {
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        lead.workflowStatus = 'approved';
        lead.updatedAt = now();
      }
      return leads;
    });
    console.log(`[drafts] Approved draft ${draftId} for ${draftBusinessName}`);
  }
}

export async function revokeDraft(draftId: string): Promise<void> {
  let draftBusinessName = '';
  let leadId = '';

  await updateJson(PATHS.drafts, z.array(DraftEntrySchema), (drafts) => {
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) throw new Error(`Draft ${draftId} not found.`);
    
    draft.approved = false;
    draft.approvalHash = null;
    draft.updatedAt = now();
    
    draftBusinessName = draft.businessName;
    leadId = draft.leadId;
    return drafts;
  });

  if (leadId) {
    await updateJson(PATHS.leadsValidated, z.array(LeadSchema), (leads) => {
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        lead.workflowStatus = 'drafted';
        lead.updatedAt = now();
      }
      return leads;
    });
    console.log(`[drafts] Revoked draft ${draftId} for ${draftBusinessName}`);
  }
}

export async function updateDraft(draftId: string, subject?: string, body?: string): Promise<void> {
  await updateJson(PATHS.drafts, z.array(DraftEntrySchema), (drafts) => {
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) throw new Error(`Draft ${draftId} not found.`);
    
    if (subject !== undefined) draft.subject = subject;
    if (body !== undefined) draft.body = body;
    
    draft.updatedAt = now();
    
    // If it was already approved, changing it silently invalidates the approvalHash
    // so we should probably revoke it if edited while approved.
    if (draft.approved) {
       draft.approved = false;
       draft.approvalHash = null;
    }
    
    return drafts;
  });
}

export async function approveAllPending(): Promise<void> {
  const approvedLeadIds: string[] = [];

  await updateJson(PATHS.drafts, z.array(DraftEntrySchema), (drafts) => {
    for (const draft of drafts) {
      if (!draft.approved) {
        draft.approved = true;
        draft.approvalHash = sha256(draft.recipientEmail + draft.subject + draft.body);
        draft.updatedAt = now();
        approvedLeadIds.push(draft.leadId);
      }
    }
    return drafts;
  });

  if (approvedLeadIds.length > 0) {
    await updateJson(PATHS.leadsValidated, z.array(LeadSchema), (leads) => {
      for (const lead of leads) {
        if (approvedLeadIds.includes(lead.id)) {
          lead.workflowStatus = 'approved';
          lead.updatedAt = now();
        }
      }
      return leads;
    });
    console.log(`[drafts] Approved ${approvedLeadIds.length} pending draft(s).`);
  } else {
    console.log(`[drafts] No pending drafts to approve.`);
  }
}
