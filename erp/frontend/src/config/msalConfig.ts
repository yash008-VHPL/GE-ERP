import type { Configuration, RedirectRequest } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId:    import.meta.env.VITE_AZURE_CLIENT_ID,
    authority:   `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
  },
};

/**
 * Scopes to request when acquiring a token for the Purchase API + SP service.
 *
 * IMPORTANT: 'offline_access' MUST be included.  Without it, Azure AD does not
 * issue a refresh token, so when the 1-hour access token expires MSAL has nothing
 * to silently renew with.  It then falls back to a hidden-iframe flow, which
 * browsers with tracking prevention block, causing every API call to fail.
 * With 'offline_access', renewal happens via a direct POST to the token endpoint
 * — no iframe, no browser restrictions.
 */
export const loginRequest: RedirectRequest = {
  scopes: [
    'openid', 'profile', 'offline_access',
    `api://${import.meta.env.VITE_AZURE_CLIENT_ID}/access_as_user`,
  ],
};
