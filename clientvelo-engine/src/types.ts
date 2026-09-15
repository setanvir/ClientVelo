/**
 * types.ts — Zod schemas and TypeScript types for ClientVelo Engine.
 *
 * All data models live here. No runtime logic — pure schema definitions.
 * Importing this module never triggers side effects.
 */

import { z } from 'zod';

// ─── Enumerations ─────────────────────────────────────────────────────────────

export const ContactChannelSchema = z.enum([
  'direct_email',
  'generic_email',
  'contact_form',
  'phone_only',
  'none',
  'needs_manual_review',
]);

export const EmailTypeSchema = z.enum([
  'business_public',
  'generic_role',
  'personal_public',
  'unknown',
]);

export const EmailValidationStatusSchema = z.enum([
  'not_checked',
  'syntax_valid',
  'domain_has_mx',
  'role_address',
  'invalid',
  'needs_manual_review',
]);

export const AuditStatusSchema = z.enum([
  'not_checked',
  'complete',
  'partial',
  'failed',
  'site_unreachable',
]);

export const PsiStatusSchema = z.enum([
  'unavailable',
  'complete',
  'disabled',
]);

export const PrimaryIssueSchema = z.enum([
  'slow_or_heavy_mobile_page',
  'no_visible_booking_cta',
  'no_click_to_call',
  'contact_path_has_friction',
  'site_unreachable',
  'no_website',
  'no_material_issue_detected',
]);

export const WorkflowStatusSchema = z.enum([
  'new',
  'enriched',
  'validated',
  'needs_review',
  'approved',
  'drafted',
  'sent',
  'replied',
  'bounced',
  'opted_out',
  'skipped',
]);

export const DispatchStatusSchema = z.enum([
  'dry_run',
  'sent',
  'transient_error',
  'permanent_error',
  'suppressed',
  'duplicate',
  'skipped',
]);

export const JobStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'stopped',
  'interrupted',
]);

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

export const EmailCandidateSchema = z.object({
  email: z.string(),
  emailType: EmailTypeSchema,
  /** How the email was found: 'mailto_link' | 'visible_text' | 'obfuscated' | 'osm_tag' */
  source: z.string(),
});

export const AuditDataSchema = z.object({
  viewportMeta: z.boolean().nullable(),
  horizontalOverflow: z.boolean().nullable(),
  telLink: z.boolean().nullable(),
  bookingKeywordFound: z.boolean().nullable(),
  bookingCtaAboveFold: z.boolean().nullable(),
  whatsappOrSocialBookingLink: z.boolean().nullable(),
  loadTimeMs: z.number().nullable(),
  psiMobileScore: z.number().nullable(),
  /** Map of page URL → HTTP status code for all pages visited during audit */
  httpStatuses: z.record(z.string(), z.number()).nullable(),
});

// ─── Lead ─────────────────────────────────────────────────────────────────────

export const LeadSchema = z.object({
  // Base fields
  id: z.string().uuid(),
  businessName: z.string(),
  category: z.string(),
  city: z.string(),
  country: z.string(),
  websiteUrl: z.string().nullable(),
  phone: z.string().nullable(),
  source: z.string(),
  sourceUrl: z.string().nullable(),
  sourceCheckedAt: z.string().nullable(),
  rating: z.number().nullable(),
  reviewCount: z.number().nullable(),
  contactName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),

  // Contact fields (filled by enrich)
  contactChannel: ContactChannelSchema.nullable(),
  emailCandidates: z.array(EmailCandidateSchema),
  email: z.string().nullable(),
  emailType: EmailTypeSchema.nullable(),
  chosenEmailReason: z.string().nullable(),
  requiresManualAction: z.boolean(),

  // Validation (filled by validate)
  emailValidationStatus: EmailValidationStatusSchema,

  // Audit fields (filled by audit)
  auditStatus: AuditStatusSchema,
  psiStatus: PsiStatusSchema,
  screenshotPath: z.string().nullable(),
  audit: AuditDataSchema.nullable(),
  primaryIssue: PrimaryIssueSchema.nullable(),
  evidenceUrl: z.string().nullable(),
  evidenceText: z.string().nullable(),
  personalizationNote: z.string().nullable(),

  // Scoring (filled by qualify)
  qualificationScore: z.number().nullable(),
  qualificationReasons: z.array(z.string()),

  // Workflow state
  workflowStatus: WorkflowStatusSchema,

  // OSM-specific fields (null for CSV-imported leads)
  placeId: z.string().nullable(),
  osmSocial: z
    .object({
      facebook: z.string().nullable(),
      instagram: z.string().nullable(),
      whatsapp: z.string().nullable(),
    })
    .nullable(),
});

