import axios, { AxiosError } from 'axios';
import { msalInstance } from './msalInstance';

const API_SCOPES = [`api://${import.meta.env.VITE_AZURE_CLIENT_ID}/access_as_user`];

/**
 * Token request deduplication.
 *
 * Problem: pages like Dashboard fire several API calls concurrently via
 * Promise.allSettled().  Without deduplication every request independently
 * calls acquireTokenSilent; if the token is stale they all fail at the same
 * moment and each tries to call acquireTokenRedirect.  MSAL only allows one
 * interactive session at a time — calls 2-N throw BrowserAuthError
 * "interaction_in_progress", which falls into the catch block and tries
 * *another* acquireTokenRedirect, causing a redirect storm / crash loop.
 * This is more aggressive in Edge than Safari due to how Edge batches tasks.
 *
 * Fix: share a single in-flight promise.  All concurrent requests wait for
 * the same acquireTokenSilent result.  Only one can ever trigger a redirect.
 */
let _inflightToken: Promise<string> | null = null;
let _redirecting = false;

async function getToken(): Promise<string> {
  // If we've already decided to redirect the user to login,
  // don't queue more work — just bail immediately.
  if (_redirecting) throw new Error('Redirecting to login…');

  // Reuse an in-flight token request rather than racing.
  if (_inflightToken) return _inflightToken;

  _inflightToken = (async () => {
    const accounts = msalInstance.getAllAccounts();

    if (!accounts[0]) {
      _redirecting = true;
      await msalInstance.loginRedirect({ scopes: API_SCOPES });
      throw new Error('Redirecting to login…');
    }

    try {
      const result = await msalInstance.acquireTokenSilent({
        scopes:       API_SCOPES,
        account:      accounts[0],
        forceRefresh: false,
      });
      return result.accessToken;

    } catch (err) {
      const msg = (err as Error)?.message ?? '';

      // interaction_in_progress means MSAL already has a redirect/popup
      // underway (e.g. from another tab, or a stale sessionStorage entry).
      // Do NOT start another one — just propagate the error so the existing
      // interaction can complete.
      if (msg.includes('interaction_in_progress')) {
        console.warn('[auth] interaction already in progress — waiting for existing auth to complete');
        throw err;
      }

      // For every other silent failure (expired refresh token, consent needed,
      // network hiccup on the token endpoint, etc.) fall back to interactive.
      console.error('[auth] acquireTokenSilent failed, redirecting to login:', err);
      _redirecting = true;
      await msalInstance.acquireTokenRedirect({ scopes: API_SCOPES, account: accounts[0] });
      throw new Error('Redirecting to login…');
    }
  })().finally(() => {
    // Clear the shared promise so the next call (after the token has aged)
    // starts a fresh acquireTokenSilent.  _redirecting stays true for the
    // lifetime of the page — no further requests should fire once we've
    // decided to redirect.
    _inflightToken = null;
  });

  return _inflightToken;
}

function attachInterceptors(instance: ReturnType<typeof axios.create>) {
  instance.interceptors.request.use(async config => {
    const token = await getToken();
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  instance.interceptors.response.use(
    res => res,
    (err: AxiosError) => {
      const status  = err.response?.status;
      const detail  = (err.response?.data as { error?: string; detail?: string } | undefined);
      const message = detail?.error ?? detail?.detail ?? err.message;
      console.error(`[api] ${err.config?.method?.toUpperCase()} ${err.config?.url} → ${status ?? 'network error'}: ${message}`);
      return Promise.reject(err);
    }
  );
}

export const purchaseApi = axios.create({
  baseURL: import.meta.env.VITE_PURCHASE_API_URL,
});
attachInterceptors(purchaseApi);

export const spApi = axios.create({
  baseURL: import.meta.env.VITE_SP_SERVICE_URL,
});
attachInterceptors(spApi);
