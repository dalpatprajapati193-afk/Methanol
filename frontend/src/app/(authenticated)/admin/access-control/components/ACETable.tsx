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
import { Plus, Pencil, Trash2, Check, X, ShieldCheck, ShieldX } from "lucide-react";
import { Modal } from "@/shared/components/modal/Index";
import { useToast } from "@/shared/components/toast/Index";
import RequireAccess from "@/shared/components/RequireAccess";
import { usePermissions } from "@/shared/providers/PermissionProvider";
import { createMappingsBatch, updateACE, deleteMapping } from "../actions/ACEActions";

export type ACERow = {
  mappingId: number;
  aceId: number;
  groupId: number;
  groupName: string;
  resourceId: number;
  resourceTitle: string;
  resourceType: string;
  resourceArea: string;
  resourceUrl: string | null;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isAllowed: boolean;
};

type LookupGroup = { id: number; name: string };
type LookupResource = {
  id: number;
  title: string;
  resourceType: string;
  resourceArea: string;
  url: string | null;
};

type Props = {
  initialRows: ACERow[];
  groups: LookupGroup[];
  resources: LookupResource[];
};

const col = createColumnHelper<ACERow>();

const BoolCell = ({ value }: { value: boolean }) => (
  <div className="flex justify-center">
    {value
      ? <Check size={14} className="text-accent-green" />
      : <X size={14} className="text-text-secondary/30" />}
  </div>
);

const AREA_COLORS: Record<string, string> = {
  sidebar: "bg-accent-blue/10 text-accent-blue",
  admin: "bg-accent-orange/10 text-accent-orange",
  general: "bg-accent-green/10 text-accent-green",
};

const permKeys = ["canCreate", "canRead", "canUpdate", "canDelete"] as const;
const permLabels: Record<string, string> = {
  canCreate: "Create",
  canRead: "Read",
  canUpdate: "Update",
  canDelete: "Delete",
};

