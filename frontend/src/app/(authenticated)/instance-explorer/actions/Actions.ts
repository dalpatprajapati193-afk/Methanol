"use server";

import { z } from "zod";
import prisma from "@/shared/libs/Prisma";
import { revalidatePath } from "next/cache";

const CreateInstanceSchema = z.object({
  instanceName: z.string().min(1, "Instance Name is required"),
  capabilityId: z.number().int().positive("Capability must be selected"),
  hierarchyMasterId: z.string().min(1, "Please select the final hierarchy level."),
});

export async function createInstance(payload: unknown) {
  const parsed = CreateInstanceSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0].message,
    };
  }

  const data = parsed.data;

  try {
    const capability = await prisma.capability.findUnique({
      where: { capabilityId: data.capabilityId },
    });

    if (!capability) {
      return { success: false as const, error: "Selected capability not found." };
    }

    const created = await prisma.instance.create({
      data: {
        instanceName: data.instanceName,
        capabilityId: data.capabilityId,
        hierarchyMasterId: BigInt(data.hierarchyMasterId),
        isActive: true,
        configuration: {
          create: {
            pipeline_config_data: Buffer.from("")
          },
        },
      },
    });

    // Revalidate layout to refetch instances
    revalidatePath("/(authenticated)/instance-explorer", "layout");

    return { success: true as const, data: created };
  } catch (error) {
    console.error("Failed to create instance:", error);
    return {
      success: false as const,
      error: "Failed to create instance. Please try again.",
    };
  }
}




export async function getInstance(instanceId: string) {
  try {
    const id = parseInt(instanceId, 10);
    if (isNaN(id)) return { success: false as const, error: "Invalid ID" };

    const allMasters = await prisma.hierarchyMaster.findMany();

    const instance = await prisma.instance.findUnique({
      where: { instanceId: id },
      include: {
        capability: {
          include: {
            moduleTypeRel: true,
            plantTypeRel: true,
            systemTypeRel: true,
          },
        },
      },
    });
    if (instance) {
      const nodes: { id: string; name: string }[] = [];
      let currentMasterId = instance.hierarchyMasterId;
      while (currentMasterId) {
        const master = allMasters.find(m => m.hierarchyMasterId?.toString() === currentMasterId?.toString());
        if (master) {
          nodes.unshift({ id: master.hierarchyMasterId.toString(), name: master.hierarchyDisplayName });
          currentMasterId = master.parentHierarchyId;
        } else {
          break;
        }
      }

      const folder = instance.capability?.folderMapping || "default";
      const breadcrumbs = nodes.map((node, i) => {
        let path = "";
        if (i === 0) path = `/instance-explorer/${node.id}/region-overview`;
        else if (i === 1) path = `/instance-explorer/${node.id}/affiliate-overview`;
        else if (i === 2) path = `/instance-explorer/${node.id}/plant-overview`;
        else path = `/instance-explorer/${instance.instanceId}/${folder}`;
        return { name: node.name, path };
      });

      breadcrumbs.push({
        name: instance.instanceName,
        path: `/instance-explorer/${instance.instanceId}/${folder}`,
      });

      const fullPath = breadcrumbs.map(b => b.name).join(" > ");

      return {
        success: true as const,
        data: {
          ...instance,
          hierarchyMasterId: instance.hierarchyMasterId?.toString() || null,
          hierarchyPath: fullPath,
          breadcrumbs,
        },
      };
    }

    // Fallback: check if it's a hierarchyMasterId (for Region/Affiliate/Plant overview routes)
    const hierarchy = allMasters.find(m => m.hierarchyMasterId?.toString() === id.toString());
    if (hierarchy) {
      const nodes: { id: string; name: string }[] = [];
      let currentMasterId: any = hierarchy.hierarchyMasterId;
      while (currentMasterId) {
        const master = allMasters.find(m => m.hierarchyMasterId?.toString() === currentMasterId?.toString());
        if (master) {
          nodes.unshift({ id: master.hierarchyMasterId.toString(), name: master.hierarchyDisplayName });
          currentMasterId = master.parentHierarchyId;
        } else {
          break;
        }
      }

      const breadcrumbs = nodes.map((node, i) => {
        let path = "";
        if (i === 0) path = `/instance-explorer/${node.id}/region-overview`;
        else if (i === 1) path = `/instance-explorer/${node.id}/affiliate-overview`;
        else if (i === 2) path = `/instance-explorer/${node.id}/plant-overview`;
        else path = `#`;
        return { name: node.name, path };
      });

      const fullPath = breadcrumbs.map(b => b.name).join(" > ");

      return {
        success: true as const,
        data: { instanceName: hierarchy.hierarchyDisplayName, hierarchyPath: fullPath, breadcrumbs, isHierarchyMaster: true },
      };
    }

    return { success: true as const, data: { instanceName: "Overview", hierarchyPath: "Overview", breadcrumbs: [] } };
  } catch (error) {
    console.error("Failed to get instance or hierarchy:", error);
    return {
      success: false as const,
      error: "Failed to load instance info.",
    };
  }
}
