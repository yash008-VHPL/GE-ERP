import axios from 'axios';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalInstance } from './msalInstance';
import { loginRequest } from './msalConfig';

const API_SCOPES = [`api://${import.meta.env.VITE_AZURE_CLIENT_ID}/access_as_user`];

// Guard so we only trigger one redirect even if multiple API calls fail at once
let redirectingToLogin = false;

/** Silently acquire a token — redirects to login if token is expired or unrefreshable */
async function getToken(): Promise<string> {
  const accounts = msalInstance.getAllAccounts();
  if (!accounts[0]) {
    if (!redirectingToLogin) {
      redirectingToLogin = true;
      await msalInstance.loginRedirect(loginRequest);
    }
    throw new Error('Redirecting to login...');
  }

  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes: API_SCOPES,
      account: accounts[0],
      forceRefresh: false,
    });
    return result.accessToken;
  } catch (e) {
    // Token expired or silent iframe blocked by tracking prevention — force fresh login
    if (!redirectingToLogin) {
      redirectingToLogin = true;
      await msalInstance.logoutRedirect();
    }
    throw e instanceof InteractionRequiredAuthError
      ? new Error('Session expired — signing you out...')
      : new Error('Token refresh failed — signing you out...');
  }
}

/** Axios instance for the Purchase API (port 3002) */
export const purchaseApi = axios.create({
  baseURL: import.meta.env.VITE_PURCHASE_API_URL,
});

purchaseApi.interceptors.request.use(async config => {
  const token = await getToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Axios instance for the SharePoint service (port 3001) */
export const spApi = axios.create({
  baseURL: import.meta.env.VITE_SP_SERVICE_URL,
});

spApi.interceptors.request.use(async config => {
  const token = await getToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});
