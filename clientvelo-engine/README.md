# ClientVelo Engine

An autonomous, offline-first B2B lead generation and outreach engine.

## Overview

ClientVelo Engine discovers local businesses via OpenStreetMap, enriches them with contact details, performs automated local mobile audits, validates emails, and safely queues personalized outreach. It is designed to be run as a daily cron job.

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```
2. Install Playwright browsers (for enrichment/audits):
   ```bash
   npx playwright install chromium
   ```
3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your SMTP credentials, limits, and window settings.
   ```

## Workflow (Phase 5 Dashboard)

The backend engine processes the leads, but you MUST review and approve them using the local web dashboard. **The dashboard NEVER sends emails.**

1. **Import**
   Run the initial import step. This deduplicates against existing leads in `data/leads.json` and skips invalid rows:
   ```bash
   npx tsx src/cli.ts import data/raw/dentists-seattle.csv
   ```

2. **Enrichment & Audit (Playwright)**
   Crawl imported leads up to a bounded 3-page depth. It extracts an exact `owner@` or `contact@` email, or the first valid business email found. It takes a mobile screenshot and checks for mobile-friendliness.
   ```bash
   npx tsx src/cli.ts enrich
   ```

3. **Validation, Scoring, & Drafting**
   Validates syntax and MX records of found emails. Leads with a score >= 50 get moved to `data/leads_validated.json` and receive a draft email in `data/drafts.json`. No emails are sent yet.
   ```bash
   npx tsx src/cli.ts qualify
   ```

4. **Review & Approval (Dashboard)**
   To ensure maximum safety and deliverability, you must visually review and approve drafts.
   ```bash
   npx tsx src/cli.ts serve --demo
   ```
   - Open `http://localhost:3000`
   - Use the **Review Workspace** to navigate drafts (using `J`/`K`).
   - Press `A` to approve. The draft's exact text is SHA-256 hashed.

   For leads lacking an email or phone-only, use the **Manual Outreach** view to generate WhatsApp scripts.

5. **Send Queue**
   Dispatches approved drafts to the SMTP server defined in your `.env`.
   The engine enforces a strict sending schedule (M-F, 9am-5pm) and a daily cap (max 20/day) to prevent spam triggering.
   ```bash
   npx tsx src/cli.ts queue --send
   ```
   Monitor the live send progress from the **Dispatch Logs** view in the dashboard.

6. **Export (Optional)**
   Export the final structured data for external CRMs or manual processing:
   ```bash
   npx tsx src/cli.ts export-manual
   ```

## Note on Dry Run

By default, the `.env.example` sets `DRY_RUN=true`. When you run `npx tsx src/cli.ts queue --send`, the system will print a log of what it *would* send and record a dry-run in `dispatch_logs.json`, without actually contacting the SMTP server. 
In production, `DRY_RUN` must be set to `false` in your `.env` file to actually dispatch emails.

## OpenStreetMap (OSM) Attribution and ODbL Compliance

ClientVelo Engine utilizes data from OpenStreetMap.
**Data Source:** © OpenStreetMap contributors. 
**License:** Open Data Commons Open Database License (ODbL).

When using this software to generate leads or construct databases, you must comply with the ODbL. This means attributing OpenStreetMap appropriately and sharing any derivative databases under the same license if they are publicly distributed. (Internal business use is generally permitted without share-alike triggers, but you should review the license).

## Compliance Warnings

- **Local Laws**: You are solely responsible for ensuring your outreach complies with local anti-spam legislation (e.g., CAN-SPAM, GDPR, CASL, ACMA).
- **Suppression**: Always honor opt-out requests immediately via the Dashboard or CLI.
- **Targeting**: This engine is intended for B2B (Business-to-Business) outreach. Do not use this tool to contact individuals at personal addresses unless you have explicit consent.
