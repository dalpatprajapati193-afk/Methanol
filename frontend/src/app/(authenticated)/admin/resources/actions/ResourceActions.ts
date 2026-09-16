"use server";

import { z } from "zod";
import prisma from "@/shared/libs/Prisma";
import { revalidatePath } from "next/cache";

const ResourceSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  url: z.string().max(255).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
  icon: z.string().max(50).optional().nullable(),
  resourceType: z.enum(["URL", "HierarchyMaster", "Feature", "API", "*"]),
  resourceArea: z.enum(["sidebar", "admin", "general", "*"]),
});

export async function createResource(data: unknown) {
  try {
    const parsed = ResourceSchema.parse(data);
    const resource = await prisma.resource.create({ data: parsed });
    revalidatePath("/admin/resources");
    return { success: true, resource };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateResource(resourceId: number, data: unknown) {
  try {
    const parsed = ResourceSchema.parse(data);
    const resource = await prisma.resource.update({
      where: { resourceId },
      data: parsed,
    });
    revalidatePath("/admin/resources");
    return { success: true, resource };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteResource(resourceId: number) {
  try {
    await prisma.resource.delete({ where: { resourceId } });
    revalidatePath("/admin/resources");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
