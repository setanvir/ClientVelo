import { Router } from 'express';
import { readLeads, writeLeads, readDrafts, readSuppression, readJsonArray } from './store.js';
import { updateDraft, approveDraft, revokeDraft } from './drafts.js';
import { addSuppression } from './suppression.js';
import { getJobs, getJob, getJobOutput, spawnJob, stopJob } from './jobs.js';
import { previewSendBatch } from './queue.js';
import { config } from './config.js';
import fs from 'node:fs/promises';

export const apiRouter = Router();

apiRouter.get('/overview', async (req, res) => {
  try {
    const [leads, drafts, suppressions] = await Promise.all([
      readLeads('data/leads_validated.json'),
      readDrafts(),
      readSuppression()
    ]);

    const stats = {
      totalLeads: leads.length,
      needsReview: leads.filter(l => l.workflowStatus === 'needs_review').length,
      approved: leads.filter(l => l.workflowStatus === 'approved').length,
      drafted: leads.filter(l => l.workflowStatus === 'drafted').length,
      sent: leads.filter(l => l.workflowStatus === 'sent').length,
      suppressed: suppressions.length
    };

    res.json({ stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/leads', async (req, res) => {
  try {
    let leads = await readLeads('data/leads_validated.json');
    
    // Filtering
    const status = req.query.status as string;
    if (status) {
      if (status === 'manual_outreach') {
        leads = leads.filter(l => l.requiresManualAction || ['phone_only', 'contact_form', 'needs_manual_review'].includes(l.contactChannel || ''));
      } else {
        leads = leads.filter(l => l.workflowStatus === status);
      }
    }

    const contactChannel = req.query.contactChannel as string;
    if (contactChannel) {
      leads = leads.filter(l => l.contactChannel === contactChannel);
    }

    const emailClass = req.query.emailClass as string;
    if (emailClass) {
      leads = leads.filter(l => l.emailType === emailClass);
    }

    const primaryIssue = req.query.primaryIssue as string;
    if (primaryIssue) {
      leads = leads.filter(l => l.primaryIssue === primaryIssue);
    }

    const minScore = parseInt(req.query.minScore as string);
    if (!isNaN(minScore)) {
      leads = leads.filter(l => (l.qualificationScore || 0) >= minScore);
    }

    const maxScore = parseInt(req.query.maxScore as string);
    if (!isNaN(maxScore)) {
      leads = leads.filter(l => (l.qualificationScore || 0) <= maxScore);
    }

    // Search
    const search = req.query.q as string;
    if (search) {
      const q = search.toLowerCase();
      leads = leads.filter(l => 
        (l.businessName && l.businessName.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q)) ||
        (l.websiteUrl && l.websiteUrl.toLowerCase().includes(q))
      );
    }

    // Sorting
    const sortField = req.query.sortField as string || 'createdAt';
    const sortOrder = req.query.sortOrder as string || 'desc';
    leads.sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';
      
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const total = leads.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginatedLeads = leads.slice(start, start + limit);

    res.json({ 
      leads: paginatedLeads, 
      total, 
      page, 
      totalPages 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/leads/bulk', async (req, res) => {
  try {
    const { action, ids, reason } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) throw new Error('No IDs provided');
    
    const leads = await readLeads('data/leads_validated.json');
    let updatedCount = 0;

    if (action === 'skip') {
      for (const lead of leads) {
        if (ids.includes(lead.id)) {
          lead.workflowStatus = 'skipped';
          updatedCount++;
        }
      }
      await writeLeads(leads, 'data/leads_validated.json');
    } else if (action === 'suppress') {
      const suppressionReason = reason || 'opt_out';
      for (const lead of leads) {
        if (ids.includes(lead.id)) {
          if (lead.email) {
            await addSuppression(lead.email, suppressionReason, 'dashboard_bulk');
          }
          lead.workflowStatus = suppressionReason === 'opt_out' ? 'opted_out' : (suppressionReason === 'bounce' ? 'bounced' : 'skipped');
          updatedCount++;
        }
      }
      await writeLeads(leads, 'data/leads_validated.json');
    } else {
      throw new Error('Invalid bulk action');
    }

    res.json({ success: true, updatedCount });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.post('/leads/export', async (req, res) => {
  try {
    const { ids } = req.body;
    const leads = await readLeads('data/leads_validated.json');
    
    let toExport = leads;
    if (Array.isArray(ids) && ids.length > 0) {
      toExport = leads.filter(l => ids.includes(l.id));
    }

    if (toExport.length === 0) {
      throw new Error('No leads to export');
    }

    const header = ['businessName', 'email', 'phone', 'websiteUrl', 'workflowStatus', 'primaryIssue', 'score'].join(',') + '\\n';
    const rows = toExport.map(l => {
      return [
        `"${(l.businessName || '').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${(l.websiteUrl || '').replace(/"/g, '""')}"`,
        `"${(l.workflowStatus || '').replace(/"/g, '""')}"`,
        `"${(l.primaryIssue || '').replace(/"/g, '""')}"`,
        `"${l.qualificationScore ?? ''}"`
      ].join(',');
    }).join('\\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads_export.csv"');
    res.send(header + rows);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.get('/drafts', async (req, res) => {
  try {
    const drafts = await readDrafts();
    const leads = await readLeads('data/leads_validated.json');
    
    // Enrich drafts with lead evidence/audit data for the UI
    const enrichedDrafts = drafts.map(draft => {
      const lead = leads.find(l => l.id === draft.leadId);
      return {
        ...draft,
        audit: lead?.audit,
        screenshotPath: lead?.screenshotPath
      };
    });
    
    res.json({ drafts: enrichedDrafts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.patch('/drafts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, body } = req.body;
    await updateDraft(id, subject, body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.post('/drafts/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    await approveDraft(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.post('/drafts/:id/revoke', async (req, res) => {
  try {
    const { id } = req.params;
    await revokeDraft(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.post('/suppression/:action', async (req, res) => {
  try {
    const { action } = req.params;
    const { email } = req.body;
    if (!email) throw new Error('Email is required');
    if (!['opt_out', 'bounce', 'invalid'].includes(action)) {
       throw new Error('Invalid suppression action');
    }
    await addSuppression(email, action, 'dashboard');
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.get('/manual/export', async (req, res) => {
  try {
    const leads = await readLeads('data/leads_validated.json');
    const manualLeads = leads.filter(l => l.workflowStatus === 'manual_outreach');
    res.json({ leads: manualLeads });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/dispatch_logs', async (req, res) => {
  try {
    const logs = await readJsonArray<any>('data/dispatch_logs.json', (val: any) => val);
    res.json({ logs });
  } catch (error: any) {
    // If file doesn't exist yet, return empty array
    if (error.code === 'ENOENT') {
      res.json({ logs: [] });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// ─── Jobs API (Phase 6) ────────────────────────────────────────────────────────

apiRouter.post('/jobs', async (req, res) => {
  try {
    const { command, args } = req.body;
    if (!command) throw new Error('Command is required');
    const safeArgs = Array.isArray(args) ? args.map(String) : [];
    const job = await spawnJob(command, safeArgs);
    res.json({ job });
  } catch (error: any) {
    if (error.message.includes('Another job is already running')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

apiRouter.get('/jobs', async (req, res) => {
  try {
    const jobs = await getJobs();
    res.json({ jobs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/jobs/:id/output', async (req, res) => {
  try {
    const { id } = req.params;
    const after = parseInt(req.query.after as string || '0', 10);
    const output = await getJobOutput(id, after);
    res.json(output);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/jobs/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    await stopJob(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// We need a route for screenshots that bypasses static public folder
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fsSync from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

apiRouter.get('/screenshots/:filename', (req, res) => {
  const filename = req.params.filename;
  // Ensure we only serve .jpeg from data/screenshots
  if (!filename.endsWith('.jpeg') || filename.includes('/') || filename.includes('\\')) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  
  const filePath = path.join(DATA_DIR, 'screenshots', filename);
  if (fsSync.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

apiRouter.post('/send/preview', async (req, res) => {
  try {
    const preview = await previewSendBatch();
    res.json(preview);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/send/start', async (req, res) => {
  try {
    if (config.DRY_RUN !== false && process.env.DRY_RUN !== 'false') {
      throw new Error('Live sending requires DRY_RUN=false in .env');
    }
    const { fingerprint } = req.body;
    if (!fingerprint) {
      throw new Error('Batch fingerprint is required to start live sending');
    }
    
    const job = await spawnJob('send', ['--send', '--confirm-batch', fingerprint]);
    res.json({ success: true, job });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.post('/send/stop', async (req, res) => {
  try {
    await fs.writeFile('.stop-send', '1');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
