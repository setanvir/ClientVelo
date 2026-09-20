# ClientVelo Engine — Implementation Plan

## Overview

**ClientVelo Engine** is a CLI-only Node.js/TypeScript MVP for low-volume, high-quality local-business B2B outreach (≤20 emails/day). It discovers leads from OpenStreetMap (primary) or a hand-prepared CSV (fallback), enriches them with bounded Playwright website inspection, audits mobile UX, validates emails, scores leads, drafts plain-text emails from approved templates, and dispatches them over SMTP with multi-layered safety controls.

No frontend. No scraping. No fabrication. Every outgoing message must trace to a real measured audit value.

---

## Open Questions

> [!IMPORTANT]
> **Q1 — Playwright installation**: The spec uses Chromium via Playwright. On Windows, `npx playwright install chromium` is separate from `npm install`. The README will document this; no runtime issue expected, but confirming you'll run that step before Phase 2.

> [!IMPORTANT]
> **Q2 — SMTP provider for dry-run demos**: The spec mentions Gmail App Password is acceptable for testing. All Phase 1–3 demos send nothing; Phase 4 demos only do a dry-run. Live sending will only be enabled when you explicitly approve. Confirming this is fine.

> [!NOTE]
> **Q3 — Niche-to-OSM-tag map**: The spec lists three niches (Dental Clinic, Salon, HVAC). The map will be hardcoded as a config object in `src/config.ts` with a note to verify new tags at taginfo.openstreetmap.org. You can extend the map via an env var or direct config edit.

> [!NOTE]
> **Q4 — `CHAIN_BLOCKLIST` default**: The spec leaves it blank. It will default to an empty array; you populate it with chains to skip (e.g., `"Starbucks,McDonalds"`).

---

## Proposed Changes

The entire project is **new**. All files are `[NEW]`.

---

### Root scaffold

#### [NEW] `clientvelo-engine/package.json`
- `type: "module"` (ESM)
- `scripts`: `dev`, `test`, `lint`
- Dependencies: `playwright`, `nodemailer`, `dotenv`, `zod`, `tsx`
- DevDependencies: `@types/nodemailer`, `typescript`
- Test command: `node --import tsx --test tests/*.test.ts`

#### [NEW] `clientvelo-engine/tsconfig.json`
- Target: `ES2022`, `NodeNext` module resolution, strict mode, `noUncheckedIndexedAccess`

#### [NEW] `clientvelo-engine/.env.example`
All variables from the spec, with safe defaults (`DRY_RUN=true`, `SEND_CONFIRMATION_REQUIRED=true`).  
Includes new OSM vars: `OVERPASS_URL`, `OVERPASS_TIMEOUT_SECONDS`, `MAX_DISCOVER_PER_RUN`, `CHAIN_BLOCKLIST`, `USER_AGENT`.

#### [NEW] `clientvelo-engine/.gitignore`
Excludes: `.env`, `data/*` (except `data/leads_input.example.csv`), `node_modules`, `data/screenshots/`, `data/errors/`, `data/osm_cache/`

#### [NEW] `clientvelo-engine/README.md`
Covers everything the spec mandates (install, CSV format, dry-run workflow, MX limitations, bounce disclaimer, SMTP setup, suppression, safe-stop, troubleshooting, data formats, compliance notes, OSM attribution, ODbL note).

---

### Source files (`src/`)

#### [NEW] `src/types.ts`
All Zod schemas and inferred TypeScript types for:
- `Lead` (base + contact + validation + audit + scoring + workflow status)
- `DraftEntry` (with `approved`, `approvalHash`, `customOpener`)
- `DispatchLog`
- `SuppressionEntry`
- `SeenEntry`
- Enum literals: `contactChannel`, `emailValidationStatus`, `auditStatus`, `primaryIssue`, `workflowStatus`, `dispatchStatus`, `emailType`

#### [NEW] `src/config.ts`
- Loads `.env` via `dotenv`
- Validates all env vars with Zod; exits with a clear message on any missing/invalid value
- Never logs secrets
- Exports a frozen `config` object
- Contains the niche-to-OSM-tag map (e.g., `"Dental Clinic" → ["amenity=dentist","healthcare=dentist"]`)
- Validates `RAMP_SCHEDULE` as a comma-separated list of integers

