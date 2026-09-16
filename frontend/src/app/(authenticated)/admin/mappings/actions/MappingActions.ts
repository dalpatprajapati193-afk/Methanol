"use server";

import prisma from "@/shared/libs/Prisma";
import { revalidatePath } from "next/cache";

export async function addUserToGroup(userId: number, groupId: number) {
  try {
    await prisma.userGroupMapping.create({
      data: { userId, groupId },
    });
    revalidatePath("/admin/mappings");
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false, error: "User is already in this group." };
    return { success: false, error: error.message };
  }
}

export async function removeUserFromGroup(userId: number, groupId: number) {
  try {
    await prisma.userGroupMapping.delete({
      where: { userId_groupId: { userId, groupId } },
    });
    revalidatePath("/admin/mappings");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
