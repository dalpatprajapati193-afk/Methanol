"use client";

import { useAtom } from "jotai";
import { wizardStateAtom } from "../../config/ConfigAtoms";
import { MODEL_CHAIN } from "../../config/ConfigCatalog";
import { generateSubAssets } from "../../config/SubAssets";

/** Display-only grouping — Deviation Detection and Failure Mode Identification
 * always toggle together as one unit here, but still write both underlying
 * MODEL_CHAIN values into state.models[subId] individually, so BuildWorkbook.ts's
 * "Models" sheet (one YES/blank column per MODEL_CHAIN entry) and the backend's
 * MODEL_TYPE_MAP (keyed by these exact label strings) stay untouched. */
interface DisplayGroup {
  key: string;
  label: string;
  indices: number[];
}
const DISPLAY_GROUPS: DisplayGroup[] = [
  { key: "deviation_detection", label: "Deviation Detection and Failure Mode Identification", indices: [0, 1] },
  { key: MODEL_CHAIN[2].value, label: MODEL_CHAIN[2].label, indices: [2] },
  { key: MODEL_CHAIN[3].value, label: MODEL_CHAIN[3].label, indices: [3] },
];

export function StepModels() {
  const [state, setState] = useAtom(wizardStateAtom);
  const items = generateSubAssets(state.mc);

  const isSelected = (subId: string, modelId: string) => (state.models[subId] || []).includes(modelId);
  const hasLaterSelected = (subId: string, maxIdx: number) =>
    MODEL_CHAIN.slice(maxIdx + 1).some((m) => isSelected(subId, m.value));
  const isGroupSelected = (subId: string, group: DisplayGroup) =>
    group.indices.every((idx) => isSelected(subId, MODEL_CHAIN[idx].value));

  const setModelsFor = (subId: string, values: string[]) => {
    setState({ ...state, models: { ...state.models, [subId]: values } });
  };

  const toggleGroup = (subId: string, group: DisplayGroup) => {
    const current = new Set(state.models[subId] || []);
    const maxIdx = Math.max(...group.indices);
    if (isGroupSelected(subId, group)) {
      if (hasLaterSelected(subId, maxIdx)) return; // locked — prerequisite for a later selection
      group.indices.forEach((idx) => current.delete(MODEL_CHAIN[idx].value));
    } else {
      // Cascade: selecting this group force-selects everything before it too.
      MODEL_CHAIN.slice(0, maxIdx + 1).forEach((m) => current.add(m.value));
    }
    setModelsFor(subId, Array.from(current));
  };

  const selectAllFor = (subId: string) => setModelsFor(subId, MODEL_CHAIN.map((m) => m.value));
  const clearAllFor = (subId: string) => setModelsFor(subId, []);

  const countFor = (group: DisplayGroup) => items.filter((item) => isGroupSelected(item.id, group)).length;
  const allHave = (group: DisplayGroup) => items.length > 0 && countFor(group) === items.length;

  const bulkApply = (group: DisplayGroup) => {
    const turnOn = !allHave(group);
    const maxIdx = Math.max(...group.indices);
    const next = { ...state.models };
    items.forEach((item) => {
      const current = new Set(next[item.id] || []);
      if (turnOn) {
        MODEL_CHAIN.slice(0, maxIdx + 1).forEach((m) => current.add(m.value));
      } else if (!MODEL_CHAIN.slice(maxIdx + 1).some((m) => current.has(m.value))) {
        group.indices.forEach((idx) => current.delete(MODEL_CHAIN[idx].value));
      }
      next[item.id] = Array.from(current);
    });
    setState({ ...state, models: next });
  };

  if (!items.length) {
    return (
      <div className="rounded-md border border-border bg-surface p-5 text-sm text-text-secondary">
        No sub-assets yet — complete Machine Config first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-border bg-surface p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-secondary">
          Bulk Apply <span className="normal-case text-text-secondary/70">— toggle a model across every sub-asset</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {DISPLAY_GROUPS.map((group) => {
            const on = allHave(group);
            const count = countFor(group);
            return (
              <button
                key={group.key}
                type="button"
                onClick={() => bulkApply(group)}
                className={
                  "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors " +
                  (on
                    ? "border-accent-blue bg-accent-blue/10 text-accent-blue"
                    : "border-border bg-background text-text-secondary hover:border-accent-blue/50 hover:bg-accent-blue/5")
                }
              >
                {group.label}
                <span
                  className={
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold " +
                    (on ? "bg-accent-blue text-background" : "bg-border text-text-secondary")
                  }
                >
                  {count}/{items.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface">
              <th className="p-2 text-left text-xs uppercase text-text-secondary">Sub-Asset</th>
              {DISPLAY_GROUPS.map((group) => (
                <th key={group.key} className="p-2 text-center text-xs uppercase text-text-secondary">
                  {group.label}
                </th>
              ))}
              <th className="p-2 text-center text-xs uppercase text-text-secondary">Quick</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="group border-t border-border transition-colors hover:bg-accent-blue/5">
                <td className="p-2 text-text-primary">{item.label}</td>
                {DISPLAY_GROUPS.map((group) => {
                  const checked = isGroupSelected(item.id, group);
                  const maxIdx = Math.max(...group.indices);
                  const locked = checked && hasLaterSelected(item.id, maxIdx);
                  return (
                    <td key={group.key} className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.id, group)}
                        disabled={locked}
                        title={
                          locked
                            ? "Required by a later model already selected for this row"
                            : checked
                              ? `Remove ${group.label}`
                              : `Add ${group.label}`
                        }
                        className={
                          "mx-auto flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition-all " +
                          (checked
                            ? locked
                              ? "cursor-not-allowed border-accent-blue/40 bg-accent-blue/10 text-accent-blue/60"
                              : "cursor-pointer border-accent-blue bg-accent-blue text-background hover:scale-110 hover:opacity-90"
                            : "cursor-pointer border-border bg-background text-transparent hover:scale-110 hover:border-accent-blue/60 hover:bg-accent-blue/10")
                        }
                      >
                        {checked ? (locked ? "🔒" : "✓") : ""}
                      </button>
                    </td>
                  );
                })}
                <td className="p-2 text-center">
                  <div className="flex justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => selectAllFor(item.id)}
                      className="text-[10px] font-medium uppercase text-accent-blue hover:underline"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => clearAllFor(item.id)}
                      className="text-[10px] font-medium uppercase text-accent-red hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-secondary">
        Click a circle to toggle a model — selecting one auto-selects everything before it in the chain. Hover a row for quick &quot;All&quot;/&quot;Clear&quot; actions.
      </p>
    </div>
  );
}
