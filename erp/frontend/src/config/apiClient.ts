import axios from 'axios';
import { InteractionRequiredAuthError, BrowserAuthError } from '@azure/msal-browser';
import { msalInstance } from './msalInstance';
import { loginRequest } from './msalConfig';

const API_SCOPES = [`api://${import.meta.env.VITE_AZURE_CLIENT_ID}/access_as_user`];

/** Silently acquire a token, falling back to redirect on any auth failure */
async function getToken(): Promise<string> {
  const accounts = msalInstance.getAllAccounts();
  if (!accounts[0]) {
    await msalInstance.loginRedirect(loginRequest);
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
    // timed_out = iframe blocked by tracking prevention; interaction_required = expired
    if (
      e instanceof InteractionRequiredAuthError ||
      (e instanceof BrowserAuthError && (e.errorCode === 'timed_out' || e.errorCode === 'monitor_window_timeout'))
    ) {
      await msalInstance.acquireTokenRedirect({ scopes: API_SCOPES, account: accounts[0] });
      throw new Error('Redirecting to re-authenticate...');
    }
    throw e;
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
