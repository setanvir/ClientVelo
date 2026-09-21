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

## Workflow (Phase 6 Command Center)

The backend engine processes the leads, but you MUST review and approve them using the local web dashboard. **The dashboard NEVER sends emails directly.** Instead, it securely spawns background CLI jobs that you can monitor in real-time.

1. **Start the Dashboard**
   ```bash
   npx tsx src/cli.ts serve
   ```
   - Open \`http://localhost:3000\`
   - You must use the generated \`X-CV-Token\` (printed in terminal) to authenticate if not using \`--demo\`.

2. **Discover (Action Center)**
   Use the UI to discover leads from OpenStreetMap, or run the CLI:
   ```bash
   npx tsx src/cli.ts discover --niche "dentist" --city "Seattle" --limit 10
   ```

3. **Enrichment & Audit (Playwright)**
   Crawl imported leads up to a bounded 3-page depth. It extracts an exact \`owner@\` or \`contact@\` email, or the first valid business email found. It takes a mobile screenshot and checks for mobile-friendliness.
   \`\`\`bash
   npx tsx src/cli.ts enrich
   \`\`\`

4. **Validation, Scoring, & Drafting**
   Validates syntax and MX records of found emails. Leads with a score >= 50 get moved to \`data/leads_validated.json\` and receive a draft email in \`data/drafts.json\`. No emails are sent yet.
   \`\`\`bash
   npx tsx src/cli.ts qualify
   \`\`\`

5. **Review & Approval (Dashboard)**
   To ensure maximum safety and deliverability, you must visually review and approve drafts.
   - Use the **Review Workspace** to navigate drafts (using \`J\`/\`K\`).
   - Press \`A\` to approve. The draft's exact text is SHA-256 hashed.
   
   For leads lacking an email or phone-only, use the **Manual Outreach** view to generate WhatsApp scripts.

6. **Send Queue (Live Send)**
   Dispatches approved drafts to the SMTP server defined in your \`.env\`.
   The engine enforces a strict sending schedule (M-F, 9am-5pm) and a daily cap (max 20/day) to prevent spam triggering. 
   You can start this from the **Overview Action Center** ("Live Send Approved") or via CLI:
   \`\`\`bash
   npx tsx src/cli.ts send --send --confirm-batch <sha256-fingerprint>
   \`\`\`
   Monitor the live send progress from the **Live Console** view in the dashboard. The system utilizes file-based locks (\`.send.lock\`) to ensure only one batch can run at a time, and a cooperative halt signal (\`.stop-send\`) can be sent via the UI.

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
