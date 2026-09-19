import { Router } from 'express';
import { readLeads, readDrafts, readSuppression, readJsonArray } from './store.js';
import { updateDraft, approveDraft, revokeDraft } from './drafts.js';
import { addSuppression } from './suppression.js';
import { getJobs, getJob, getJobOutput, spawnJob, stopJob } from './jobs.js';
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
    const leads = await readLeads('data/leads_validated.json');
    // For Phase 5A, just return all leads or a subset
    res.json({ leads });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
import fs from 'node:fs';

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
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});
