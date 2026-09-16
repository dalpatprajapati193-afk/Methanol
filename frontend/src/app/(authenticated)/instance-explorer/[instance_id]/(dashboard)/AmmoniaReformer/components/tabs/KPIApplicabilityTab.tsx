"use client";

import { useState } from "react";
import { useAtomValue } from "jotai";
import KPICalcsTab from "./KPICalcsTab";
import KPIPackagesTab from "./KPIPackagesTab";
import SensorMappingControls from "./SensorMappingControls";
import { mandatoryKpiFulfilledAtom, mandatoryKpiPackageStatusAtom, kpiAtom } from "../../store/Index";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));

type ViewMode = "package" | "element";

export default function KPIApplicabilityTab() {
  const [viewMode, setViewMode] = useState<ViewMode>("package");
  const mandatoryFulfilledFallback = useAtomValue(mandatoryKpiFulfilledAtom);
  const mandatoryPackageStatus = useAtomValue(mandatoryKpiPackageStatusAtom);
  const mandatoryFulfilled = mandatoryPackageStatus?.fulfilled ?? mandatoryFulfilledFallback;

  // While KPI packages / calc requirements are still loading, the readiness
  // computation has no data yet — an empty package set yields total === 0,
  // which would otherwise read as "fulfilled" and flash a false-positive green
  // badge. Treat that window as indeterminate instead.
  const kpi = useAtomValue(kpiAtom);
  const hasMandatory = (mandatoryPackageStatus?.total ?? 0) > 0;
  const mandatoryStatusPending =
    kpi.packages.length === 0 ||
    kpi.calcRequirementsLoading ||
    (hasMandatory && Object.keys(kpi.calcRequirements).length === 0);

  return (
    <div className="flex flex-col gap-4">
      <SensorMappingControls />
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center rounded-lg border border-border bg-surface p-1">
          <button
            className={cn(
              "px-3 py-1.5 text-xs rounded transition-colors",
              viewMode === "package" ? "bg-accent-blue text-surface" : "text-text-secondary hover:bg-surface-hover"
            )}
            onClick={() => setViewMode("package")}
          >
            Package View
          </button>
          <button
            className={cn(
              "px-3 py-1.5 text-xs rounded transition-colors",
              viewMode === "element" ? "bg-accent-blue text-surface" : "text-text-secondary hover:bg-surface-hover"
            )}
            onClick={() => setViewMode("element")}
          >
            Element View
          </button>
        </div>

        <span className="text-xs text-text-secondary">
          {viewMode === "package"
            ? "KPIs grouped by packages with instance-level requirements"
            : "Hierarchy-first view with applicable KPI packages and requirements"}
        </span>

        {mandatoryStatusPending ? (
          <div className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-text-secondary text-xs font-medium">
            <span className="inline-block w-3 h-3 border-2 border-text-secondary border-t-transparent rounded-full animate-spin shrink-0" />
            Checking plant config…
          </div>
        ) : (
          <div className={cn(
            "ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium",
            mandatoryFulfilled
              ? "border-accent-green text-accent-green bg-surface"
              : "border-accent-orange text-accent-orange bg-surface"
          )}>
            <span className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              mandatoryFulfilled ? "bg-accent-green" : "bg-accent-orange animate-pulse"
            )} />
            Plant Config Ready for Model
            <span className="font-bold">{mandatoryFulfilled ? "✓" : "✗"}</span>
          </div>
        )}
      </div>

      {viewMode === "package" ? <KPIPackagesTab /> : <KPICalcsTab />}
    </div>
  );
}
