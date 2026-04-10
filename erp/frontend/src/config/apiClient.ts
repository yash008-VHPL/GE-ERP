import axios from 'axios';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalInstance } from './msalInstance';

const API_SCOPES = [`api://${import.meta.env.VITE_AZURE_CLIENT_ID}/access_as_user`];

async function getToken(): Promise<string> {
  const accounts = msalInstance.getAllAccounts();
  if (!accounts[0]) {
    await msalInstance.loginRedirect({ scopes: API_SCOPES });
    throw new Error('Redirecting to login…');
  }

  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes: API_SCOPES,
      account: accounts[0],
      forceRefresh: false,
    });
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      // Silent refresh blocked (token expired / tracking prevention blocking iframe).
      // Redirect to interactive login so the user gets a fresh token.
      await msalInstance.acquireTokenRedirect({ scopes: API_SCOPES, account: accounts[0] });
      throw new Error('Redirecting to login…');
    }
    throw err;
  }
}

export const purchaseApi = axios.create({
  baseURL: import.meta.env.VITE_PURCHASE_API_URL,
});

purchaseApi.interceptors.request.use(async config => {
  const token = await getToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const spApi = axios.create({
  baseURL: import.meta.env.VITE_SP_SERVICE_URL,
});

spApi.interceptors.request.use(async config => {
  const token = await getToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});
