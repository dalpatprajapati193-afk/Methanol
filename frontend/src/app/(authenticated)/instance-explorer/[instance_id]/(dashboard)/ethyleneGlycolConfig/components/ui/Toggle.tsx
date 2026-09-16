"use client";

import styles from "./EgForm.module.css";

// ── ToggleGroup: legacy button-style segmented radio ──────────────────────────

export function ToggleGroup({
  options,
  value,
  onChange,
  name,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  name?: string;
}) {
  return (
    <div className={styles.toggleGroup} role="radiogroup">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <label
            key={opt}
            className={`${styles.toggle} ${selected ? styles.toggleSelected : ""}`}
          >
            <input
              type="radio"
              name={name}
              className={styles.srOnly}
              checked={selected}
              onChange={() => onChange(opt)}
            />
            {opt}
          </label>
        );
      })}
    </div>
  );
}

// ── YesNoToggle: yes/no rendered as button toggles (capitalized) ──────────────

export function YesNoToggle({
  value,
  onChange,
  name,
}: {
  value: "yes" | "no";
  onChange: (v: "yes" | "no") => void;
  name?: string;
}) {
  return (
    <div className={styles.toggleGroup} role="radiogroup">
      {(["yes", "no"] as const).map((opt) => {
        const selected = value === opt;
        return (
          <label
            key={opt}
            className={`${styles.toggle} ${selected ? styles.toggleSelected : ""} capitalize`}
          >
            <input
              type="radio"
              name={name}
              className={styles.srOnly}
              checked={selected}
              onChange={() => onChange(opt)}
            />
            {opt}
          </label>
        );
      })}
    </div>
  );
}

// ── CheckboxGroup: multi-select pills (button-style) ──────────────────────────

export function CheckboxGroup({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className={styles.checkboxGroup}>
      {options.map((opt) => {
        const isOn = selected.includes(opt);
        return (
          <label
            key={opt}
            className={`${styles.toggle} ${isOn ? styles.toggleSelected : ""}`}
          >
            <input
              type="checkbox"
              className={styles.srOnly}
              checked={isOn}
              onChange={() => onToggle(opt)}
            />
            {opt}
          </label>
        );
      })}
    </div>
  );
}
