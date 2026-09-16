"use client";

import { useAtom, useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import {
  configIdAtom,
  configDataAtom,
  additionalInputsListAtom,
  wizardDirtyAtom,
  uomBankAtom,
} from "../../store/WizardAtoms";
import { getAdditionalInputsList } from "../../actions/Actions";
import type { AdditionalInput, AdditionalInputMapping, TagEntry } from "../../store/Types";
import TagArrayEditor from "./TagArrayEditor";
import { NumberField } from "../ui/Index";

export default function AdditionalInputs() {
  const [configId] = useAtom(configIdAtom);
  const [configData, setConfigData] = useAtom(configDataAtom);
  const [inputsList, setInputsList] = useAtom(additionalInputsListAtom);
  const [, setDirty] = useAtom(wizardDirtyAtom);
  const uomBank = useAtomValue(uomBankAtom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configId) return;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = await getAdditionalInputsList(configData);
        setInputsList(list);
      } catch {
        setError("Failed to load additional inputs.");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configId]);

  function getMapping(input: AdditionalInput): AdditionalInputMapping {
    return configData.additional_inputs[input.id] ?? { is_constant: input.type === "constant" };
  }

  function updateMapping(inputId: string, mapping: AdditionalInputMapping) {
    setConfigData((prev) => ({
      ...prev,
      additional_inputs: { ...prev.additional_inputs, [inputId]: mapping },
    }));
    setDirty(true);
  }

  if (loading) {
    return <p className="text-sm text-text-secondary">Loading additional inputs…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Additional Inputs</h2>
        <p className="text-sm text-text-secondary mt-1">
          Provide PI tags for additional measurements required by the digital twin model for this
          configuration.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-accent-red-light border border-accent-red rounded-lg text-sm text-accent-red">
          {error}
        </div>
      )}

      {inputsList.length === 0 && !loading && (
        <p className="text-sm text-text-secondary italic">
          Additional PI tag inputs will appear here once configured for this plant.
        </p>
      )}

      {inputsList.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {inputsList.map((inp) => (
              <AdditionalInputRow
                key={inp.id}
                input={inp}
                mapping={getMapping(inp)}
                uomList={uomBank}
                onChange={(m) => updateMapping(inp.id, m)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AdditionalInputRow({
  input,
  mapping,
  uomList,
  onChange,
}: {
  input: AdditionalInput;
  mapping: AdditionalInputMapping;
  uomList: { symbol: string; category: string }[];
  onChange: (m: AdditionalInputMapping) => void;
}) {
  const isConstant = mapping.is_constant;
  return (
    <div className="p-4 bg-surface-hover border border-border rounded-lg flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-text-primary">
            {input.name}
            {isConstant && (
              <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-semibold bg-accent-yellow-light text-accent-yellow">
                Design Constant
              </span>
            )}
          </p>
          <p className="text-xs text-text-secondary font-mono">{input.attribute_name}</p>
          {input.uom && <p className="text-xs text-text-secondary">UoM: {input.uom}</p>}
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-xs shrink-0">
          <input
            type="checkbox"
            className="accent-accent-blue"
            checked={isConstant}
            onChange={(e) => onChange({ ...mapping, is_constant: e.target.checked })}
          />
          Constant
        </label>
      </div>

      {isConstant ? (
        <div className="flex gap-2 items-center max-w-xs">
          <NumberField
            value={mapping.value ?? ""}
            onChange={(v) => onChange({ ...mapping, value: v })}
            placeholder="Enter design value"
          />
          {input.uom && <span className="text-sm text-text-secondary shrink-0">{input.uom}</span>}
        </div>
      ) : (
        <TagArrayEditor
          label="PI Tags"
          tags={mapping.tags ?? []}
          uomHint={input.uom}
          nameHint={input.name}
          uomList={uomList}
          onChange={(tags: TagEntry[]) => onChange({ ...mapping, tags })}
        />
      )}
    </div>
  );
}
