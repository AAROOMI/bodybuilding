import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Raw body parser for proxying D-ID requests
  app.use('/api/did', express.raw({ type: '*/*', limit: '10mb' }));

  // CORS Preflight for D-ID proxy
  app.options('/api/did/*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.sendStatus(200);
  });

  // D-ID API Proxy: forwards requests with the authorized origin
  app.all('/api/did/*', async (req, res) => {
    const targetPath = req.url.replace(/^\/api\/did/, '');
    const targetUrl = `https://api.d-id.com${targetPath}`;

    // Strip hop-by-hop and browser-specific headers that break Node undici fetch
    const disallowedHeaders = new Set([
      'connection',
      'keep-alive',
      'proxy-connection',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailer',
      'transfer-encoding',
      'upgrade',
      'host',
      'origin',
      'referer',
      'content-length',
      'sec-fetch-dest',
      'sec-fetch-mode',
      'sec-fetch-site',
      'sec-fetch-user',
      'priority',
      'cookie',
    ]);

    const forwardHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (typeof value === 'string' && !disallowedHeaders.has(lower)) {
        forwardHeaders[lower] = value;
      }
    }
    // Inject authorized D-ID Studio origin to satisfy Allowed Domains validation
    forwardHeaders['origin'] = 'https://studio.d-id.com';
    forwardHeaders['referer'] = 'https://studio.d-id.com/';

    try {
      const fetchOptions: RequestInit = {
        method: req.method,
        headers: forwardHeaders,
      };

      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Buffer.isBuffer(req.body) && req.body.length > 0) {
        fetchOptions.body = req.body;
      }

      const response = await fetch(targetUrl, fetchOptions);

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');

      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      res.status(response.status);
      const data = await response.arrayBuffer();
      res.send(Buffer.from(data));
    } catch (err: any) {
      console.error('D-ID Proxy Error:', err);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(500).json({ error: 'Proxy request failed', details: err?.message });
    }
  });

  const hasDist = fs.existsSync(path.resolve(__dirname, 'dist', 'index.html'));
  const isProduction = process.env.NODE_ENV === 'production' || (!process.env.npm_lifecycle_event?.includes('dev') && hasDist);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
