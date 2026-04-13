import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './msalConfig';

export const msalInstance = new PublicClientApplication(msalConfig);

/**
 * initialize() → handleRedirectPromise() must complete before React renders.
 *
 * navigateToLoginRequestUrl: false  — prevents MSAL trying to call
 * window.top.location inside a sandboxed silent-refresh iframe (which throws
 * a cross-origin error and crashes the app in Edge / Firefox).
 *
 * Stale interaction state cleanup — Edge can leave `interaction.status =
 * 'interaction_in_progress'` in sessionStorage after an aborted redirect
 * (e.g. user hit Back, or Edge killed the tab mid-auth).  If that stale
 * entry is present on the next load, every acquireTokenSilent call throws
 * BrowserAuthError('interaction_in_progress'), which in turn triggers
 * acquireTokenRedirect, which throws again — a crash loop unique to Edge.
 * We clear these keys only when handleRedirectPromise returns null (i.e. no
 * redirect is currently being processed), so we don't interfere with a
 * legitimate ongoing auth flow.
 */
export const msalReady = msalInstance
  .initialize()
  .then(() => msalInstance.handleRedirectPromise({ navigateToLoginRequestUrl: false }))
  .then(result => {
    if (!result) {
      // No redirect was in-flight — safe to evict any stale MSAL interaction
      // keys that Edge may have left behind from a previous aborted session.
      const staleKeys = Object.keys(sessionStorage).filter(k =>
        k.includes('interaction.status') || k.includes('interaction-status')
      );
      staleKeys.forEach(k => sessionStorage.removeItem(k));
      if (staleKeys.length > 0) {
        console.info('[auth] cleared', staleKeys.length, 'stale MSAL interaction key(s)');
      }
    }
    return result;
  });
