"use client";

import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { Plus, Pencil, Trash2, Check, X, LayoutDashboard } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Modal } from "@/shared/components/modal/Index";
import { useToast } from "@/shared/components/toast/Index";
import RequireAccess from "@/shared/components/RequireAccess";
import { usePermissions } from "@/shared/providers/PermissionProvider";
import { createResource, updateResource, deleteResource } from "../actions/ResourceActions";

export type ResourceRow = {
  resourceId: number;
  title: string;
  url: string | null;
  description: string | null;
  isActive: boolean;
  icon: string | null;
  resourceType: string;
  resourceArea: string;
};

const RESOURCE_TYPES = ["URL", "HierarchyMaster", "Feature", "API"] as const;
const RESOURCE_AREAS = ["sidebar", "admin", "general"] as const;

const AREA_COLORS: Record<string, string> = {
  sidebar: "bg-accent-blue/10 text-accent-blue",
  admin: "bg-accent-orange/10 text-accent-orange",
  general: "bg-accent-green/10 text-accent-green",
};

const TYPE_COLORS: Record<string, string> = {
  URL: "bg-accent-blue/10 text-accent-blue",
  HierarchyMaster: "bg-accent-orange/10 text-accent-orange",
  Feature: "bg-accent-yellow/10 text-accent-yellow",
  API: "bg-accent-green/10 text-accent-green",
};

function IconPreview({ name }: { name: string | null }) {
  if (!name) return <LayoutDashboard size={15} className="text-text-secondary" />;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (LucideIcons as any)[name] as React.ElementType | undefined;
  if (!Icon) return <span className="text-[10px] text-text-secondary italic">{name}?</span>;
  return <Icon size={15} className="text-text-primary" />;
}

const col = createColumnHelper<ResourceRow>();

type Props = { initialResources: ResourceRow[] };

const initialFormState = {
  title: "",
  url: "",
  description: "",
  isActive: true,
  icon: "",
  resourceType: "URL" as ResourceRow["resourceType"],
  resourceArea: "sidebar" as ResourceRow["resourceArea"],
};

