"use client";

import { ReactNode } from "react";
import { usePermissions, type PermissionsState } from "@/shared/providers/PermissionProvider";

type RequireAccessProps = {
  right: keyof PermissionsState;
  children: ReactNode;
  fallback?: ReactNode;
};

export default function RequireAccess({ right, children, fallback = null }: RequireAccessProps) {
  const permissions = usePermissions();

  if (!permissions[right]) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
