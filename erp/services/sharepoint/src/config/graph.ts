// =============================================================================
// GE ERP — SharePoint Service
// src/config/graph.ts
// Microsoft Graph client factory — per-request clients with the correct token
// =============================================================================

import 'isomorphic-fetch';
import { Client } from '@microsoft/microsoft-graph-client';
import { msalClient, GRAPH_SCOPES } from './msal';

/**
 * Build a Graph client that uses the caller's delegated token (OBO flow).
 * Pass the raw Bearer token extracted from the incoming request's
 * Authorization header; MSAL exchanges it for a Graph-scoped token.
 *
 * @param delegatedToken  Raw access token from the ERP frontend (M365 user)
 */
export async function buildDelegatedGraphClient(delegatedToken: string): Promise<Client> {
  const result = await msalClient.acquireTokenOnBehalfOf({
    oboAssertion: delegatedToken,
    scopes:       GRAPH_SCOPES,
  });

  if (!result?.accessToken) {
    throw new Error('OBO token exchange failed: no access token returned');
  }

  return Client.init({
    authProvider: done => done(null, result.accessToken),
    defaultVersion: 'v1.0',
  });
}

/**
 * Build a Graph client using app-only (client credentials) auth.
 * Use for scheduled/batch operations where no user context is available.
 */
export async function buildAppOnlyGraphClient(): Promise<Client> {
  const result = await msalClient.acquireTokenByClientCredential({
    scopes: GRAPH_SCOPES,
  });

  if (!result?.accessToken) {
    throw new Error('Client credentials token acquisition failed');
  }

  return Client.init({
    authProvider: done => done(null, result.accessToken),
    defaultVersion: 'v1.0',
  });
}