#### [NEW] `src/utils.ts`
- `delay(ms)` — resolves after ms with optional jitter
- `randomBetween(min, max)` — integer ms
- `sha256(s)` — hex hash for approval binding
- `normalizeUrl(raw)` — strips trailing slash, lowercases scheme/host, validates URL format
- `normalizeEmail(raw)` — lowercase, trim
- `extractDomain(url|email)` — for domain-based deduplication and cooldown
- `isInSendWindow(config)` — checks timezone-aware time and day-of-week
- `currentCampaignDay(logs)` — count distinct calendar days with ≥1 sent dispatch
- `sleep(signal)` — abortable sleep for graceful Ctrl+C

#### [NEW] `src/store.ts`
- Generic `readJson<T>(path, schema)` — reads, parses, validates with Zod; returns `[]`/`{}` on missing file; throws on malformed JSON (never silently corrupt)
- Generic `writeJson<T>(path, data)` — atomic: write to `.tmp`, `fsync`, `rename`; creates directories if needed
- Convenience wrappers: `readLeads()`, `writeLeads()`, `readDrafts()`, `writeDrafts()`, `readDispatchLogs()`, `writeDispatchLogs()`, `readSuppression()`, `writeSuppression()`, `readSeen()`, `writeSeen()`

#### [NEW] `src/cli.ts`
Command router. Parses `process.argv` (no framework needed at this scale). Dispatches to handlers. Every command catches errors and exits with code 1 on failure, 0 on success. Commands:

| Command | Handler module |
|---|---|
| `import` | `src/import.ts` |
| `discover` | `src/discover.ts` |
| `enrich` | `src/enrich.ts` |
| `audit` | `src/audit.ts` |
| `validate` | `src/validate.ts` |
| `qualify` | `src/qualify.ts` |
| `draft` | `src/drafts.ts` |
| `preview` | `src/drafts.ts` |
| `approve` | `src/drafts.ts` |
| `send` | `src/queue.ts` |
| `mark-opt-out` | `src/suppression.ts` |
| `mark-bounce` | `src/suppression.ts` |
| `mark-invalid` | `src/suppression.ts` |
| `mark-replied` | `src/suppression.ts` |
| `export-manual` | `src/export.ts` |
| `status` | inline summary |
| `run-daily` | orchestrates discover→enrich→audit→validate→qualify→draft→preview, stops before approve |
| `test` | runs node test runner |

`send` requires both `DRY_RUN=false` AND `--send` flag; otherwise always dry-runs.

#### [NEW] `src/import.ts`
- Implements the `LeadProvider` interface (`{ discover(): Promise<Partial<Lead>[]> }`)
- Reads CSV via Node.js `fs` + manual parsing (no extra dep)
- Validates required columns, normalizes URLs, dedupes by `businessName+city` (exact match)
- Writes invalid rows to `data/errors/import_errors_<timestamp>.csv` (never silent drop)
- Assigns `source="csv"`, `workflowStatus="new"`, generates UUID `id`
- Idempotent: re-run skips already-imported leads (same normalized `websiteUrl` or same `businessName+city`)

#### [NEW] `src/discover.ts`
- Implements the same `LeadProvider` interface
- Builds Overpass QL query using niche-to-tag map; queries named administrative area, not bounding box
- Sets `User-Agent` header from config
- Caches raw JSON responses in `data/osm_cache/<niche>-<city>-<date>.json`; reuses if < 24h old
- Exponential backoff on HTTP 429/504; never loops or hammers
- Extracts nodes/ways/relations; uses `center` for ways
- Maps OSM tags → Lead fields; handles `contact:phone`, `contact:email`, `contact:website`, social tags
- Dedupes by `place_id` and website domain; cross-references `seen.json`; appends new entries to `seen.json`
- Applies `CHAIN_BLOCKLIST`; skips entries with no `name`
- Hard cap: `MAX_DISCOVER_PER_RUN` (default 50)
- Leads with no website: `primaryIssue=no_website`, `contactChannel=phone_only` (or `direct_email` if OSM email tag exists)
- `source="OpenStreetMap contributors (ODbL)"`, `sourceUrl="https://www.openstreetmap.org/{type}/{id}"`
- Writes to `leads_raw.json` (merges with existing)

