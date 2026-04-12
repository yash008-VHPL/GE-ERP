import { useMsal } from '@azure/msal-react';

/**
 * App Roles defined in the Azure AD app registration manifest.
 * Assign these roles to users/groups in Azure Portal →
 * App registrations → your app → App roles → assign to users/groups.
 */
export type AppRole = 'Admin' | 'Procurement' | 'Sales' | 'Finance' | 'Warehouse';

const KNOWN_ROLES: AppRole[] = ['Admin', 'Procurement', 'Sales', 'Finance', 'Warehouse'];

export function useUserRoles(): AppRole[] {
  const { accounts } = useMsal();
  const claims = accounts[0]?.idTokenClaims as Record<string, unknown> | undefined;
  const raw = (claims?.roles as string[] | undefined) ?? [];
  const matched = raw.filter((r): r is AppRole => KNOWN_ROLES.includes(r as AppRole));
  // If no app roles are configured in Azure AD yet, grant full access
  // so the app stays usable during initial setup.
  return matched.length > 0 ? matched : ['Admin', 'Procurement', 'Sales', 'Finance', 'Warehouse'];
}

export function hasAnyRole(userRoles: AppRole[], ...required: AppRole[]): boolean {
  return required.some(r => userRoles.includes(r));
}
