// =============================================================================
// GE ERP — SharePoint Service
// src/config/msal.ts
// MSAL ConfidentialClientApplication — used for both OBO and app-only flows
// =============================================================================

import { ConfidentialClientApplication, Configuration, LogLevel } from '@azure/msal-node';
import { config } from './env';
import { logger } from '../utils/logger';

const msalConfig: Configuration = {
  auth: {
    clientId:     config.AZURE_CLIENT_ID,
    authority:    `https://login.microsoftonline.com/${config.AZURE_TENANT_ID}`,
    clientSecret: config.AZURE_CLIENT_SECRET,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message) => {
        switch (level) {
          case LogLevel.Error:   logger.error(`[MSAL] ${message}`); break;
          case LogLevel.Warning: logger.warn(`[MSAL] ${message}`);  break;
          case LogLevel.Info:    logger.info(`[MSAL] ${message}`);  break;
          case LogLevel.Verbose: logger.debug(`[MSAL] ${message}`); break;
        }
      },
      piiLoggingEnabled: false,
      logLevel: config.NODE_ENV === 'production' ? LogLevel.Warning : LogLevel.Info,
    },
  },
};

/** Singleton MSAL client — shared across request handlers */
export const msalClient = new ConfidentialClientApplication(msalConfig);

/** Graph scopes requested when exchanging tokens */
export const GRAPH_SCOPES = ['https://graph.microsoft.com/.default'];
