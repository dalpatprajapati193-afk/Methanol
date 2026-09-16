"use client";

import type { Option } from "../../config/ConfigCatalog";

interface PillSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  multi?: boolean;
}

/** Single- or multi-select pill buttons — the recurring option-picker pattern
 * from the original wizard's ~30 machine-config questions. */
export function PillSelect({ options, value, onChange, multi = false }: PillSelectProps) {
  const toggle = (v: string) => {
    if (multi) {
      onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    } else {
      onChange(value[0] === v ? [] : [v]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={
              selected
                ? "rounded-md border border-accent-blue bg-accent-blue/10 px-3 py-1.5 text-sm text-accent-blue"
                : "rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary hover:border-accent-blue/50"
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