#### [NEW] `src/enrich.ts`
- Receives leads in `workflowStatus=new`
- For each lead with a `websiteUrl`, launches Playwright (headless Chromium, 390×844 viewport)
- Visits up to `MAX_PAGES_PER_DOMAIN` pages (homepage, `/contact`, `/about`, one service-adjacent link)
- Respects `robots.txt` (fetch and parse before visiting)
- Per-page timeout: `PAGE_TIMEOUT_MS`; per-domain delay: `PER_DOMAIN_DELAY_MS`; max response size guard
- Extracts: `mailto:` links, visible emails (regex, obfuscations), phone numbers, contact-form presence, page title, service descriptions
- Deobfuscates `[at]`/`(at)`/`(dot)` patterns
- Classifies each email candidate: `business_public | generic_role | personal_public | unknown`
- Picks preferred email with written `chosenEmailReason`; sets `contactChannel` and `requiresManualAction`
- If only contact form: `contactChannel=contact_form`, `email=null`, `requiresManualAction=true`
- Updates `workflowStatus=enriched`; writes `leads_enriched.json`
- Clean failure: `auditStatus=site_unreachable` or `failed`; logs to `data/errors/`

#### [NEW] `src/audit.ts`
- Playwright at 390×844 (separate from enrich; may reuse browser instance)
- Measures: `viewportMeta` (has `<meta name=viewport>`), `horizontalOverflow`, `telLink` (clickable `tel:` link), `bookingKeywordFound` (regex), `bookingCtaAboveFold`, `whatsappOrSocialBookingLink`, `loadTimeMs` (Navigation Timing API)
- Takes one screenshot per lead → `data/screenshots/<leadId>.png`; records `screenshotPath`
- Optional PSI: if `AUDIT_PSI_ENABLED=true` and `PAGESPEED_INSIGHTS_API_KEY` is set, calls PSI API for mobile score → `psiMobileScore`; if unavailable or disabled → `psiStatus=unavailable`
- Derives `primaryIssue` from measured values using thresholds from config (`LOAD_SLOW_MS`, `PSI_POOR_SCORE`)
- Wording is cautious: "may make it harder for mobile visitors to…"
- `no_website` primary issue is set by discover, not audit; audit skips leads with no URL
- Updates `workflowStatus=enriched` (audit is part of enrichment phase); writes `leads_enriched.json`

#### [NEW] `src/validate.ts`
- Reads `leads_enriched.json`, processes each lead's `email`
- Syntax check (RFC 5321-compliant regex)
- Domain normalization (lowercase)
- MX lookup: `dns.promises.resolveMx` with configurable timeout; catches `ENODATA`, `ENOTFOUND`, `ETIMEOUT`
- Role-address detection: `info@`, `contact@`, `hello@`, `office@`, `support@`, `sales@`, `admin@` → flagged, ranked lower, not rejected
- Blocked-address detection: `noreply@`, `no-reply@`, `abuse@`, `postmaster@`, `mailer-daemon@` → excluded
- Optional disposable-domain check (static list, no network call)
- Sets `emailValidationStatus`; never claims address is "verified" or bounce-free
- Writes `leads_validated.json`; updates `workflowStatus=validated` or `needs_review`

