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
  system: {
    // When the silent-refresh iframe gets an auth code back and loads
    // the app at redirectUri, MSAL must NOT try to navigate the top-level
    // window — the iframe sandbox blocks that ("allow-top-navigation" not
    // set) and the whole silent flow fails.  Setting this to false tells
    // MSAL to stay put inside the iframe, process the code, and
    // communicate the token back to the parent via BroadcastChannel /
    // localStorage instead of via a parent-window redirect.
    navigateToLoginRequestUrl: false,
  },
};

/** Scopes to request when acquiring a token for the Purchase API + SP service */
export const loginRequest: RedirectRequest = {
  scopes: [
    'openid', 'profile',
    `api://${import.meta.env.VITE_AZURE_CLIENT_ID}/access_as_user`,
  ],
};
