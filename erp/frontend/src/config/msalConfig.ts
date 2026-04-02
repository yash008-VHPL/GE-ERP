import type { Configuration, RedirectRequest } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId:    import.meta.env.VITE_AZURE_CLIENT_ID,
    authority:   `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation:       'localStorage',
    storeAuthStateInCookie: false,
  },
};

/** Scopes to request when acquiring a token for the Purchase API + SP service */
export const loginRequest: RedirectRequest = {
  scopes: [
    'openid', 'profile',
    `api://${import.meta.env.VITE_AZURE_CLIENT_ID}/access_as_user`,
  ],
};
