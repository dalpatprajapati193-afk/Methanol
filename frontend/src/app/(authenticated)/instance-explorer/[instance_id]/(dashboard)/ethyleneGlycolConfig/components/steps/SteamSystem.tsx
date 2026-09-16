"use client";

import { useAtom } from "jotai";
import { configDataAtom, wizardDirtyAtom } from "../../store/WizardAtoms";
import { Field, TextField, NumberField, YesNoToggle, DynamicListCard } from "../ui/Index";

export default function SteamSystem() {
  const [configData, setConfigData] = useAtom(configDataAtom);
  const [, setDirty] = useAtom(wizardDirtyAtom);

  function setNumHeaders(raw: string) {
    const count = Math.max(1, parseInt(raw) || 1);
    const current = configData.steamHeaders;
    const headers = Array.from({ length: count }, (_, i) =>
      current[i] ?? { headerLabel: "", isSuperheated: "no" as const }
    );
    setConfigData((prev) => ({ ...prev, numSteamHeaders: count, steamHeaders: headers }));
    setDirty(true);
  }

  function updateLabel(index: number, value: string) {
    const headers = configData.steamHeaders.map((h, i) => (i === index ? { ...h, headerLabel: value } : h));
    setConfigData((prev) => ({ ...prev, steamHeaders: headers }));
    setDirty(true);
  }

  function updateSuperheated(index: number, value: "yes" | "no") {
    const headers = configData.steamHeaders.map((h, i) => (i === index ? { ...h, isSuperheated: value } : h));
    setConfigData((prev) => ({ ...prev, steamHeaders: headers }));
    setDirty(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Steam System Configuration</h2>
        <p className="text-sm text-text-secondary mt-1">
          Steam headers available to the EG section.
        </p>
      </div>

      <div className="max-w-xs">
        <Field label="Number of Steam Headers Available to EG Section">
          <NumberField min={1} value={configData.numSteamHeaders} onChange={setNumHeaders} />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-text-primary">Steam Header Details</p>
        {configData.steamHeaders.map((h, i) => (
          <DynamicListCard key={i} title={`Steam Header ${i + 1}`}>
            <Field label="Header Label">
              <TextField value={h.headerLabel} onChange={(v) => updateLabel(i, v)} placeholder="e.g. HP Steam" />
            </Field>
            <Field label="Is Superheated?">
              <YesNoToggle value={h.isSuperheated} onChange={(v) => updateSuperheated(i, v)} />
            </Field>
          </DynamicListCard>
        ))}
      </div>
    </div>
  );
}
