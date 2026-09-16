"use client";

import { createContext, useContext, ReactNode } from "react";

export type PermissionsState = {
  canCreate?: boolean;
  canRead?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
};

const PermissionContext = createContext<PermissionsState | null>(null);

export function PermissionProvider({
  permissions,
  children,
}: {
  permissions: PermissionsState;
  children: ReactNode;
}) {
  return (
    <PermissionContext.Provider value={permissions}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    // Secure default: if used outside of a provider, default all rights to false
    return {
      canCreate: false,
      canRead: false,
      canUpdate: false,
      canDelete: false,
    };
  }
  return context;
}
