import axios from 'axios';
import { msalInstance } from './msalInstance';

const API_SCOPES = [`api://${import.meta.env.VITE_AZURE_CLIENT_ID}/access_as_user`];

async function getToken(): Promise<string> {
  const accounts = msalInstance.getAllAccounts();
  if (!accounts[0]) throw new Error('Not signed in');

  const result = await msalInstance.acquireTokenSilent({
    scopes: API_SCOPES,
    account: accounts[0],
    forceRefresh: false,
  });
  return result.accessToken;
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
