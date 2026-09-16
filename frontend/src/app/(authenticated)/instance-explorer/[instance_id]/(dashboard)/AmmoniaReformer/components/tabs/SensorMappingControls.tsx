"use client";

import { useState, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  sensorsAtom,
  instanceIdAtom,
  updateSensorMappingAtom,
  uploadSensorMappingAtom,
  flushDraftAtom,
  uploadPipelineInputAtom,
} from "../../store/Index";
import { downloadPipelineInputAction } from "../../actions/Actions";
import FileUpload from "../shared/FileUpload";
import Toast, { ToastStack } from "../shared/Toast";
import type { SensorMappingRow } from "../../types/Index";

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));

type ImportReport = { matched: number; skipped: number; total_template: number } | null;

function isMapped(r: SensorMappingRow) {
  return !!(r.sensor_name || r.constant_value || r.formula);
}

function IconBtn({ onClick, disabled, tooltip, children }: {
  onClick: () => void;
  disabled?: boolean;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative inline-flex group">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="inline-flex items-center justify-center w-8 h-8 border border-border rounded-[7px] bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
      >
        {children}
      </button>
      <div className="absolute top-full left-0 mt-2 z-50 w-max max-w-60 px-2.5 py-1.5 bg-surface border border-border rounded-lg shadow-md text-xs text-text-primary pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-pre-line leading-relaxed">
        {tooltip}
        <div className="absolute bottom-full left-3 border-4 border-transparent border-b-border" />
      </div>
    </div>
  );
}

export default function SensorMappingControls() {
  const [loading, setLoading] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const sensors = useAtomValue(sensorsAtom);
  const instanceId = useAtomValue(instanceIdAtom);
  const updateSensorMapping = useSetAtom(updateSensorMappingAtom);
  const uploadSensorMapping = useSetAtom(uploadSensorMappingAtom);
  const flushDraft = useSetAtom(flushDraftAtom);
  const uploadPipelineInputFile = useSetAtom(uploadPipelineInputAtom);

  const anyMapped = sensors.mappingRows.some((r) => !r._is_calc_override && isMapped(r));

  const handleExternalUpload = useCallback(async (file: File) => {
    setLoading(true); setImportReport(null); setUploadError(null);
    try {
      const result = await uploadSensorMapping(file);
      setImportReport((result as { report: ImportReport }).report);
    } catch {
      if (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls")) {
        try {
          const res = await uploadPipelineInputFile(file);
          setImportReport((res as { report: ImportReport }).report);
          return;
        } catch (err2: unknown) {
          const msg2 = err2 instanceof Error ? err2.message : String(err2);
          setUploadError(`Could not load file as mapping or pipeline-input workbook. ${msg2}`);
          return;
        }
      }
      setUploadError("Could not load mapping file.");
    } finally {
      setLoading(false);
    }
  }, [uploadSensorMapping, uploadPipelineInputFile]);

  const handleResetMapping = useCallback(async () => {
    const clearedRows = sensors.mappingRows.map((r) =>
      r._is_calc_override ? r : { ...r, sensor_name: "", constant_value: "", formula: "" }
    );
    setResetting(true);
    try {
      await updateSensorMapping(clearedRows);
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  }, [sensors.mappingRows, updateSensorMapping]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">

        {/* Load from file */}
        <FileUpload
          accept=".xlsx,.xls,.csv,.json"
          onFile={handleExternalUpload}
          disabled={loading}
          tooltip={"Import sensor-to-PI-tag mapping from an external file\n.xlsx · .xls · .csv · .json"}
        />

        {/* Save now — force-flush the instance draft to the DB (autosave also runs in the background) */}
        <IconBtn
          disabled={loading}
          tooltip={"Save now\nSaves your configuration for this instance"}
          onClick={async () => {
            setLoading(true);
            try { await flushDraft(true); }
            finally { setLoading(false); }
          }}
        >
          {/* Save / floppy-disk icon */}
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path d="M1 2a1 1 0 0 1 1-1h7l2 2v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            <rect x="3.5" y="1" width="4" height="3.5" rx="0.5" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="3" y="7" width="6" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
        </IconBtn>

        {/* Download pipeline input xlsx */}
        <IconBtn
          disabled={loading}
          tooltip={"Download sensor mapping\nOutputs sensor_mapping.xlsx"}
          onClick={async () => {
            setLoading(true);
            try {
              const { base64, filename } = await downloadPipelineInputAction(instanceId);
              const bytes = atob(base64);
              const arr = new Uint8Array(bytes.length);
              for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
              const url = URL.createObjectURL(new Blob([arr]));
              const a = document.createElement("a");
              a.href = url; a.download = filename; a.click();
              URL.revokeObjectURL(url);
            } finally { setLoading(false); }
          }}
        >
          {/* Download arrow icon */}
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v7M3.5 5.5 6 8l2.5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 10h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </IconBtn>

        {confirmReset ? (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-accent-red">Clear all PI sensor mappings? This cannot be undone.</span>
            <button
              onClick={() => setConfirmReset(false)}
              className="px-2 py-1 text-xs border border-border rounded text-text-secondary hover:bg-surface-hover transition-colors shrink-0"
            >
              Cancel
            </button>
            <button
              onClick={handleResetMapping}
              disabled={resetting}
              className="px-2 py-1 text-xs border border-accent-red rounded text-accent-red hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {resetting ? "Resetting…" : "Confirm reset"}
            </button>
          </div>
        ) : (
          <div className="relative inline-flex group ml-auto">
            <button
              className="h-8 px-3 text-sm border border-accent-red text-accent-red rounded hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={loading || !anyMapped}
              onClick={() => setConfirmReset(true)}
            >
              Reset
            </button>
            <div className="absolute top-full right-0 mt-2 z-50 w-max max-w-60 px-2.5 py-1.5 bg-surface border border-border rounded-lg shadow-md text-xs text-text-primary pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-pre-line leading-relaxed">
              Clear all PI sensor mappings{"\n"}This action cannot be undone
              <div className="absolute bottom-full right-3 border-4 border-transparent border-b-border" />
            </div>
          </div>
        )}
      </div>

      <ToastStack>
        {uploadError && (
          <Toast variant="error" message={uploadError} onClose={() => setUploadError(null)} />
        )}

        {importReport && (
          <Toast
            variant={importReport.matched > 0 ? "success" : "warning"}
            onClose={() => setImportReport(null)}
          >
            {importReport.matched > 0 ? "Loaded plant config: " : "File loaded, but no rows matched current hierarchy/template: "}
            <strong>{importReport.matched} rows matched</strong>
            {importReport.skipped > 0 && (
              <span className="text-text-secondary"> · {importReport.skipped} skipped</span>
            )}
          </Toast>
        )}
      </ToastStack>
    </div>
  );
}
