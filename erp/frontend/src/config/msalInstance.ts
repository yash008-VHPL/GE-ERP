import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './msalConfig';

export const msalInstance = new PublicClientApplication(msalConfig);

// initialize() then immediately pre-call handleRedirectPromise with
// navigateToLoginRequestUrl=false.  The result is memoised by hash key so
// when MsalProvider calls handleRedirectPromise() without options it returns
// this same promise — preventing MSAL from trying to window.top.location when
// the app loads inside a sandboxed silent-refresh iframe.
export const msalReady = msalInstance
  .initialize()
  .then(() => msalInstance.handleRedirectPromise({ navigateToLoginRequestUrl: false }));
