import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './server-routes.js';
import { recoverJobsOnStartup, setJobsSimulatedMode } from './jobs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

export async function startServer(port: number, demoMode: boolean = false) {
  const app = express();
  
  if (demoMode) {
    setJobsSimulatedMode(true);
  }
  
  await recoverJobsOnStartup();
  
  // Generate a random token for this session
  const sessionToken = crypto.randomBytes(32).toString('hex');

  // Security Middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    // 1. Host Header Validation (only localhost)
    const host = req.get('host');
    if (!host || !host.startsWith('127.0.0.1:') && !host.startsWith('localhost:')) {
      res.status(403).send('Forbidden: Invalid Host');
      return;
    }

    // 2. CSP (Content Security Policy)
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';"
    );
    
    // 3. Prevent clickjacking and MIME sniffing
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    next();
  });

  // Serve static files from public directory
  app.use(express.static(PUBLIC_DIR, { index: false })); // we will serve index manually to inject token

  // Inject session token into index.html
  app.get('/', (req, res) => {
    // Basic template, in production we might read index.html and replace a placeholder.
    // For now, let's serve it from the file but set a cookie or just embed it.
    // Actually, let's just serve index.html and the client can get the token from a script tag.
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ClientVelo Engine</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  cvnavy: '#0f172a',
                  cvslate: '#334155',
                  cvteal: '#0d9488',
                }
              }
            }
          }
        </script>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body class="bg-gray-50 text-cvslate h-screen flex overflow-hidden">
        <script>
          window.CV_TOKEN = "${sessionToken}";
        </script>
        <div id="app" class="flex w-full h-full"></div>
        <script type="module" src="/js/app.js"></script>
      </body>
      </html>
    `);
  });

  // API Token Validation Middleware
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const providedToken = req.get('X-CV-Token');
    if (!providedToken || providedToken !== sessionToken) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });

  app.use(express.json());
  
  // Attach API routes
  app.use('/api', apiRouter);

  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`\nClientVelo Dashboard running at: http://127.0.0.1:${port}`);
    console.log(`Session Token: ${sessionToken}`);
    if (demoMode) {
      console.log(`[DEMO MODE] Running with test data boundaries.`);
    }
    console.log(`Press Ctrl+C to stop.\n`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down dashboard...');
    server.close(() => {
      process.exit(0);
    });
  });
}
