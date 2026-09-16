"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Layers } from "lucide-react";
import { useAtomValue } from "jotai";
import { getInstance } from "../../actions/Actions";
import { sidebarViewModeAtom } from "../HierarchySidebar";

type Breadcrumb = {
  name: string;
  path: string;
};

type InstanceData = {
  instanceName?: string;
  hierarchyPath?: string;
  breadcrumbs?: Breadcrumb[];
  [key: string]: any;
};

export default function InstanceInfo() {
  const { instance_id } = useParams();
  const [instanceInfo, setInstanceInfo] = useState<InstanceData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const viewMode = useAtomValue(sidebarViewModeAtom);

  useEffect(() => {
    async function fetchInstance() {
      if (!instance_id || typeof instance_id !== "string") {
        setInstanceInfo(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setInstanceInfo(null); // Clear stale data while fetching new instance

      try {
        const res = await getInstance(instance_id);
        if (res.success && res.data) {
          setInstanceInfo(res.data);
        } else {
          setInstanceInfo({ instanceName: "Instance not found" });
        }
      } catch (err) {
        setInstanceInfo({ instanceName: "Error loading instance" });
      } finally {
        setLoading(false);
      }
    }

    fetchInstance();
  }, [instance_id]);

  if (!instance_id) {
    return (
      <div className="h-full w-full border-b border-border flex items-center px-6 bg-surface/50 backdrop-blur-md">
        <h1 className="text-sm font-semibold text-text-secondary">No instance selected</h1>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full w-full border-b border-border flex items-center px-6 bg-surface/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent-blue animate-pulse" />
          <h1 className="text-sm font-semibold text-text-secondary">Loading...</h1>
        </div>
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className="h-full w-full border-b border-border flex items-center px-6 bg-surface/50 backdrop-blur-md transition-all duration-300">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border shadow-sm">
          <Layers size={15} className="text-accent-blue shrink-0" />
          <h1 className="text-sm font-semibold text-text-primary">
            {instanceInfo?.instanceName || "Overview"}
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full border-b border-border flex items-center bg-surface/50 backdrop-blur-md transition-all duration-300">
      {instanceInfo?.breadcrumbs && instanceInfo.breadcrumbs.length > 0 ? (
        <nav className="flex items-center gap-1 text-xs md:text-sm font-medium tracking-wide">
          {(() => {
            const breadcrumbs = instanceInfo.breadcrumbs!;
            const hasHiddenLast = breadcrumbs.length > 1;
            const breadcrumbsToShow = hasHiddenLast ? breadcrumbs.slice(0, -1) : breadcrumbs;
            const hiddenLast = hasHiddenLast ? breadcrumbs[breadcrumbs.length - 1] : null;

            return breadcrumbsToShow.map((b, idx) => {
              const isLast = idx === breadcrumbsToShow.length - 1;
              const tooltipText = isLast && hiddenLast ? hiddenLast.name : undefined;

              return (
                <div key={idx} className="flex items-center gap-1" title={tooltipText}>
                  {idx > 0 && <ChevronRight size={14} className="text-text-secondary mx-0.5 shrink-0 opacity-60" />}
                  {isLast || b.path === "#" ? (
                    <span
                      className={`px-2.5 py-1 rounded-lg bg-surface border border-border text-accent-blue font-semibold shadow-sm transition-all duration-200 ${tooltipText ? "cursor-help" : ""
                        }`}
                    >
                      {b.name}
                    </span>
                  ) : (
                    <Link
                      href={b.path}
                      className="px-2.5 py-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover hover:shadow-sm transition-all duration-200"
                    >
                      {b.name}
                    </Link>
                  )}
                </div>
              );
            });
          })()}
        </nav>
      ) : (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border shadow-sm">
          <Layers size={15} className="text-accent-blue shrink-0" />
          <h1 className="text-sm font-semibold text-text-primary">
            {instanceInfo?.hierarchyPath || instanceInfo?.instanceName || "Overview"}
          </h1>
        </div>
      )}
    </div>
  );
}
