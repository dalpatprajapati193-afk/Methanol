"use server";

import { z } from "zod";
import prisma from "@/shared/libs/Prisma";
import { revalidatePath } from "next/cache";

const PermissionsSchema = z.object({
  canCreate: z.boolean().default(false),
  canRead: z.boolean().default(true),
  canUpdate: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  isAllowed: z.boolean().default(true),
});

/**
 * Batch-create SecurityGroupResourceMapping rows + a default ACE for each.
 * Skips any group+resource combination that already has a mapping.
 */
export async function createMappingsBatch(
  groupId: number,
  resourceIds: number[],
  permissions: unknown
) {
  try {
    const perms = PermissionsSchema.parse(permissions);
    if (!groupId || resourceIds.length === 0) {
      return { success: false, error: "Group and at least one resource are required." };
    }

    let created = 0;
    let skipped = 0;

    for (const resourceId of resourceIds) {
      // Upsert-like: try to create mapping, skip if already exists
      const existing = await prisma.securityGroupResourceMapping.findUnique({
        where: { groupId_resourceId: { groupId, resourceId } },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const mapping = await prisma.securityGroupResourceMapping.create({
        data: {
          groupId,
          resourceId,
          ace: {
            create: { ...perms },
          },
        },
      });

      if (mapping) created++;
    }

    revalidatePath("/admin/access-control");
    return { success: true, created, skipped };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Update permissions on an existing ACE.
 */
export async function updateACE(aceId: number, permissions: unknown) {
  try {
    const perms = PermissionsSchema.parse(permissions);
    const ace = await prisma.accessControlEntry.update({
      where: { aceId },
      data: perms,
    });
    revalidatePath("/admin/access-control");
    return { success: true, ace };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a SecurityGroupResourceMapping (cascades to its ACE).
 */
export async function deleteMapping(mappingId: number) {
  try {
    await prisma.securityGroupResourceMapping.delete({
      where: { id: mappingId },
    });
    revalidatePath("/admin/access-control");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
