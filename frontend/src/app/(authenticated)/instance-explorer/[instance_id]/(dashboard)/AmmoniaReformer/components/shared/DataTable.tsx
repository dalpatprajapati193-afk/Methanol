"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));

interface Column<T> {
  key: string;
  header: string;
  editable?: boolean;
  type?: "text" | "number" | "select";
  options?: string[];
  width?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface Props<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  onRowChange?: (index: number, key: string, value: unknown) => void;
  onAddRow?: () => void;
  onDeleteRow?: (index: number) => void;
  className?: string;
  stickyHeader?: boolean;
  maxHeight?: string;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowChange,
  onAddRow,
  onDeleteRow,
  className = "",
  stickyHeader = false,
  maxHeight = "400px",
}: Props<T>) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);

  return (
    <div className={cn("border border-border rounded-xl overflow-hidden shadow-sm", className)}>
      <div className={stickyHeader ? "overflow-y-auto" : ""} style={stickyHeader ? { maxHeight } : {}}>
        <table className="w-full text-xs border-collapse">
          <thead className={stickyHeader ? "sticky top-0 z-10" : ""}>
            <tr className="bg-surface border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-2.5 py-2 text-left text-[10.5px] font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap"
                  style={col.width ? { width: col.width } : {}}
                >
                  {col.header}
                </th>
              ))}
              {onDeleteRow && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b border-border/60 hover:bg-surface transition-colors">
                {columns.map((col) => {
                  const val = row[col.key];
                  const isEditing =
                    editingCell?.row === rowIdx && editingCell?.col === col.key;
                  return (
                    <td key={col.key} className="px-2.5 py-1.5 align-middle">
                      {col.render ? (
                        col.render(val, row)
                      ) : col.editable && onRowChange ? (
                        isEditing ? (
                          col.type === "select" ? (
                            <select
                              autoFocus
                              className="w-full border border-accent-blue rounded-[6px] px-1.5 py-0.5 text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
                              value={String(val ?? "")}
                              onChange={(e) => {
                                onRowChange(rowIdx, col.key, e.target.value);
                                setEditingCell(null);
                              }}
                              onBlur={() => setEditingCell(null)}
                            >
                              {(col.options ?? []).map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              autoFocus
                              type={col.type === "number" ? "number" : "text"}
                              className="w-full border border-accent-blue rounded-[6px] px-1.5 py-0.5 text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
                              defaultValue={String(val ?? "")}
                              onBlur={(e) => {
                                const v = col.type === "number"
                                  ? e.target.value === "" ? null : Number(e.target.value)
                                  : e.target.value;
                                onRowChange(rowIdx, col.key, v);
                                setEditingCell(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                            />
                          )
                        ) : (
                          <span
                            className="block w-full cursor-text hover:bg-surface-hover rounded-[5px] px-1.5 py-0.5 min-h-[20px] transition-colors"
                            onClick={() => setEditingCell({ row: rowIdx, col: col.key })}
                          >
                            {String(val ?? "")}
                          </span>
                        )
                      ) : (
                        <span className="text-text-primary">{String(val ?? "")}</span>
                      )}
                    </td>
                  );
                })}
                {onDeleteRow && (
                  <td className="px-1 text-center">
                    <button
                      className="w-5 h-5 flex items-center justify-center text-text-tertiary hover:text-accent-red hover:bg-red-50 rounded transition-colors mx-auto"
                      onClick={() => onDeleteRow(rowIdx)}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (onDeleteRow ? 1 : 0)}
                  className="py-8 text-center text-text-secondary italic text-xs"
                >
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {onAddRow && (
        <div className="px-3 py-2 border-t border-border bg-surface">
          <button
            onClick={onAddRow}
            className="text-xs text-accent-blue hover:text-accent-blue/80 font-medium flex items-center gap-1 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Add row
          </button>
        </div>
      )}
    </div>
  );
}
