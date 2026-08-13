import cors from 'cors';
import express, { type Express } from 'express';
import type { SessionManager } from './session/session-manager.js';
import { requireLicense } from './middleware/license-gate.js';
import { deepAnalyze } from './engines/deep-analyzer.js';
import type { DeepAnalysisRequest } from './config/types.js';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

/** Minimal sliding-window rate limiter — 10 requests/minute per IP, to guard against accidental client loops. */
function rateLimiter() {
  const hits = new Map<string, number[]>();
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) {
      res.status(429).json({ error: 'Rate limit exceeded. Max 10 requests/minute.' });
      return;
    }
    recent.push(now);
    hits.set(ip, recent);
    next();
  };
}

export function createHttpBridge(sessions: SessionManager): Express {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(cors({ origin: /^chrome-extension:\/\// }));
  app.use(rateLimiter());

  app.post('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/status', (_req, res) => {
    res.json({ name: 'accessible-ai', version: '1.0.0', activeSessions: sessions.size() });
  });

  app.post('/analyze', requireLicense('deep-analysis'), async (req, res) => {
    try {
      const { auditResults, standard, pageUrl, pageHtml } = req.body as DeepAnalysisRequest;
      const anthropicApiKey = req.headers['x-anthropic-api-key'] as string | undefined;
      const sessionId = sessions.createSession({ standard });
      const result = await deepAnalyze({ auditResults, standard, pageUrl, pageHtml, sessionId, anthropicApiKey });
      sessions.updateSession(sessionId, { deepAnalysis: result });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Deep analysis failed' });
    }
  });

  return app;
}
