import axios, { AxiosError } from 'axios';
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
    // ANY silent failure (InteractionRequiredAuthError, BrowserAuthError
    // from sandbox blocking the iframe, interaction_in_progress, timeout, etc.)
    // — redirect to interactive login so the user always gets a fresh token.
    console.error('[auth] acquireTokenSilent failed, redirecting to login:', err);
    await msalInstance.acquireTokenRedirect({ scopes: API_SCOPES, account: accounts[0] });
    throw new Error('Redirecting to login…');
  }
}

function attachInterceptors(instance: ReturnType<typeof axios.create>) {
  instance.interceptors.request.use(async config => {
    const token = await getToken();
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  // Surface real HTTP errors so the UI can show a meaningful message.
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
