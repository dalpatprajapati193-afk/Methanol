"use server";

import { z } from "zod";
import prisma from "@/shared/libs/Prisma";

// ── Validation Schema ──────────────────────────────────────────────────

const UpdateCapabilitySchema = z.object({
  capabilityId: z.number().int().positive(),
  moduleType: z.number().int().positive({ message: "Module is required." }),
  plantType: z.number().int().positive({ message: "Plant is required." }),
  systemType: z.number().int().positive({ message: "System is required." }),
  folderMapping: z.string().min(1, "Folder Mapping is required."),
  isActive: z.boolean(),
});

const CreateCapabilitySchema = z.object({
  moduleType: z.number().int().positive({ message: "Module is required." }),
  plantType: z.number().int().positive({ message: "Plant is required." }),
  systemType: z.number().int().positive({ message: "System is required." }),
  folderMapping: z.string().min(1, "Folder Mapping is required."),
  isActive: z.boolean(),
});

// ── Action ─────────────────────────────────────────────────────────────

export async function updateCapability(payload: unknown) {
  const parsed = UpdateCapabilitySchema.safeParse(payload);

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0].message,
    };
  }

  const { capabilityId, moduleType, plantType, systemType, folderMapping, isActive } =
    parsed.data;

  try {
    const updated = await prisma.capability.update({
      where: { capabilityId },
      data: { moduleType, plantType, systemType, folderMapping, isActive },
      include: {
        moduleTypeRel: true,
        plantTypeRel: true,
        systemTypeRel: true,
      },
    });

    return { success: true as const, data: updated };
  } catch {
    return {
      success: false as const,
      error: "Failed to update capability. Please try again.",
    };
  }
}

export async function createCapability(payload: unknown) {
  const parsed = CreateCapabilitySchema.safeParse(payload);

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0].message,
    };
  }

  const { moduleType, plantType, systemType, folderMapping, isActive } = parsed.data;

  try {
    const created = await prisma.capability.create({
      data: { moduleType, plantType, systemType, folderMapping, isActive },
      include: {
        moduleTypeRel: true,
        plantTypeRel: true,
        systemTypeRel: true,
      },
    });

    return { success: true as const, data: created };
  } catch {
    return {
      success: false as const,
      error: "Failed to create capability. Please try again.",
    };
  }
}
