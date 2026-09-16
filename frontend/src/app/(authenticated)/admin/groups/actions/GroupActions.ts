"use server";

import prisma from "@/shared/libs/Prisma";
import { revalidatePath } from "next/cache";

export async function createSecurityGroup(data: { groupName: string; description?: string; isActive?: boolean }) {
  try {
    const group = await prisma.securityGroup.create({
      data: {
        groupName: data.groupName,
        description: data.description,
        isActive: data.isActive ?? true,
      },
    });
    revalidatePath("/admin/groups");
    return { success: true, group };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateSecurityGroup(groupId: number, data: { groupName: string; description?: string; isActive?: boolean }) {
  try {
    const group = await prisma.securityGroup.update({
      where: { groupId },
      data: {
        groupName: data.groupName,
        description: data.description,
        isActive: data.isActive,
      },
    });
    revalidatePath("/admin/groups");
    return { success: true, group };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteSecurityGroup(groupId: number) {
  try {
    await prisma.securityGroup.delete({
      where: { groupId },
    });
    revalidatePath("/admin/groups");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
