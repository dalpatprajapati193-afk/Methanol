"use client";

import { useState } from "react";
import { createInstance } from "../actions/Actions";

type LookupItem = { id: number; name: string };
type Props = {
  capabilities: any[];
  dashboardFolders: string[];
  hierarchyTypes: any[];
  hierarchyMasters: any[];
  onSuccess: () => void;
  onClose: () => void;
};

export default function AddInstanceModal({
  capabilities,
  dashboardFolders,
  hierarchyTypes,
  hierarchyMasters,
  onSuccess,
  onClose,
}: Props) {
  const [instanceName, setInstanceName] = useState("");
  const [capabilityId, setCapabilityId] = useState<number | "">("");

  // Store the selected hierarchyMasterId for each hierarchyTypeId
  // key: hierarchyTypeId, value: hierarchyMasterId
  const [selectedMasters, setSelectedMasters] = useState<Record<string, string>>({});

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const systemType = hierarchyTypes.find(t => t.hierarchyTypeName.toLowerCase() === 'system');
  const isSystemSelected = systemType ? !!selectedMasters[systemType.hierarchyTypeId] : false;
  
  const isFormValid = instanceName.trim() !== "" && capabilityId !== "" && isSystemSelected;

  const handleHierarchyChange = (typeId: string, masterId: string) => {
    // Determine all descendants of typeId to clear them
    const newSelections = { ...selectedMasters };
    newSelections[typeId] = masterId;

    let currentParentId = typeId;
    let foundDescendant = true;
    while (foundDescendant) {
      const childType = hierarchyTypes.find((t) => t.parentHierarchyTypeId === currentParentId);
      if (childType) {
        delete newSelections[childType.hierarchyTypeId];
        currentParentId = childType.hierarchyTypeId;
      } else {
        foundDescendant = false;
      }
    }

    setSelectedMasters(newSelections);
  };

  const handleSave = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      // The final hierarchyMasterId to save is the one selected for the 'system' level
      let systemMasterId = systemType ? selectedMasters[systemType.hierarchyTypeId] : null;

      if (!systemMasterId) {
         setError("Please select a System mapping.");
         setIsSubmitting(false);
         return;
      }

      const result = await createInstance({
        instanceName,
        capabilityId: Number(capabilityId),
        hierarchyMasterId: systemMasterId,
      });

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors";
  const labelClass =
    "block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1";

  return (
    <div className="flex flex-col gap-4">
      {/* Name */}
      <div>
        <label className={labelClass}>Instance Name</label>
        <input
          value={instanceName}
          onChange={(e) => setInstanceName(e.target.value)}
          placeholder="e.g. My Instance"
          className={inputClass}
        />
      </div>

      {/* Capability Dropdown */}
      <div>
        <label className={labelClass}>Capability</label>
        <select
          value={capabilityId}
          onChange={(e) => setCapabilityId(e.target.value ? Number(e.target.value) : "")}
          className={inputClass}
        >
          <option value="" disabled>
            Select a capability
          </option>
          {capabilities.map((c) => (
            <option key={c.capabilityId} value={c.capabilityId} className="capitalize">
              {c.moduleTypeRel?.moduleTypeName} - {c.plantTypeRel?.plantTypeName} - {c.systemTypeRel?.systemTypeName}
            </option>
          ))}
        </select>
      </div>

      <div className="border-t border-border my-2 pt-2">
        <label className="block text-xs font-semibold text-text-primary mb-3 uppercase tracking-wide">
          Hierarchy Mapping
        </label>

        {hierarchyTypes.map((ht) => {
          const typeId = ht.hierarchyTypeId;
          const parentTypeId = ht.parentHierarchyTypeId;
          const parentSelectedMasterId = parentTypeId ? selectedMasters[parentTypeId] : null;

          // Disable if there's a parent type but its value hasn't been selected yet
          const isDisabled = parentTypeId ? !parentSelectedMasterId : false;

          // Filter masters for this type, and if parent exists, filter by parent hierarchy id
          const options = hierarchyMasters.filter((m) => {
            if (m.hierarchyTypeId !== typeId) return false;
            if (parentTypeId && m.parentHierarchyId !== parentSelectedMasterId) return false;
            return true;
          });

          return (
            <div key={typeId} className="mb-3">
              <label className={labelClass}>{ht.hierarchyDisplayName}</label>
              <select
                value={selectedMasters[typeId] || ""}
                onChange={(e) => handleHierarchyChange(typeId, e.target.value)}
                disabled={isDisabled}
                className={[inputClass, isDisabled && "opacity-50 cursor-not-allowed"].join(" ")}
              >
                <option value="" disabled>
                  Select {ht.hierarchyDisplayName}
                </option>
                {options.map((opt) => (
                  <option key={opt.hierarchyMasterId} value={opt.hierarchyMasterId}>
                    {opt.hierarchyDisplayName}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-accent-red/30 bg-accent-red/10 px-4 py-3 mt-2">
          <p className="text-sm text-accent-red">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-border transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSubmitting || !isFormValid}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting && (
            <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {isSubmitting ? "Creating…" : "Create Instance"}
        </button>
      </div>
    </div>
  );
}
