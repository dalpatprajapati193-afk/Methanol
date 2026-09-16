"use client";

import { useAtom } from "jotai";
import { configDataAtom, wizardDirtyAtom } from "../../store/WizardAtoms";
import { Field, TextField, NumberField, SelectField, FormGrid } from "../ui/Index";

type GeneralField = "configName" | "plantCapacity" | "commissioningYear" | "techLicensor" | "waterToEORatio";

const LICENSOR_OPTIONS = ["Shell", "Scientific Design (SD)", "Linde", "MEGLOBAL", "Other"];

export default function GeneralInfo() {
  const [configData, setConfigData] = useAtom(configDataAtom);
  const [, setDirty] = useAtom(wizardDirtyAtom);

  function update(field: GeneralField, value: string) {
    setConfigData((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">General Plant Information</h2>
        <p className="text-sm text-text-secondary mt-1">
          Basic plant identity and design parameters.
        </p>
      </div>

      <FormGrid>
        <Field label="Plant Name" hint="A friendly name for this plant" required full>
          <TextField value={configData.configName} onChange={(v) => update("configName", v)} placeholder="e.g. Yansab EG" />
        </Field>

        <Field label="Plant Design Capacity" hint="MT / equivalent EO" required>
          <NumberField value={configData.plantCapacity} onChange={(v) => update("plantCapacity", v)} placeholder="e.g. 97.5" />
        </Field>

        <Field label="Year of Commissioning" hint="e.g., 2005" required>
          <NumberField value={configData.commissioningYear} onChange={(v) => update("commissioningYear", v)} placeholder="e.g. 1998" />
        </Field>

        <Field label="Technology Licensor" required>
          <SelectField options={LICENSOR_OPTIONS} value={configData.techLicensor} onChange={(v) => update("techLicensor", v)} />
        </Field>

        <Field label="Design Water-to-EO Molar Ratio" hint="Typical range: 15–25" required>
          <NumberField value={configData.waterToEORatio} onChange={(v) => update("waterToEORatio", v)} placeholder="e.g. 17.5" />
        </Field>
      </FormGrid>
    </div>
  );
}
