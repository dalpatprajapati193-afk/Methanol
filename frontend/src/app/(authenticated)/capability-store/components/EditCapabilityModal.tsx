"use client";

import { useState } from "react";
import { updateCapability, createCapability } from "../actions/Actions";

// ── Types ──────────────────────────────────────────────────────────────

import { type CapabilityRow } from "./CapabilityTable";

type LookupItem = { id: number; name: string };

type Props = {
  capability?: CapabilityRow | null;
  moduleTypes: LookupItem[];
  plantTypes: LookupItem[];
  systemTypes: LookupItem[];
  onSuccess: (updated: CapabilityRow, isNew?: boolean) => void;
  onClose: () => void;
};

// ── Component ──────────────────────────────────────────────────────────

export default function EditCapabilityModal({
  capability,
  moduleTypes,
  plantTypes,
  systemTypes,
  onSuccess,
  onClose,
}: Props) {
  const [moduleType, setModuleType] = useState<number | "">(capability?.moduleType ?? "");
  const [plantType, setPlantType] = useState<number | "">(capability?.plantType ?? "");
  const [systemType, setSystemType] = useState<number | "">(capability?.systemType ?? "");
  const [folderMapping, setFolderMapping] = useState(capability?.folderMapping ?? "default");
  const [isActive, setIsActive] = useState(capability?.isActive ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      let result;
      if (capability) {
        result = await updateCapability({
          capabilityId: capability.capabilityId,
          moduleType: Number(moduleType),
          plantType: Number(plantType),
          systemType: Number(systemType),
          folderMapping,
          isActive,
        });
      } else {
        result = await createCapability({
          moduleType: Number(moduleType),
          plantType: Number(plantType),
          systemType: Number(systemType),
          folderMapping,
          isActive,
        });
      }

      if (result.success) {
        const d = result.data;
        onSuccess({
          capabilityId: d.capabilityId,
          moduleType: d.moduleType,
          plantType: d.plantType,
          systemType: d.systemType,
          moduleTypeName: d.moduleTypeRel.moduleTypeName,
          plantTypeName: d.plantTypeRel.plantTypeName,
          systemTypeName: d.systemTypeRel.systemTypeName,
          folderMapping: d.folderMapping,
          isActive: d.isActive,
        }, !capability);
      } else {
        setError(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors capitalize";
  const labelClass = "block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1";

  return (
    <div className="flex flex-col gap-5">

      {/* Module */}
      <div>
        <label className={labelClass}>Module</label>
        <select
          id="edit-module-type"
          value={moduleType}
          onChange={(e) => setModuleType(e.target.value ? Number(e.target.value) : "")}
          className={selectClass}
        >
          <option value="" disabled>Select a module</option>
          {moduleTypes.map((m) => (
            <option key={m.id} value={m.id} className="capitalize">
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {/* Plant */}
      <div>
        <label className={labelClass}>Plant</label>
        <select
          id="edit-plant-type"
          value={plantType}
          onChange={(e) => setPlantType(e.target.value ? Number(e.target.value) : "")}
          className={selectClass}
        >
          <option value="" disabled>Select a plant</option>
          {plantTypes.map((p) => (
            <option key={p.id} value={p.id} className="capitalize">
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* System */}
      <div>
        <label className={labelClass}>System</label>
        <select
          id="edit-system-type"
          value={systemType}
          onChange={(e) => setSystemType(e.target.value ? Number(e.target.value) : "")}
          className={selectClass}
        >
          <option value="" disabled>Select a system</option>
          {systemTypes.map((s) => (
            <option key={s.id} value={s.id} className="capitalize">
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Folder Mapping */}
      <div>
        <label className={labelClass}>Folder Mapping</label>
        <input
          id="edit-folder-mapping"
          value={folderMapping}
          onChange={(e) => setFolderMapping(e.target.value)}
          placeholder="Folder Mapping"
          className={[selectClass, "normal-case"].join(" ")}
        />
      </div>

      {/* Active Toggle */}
      <div className="flex items-center justify-between">
        <label className={labelClass}>Active</label>
        <button
          id="edit-active-toggle"
          type="button"
          role="switch"
          aria-checked={isActive}
          onClick={() => setIsActive((v) => !v)}
          className={[
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-2",
            isActive ? "bg-accent-green" : "bg-border",
          ].join(" ")}
        >
          <span
            className={[
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200",
              isActive ? "translate-x-6" : "translate-x-1",
            ].join(" ")}
          />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-accent-red/30 bg-accent-red/10 px-4 py-3">
          <p className="text-sm text-accent-red">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
        <button
          id="edit-cancel-btn"
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-border transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          id="edit-save-btn"
          type="button"
          onClick={handleSave}
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting && (
            <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {isSubmitting ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
