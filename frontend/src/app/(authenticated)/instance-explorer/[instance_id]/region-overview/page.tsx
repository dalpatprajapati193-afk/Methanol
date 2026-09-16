import prisma from "@/shared/libs/Prisma";
import Link from "next/link";
import { FolderGit2, AlertCircle, LayoutGrid } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RegionOverview({
  params,
  searchParams,
}: {
  params: Promise<{ instance_id: string }>;
  searchParams: Promise<{ moduleId?: string }>;
}) {
  const { instance_id } = await params;
  const resolvedSearchParams = await searchParams;
  const moduleIdStr = resolvedSearchParams.moduleId;
  
  const hierarchyId = BigInt(instance_id);

  const instances = await prisma.instance.findMany({
    include: {
      capability: {
        include: {
          moduleTypeRel: true,
          plantTypeRel: true,
          systemTypeRel: true,
        },
      },
    },
    orderBy: { instanceName: "asc" },
  });

  const capabilities = await prisma.capability.findMany({
    include: {
      moduleTypeRel: true,
      plantTypeRel: true,
      systemTypeRel: true,
    },
    orderBy: { capabilityId: "asc" },
  });

  const hierarchyMasters = await prisma.hierarchyMaster.findMany({
    where: { isActive: true },
  });

  const resolveHierarchyPath = (masterId: bigint | null) => {
    const parts: string[] = [];
    let currentId = masterId;
    while (currentId) {
      const master = hierarchyMasters.find((m) => m.hierarchyMasterId === currentId);
      if (master) {
        parts.unshift(master.hierarchyDisplayName);
        currentId = master.parentHierarchyId;
      } else {
        break;
      }
    }
    return parts;
  };

  const getDescendantIds = (masterId: bigint) => {
    const descendants = new Set<bigint>();
    descendants.add(masterId);
    let currentLevel = [masterId];
    while (currentLevel.length > 0) {
      const nextLevel: bigint[] = [];
      for (const id of currentLevel) {
        const children = hierarchyMasters.filter(m => m.parentHierarchyId === id);
        for (const child of children) {
          if (!descendants.has(child.hierarchyMasterId)) {
            descendants.add(child.hierarchyMasterId);
            nextLevel.push(child.hierarchyMasterId);
          }
        }
      }
      currentLevel = nextLevel;
    }
    return descendants;
  };

  const validHierarchyIds = getDescendantIds(hierarchyId);
  const moduleId = moduleIdStr ? parseInt(moduleIdStr, 10) : null;

  const filteredInstances = instances.filter(ins => {
    const matchModule = moduleId ? ins.capability?.moduleTypeRel?.moduleTypeId === moduleId : true;
    const matchHierarchy = ins.hierarchyMasterId ? validHierarchyIds.has(ins.hierarchyMasterId) : false;
    return matchModule && matchHierarchy;
  });

  const filteredCapabilities = capabilities.filter(cap => {
    return moduleId ? cap.moduleTypeRel?.moduleTypeId === moduleId : true;
  });

  const mappedCapabilityIds = new Set(filteredInstances.map((ins) => ins.capabilityId));
  
  const mappedInstances = filteredInstances;
  const unmappedCapabilities = filteredCapabilities.filter(
    (cap) => !mappedCapabilityIds.has(cap.capabilityId)
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-wide">
          Region Overview
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Select a node from the hierarchy on the left to view specific details, or see the mapped status below.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Total Capabilities</span>
          <span className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <LayoutGrid size={20} className="text-accent-blue" />
            {filteredCapabilities.length}
          </span>
        </div>
        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Mapped Instances</span>
          <span className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <FolderGit2 size={20} className="text-accent-green" />
            {mappedInstances.length}
          </span>
        </div>
        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Unmapped Capabilities</span>
          <span className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <AlertCircle size={20} className="text-accent-orange" />
            {unmappedCapabilities.length}
          </span>
        </div>
      </div>

      {/* Mapped Capabilities (Instances) */}
      <div className="mt-4">
        <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-green"></span>
          Mapped Capabilities
        </h2>
        
        {mappedInstances.length === 0 ? (
          <div className="text-sm text-text-secondary p-4 border border-dashed border-border rounded-lg text-center">
            No mapped capabilities found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {mappedInstances.map((ins) => {
              const parts = resolveHierarchyPath(ins.hierarchyMasterId);
              const href = `/instance-explorer/${ins.instanceId}/${ins.capability.folderMapping}`;
              const capName = `${ins.capability.moduleTypeRel.moduleTypeName} - ${ins.capability.plantTypeRel.plantTypeName} - ${ins.capability.systemTypeRel.systemTypeName}`;

              return (
                <Link
                  key={ins.instanceId}
                  href={href}
                  className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-surface hover:border-accent-blue hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-bold text-text-primary group-hover:text-accent-blue transition-colors line-clamp-1">
                      {ins.instanceName}
                    </h3>
                  </div>
                  
                  <div className="flex flex-col gap-1.5 mt-auto">
                    <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
                      Mapped Capability
                    </div>
                    <div className="text-xs text-text-primary font-medium line-clamp-2 leading-relaxed">
                      {capName}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mt-1">
                    {parts.map((p, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-background border border-border text-text-secondary truncate max-w-full">
                        {p}
                      </span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
