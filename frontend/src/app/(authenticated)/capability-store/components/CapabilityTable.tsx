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
  type FilterFn,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, Plus } from "lucide-react";
import { Modal } from "@/shared/components/modal/Index";
import { useToast } from "@/shared/components/toast/Index";
import RequireAccess from "@/shared/components/RequireAccess";
import { usePermissions } from "@/shared/providers/PermissionProvider";
import EditCapabilityModal from "./EditCapabilityModal";

// ── Types ──────────────────────────────────────────────────────────────

export type CapabilityRow = {
  capabilityId: number;
  moduleType: number;
  plantType: number;
  systemType: number;
  moduleTypeName: string;
  plantTypeName: string;
  systemTypeName: string;
  folderMapping: string;
  isActive: boolean;
};

type LookupItem = { id: number; name: string };

type Props = {
  initialCapabilities: CapabilityRow[];
  moduleTypes: LookupItem[];
  plantTypes: LookupItem[];
  systemTypes: LookupItem[];
};

// ── Custom filter (case-insensitive substring) ─────────────────────────

const fuzzyFilter: FilterFn<CapabilityRow> = (row, columnId, value) => {
  const cellValue = String(row.getValue(columnId) ?? "").toLowerCase();
  return cellValue.includes(String(value).toLowerCase());
};

// ── Column helper ──────────────────────────────────────────────────────

const col = createColumnHelper<CapabilityRow>();

// ── Component ──────────────────────────────────────────────────────────

export default function CapabilityTable({
  initialCapabilities,
  moduleTypes,
  plantTypes,
  systemTypes,
}: Props) {
  const permissions = usePermissions();
  const { toast } = useToast();
  const [capabilities, setCapabilities] =
    useState<CapabilityRow[]>(initialCapabilities);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [editingRow, setEditingRow] = useState<CapabilityRow | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // ── Column definitions ────────────────────────────────────────────────

  const columns = useMemo(
    () => {
      const baseCols: ColumnDef<CapabilityRow, any>[] = [
        col.accessor("moduleTypeName", {
          header: "Module",
          filterFn: fuzzyFilter,
          cell: (info) => (
            <span className="capitalize">{info.getValue()}</span>
          ),
        }),
        col.accessor("plantTypeName", {
          header: "Plant",
          filterFn: fuzzyFilter,
          cell: (info) => (
            <span className="capitalize">{info.getValue()}</span>
          ),
        }),
        col.accessor("systemTypeName", {
          header: "System",
          filterFn: fuzzyFilter,
          cell: (info) => (
            <span className="capitalize">{info.getValue() as string}</span>
          ),
        }),
        col.accessor("folderMapping", {
          header: "Folder Mapping",
          filterFn: fuzzyFilter,
          cell: (info) => (
            <span className="font-mono text-xs">{info.getValue() as string}</span>
          ),
        }),
        col.accessor("isActive", {
          header: "Active",
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

      if (permissions.canUpdate) {
        baseCols.push(
          col.display({
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
              <RequireAccess right="canUpdate">
                <button
                  id={`edit-btn-${row.original.capabilityId}`}
                  onClick={() => setEditingRow(row.original)}
                  aria-label="Edit capability"
                  className="p-1.5 rounded-md text-text-secondary hover:text-accent-blue hover:bg-surface-hover transition-colors"
                >
                  <Pencil size={15} />
                </button>
              </RequireAccess>
            ),
          })
        );
      }

      return baseCols;
    },
    [permissions.canUpdate]
  );

  // ── Table instance ────────────────────────────────────────────────────

  const table = useReactTable({
    data: capabilities,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const totalCount = capabilities.length;
  const filteredCount = table.getFilteredRowModel().rows.length;

  // ── Edit success handler ───────────────────────────────────────────────

  const handleEditSuccess = (updated: CapabilityRow, isNew = false) => {
    if (isNew) {
      setCapabilities((prev) => [...prev, updated]);
      setIsAdding(false);
      toast("Capability created successfully.", "success");
    } else {
      setCapabilities((prev) =>
        prev.map((c) => (c.capabilityId === updated.capabilityId ? updated : c))
      );
      setEditingRow(null);
      toast("Capability updated successfully", "success");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Page Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-text-primary tracking-wide uppercase">
            Registered Capabilities
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Showing{" "}
            <span className="font-semibold text-text-primary">{filteredCount}</span>
            {" "}of{" "}
            <span className="font-semibold text-text-primary">{totalCount}</span>
            {" "}capabilities
          </p>
        </div>
        <RequireAccess right="canCreate">
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            <span>Add Capability</span>
          </button>
        </RequireAccess>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-y-auto flex-1 relative bg-background">
        <table className="w-full text-sm">

          {/* Column Headers + Filter Row */}
          <thead className="bg-surface sticky top-0 z-10 before:content-[''] before:absolute before:inset-x-0 before:bottom-0 before:border-b before:border-border">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isSortable = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="px-4 pt-3 pb-1 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-surface"
                    >
                      {/* Label + Sort */}
                      <div
                        className={[
                          "flex items-center gap-1 mb-1.5",
                          isSortable ? "cursor-pointer select-none" : "",
                        ].join(" ")}
                        onClick={isSortable ? header.column.getToggleSortingHandler() : undefined}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {isSortable && (
                          <span className="text-text-secondary/60">
                            {sortDir === "asc" ? (
                              <ArrowUp size={12} />
                            ) : sortDir === "desc" ? (
                              <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={12} />
                            )}
                          </span>
                        )}
                      </div>

                      {/* Per-column filter */}
                      {header.column.id === "isActive" ? (
                        <select
                          value={(header.column.getFilterValue() as string) ?? ""}
                          onChange={(e) =>
                            header.column.setFilterValue(e.target.value)
                          }
                          className="w-full text-xs bg-background border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent-blue"
                        >
                          <option value="">All</option>
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      ) : header.column.id !== "actions" ? (
                        <input
                          value={(header.column.getFilterValue() as string) ?? ""}
                          onChange={(e) =>
                            header.column.setFilterValue(e.target.value)
                          }
                          placeholder="Filter…"
                          className="w-full text-xs bg-background border border-border rounded px-2 py-1 text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-blue"
                        />
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Body */}
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-text-secondary"
                >
                  No capabilities match your filter.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-border hover:bg-surface-hover transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-text-primary">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit/Add Modal */}
      {(editingRow || isAdding) && (
        <Modal
          title={isAdding ? "Add Capability" : "Edit Capability"}
          onClose={() => {
            setEditingRow(null);
            setIsAdding(false);
          }}
        >
          <EditCapabilityModal
            capability={editingRow}
            moduleTypes={moduleTypes}
            plantTypes={plantTypes}
            systemTypes={systemTypes}
            onSuccess={handleEditSuccess}
            onClose={() => {
              setEditingRow(null);
              setIsAdding(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
