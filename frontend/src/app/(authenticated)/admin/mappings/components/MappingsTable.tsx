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
import { Plus, Trash2 } from "lucide-react";
import Select from "react-select";
import { Modal } from "@/shared/components/modal/Index";
import { useToast } from "@/shared/components/toast/Index";
import RequireAccess from "@/shared/components/RequireAccess";
import { usePermissions } from "@/shared/providers/PermissionProvider";
import { addUserToGroup, removeUserFromGroup } from "../actions/MappingActions";

export type MappingRow = {
  userId: number;
  groupId: number;
  userName: string;
  userEmail: string;
  groupName: string;
};

type LookupItem = { id: number; name: string };

type Props = {
  initialMappings: MappingRow[];
  users: LookupItem[];
  groups: LookupItem[];
};

const customStyles = {
  control: (base: any, state: any) => ({
    ...base,
    backgroundColor: 'var(--color-background)',
    borderColor: state.isFocused ? 'var(--color-accent-blue)' : 'var(--color-border)',
    borderRadius: '0.5rem',
    minHeight: '42px',
    boxShadow: 'none',
    '&:hover': {
      borderColor: state.isFocused ? 'var(--color-accent-blue)' : 'var(--color-border)'
    }
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    zIndex: 50
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'var(--color-accent-blue)'
      : state.isFocused
      ? 'var(--color-surface-hover)'
      : 'transparent',
    color: state.isSelected ? '#ffffff' : 'var(--color-text-primary)',
    cursor: 'pointer',
    '&:active': {
      backgroundColor: 'var(--color-accent-blue)',
    }
  }),
  singleValue: (base: any) => ({
    ...base,
    color: 'var(--color-text-primary)'
  }),
  input: (base: any) => ({
    ...base,
    color: 'var(--color-text-primary)'
  }),
  placeholder: (base: any) => ({
    ...base,
    color: 'var(--color-text-secondary)',
    fontSize: '0.875rem'
  })
};

const col = createColumnHelper<MappingRow>();

export default function MappingsTable({ initialMappings, users, groups }: Props) {
  const permissions = usePermissions();
  const { toast } = useToast();
  const [mappings, setMappings] = useState<MappingRow[]>(initialMappings);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [isAdding, setIsAdding] = useState(false);

  // Form State
  const [formData, setFormData] = useState({ userId: "", groupId: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const columns = useMemo(
    () => {
      const baseCols: ColumnDef<MappingRow, any>[] = [
        col.accessor("userName", {
          header: "User",
          cell: (info) => (
            <div className="flex flex-col">
              <span className="font-medium text-text-primary">{info.getValue()}</span>
              <span className="text-xs text-text-secondary">{info.row.original.userEmail}</span>
            </div>
          ),
        }),
        col.accessor("groupName", {
          header: "Security Group",
          cell: (info) => <span className="font-medium text-text-primary">{info.getValue()}</span>,
        }),
      ];

      if (permissions.canDelete) {
        baseCols.push(
          col.display({
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
              <RequireAccess right="canDelete">
                <button
                  onClick={async () => {
                    if (confirm(`Remove ${row.original.userName} from ${row.original.groupName}?`)) {
                      const res = await removeUserFromGroup(row.original.userId, row.original.groupId);
                      if (res.success) {
                        setMappings(prev => prev.filter(m => !(m.userId === row.original.userId && m.groupId === row.original.groupId)));
                        toast("User removed from group", "success");
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
            ),
          })
        );
      }

      return baseCols;
    },
    [permissions.canDelete]
  );

  const table = useReactTable({
    data: mappings,
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
    if (!formData.userId || !formData.groupId) return;
    
    setIsSubmitting(true);
    const uId = parseInt(formData.userId, 10);
    const gId = parseInt(formData.groupId, 10);

    const res = await addUserToGroup(uId, gId);
    if (res.success) {
      const user = users.find(u => u.id === uId);
      const group = groups.find(g => g.id === gId);
      if (user && group) {
        setMappings(prev => [...prev, {
          userId: uId,
          groupId: gId,
          userName: user.name.split("|")[0], // Assuming we format name as "Name | Email"
          userEmail: user.name.split("|")[1] || "",
          groupName: group.name,
        }]);
      }
      toast("User assigned to group", "success");
      setIsAdding(false);
    } else {
      toast(res.error || "Assignment failed", "error");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-bold text-text-primary uppercase tracking-wide">User Mappings</h2>
          <p className="text-xs text-text-secondary">Assign users to Security Groups.</p>
        </div>
        <RequireAccess right="canCreate">
          <button
            onClick={() => { setFormData({ userId: "", groupId: "" }); setIsAdding(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> Assign User
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
              <tr><td colSpan={columns.length} className="text-center p-6 text-text-secondary">No mappings found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isAdding && (
        <Modal title="Assign User to Group" onClose={() => setIsAdding(false)}>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">User</label>
              <Select
                options={users.map(u => ({ value: u.id.toString(), label: u.name }))}
                value={users.map(u => ({ value: u.id.toString(), label: u.name })).find(o => o.value === formData.userId) || null}
                onChange={(selected: any) => setFormData({ ...formData, userId: selected?.value || "" })}
                isSearchable
                placeholder="Select User..."
                styles={customStyles}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Security Group</label>
              <Select
                options={groups.map(g => ({ value: g.id.toString(), label: g.name }))}
                value={groups.map(g => ({ value: g.id.toString(), label: g.name })).find(o => o.value === formData.groupId) || null}
                onChange={(selected: any) => setFormData({ ...formData, groupId: selected?.value || "" })}
                isSearchable
                placeholder="Select Group..."
                styles={customStyles}
                className="text-sm"
              />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formData.userId || !formData.groupId}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue text-white hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? "Assigning..." : "Assign"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
