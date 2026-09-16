"use client";

import { useAtom } from "jotai";
import { wizardStateAtom } from "../../config/ConfigAtoms";
import type { PlantOnlineTag } from "../../config/ConfigTypes";

export function StepModelConfig() {
  const [state, setState] = useAtom(wizardStateAtom);
  const { modelConfig } = state;

  const patch = (p: Partial<typeof modelConfig>) => {
    setState({ ...state, modelConfig: { ...modelConfig, ...p } });
  };

  const setTag = (idx: number, patch: Partial<PlantOnlineTag>) => {
    const tags = modelConfig.plantOnlineTags.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    setState({ ...state, modelConfig: { ...modelConfig, plantOnlineTags: tags } });
  };
  const addTag = () => {
    setState({
      ...state,
      modelConfig: { ...modelConfig, plantOnlineTags: [...modelConfig.plantOnlineTags, { piName: "", min: "", max: "" }] },
    });
  };
  const removeTag = (idx: number) => {
    setState({
      ...state,
      modelConfig: { ...modelConfig, plantOnlineTags: modelConfig.plantOnlineTags.filter((_, i) => i !== idx) },
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 rounded-md border border-border bg-surface p-5">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-secondary">
            Test Start Date
          </label>
          <input
            type="date"
            value={modelConfig.testStartDate}
            onChange={(e) => patch({ testStartDate: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-secondary">
            Test End Date
          </label>
          <input
            type="date"
            value={modelConfig.testEndDate}
            onChange={(e) => patch({ testEndDate: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
          />
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Plant Online Tags</p>
          <button
            type="button"
            onClick={addTag}
            className="rounded-md border border-border px-3 py-1 text-xs text-text-secondary"
          >
            + Add Tag
          </button>
        </div>
        <p className="mb-3 text-xs text-text-secondary">
          Exported as plant_online_tag_1_pi_name, _Min, _Max, etc.
        </p>
        <div className="flex flex-col gap-2">
          {modelConfig.plantOnlineTags.map((tag, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={tag.piName}
                onChange={(e) => setTag(idx, { piName: e.target.value })}
                placeholder="e.g. SK.OLF.Root.Tag.PV"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
              />
              <input
                type="number"
                value={tag.min}
                onChange={(e) => setTag(idx, { min: e.target.value === "" ? "" : Number(e.target.value) })}
                placeholder="Min"
                className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
              />
              <input
                type="number"
                value={tag.max}
                onChange={(e) => setTag(idx, { max: e.target.value === "" ? "" : Number(e.target.value) })}
                placeholder="Max"
                className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
              />
              <button
                type="button"
                onClick={() => removeTag(idx)}
                className="rounded-md border border-border px-2 py-1 text-xs text-accent-red"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
