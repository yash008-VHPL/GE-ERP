// =============================================================================
// GE ERP — SharePoint Service
// src/middleware/auth.ts
// Validates the incoming M365 Bearer token via OBO exchange.
// The ERP frontend (logged into the M365 tenant) passes its access token;
// this middleware exchanges it for a Graph-scoped token and attaches user info.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { msalClient, GRAPH_SCOPES } from '../config/msal';
import { logger } from '../utils/logger';

// Augment Express Request to carry auth context
declare global {
  namespace Express {
    interface Request {
      graphToken:     string;
      userUpn:        string;
      userName:       string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const incomingToken = authHeader.slice(7);

  try {
    // Exchange the user's token (scoped to this API) for a Graph-scoped token
    const result = await msalClient.acquireTokenOnBehalfOf({
      oboAssertion: incomingToken,
      scopes:       GRAPH_SCOPES,
    });

    if (!result?.accessToken) {
      res.status(401).json({ error: 'Token exchange failed: no Graph token returned' });
      return;
    }

    req.graphToken = result.accessToken;
    req.userUpn    = result.account?.username  ?? 'unknown';
    req.userName   = result.account?.name      ?? 'Unknown User';

    logger.debug(`[auth] OBO exchange OK — user: ${req.userUpn}`);
    next();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[auth] OBO token exchange failed: ${msg}`);
    res.status(401).json({ error: 'Authentication failed', detail: msg });
  }
}