export default function ResourcesTable({ initialResources }: Props) {
  const permissions = usePermissions();
  const { toast } = useToast();
  const [resources, setResources] = useState<ResourceRow[]>(initialResources);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [editingResource, setEditingResource] = useState<ResourceRow | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAdd = () => {
    setFormData(initialFormState);
    setIsAdding(true);
  };

  const openEdit = (r: ResourceRow) => {
    setEditingResource(r);
    setFormData({
      title: r.title,
      url: r.url ?? "",
      description: r.description ?? "",
      isActive: r.isActive,
      icon: r.icon ?? "",
      resourceType: r.resourceType,
      resourceArea: r.resourceArea,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      ...formData,
      url: formData.url || null,
      description: formData.description || null,
      icon: formData.icon || null,
    };

    if (editingResource) {
      const res = await updateResource(editingResource.resourceId, payload);
      if (res.success && res.resource) {
        setResources((prev) =>
          prev.map((r) => (r.resourceId === res.resource!.resourceId ? (res.resource as ResourceRow) : r))
        );
        toast("Resource updated", "success");
        setEditingResource(null);
      } else {
        toast(res.error ?? "Update failed", "error");
      }
    } else {
      const res = await createResource(payload);
      if (res.success && res.resource) {
        setResources((prev) => [...prev, res.resource as ResourceRow]);
        toast("Resource created", "success");
        setIsAdding(false);
      } else {
        toast(res.error ?? "Creation failed", "error");
      }
    }
    setIsSubmitting(false);
  };

  const columns = useMemo(
    () => {
      const baseCols: ColumnDef<ResourceRow, any>[] = [
        col.accessor("title", {
          header: "Title",
          cell: (info) => (
            <div className="flex items-center gap-2">
              <IconPreview name={info.row.original.icon} />
              <span className="font-medium text-text-primary">{info.getValue()}</span>
            </div>
          ),
        }),
        col.accessor("url", {
          header: "URL",
          cell: (info) => (
            <span className="font-mono text-xs text-text-secondary truncate max-w-[180px] block" title={info.getValue() ?? ""}>
              {info.getValue() ?? "—"}
            </span>
          ),
        }),
        col.accessor("resourceType", {
          header: "Type",
          cell: (info) => (
            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${TYPE_COLORS[info.getValue()] ?? "bg-surface text-text-secondary"}`}>
              {info.getValue()}
            </span>
          ),
        }),
        col.accessor("resourceArea", {
          header: "Area",
          cell: (info) => (
            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${AREA_COLORS[info.getValue()] ?? "bg-surface text-text-secondary"}`}>
              {info.getValue()}
            </span>
          ),
        }),
        col.accessor("isActive", {
          header: "Status",
          cell: (info) => (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${info.getValue() ? "bg-accent-green/15 text-accent-green" : "bg-border text-text-secondary"}`}>
              {info.getValue() ? <Check size={11} /> : <X size={11} />}
              {info.getValue() ? "Active" : "Inactive"}
            </span>
          ),
        }),
      ];

      if (permissions.canUpdate || permissions.canDelete) {
        baseCols.push(
          col.display({
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
              <div className="flex gap-2 justify-end">
                <RequireAccess right="canUpdate">
                  <button
                    onClick={() => openEdit(row.original)}
                    className="p-1.5 rounded-md text-text-secondary hover:text-accent-blue hover:bg-surface-hover transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                </RequireAccess>
                <RequireAccess right="canDelete">
                  <button
                    onClick={async () => {
                      if (confirm(`Delete resource "${row.original.title}"?`)) {
                        const res = await deleteResource(row.original.resourceId);
                        if (res.success) {
                          setResources((prev) => prev.filter((r) => r.resourceId !== row.original.resourceId));
                          toast("Resource deleted", "success");
                        } else {
                          toast(`Failed: ${res.error}`, "error");
                        }
                      }
                    }}
                    className="p-1.5 rounded-md text-text-secondary hover:text-accent-red hover:bg-surface-hover transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </RequireAccess>
              </div>
            ),
          })
        );
      }

      return baseCols;
    },
    [permissions.canUpdate, permissions.canDelete]
  );

  const table = useReactTable({
    data: resources,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-bold text-text-primary uppercase tracking-wide">Resources</h2>
          <p className="text-xs text-text-secondary">Manage URL routes, features, and other resources exposed to security groups.</p>
        </div>
        <RequireAccess right="canCreate">
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> Add Resource
          </button>
        </RequireAccess>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-y-auto flex-1 bg-background">
        <table className="w-full text-sm">
          <thead className="bg-surface sticky top-0 z-10 before:content-[''] before:absolute before:inset-x-0 before:bottom-0 before:border-b before:border-border">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-border hover:bg-surface-hover transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2.5 text-text-primary">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr><td colSpan={columns.length} className="text-center p-8 text-text-secondary">No resources found. Add one to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {(isAdding || editingResource) && (
        <Modal
          title={editingResource ? "Edit Resource" : "Add Resource"}
          onClose={() => { setIsAdding(false); setEditingResource(null); }}
        >
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Title <span className="text-accent-red">*</span></label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Instance Explorer"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-accent-blue focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">URL</label>
                <input
                  type="text"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="e.g. /instance-explorer"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-accent-blue focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                placeholder="Short description of this resource..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-accent-blue focus:outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Resource Type</label>
                <select
                  value={formData.resourceType}
                  onChange={(e) => setFormData({ ...formData, resourceType: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-accent-blue focus:outline-none"
                >
                  {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Resource Area</label>
                <select
                  value={formData.resourceArea}
                  onChange={(e) => setFormData({ ...formData, resourceArea: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-accent-blue focus:outline-none"
                >
                  {RESOURCE_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Icon <span className="text-text-secondary/60">(Lucide icon name, e.g. "Globe")</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="Globe"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-accent-blue focus:outline-none"
                />
                <div className="w-9 h-9 flex items-center justify-center border border-border rounded-lg bg-surface shrink-0">
                  <IconPreview name={formData.icon || null} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="res-is-active"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="accent-accent-blue rounded"
              />
              <label htmlFor="res-is-active" className="text-sm text-text-primary cursor-pointer">Is Active</label>
            </div>

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => { setIsAdding(false); setEditingResource(null); }}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue text-white hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Save Resource"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
