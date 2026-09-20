import { readLeads } from './store.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function exportManual(outPath: string = 'data/manual_outreach.csv'): Promise<void> {
  const leads = await readLeads('data/leads_validated.json'); // We'll export from validated/enriched leads
  const toExport = leads.filter(
    l => l.contactChannel === 'phone_only' || l.contactChannel === 'contact_form' || l.contactChannel === 'none' || l.email === null
  );

  if (toExport.length === 0) {
    console.log('[export] No leads require manual outreach.');
    return;
  }

  const header = ['businessName', 'phone', 'websiteUrl', 'primaryIssue', 'evidenceText', 'screenshotPath'].join(',') + '\n';
  const rows = toExport.map(l => {
    return [
      `"${(l.businessName || '').replace(/"/g, '""')}"`,
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${(l.websiteUrl || '').replace(/"/g, '""')}"`,
      `"${(l.primaryIssue || '').replace(/"/g, '""')}"`,
      `"${(l.evidenceText || '').replace(/"/g, '""')}"`,
      `"${(l.screenshotPath || '').replace(/"/g, '""')}"`
    ].join(',');
  }).join('\n');

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, header + rows, 'utf8');

  console.log(`[export] Exported ${toExport.length} lead(s) for manual outreach to ${outPath}`);
}
