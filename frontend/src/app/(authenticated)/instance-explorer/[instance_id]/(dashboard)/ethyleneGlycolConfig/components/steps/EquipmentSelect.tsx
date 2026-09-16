"use client";

import { useAtom } from "jotai";
import { configDataAtom, wizardDirtyAtom } from "../../store/WizardAtoms";
import { Field, ToggleGroup, YesNoToggle, ConditionalReveal } from "../ui/Index";

const GFS_ARRANGEMENTS = ["Separate Columns", "Integrated Single Column"] as const;
type GfsArrangement = (typeof GFS_ARRANGEMENTS)[number] | "";

export default function EquipmentSelect() {
  const [configData, setConfigData] = useAtom(configDataAtom);
  const [, setDirty] = useAtom(wizardDirtyAtom);

  function setHasGfs(value: "yes" | "no") {
    setConfigData((prev) => ({
      ...prev,
      eq_hasGFS: value,
      eq_gfsArrangement: value === "no" ? "" : prev.eq_gfsArrangement,
    }));
    setDirty(true);
  }

  function setArrangement(value: GfsArrangement) {
    setConfigData((prev) => ({ ...prev, eq_gfsArrangement: value }));
    setDirty(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Equipment Selection</h2>
        <p className="text-sm text-text-secondary mt-1">
          Configure equipment presence and column arrangements.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Field label="Is Glycol Feed Stripper (GFS) present?">
          <YesNoToggle value={configData.eq_hasGFS} onChange={setHasGfs} />
        </Field>

        {configData.eq_hasGFS === "yes" && (
          <ConditionalReveal>
            <Field label="Reabsorber & GFS Arrangement">
              <ToggleGroup
                options={GFS_ARRANGEMENTS}
                value={configData.eq_gfsArrangement}
                onChange={(v) => setArrangement(v as GfsArrangement)}
              />
            </Field>
          </ConditionalReveal>
        )}
      </div>
    </div>
  );
}
