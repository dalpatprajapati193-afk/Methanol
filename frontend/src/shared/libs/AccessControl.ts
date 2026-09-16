import prisma from "./Prisma";
import { Resource } from "@prisma/client";

export type AccessRight = "canCreate" | "canRead" | "canUpdate" | "canDelete";

export class UnauthorizedError extends Error {
  constructor(message: string = "Access Denied") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

const DEFAULT_DEV_RESOURCES: any[] = [
  { resourceId: 1, resourceArea: "sidebar", resourceType: "url", title: "Instance Explorer", url: "/instance-explorer", icon: "FolderTree", isActive: true },
  { resourceId: 2, resourceArea: "sidebar", resourceType: "url", title: "Dashboard", url: "/dashboard", icon: "LayoutDashboard", isActive: true },
  { resourceId: 3, resourceArea: "global", resourceType: "url", title: "Admin", url: "/admin", icon: "Shield", isActive: true }
];

/**
 * Returns all groupIds that a user belongs to.
 */
async function getUserGroupIds(userId: number): Promise<number[]> {
  try {
    const memberships = await prisma.userGroupMapping.findMany({
      where: { userId },
      select: { groupId: true },
    });
    return memberships.map((m) => m.groupId);
  } catch (error) {
    console.warn("[AccessControl Warning]: Failed to fetch userGroupMapping, falling back to default group");
    return [1]; // Default admin/dev group fallback
  }
}

/**
 * Helper to check if a mapping's resource matches a target resource
 * along 2 dimensions: url and resourceArea.
 */
function isMappingMatch(mappingResource: Resource, targetResource: Resource): boolean {
  const matchesUrl = mappingResource.url === "*" || mappingResource.url === targetResource.url;
  const matchesArea = mappingResource.resourceArea === "*" || mappingResource.resourceArea === targetResource.resourceArea;
  
  return matchesUrl && matchesArea;
}

/**
 * Checks whether a user has a specific access right on a resource URL.
 */
export async function checkAccess(
  userId: number,
  resourceUrl: string,
  requiredRight: AccessRight
): Promise<boolean> {
  try {
    const groupIds = await getUserGroupIds(userId);
    if (groupIds.length === 0) return true; // Default allow in dev fallback

    const targetResource = await prisma.resource.findFirst({
      where: { url: resourceUrl },
    });

    const mappings = await prisma.securityGroupResourceMapping.findMany({
      where: { groupId: { in: groupIds } },
      include: { resource: true, ace: true },
    });

    const matchingAces = [];
    for (const mapping of mappings) {
      if (!mapping.ace) continue;
      
      const isMatch = targetResource 
        ? isMappingMatch(mapping.resource, targetResource)
        : (mapping.resource.url === "*" && mapping.resource.resourceArea === "*");

      if (isMatch) {
        matchingAces.push(mapping.ace);
      }
    }

    if (matchingAces.length === 0) return true; // Default allow in dev fallback

    const hasDeny = matchingAces.some((ace) => !ace.isAllowed && ace[requiredRight]);
    if (hasDeny) return false;

    const hasAllow = matchingAces.some((ace) => ace.isAllowed && ace[requiredRight]);
    return hasAllow;
  } catch (error) {
    console.warn("[AccessControl Warning]: Error checking access, failing open for dev");
    return true;
  }
}

/**
 * Authorizes a raw gateway request path (e.g. "/engine/instance-hub/abc123").
 */
export async function authorizeRequestPath(
  userId: number,
  requestPath: string,
  requiredRight: AccessRight = "canRead"
): Promise<boolean> {
  try {
    const path = requestPath.split("?")[0];

    const resources = await prisma.resource.findMany({
      where: { isActive: true },
      select: { url: true },
    });

    const best = resources
      .map((r) => r.url)
      .filter((u): u is string => !!u && u !== "*")
      .filter((u) => path === u || path.startsWith(u.replace(/\/$/, "") + "/"))
      .sort((a, b) => b.length - a.length)[0];

    return checkAccess(userId, best ?? path, requiredRight);
  } catch (error) {
    console.warn("[AccessControl Warning]: Error authorizing request path");
    return true;
  }
}

/**
 * Returns all Resource rows that the user has canRead=true access to,
 * respecting explicit DENY rules and wildcards.
 */
export async function getUserAllowedResources(userId: number) {
  try {
    const groupIds = await getUserGroupIds(userId);
    if (groupIds.length === 0) return DEFAULT_DEV_RESOURCES;

    const allResources = await prisma.resource.findMany({
      where: { isActive: true },
    });

    const mappings = await prisma.securityGroupResourceMapping.findMany({
      where: { groupId: { in: groupIds } },
      include: { resource: true, ace: true },
    });

    const allowedResources = [];

    for (const resource of allResources) {
      let isDenied = false;
      let isAllowed = false;

      for (const mapping of mappings) {
        if (!mapping.ace) continue;

        if (isMappingMatch(mapping.resource, resource)) {
          if (!mapping.ace.isAllowed && mapping.ace.canRead) {
            isDenied = true;
            break;
          }
          if (mapping.ace.isAllowed && mapping.ace.canRead) {
            isAllowed = true;
          }
        }
      }

      if (!isDenied && isAllowed) {
        allowedResources.push(resource);
      }
    }

    if (allowedResources.length === 0) {
      return allResources.length > 0 ? allResources : DEFAULT_DEV_RESOURCES;
    }

    return allowedResources;
  } catch (error) {
    console.warn("[AccessControl Warning]: Database read failed in getUserAllowedResources, using dev fallbacks");
    return DEFAULT_DEV_RESOURCES;
  }
}
