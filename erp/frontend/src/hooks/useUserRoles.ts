import { useMsal } from '@azure/msal-react';

/**
 * App Roles defined in the Azure AD app registration manifest.
 *
 * Admin       — full access to everything including master data
 * Management  — full read visibility across all sections (including financials)
 * Coordination — day-to-day operations: purchases, sales, inventory (no financials)
 *
 * To assign: Azure Portal → Enterprise Applications → your app →
 *            Users and groups → Add user/group → select role
 */
export type AppRole = 'Admin' | 'Management' | 'Coordination';

const KNOWN_ROLES: AppRole[] = ['Admin', 'Management', 'Coordination'];

export function useUserRoles(): AppRole[] {
  const { accounts } = useMsal();
  const claims = accounts[0]?.idTokenClaims as Record<string, unknown> | undefined;
  const raw = (claims?.roles as string[] | undefined) ?? [];
  const matched = raw.filter((r): r is AppRole => KNOWN_ROLES.includes(r as AppRole));
  // If no app roles are configured in Azure AD yet, grant full access
  // so the app stays usable during initial setup.
  return matched.length > 0 ? matched : ['Admin', 'Management', 'Coordination'];
}

export function hasAnyRole(userRoles: AppRole[], ...required: AppRole[]): boolean {
  return required.some(r => userRoles.includes(r));
}