export type Lead = z.infer<typeof LeadSchema>;
export type ContactChannel = z.infer<typeof ContactChannelSchema>;
export type EmailType = z.infer<typeof EmailTypeSchema>;
export type EmailValidationStatus = z.infer<typeof EmailValidationStatusSchema>;
export type AuditStatus = z.infer<typeof AuditStatusSchema>;
export type PsiStatus = z.infer<typeof PsiStatusSchema>;
export type PrimaryIssue = z.infer<typeof PrimaryIssueSchema>;
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;
export type DispatchStatus = z.infer<typeof DispatchStatusSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type EmailCandidate = z.infer<typeof EmailCandidateSchema>;
export type AuditData = z.infer<typeof AuditDataSchema>;

// ─── DraftEntry ───────────────────────────────────────────────────────────────

export const DraftEntrySchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  campaignId: z.string(),
  recipientEmail: z.string(),
  recipientName: z.string().nullable(),
  businessName: z.string(),
  subject: z.string(),
  body: z.string(),
  primaryIssue: PrimaryIssueSchema,
  evidenceText: z.string().nullable(),
  /** Starts false; set to true only by the approve command. */
  approved: z.boolean(),
  /** SHA-256 of (recipientEmail + subject + body). Any edit voids this. */
  approvalHash: z.string().nullable(),
  /** Optional: replaces the default greeting sentence. */
  customOpener: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DraftEntry = z.infer<typeof DraftEntrySchema>;

// ─── DispatchLog ──────────────────────────────────────────────────────────────

export const DispatchLogSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  draftId: z.string().uuid(),
  recipient: z.string(),
  businessName: z.string(),
  campaignId: z.string(),
  messageHash: z.string(),
  timestamp: z.string(),
  status: DispatchStatusSchema,
  messageId: z.string().nullable(),
  smtpResponse: z.string().nullable(),
  errorCode: z.string().nullable(),
  retryCount: z.number().int().nonnegative(),
  dryRun: z.boolean(),
});

export type DispatchLog = z.infer<typeof DispatchLogSchema>;

// ─── SuppressionEntry ─────────────────────────────────────────────────────────

export const SuppressionEntrySchema = z.object({
  email: z.string(),
  /** 'opt_out' | 'bounce' | 'invalid' */
  reason: z.string(),
  createdAt: z.string(),
  /** The CLI command that created this entry */
  source: z.string(),
});

export type SuppressionEntry = z.infer<typeof SuppressionEntrySchema>;

// ─── SeenEntry (OSM deduplication ledger) ────────────────────────────────────

export const SeenEntrySchema = z.object({
  /** OSM place ID, e.g. "osm:node/12345" */
  placeId: z.string(),
  /** Normalized domain, null if no website */
  domain: z.string().nullable(),
  businessName: z.string(),
  seenAt: z.string(),
  leadId: z.string().uuid(),
});

export type SeenEntry = z.infer<typeof SeenEntrySchema>;

// ─── JobEntry ─────────────────────────────────────────────────────────────────

export const JobEntrySchema = z.object({
  id: z.string().uuid(),
  command: z.string(),
  args: z.array(z.string()),
  status: JobStatusSchema,
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  exitCode: z.number().nullable(),
});

export type JobEntry = z.infer<typeof JobEntrySchema>;

// ─── LeadProvider interface ───────────────────────────────────────────────────

/**
 * All lead source implementations (CSV, OSM, future APIs) must satisfy this
 * interface. Returns partial Lead objects; the caller fills in defaults and IDs.
 */
export interface LeadProvider {
  fetch(): Promise<Array<Partial<Lead>>>;
}