#### [NEW] `src/qualify.ts`
- Reads `leads_validated.json`
- Scores observable evidence only: niche match, city match, has website, audit completed, clear primary issue, `MIN_REVIEW_COUNT` (only if `reviewCount` exists), contactability, evidence quality
- OSM leads: uses `has website`, `has email tag`, `has phone`, tag completeness, audit result, city match
- Outputs `qualificationScore` (0–100) and `qualificationReasons[]`
- Sets `workflowStatus=needs_review` if score below threshold; does NOT set to `approved` (that's manual)
- Writes back to `leads_validated.json`

#### [NEW] `src/drafts.ts`
Handles `draft`, `preview`, and `approve` commands.

**Draft generation**:
- Templates: 4 variants keyed by `primaryIssue` (`slow_or_heavy_mobile_page`, `no_visible_booking_cta`, `no_click_to_call`, `contact_path_has_friction`)
- `no_website` variant is manual-only (WhatsApp/call script), never queued for email
- Format: greeting + exactly 3 sentences + footer (sender name, business name, postal address, opt-out line)
- Fails rendering if: any token is missing/undefined/null, compliance fields absent, banned phrase present
- Banned phrases: `"losing customers"`, `"you are losing"`, `"guaranteed"`, `"revenue"`, `"redesign"`, `"verified"`, subject prefixes `"Re:"`, `"Fwd:"`
- Subject: < 8 words, not deceptive
- No links, images, tracking pixels, attachments
- `customOpener` field supported (replaces greeting sentence)
- Stores in `drafts.json` with `approved=false`, `approvalHash=null`

**Approve**:
- Computes `sha256(recipientEmail + subject + body)`; stores as `approvalHash`; sets `approved=true`
- Any subsequent edit to subject/body voids approval (queue checks hash)

**Preview**:
- Prints each draft: recipient, business, subject, body, screenshot path, evidence behind each claim

#### [NEW] `src/suppression.ts`
- `suppression.json` schema: `{ email, reason, createdAt, source }`
- `mark-opt-out <email>` → adds entry, sets lead `workflowStatus=opted_out`
- `mark-bounce <email>` → adds entry, sets lead `workflowStatus=bounced`
- `mark-invalid <email>` → adds entry, sets lead `emailValidationStatus=invalid`
- `mark-replied <email>` → sets lead `workflowStatus=replied`; does NOT suppress
- All writes atomic via `store.ts`

#### [NEW] `src/mailer.ts`
- Thin Nodemailer wrapper
- Creates a transporter from SMTP config; verifies connection before sending
- `sendMessage(opts)` → returns `{ messageId, smtpResponse }`
- Throws on permanent errors (4xx/5xx recipient codes); returns retriable error on transient (connection reset, timeout)
- Never logs SMTP credentials

#### [NEW] `src/queue.ts`
Pre-send safety gauntlet — every condition must pass or the message is skipped/errored:

1. `DRY_RUN` must be `false`
2. `--send` flag present
3. Lead `workflowStatus === "approved"`
4. Draft `approved === true`
5. Approval hash matches `sha256(recipient + subject + body)` at send time
6. `emailValidationStatus` ∈ `{syntax_valid, domain_has_mx}` (not role — those pass if chosen)
7. Recipient not in suppression list
8. No duplicate dispatch (same leadId + campaignId + messageHash)
9. `DOMAIN_COOLDOWN_DAYS` check (advisory, logged)
10. Daily count from `dispatch_logs.json` < effective cap = `min(DAILY_SEND_LIMIT, RAMP_SCHEDULE[campaignDay])`
11. Send window active (`isInSendWindow`)
12. Sender identity valid (FROM_NAME, FROM_EMAIL, POSTAL_ADDRESS, OPT_OUT_LINE all set)
13. Subject and body non-empty, no banned content

**Batch preview**: Before live sends, print a table: recipient, business, subject, count X/Y, window status, dry-run flag. Require confirmation if `SEND_CONFIRMATION_REQUIRED=true`.

**Dispatch loop**:
- One message at a time
- Random delay `randomBetween(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS)` seconds between sends
- Retry transient errors up to `MAX_RETRIES`; never retry permanent recipient errors
- Stop after 2 consecutive SMTP errors
- Bounce stop rule: halt if (≥2 bounces in last 20 sends) OR (bounces/sent_total > `BOUNCE_STOP_RATE` when sent_total ≥ 50)
- Graceful Ctrl+C: catch `SIGINT`, flush current log entry, exit cleanly
- Log every attempt (dry_run | sent | transient_error | permanent_error | suppressed | duplicate | skipped) to `dispatch_logs.json` atomically

#### [NEW] `src/export.ts`
- Reads `leads_validated.json`
- Filters: `contactChannel ∈ {phone_only, contact_form, none}` OR `email === null`
- Writes CSV: `name, phone, website, primaryIssue, evidenceText, screenshotPath`

---

### Data files

#### [NEW] `data/leads_input.example.csv`
Example CSV with columns: `businessName,category,city,country,websiteUrl,phone,rating,reviewCount,contactName,source,sourceUrl`
(3–5 fictional rows; this is the only `data/` file committed to git)

#### Auto-created at runtime (not committed)
- `data/leads_raw.json` — after import/discover
- `data/leads_enriched.json` — after enrich + audit
- `data/leads_validated.json` — after validate + qualify
- `data/drafts.json` — after draft
- `data/dispatch_logs.json` — after any send attempt
- `data/suppression.json` — after any mark-* command
- `data/seen.json` — OSM deduplication ledger
- `data/osm_cache/` — raw Overpass responses
- `data/screenshots/` — one PNG per audited lead
- `data/errors/` — import error CSVs, fetch failure logs

---

### Tests (`tests/`)

All tests mock SMTP, DNS, Playwright, and time. No real network calls.

| Test file | Coverage |
|---|---|
| `tests/validate.test.ts` | Malformed email, valid email, no-MX domain, MX timeout, role addresses, blocked addresses, disposable domain |
| `tests/drafts.test.ts` | Missing tokens, missing compliance fields, banned phrases, `"undefined"` in output, no-website variant not queued, customOpener |
| `tests/suppression.test.ts` | Opt-out suppresses, bounce suppresses, mark-invalid, mark-replied does NOT suppress, suppression checked before send |
| `tests/queue.test.ts` | Approval hash voids on edit, daily cap, ramp schedule, bounce stop rule, send window, SEND_DAYS, missing --send flag, dry-run, duplicate prevention, transient retry, permanent failure, graceful interruption |
| `tests/store.test.ts` | Atomic write (temp+rename), malformed JSON protection, concurrent-safe read |
| `tests/discover.test.ts` | Contact:* tag fallbacks, missing-name skip, deduplication, seen.json, cache reuse, 429 backoff, null-review handling, no_website routing |
| `tests/import.test.ts` | CSV column validation, path traversal attempt, duplicate detection, invalid-row error report |

Run command: `node --import tsx --test tests/*.test.ts`

---

## Build Phases

### Phase 1 — Foundation
**Files**: `package.json`, `tsconfig.json`, `.env.example`, `.gitignore`, `src/types.ts`, `src/config.ts`, `src/utils.ts`, `src/store.ts`, `src/cli.ts`, `src/import.ts`, `src/discover.ts`, `data/leads_input.example.csv`  
**Tests**: `store.test.ts`, `import.test.ts`, `discover.test.ts` (mocked Overpass)  
**Demo**: `tsx src/cli.ts import --file data/leads_input.example.csv` (dry output to console); `tsx src/cli.ts discover --niche "Dental Clinic" --city "Dhaka" --limit 5` (cached/mocked)

---

### Phase 2 — Enrichment & Audit
**Files**: `src/enrich.ts`, `src/audit.ts`  
**Demo**: Run enrich + audit on ≤5 leads; show screenshot paths, audit fields, contact classification

---

### Phase 3 — Validation, Qualification, Drafts, Export
**Files**: `src/validate.ts`, `src/qualify.ts`, `src/drafts.ts`, `src/suppression.ts`, `src/export.ts`  
**Tests**: `validate.test.ts`, `drafts.test.ts`, `suppression.test.ts`  
**Demo**: Render sample drafts, preview output, export-manual CSV; send nothing

---

### Phase 4 — Send Queue
**Files**: `src/mailer.ts`, `src/queue.ts`, `README.md` (finalized)  
**Tests**: `queue.test.ts`  
**Demo**: Full dry-run end-to-end (`run-daily` + `approve` + `send` in dry-run mode); live sending disabled

---

## Data Flow

```
discover (OSM) ──┐
import   (CSV) ──┴─→ leads_raw.json
                       ↓ enrich
                  leads_enriched.json  +  screenshots/
                       ↓ audit (merged)
                  leads_enriched.json  (audit fields added)
                       ↓ validate
                  leads_validated.json
                       ↓ qualify
                  leads_validated.json (scores added)
                       ↓ [manual: approve]
                  leads_validated.json (workflowStatus=approved)
                       ↓ draft
                  drafts.json (approved=false)
                       ↓ [manual: preview → approve]
                  drafts.json (approved=true, approvalHash set)
                       ↓ send (multi-gate safety check)
                  dispatch_logs.json
```

---

## Safety Controls Summary

| Control | Mechanism |
|---|---|
| No accidental sends | `DRY_RUN=true` default + `--send` flag required |
| Approval binding | SHA-256 of recipient+subject+body; any edit voids |
| Suppression | Checked immediately before every send |
| Daily cap | `min(DAILY_SEND_LIMIT, RAMP_SCHEDULE[day])` from logs, never memory |
| Send window | Timezone-aware time + day-of-week check |
| Bounce stop | ≥2/last-20 OR rate > BOUNCE_STOP_RATE at 50+ sent |
| SMTP error stop | 2 consecutive transient errors halt the run |
| Duplicate prevention | leadId + campaignId + messageHash |
| No fabricated claims | Rendering fails if any token is null/undefined |
| No banned phrases | Rendering fails if phrase detected |
| No secrets in logs | `mailer.ts` never logs credentials |
| Atomic writes | temp+fsync+rename on all JSON writes |
| Path traversal | Import validates file path before opening |
| robots.txt | Fetched and parsed before Playwright visits |
| OSM etiquette | User-Agent, 24h cache, exponential backoff, one query per run |

---

## Risks & Assumptions

1. **Playwright / anti-bot**: Small public business sites rarely have bot detection, but some may. Enrichment will fail gracefully and log.
2. **MX ≠ deliverability**: MX lookup confirms domain advertises mail servers only. Bounce rates will not be zero. All messaging avoids claiming otherwise.
3. **SMTP reputation**: Gmail App Passwords work for low-volume testing; a dedicated sending domain is better for any sustained use.
4. **OSM data quality**: OSM tags vary in completeness by region. Dhaka dental clinics may have sparse address/phone data. The scorer handles missing fields gracefully.
5. **PSI quotas**: PageSpeed Insights free tier has a quota. `AUDIT_PSI_ENABLED=false` by default.
6. **Jurisdiction**: CAN-SPAM, GDPR, and local equivalents (Bangladesh PDPA, etc.) are the operator's responsibility. The tool includes opt-out and postal address in every email footer.
7. **ODbL compliance**: OSM data is under the Open Database License. The README includes required attribution and a note that derived works must also be ODbL.
8. **False positives**: Audit heuristics (booking CTA above fold, etc.) may misclassify. The `preview` command and `evidenceText` field allow human review before approve.
9. **File count**: Currently ~16 source files. `src/cli.ts` is the router; it could grow. We will merge if any file becomes trivial.

---

## Verification Plan

### Automated Tests
```bash
node --import tsx --test tests/*.test.ts
```
All tests mock external I/O. Target: zero failing tests before each phase demo.

### Phase demos (dry-run only through Phase 3)
- Phase 1: Import CSV + Discover (mocked OSM) → status output
- Phase 2: Enrich + Audit on ≤5 leads → show enriched JSON + screenshot paths
- Phase 3: Validate + Qualify + Draft + Preview → rendered drafts, no send
- Phase 4: Full dry-run end-to-end → dispatch_logs.json entries with `status=dry_run`

### Manual verification
- Confirm `.env.example` is accurate and complete
- Confirm `data/` (except example CSV) is gitignored
- Confirm no secrets appear in any log output
- Confirm `send` without `--send` flag always dry-runs
- Confirm `approve` hash voids when body is edited
