import axios from 'axios';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalInstance } from './msalInstance';

const API_SCOPES = [`api://${import.meta.env.VITE_AZURE_CLIENT_ID}/access_as_user`];

/** Silently acquire a token — throws a readable error on failure */
async function getToken(): Promise<string> {
  const accounts = msalInstance.getAllAccounts();
  if (!accounts[0]) throw new Error('No signed-in user');

  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes: API_SCOPES,
      account: accounts[0],
      forceRefresh: false,
    });
    return result.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      throw new Error('Session expired — please sign out and sign in again.');
    }
    // timed_out / monitor_window_timeout: tracking prevention blocked silent iframe
    // Surface a clear message rather than triggering a redirect loop
    throw new Error('Token refresh failed — please sign out and sign in again.');
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
