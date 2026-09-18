import { test, describe } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';
import { apiRouter } from '../src/server-routes.js';

describe('Server API (Phase 6A)', () => {
  // Set up a mock app with the token middleware just like server.ts
  const app = express();
  const sessionToken = 'test-token-123';

  app.use((req, res, next) => {
    // 1. Host Header Validation (mocked here or disabled for supertest)
    // Supertest uses 127.0.0.1 by default which passes host check
    const host = req.get('host') || '127.0.0.1';
    if (!host.startsWith('127.0.0.1:') && !host.startsWith('localhost:')) {
      if (host !== '127.0.0.1') {
        res.status(403).send('Forbidden: Invalid Host');
        return;
      }
    }
    next();
  });

  app.use('/api', (req, res, next) => {
    const providedToken = req.get('X-CV-Token');
    if (!providedToken || providedToken !== sessionToken) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });

  app.use(express.json());
  app.use('/api', apiRouter);

  test('Requires token on job routes', async () => {
    const res = await request(app).get('/api/jobs');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'Unauthorized');
  });

  test('Accepts valid token on job routes', async () => {
    // Since jobs.test.ts might interfere if we spawn real jobs, we just check GET /api/jobs
    const res = await request(app)
      .get('/api/jobs')
      .set('X-CV-Token', sessionToken);
    
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.jobs));
  });
  
  test('Prevents unknown commands in POST /api/jobs', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('X-CV-Token', sessionToken)
      .send({ command: 'rm', args: ['-rf'] });
    
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('Command not allowed'));
  });
});
