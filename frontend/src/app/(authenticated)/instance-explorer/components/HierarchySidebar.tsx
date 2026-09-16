"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronDown, Plus, Search, Folder, Zap, List, Network, ChevronLeft } from "lucide-react";
import { atom, useAtom } from "jotai";
import { Modal } from "@/shared/components/modal/Index";
import { useToast } from "@/shared/components/toast/Index";
import RequireAccess from "@/shared/components/RequireAccess";
import AddInstanceModal from "./AddInstanceModal";

export const sidebarViewModeAtom = atom<"hierarchy" | "list">("hierarchy");


type TreeNode = {
  name: string;
  path: string;
  treePath: string;
  children: Record<string, TreeNode>;
  isLeaf: boolean;
  isNavigable: boolean;
};

type Props = {
  instances: any[];
  capabilities: any[];
  dashboardFolders: string[];
  hierarchyTypes: any[];
  hierarchyMasters: any[];
};

export default function HierarchySidebar({ instances, capabilities, dashboardFolders, hierarchyTypes, hierarchyMasters }: Props) {
  const pathname = usePathname();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useAtom(sidebarViewModeAtom);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Helper to resolve hierarchy path
  const resolveHierarchyPath = (masterId: string | null) => {
    const nodes: { id: string; name: string }[] = [];
    let currentId = masterId;
    while (currentId) {
      const master = hierarchyMasters.find((m) => m.hierarchyMasterId === currentId);
      if (master) {
        nodes.unshift({ id: master.hierarchyMasterId, name: master.hierarchyDisplayName });
        currentId = master.parentHierarchyId;
      } else {
        break;
      }
    }
    return nodes;
  };

  // 1. Filter Instances based on search
  const filteredInstances = useMemo(() => {
    if (!searchTerm.trim()) return instances;
    const lowerSearch = searchTerm.toLowerCase();
    return instances.filter((ins) => {
      const nodes = resolveHierarchyPath(ins.hierarchyMasterId);
      return [ins.instanceName, ...nodes.map((n) => n.name)]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(lowerSearch));
    });
  }, [instances, searchTerm, hierarchyMasters]);

  // 2. Build Tree
  const tree = useMemo(() => {
    const root: TreeNode = { name: "root", path: "/instance-explorer", treePath: "root", children: {}, isLeaf: false, isNavigable: false };

    for (const ins of filteredInstances) {
      // Build path sequence
      const hierarchyNodes = resolveHierarchyPath(ins.hierarchyMasterId);
      const moduleName = ins.capability?.moduleTypeRel?.moduleTypeName || "Unknown Module";
      const moduleId = ins.capability?.moduleTypeRel?.moduleTypeId || "unknown";

      const nodes = [
        { id: String(moduleId), name: moduleName },
        ...hierarchyNodes
      ];

      let currentNode = root;
      let currentTreePath = "root";

      for (let i = 0; i < nodes.length; i++) {
        const nodeData = nodes[i];
        const partName = nodeData.name;
        const partId = nodeData.id;

        // Use node id as key to avoid collisions with same names
        const key = String(partId);
        currentTreePath += "/" + encodeURIComponent(key);

        if (!currentNode.children[key]) {
          let currentPath = "";
          let isNavigable = true;

          if (i === 0) {
            // Level 0: Module
            currentPath = `/instance-explorer/${partId}/module-overview`;
          } else if (i === 1) {
            // Level 1: Region
            currentPath = `/instance-explorer/${partId}/region-overview?moduleId=${nodes[0].id}`;
          } else if (i === 2) {
            // Level 2: Affiliate
            currentPath = `/instance-explorer/${partId}/affiliate-overview?moduleId=${nodes[0].id}`;
          } else if (i === 3) {
            // Level 3: Plant
            currentPath = `/instance-explorer/${partId}/plant-overview?moduleId=${nodes[0].id}`;
          } else {
            // Level 4+: System
            const folder = ins.capability?.folderMapping || "default";
            currentPath = `/instance-explorer/${ins.instanceId}/${folder}`;
          }

          currentNode.children[key] = {
            name: partName,
            path: currentPath,
            treePath: currentTreePath,
            children: {},
            isLeaf: i === nodes.length - 1,
            isNavigable,
          };
        }
        currentNode = currentNode.children[key];
      }
    }
    return root;
  }, [filteredInstances, hierarchyMasters]);

  // Auto-expand sidebar to the currently active node
  useEffect(() => {
    if (!pathname) return;

    const findNodeByPath = (node: TreeNode, targetPath: string): string | null => {
      if (node.isNavigable && (targetPath === node.path || targetPath === node.path + "/")) {
        return node.treePath;
      }
      for (const key in node.children) {
        const result = findNodeByPath(node.children[key], targetPath);
        if (result) return result;
      }
      return null;
    };

    const targetTreePath = findNodeByPath(tree, pathname);

    if (targetTreePath) {
      const parts = targetTreePath.split("/");
      const newExpanded: Record<string, boolean> = {};
      let current = "";
      // Expand all nodes along the path including target node if it has children
      for (let i = 0; i < parts.length; i++) {
        current += (i === 0 ? parts[i] : "/" + parts[i]);
        newExpanded[current] = true;
      }

      setExpandedNodes((prev) => ({ ...prev, ...newExpanded }));
    }
  }, [pathname, tree]);

  const toggleExpand = (treePath: string) => {
    setExpandedNodes((prev) => ({ ...prev, [treePath]: !prev[treePath] }));
  };

  const handleSuccess = () => {
    setIsAddModalOpen(false);
    toast("Instance created successfully", "success");
  };

  // Render Node Recursively
  const renderTree = (node: TreeNode, depth: number = 0) => {
    const hasChildren = Object.keys(node.children).length > 0;
    // Auto-expand if there's a search term, else use state
    const isExpanded = searchTerm.trim() !== "" || expandedNodes[node.treePath];
    const isSelected = node.isNavigable && (pathname === node.path || pathname === node.path + "/");

    return (
      <div key={`-${node.treePath}-${node.path}-${node.name}-${node.isLeaf}`}>
        <div
          className={[
            "flex items-start group py-1.5 px-2 rounded-lg cursor-pointer text-sm font-medium transition-colors",
            isSelected
              ? "bg-accent-blue/10 text-accent-blue"
              : "text-text-primary hover:bg-surface-hover",
          ].join(" ")}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={(e) => {
            if (hasChildren) {
              toggleExpand(node.treePath);
            }
          }}
        >
          {/* Caret for expansion */}
          <div
            className="w-5 h-5 flex items-center justify-center shrink-0"
            onClick={(e) => {
              if (hasChildren) {
                e.preventDefault();
                e.stopPropagation();
                toggleExpand(node.treePath);
              }
            }}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown size={14} className="text-text-secondary" />
              ) : (
                <ChevronRight size={14} className="text-text-secondary" />
              )
            ) : (
              <span className="w-3" />
            )}
          </div>

          {/* Link to navigate */}
          {node.isNavigable && !hasChildren ? (
            <Link
              href={node.path}
              className="flex flex-1 items-start gap-2 px-1 py-0.5"
            >
              {node.isLeaf ? (
                <Zap size={14} className="text-text-secondary shrink-0 mt-[3px]" />
              ) : (
                <Folder size={14} className="text-text-secondary shrink-0 mt-[3px]" />
              )}
              <span className="wrap-break-words text-left">{node.name}</span>
            </Link>
          ) : (
            <div
              className="flex flex-1 items-start gap-2 px-1 py-0.5"
              onClick={(e) => {
                if (hasChildren) {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleExpand(node.treePath);
                }
              }}
            >
              {node.isLeaf ? (
                <Zap size={14} className="text-text-secondary shrink-0 mt-[3px]" />
              ) : (
                <Folder size={14} className="text-text-secondary shrink-0 mt-[3px]" />
              )}
              <span className="wrap-break-words text-left">{node.name}</span>
            </div>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {Object.values(node.children).map((child) =>
              renderTree(child, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col bg-surface border border-border rounded-xl shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${isCollapsed ? "w-12 h-12 items-center justify-center" : "w-[20%] min-w-[270px] max-w-[320px] h-full"}`}>

      {isCollapsed ? (
        <div className="flex flex-col items-center justify-center w-full h-full">
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-2 text-text-secondary hover:text-text-primary bg-surface-hover rounded-md transition-colors"
            title="Expand Sidebar"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      ) : (<>
        {/* Header */}
        <div className="p-4 border-b border-border shrink-0 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-1">
            <h2 className="text-base font-bold text-text-primary tracking-wide uppercase truncate">
              Instances
            </h2>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex bg-surface-hover rounded-md p-0.5 border border-border">
                <button
                  onClick={() => setViewMode("hierarchy")}
                  className={`p-1 rounded-sm transition-colors ${viewMode === "hierarchy" ? "bg-surface text-accent-blue shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
                  title="Hierarchy View"
                >
                  <Network size={14} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1 rounded-sm transition-colors ${viewMode === "list" ? "bg-surface text-accent-blue shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
                  title="List View"
                >
                  <List size={14} />
                </button>
              </div>
              <RequireAccess right="canUpdate">
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-accent-blue text-white rounded-md text-xs font-medium hover:opacity-90 transition-opacity shrink-0"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </RequireAccess>
              <div className="flex items-center shrink-0">
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="p-1.5 text-text-secondary hover:text-text-primary bg-surface-hover rounded-md transition-colors"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search instances..."
              className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-blue transition-colors"
            />
          </div>
        </div>

        {/* View */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {viewMode === "hierarchy" ? (
            Object.keys(tree.children).length === 0 ? (
              <div className="text-center p-4 text-xs text-text-secondary mt-10">
                {searchTerm ? "No instances match your search." : "No instances created yet."}
              </div>
            ) : (
              Object.values(tree.children).map((child) => renderTree(child, 0))
            )
          ) : (
            filteredInstances.length === 0 ? (
              <div className="text-center p-4 text-xs text-text-secondary mt-10">
                {searchTerm ? "No instances match your search." : "No instances created yet."}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {filteredInstances.map((ins) => {
                  const master = hierarchyMasters.find((m) => m.hierarchyMasterId === ins.hierarchyMasterId);
                  const displayName = master ? master.hierarchyDisplayName : ins.instanceName;
                  const folder = ins.capability?.folderMapping || "default";
                  const path = `/instance-explorer/${ins.instanceId}/${folder}`;
                  const isSelected = pathname === path || pathname === path + "/";

                  return (
                    <Link
                      key={ins.instanceId}
                      href={path}
                      className={[
                        "flex items-start gap-2 py-1.5 px-3 rounded-lg text-sm font-medium transition-colors",
                        isSelected
                          ? "bg-accent-blue/10 text-accent-blue"
                          : "text-text-primary hover:bg-surface-hover",
                      ].join(" ")}
                    >
                      <Zap size={14} className="text-text-secondary shrink-0 mt-[3px]" />
                      <span className="wrap-break-words text-left">{displayName}</span>
                    </Link>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Add Modal */}
        {isAddModalOpen && (
          <Modal title="Add Instance" onClose={() => setIsAddModalOpen(false)}>
            <AddInstanceModal
              capabilities={capabilities}
              dashboardFolders={dashboardFolders}
              hierarchyTypes={hierarchyTypes}
              hierarchyMasters={hierarchyMasters}
              onSuccess={handleSuccess}
              onClose={() => setIsAddModalOpen(false)}
            />
          </Modal>
        )}
      </>)}
    </div>
  );
}