export default function ACETable({ initialRows, groups, resources }: Props) {
  const permissions = usePermissions();
  const { toast } = useToast();
  const [rows, setRows] = useState<ACERow[]>(initialRows);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Add modal state
  const [isAdding, setIsAdding] = useState(false);
  const [addGroupId, setAddGroupId] = useState<string>("");
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<number>>(new Set());
  const [addPerms, setAddPerms] = useState({
    canCreate: false,
    canRead: true,
    canUpdate: false,
    canDelete: false,
    isAllowed: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit modal state
  const [editingRow, setEditingRow] = useState<ACERow | null>(null);
  const [editPerms, setEditPerms] = useState({
    canCreate: false,
    canRead: true,
    canUpdate: false,
    canDelete: false,
    isAllowed: true,
  });

  const openAdd = () => {
    setAddGroupId("");
    setSelectedResourceIds(new Set());
    setAddPerms({ canCreate: false, canRead: true, canUpdate: false, canDelete: false, isAllowed: true });
    setIsAdding(true);
  };

  const openEdit = (row: ACERow) => {
    setEditingRow(row);
    setEditPerms({
      canCreate: row.canCreate,
      canRead: row.canRead,
      canUpdate: row.canUpdate,
      canDelete: row.canDelete,
      isAllowed: row.isAllowed,
    });
  };

  const toggleResource = (id: number) => {
    setSelectedResourceIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAddSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addGroupId || selectedResourceIds.size === 0) return;
    setIsSubmitting(true);

    const res = await createMappingsBatch(parseInt(addGroupId), Array.from(selectedResourceIds), addPerms);

    if (res.success) {
      toast(
        `${res.created} mapping(s) created${res.skipped ? `, ${res.skipped} already existed` : ""}.`,
        "success"
      );
      setIsAdding(false);
      // Reload will happen via revalidatePath, but we optimistically can't reconstruct
      // all ACE row data client-side, so we rely on the server revalidation.
      // A page refresh will show the new data.
      window.location.reload();
    } else {
      toast(res.error ?? "Failed to create mappings", "error");
    }
    setIsSubmitting(false);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    setIsSubmitting(true);

    const res = await updateACE(editingRow.aceId, editPerms);
    if (res.success && res.ace) {
      setRows((prev) =>
        prev.map((r) =>
          r.aceId === editingRow.aceId ? { ...r, ...editPerms } : r
        )
      );
      toast("ACE updated", "success");
      setEditingRow(null);
    } else {
      toast(res.error ?? "Update failed", "error");
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (row: ACERow) => {
    if (!confirm(`Remove access for "${row.groupName}" → "${row.resourceTitle}"?`)) return;
    const res = await deleteMapping(row.mappingId);
    if (res.success) {
      setRows((prev) => prev.filter((r) => r.mappingId !== row.mappingId));
      toast("Mapping deleted", "success");
    } else {
      toast(`Failed: ${res.error}`, "error");
    }
  };

  // Group resources by area for the checklist
  const resourcesByArea = useMemo(() => {
    const map = new Map<string, LookupResource[]>();
    for (const r of resources) {
      const list = map.get(r.resourceArea) ?? [];
      list.push(r);
      map.set(r.resourceArea, list);
    }
    return map;
  }, [resources]);

  const columns = useMemo(
    () => {
      const baseCols: ColumnDef<ACERow, any>[] = [
        col.accessor("groupName", {
          header: "Security Group",
          cell: (info) => <span className="font-medium text-text-primary">{info.getValue()}</span>,
        }),
        col.accessor("resourceTitle", {
          header: "Resource",
          cell: (info) => (
            <div className="flex flex-col">
              <span className="font-medium text-text-primary">{info.getValue()}</span>
              <span className="text-[10px] text-text-secondary font-mono">{info.row.original.resourceUrl ?? ""}</span>
            </div>
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
        col.accessor("isAllowed", {
          header: "Mode",
          cell: (info) => (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${info.getValue() ? "bg-accent-green/10 text-accent-green" : "bg-accent-red/10 text-accent-red"}`}>
              {info.getValue()
                ? <><ShieldCheck size={12} /> ALLOW</>
                : <><ShieldX size={12} /> DENY</>}
            </span>
          ),
        }),
        col.accessor("canCreate", {
          header: () => <div className="text-center">Create</div>,
          cell: (info) => <BoolCell value={info.getValue()} />,
        }),
        col.accessor("canRead", {
          header: () => <div className="text-center">Read</div>,
          cell: (info) => <BoolCell value={info.getValue()} />,
        }),
        col.accessor("canUpdate", {
          header: () => <div className="text-center">Update</div>,
          cell: (info) => <BoolCell value={info.getValue()} />,
        }),
        col.accessor("canDelete", {
          header: () => <div className="text-center">Delete</div>,
          cell: (info) => <BoolCell value={info.getValue()} />,
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
                    onClick={() => handleDelete(row.original)}
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
    data: rows,
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
      <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
        <div>
          <h2 className="text-lg font-bold text-text-primary uppercase tracking-wide">Access Control Entries</h2>
          <p className="text-xs text-text-secondary">Map security groups to resources and configure their permissions.</p>
        </div>
        <RequireAccess right="canCreate">
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> Add ACE
          </button>
        </RequireAccess>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-y-auto flex-1 bg-background">
        <table className="w-full text-sm">
          <thead className="bg-surface sticky top-0 z-10 before:content-[''] before:absolute before:inset-x-0 before:bottom-0 before:border-b before:border-border">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {(() => {
              const tableRows = table.getRowModel().rows;
              
              // Pre-calculate row spans based on groupId
              const groupSpanMap = new Map<number, number>();
              let currentGroupId: number | null = null;
              let currentGroupStartIdx = 0;
              
              tableRows.forEach((row, idx) => {
                if (row.original.groupId !== currentGroupId) {
                  if (currentGroupId !== null) {
                    groupSpanMap.set(currentGroupStartIdx, idx - currentGroupStartIdx);
                  }
                  currentGroupId = row.original.groupId;
                  currentGroupStartIdx = idx;
                }
              });
              if (currentGroupId !== null) {
                groupSpanMap.set(currentGroupStartIdx, tableRows.length - currentGroupStartIdx);
              }

              return tableRows.map((row, index) => {
                const isFirstOfGroup = groupSpanMap.has(index);
                const rowSpan = isFirstOfGroup ? groupSpanMap.get(index) : 0;

                return (
                  <tr key={row.id} className="border-t border-border hover:bg-surface-hover transition-colors">
                    {row.getVisibleCells().map((cell) => {
                      if (cell.column.id === "groupName") {
                        if (!isFirstOfGroup) return null;
                        return (
                          <td 
                            key={cell.id} 
                            rowSpan={rowSpan} 
                            className="px-4 py-3 text-text-primary align-top bg-surface/30 border-r border-border"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      }

                      return (
                        <td key={cell.id} className="px-4 py-2 text-text-primary">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              });
            })()}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center p-8 text-text-secondary">
                  No access control entries found. Click &quot;Add ACE&quot; to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add Mapping Modal ── */}
      {isAdding && (
        <Modal title="Add Access Control Entry" onClose={() => setIsAdding(false)}>
          <form onSubmit={handleAddSave} className="flex flex-col gap-5">

            {/* Step 1: Group */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                1. Security Group
              </label>
              <select
                required
                value={addGroupId}
                onChange={(e) => setAddGroupId(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-accent-blue focus:outline-none"
              >
                <option value="" disabled>Select a group...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Step 2: Resources */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                2. Resources <span className="text-accent-blue normal-case font-normal">({selectedResourceIds.size} selected)</span>
              </label>
              <div className="border border-border rounded-lg overflow-y-auto max-h-[240px] bg-background">
                {Array.from(resourcesByArea.entries()).map(([area, areaResources]) => (
                  <div key={area}>
                    <div className="px-3 py-1.5 bg-surface/70 border-b border-border">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${AREA_COLORS[area]?.split(" ")[1] ?? "text-text-secondary"}`}>
                        {area}
                      </span>
                    </div>
                    {areaResources.map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-hover border-b border-border/50 last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedResourceIds.has(r.id)}
                          onChange={() => toggleResource(r.id)}
                          className="accent-accent-blue rounded shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm text-text-primary font-medium truncate">{r.title}</span>
                          {r.url && <span className="text-[10px] text-text-secondary font-mono truncate">{r.url}</span>}
                        </div>
                        <span className={`ml-auto shrink-0 inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${AREA_COLORS[r.resourceArea] ?? "bg-surface text-text-secondary"}`}>
                          {r.resourceType}
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
                {resources.length === 0 && (
                  <p className="text-center text-text-secondary text-xs p-4">No active resources found. Add resources first.</p>
                )}
              </div>
            </div>

            {/* Step 3: Permissions */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                3. Permissions
              </label>
              <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="add-isAllowed"
                    checked={addPerms.isAllowed}
                    onChange={() => setAddPerms({ ...addPerms, isAllowed: true })}
                    className="accent-accent-green"
                  />
                  <span className="text-accent-green font-semibold">ALLOW</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="add-isAllowed"
                    checked={!addPerms.isAllowed}
                    onChange={() => setAddPerms({ ...addPerms, isAllowed: false })}
                    className="accent-accent-red"
                  />
                  <span className="text-accent-red font-semibold">DENY (overrides Allow)</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3 bg-surface p-3 rounded-lg border border-border">
                {permKeys.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addPerms[key]}
                      onChange={(e) => setAddPerms({ ...addPerms, [key]: e.target.checked })}
                      className="accent-accent-blue rounded"
                    />
                    {permLabels[key]}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !addGroupId || selectedResourceIds.size === 0}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue text-white hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : `Save ${selectedResourceIds.size > 1 ? `${selectedResourceIds.size} ACEs` : "ACE"}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit ACE Modal ── */}
      {editingRow && (
        <Modal title="Edit ACE" onClose={() => setEditingRow(null)}>
          <form onSubmit={handleEditSave} className="flex flex-col gap-4">
            {/* Read-only context */}
            <div className="bg-surface border border-border rounded-lg p-3 text-sm text-text-secondary">
              <div className="flex gap-2 flex-wrap">
                <span className="font-medium text-text-primary">{editingRow.groupName}</span>
                <span className="text-text-secondary">→</span>
                <span className="font-medium text-text-primary">{editingRow.resourceTitle}</span>
                {editingRow.resourceUrl && (
                  <span className="font-mono text-xs text-text-secondary">({editingRow.resourceUrl})</span>
                )}
              </div>
            </div>

            {/* Mode */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">Rule Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="edit-isAllowed"
                    checked={editPerms.isAllowed}
                    onChange={() => setEditPerms({ ...editPerms, isAllowed: true })}
                    className="accent-accent-green"
                  />
                  <span className="text-accent-green font-medium">ALLOW</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="edit-isAllowed"
                    checked={!editPerms.isAllowed}
                    onChange={() => setEditPerms({ ...editPerms, isAllowed: false })}
                    className="accent-accent-red"
                  />
                  <span className="text-accent-red font-medium">DENY (overrides Allow)</span>
                </label>
              </div>
            </div>

            {/* Permissions */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">Permissions</label>
              <div className="grid grid-cols-2 gap-3 bg-surface p-3 rounded-lg border border-border">
                {permKeys.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editPerms[key]}
                      onChange={(e) => setEditPerms({ ...editPerms, [key]: e.target.checked })}
                      className="accent-accent-blue rounded"
                    />
                    {permLabels[key]}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue text-white hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
