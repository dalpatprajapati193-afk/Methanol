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
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/shared/components/modal/Index";
import { useToast } from "@/shared/components/toast/Index";
import RequireAccess from "@/shared/components/RequireAccess";
import { usePermissions } from "@/shared/providers/PermissionProvider";
import { createSecurityGroup, updateSecurityGroup, deleteSecurityGroup } from "../actions/GroupActions";

export type SecurityGroupRow = {
  groupId: number;
  groupName: string;
  description: string | null;
  isActive: boolean;
};

type Props = {
  initialGroups: SecurityGroupRow[];
};

const col = createColumnHelper<SecurityGroupRow>();

export default function GroupsTable({ initialGroups }: Props) {
  const permissions = usePermissions();
  const { toast } = useToast();
  const [groups, setGroups] = useState<SecurityGroupRow[]>(initialGroups);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [editingGroup, setEditingGroup] = useState<SecurityGroupRow | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form State
  const [formData, setFormData] = useState({ groupName: "", description: "", isActive: true });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const columns = useMemo(
    () => {
      const baseCols: ColumnDef<SecurityGroupRow, any>[] = [
        col.accessor("groupId", { header: "ID", enableColumnFilter: false }),
        col.accessor("groupName", {
          header: "Group Name",
          cell: (info) => <span className="font-medium text-text-primary">{info.getValue()}</span>,
        }),
        col.accessor("description", {
          header: "Description",
          cell: (info) => <span className="text-text-secondary">{info.getValue() || "-"}</span>,
        }),
        col.accessor("isActive", {
          header: "Status",
          enableSorting: true,
          filterFn: (row, _columnId, filterValue) => {
            if (filterValue === "") return true;
            return row.getValue("isActive") === (filterValue === "true");
          },
          cell: (info) => (
            <span
              className={[
                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                info.getValue()
                  ? "bg-accent-green/15 text-accent-green"
                  : "bg-border text-text-secondary",
              ].join(" ")}
            >
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
              <div className="flex gap-2">
                <RequireAccess right="canUpdate">
                  <button
                    onClick={() => {
                      setEditingGroup(row.original);
                      setFormData({
                        groupName: row.original.groupName,
                        description: row.original.description || "",
                        isActive: row.original.isActive,
                      });
                    }}
                    className="p-1.5 rounded-md text-text-secondary hover:text-accent-blue hover:bg-surface-hover transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                </RequireAccess>
                <RequireAccess right="canDelete">
                  <button
                    onClick={async () => {
                      if (confirm(`Delete group ${row.original.groupName}?`)) {
                        const res = await deleteSecurityGroup(row.original.groupId);
                        if (res.success) {
                          setGroups(prev => prev.filter(g => g.groupId !== row.original.groupId));
                          toast("Group deleted successfully", "success");
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
    data: groups,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (editingGroup) {
      const res = await updateSecurityGroup(editingGroup.groupId, formData);
      if (res.success && res.group) {
        setGroups(prev => prev.map(g => g.groupId === res.group.groupId ? res.group as SecurityGroupRow : g));
        toast("Group updated", "success");
        setEditingGroup(null);
      } else {
        toast(res.error || "Update failed", "error");
      }
    } else {
      const res = await createSecurityGroup(formData);
      if (res.success && res.group) {
        setGroups(prev => [...prev, res.group as SecurityGroupRow]);
        toast("Group created", "success");
        setIsAdding(false);
      } else {
        toast(res.error || "Creation failed", "error");
      }
    }
    setIsSubmitting(false);
  };

  const openAddModal = () => {
    setFormData({ groupName: "", description: "", isActive: true });
    setIsAdding(true);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-bold text-text-primary uppercase tracking-wide">Security Groups</h2>
          <p className="text-xs text-text-secondary">Manage system roles and group assignments.</p>
        </div>
        <RequireAccess right="canCreate">
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> Add Group
          </button>
        </RequireAccess>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-y-auto flex-1 bg-background">
        <table className="w-full text-sm">
          <thead className="bg-surface sticky top-0 z-10 before:content-[''] before:absolute before:inset-x-0 before:bottom-0 before:border-b before:border-border">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
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
                  <td key={cell.id} className="px-4 py-3 text-text-primary">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr><td colSpan={columns.length} className="text-center p-6 text-text-secondary">No groups found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {(isAdding || editingGroup) && (
        <Modal title={isAdding ? "Add Security Group" : "Edit Security Group"} onClose={() => { setIsAdding(false); setEditingGroup(null); }}>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Group Name</label>
              <input
                required
                type="text"
                value={formData.groupName}
                onChange={e => setFormData({ ...formData, groupName: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-accent-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
              <input
                type="text"
                value={formData.description || ""}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-accent-blue focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                className="accent-accent-blue rounded"
              />
              <label className="text-sm text-text-primary">Is Active</label>
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => { setIsAdding(false); setEditingGroup(null); }}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue text-white hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
