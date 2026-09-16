"use client";

import type { ReactNode } from "react";
import styles from "./EgForm.module.css";

// ── Field: label + optional hint + required asterisk ──────────────────────────

export function Field({
  label,
  hint,
  required,
  htmlFor,
  children,
  full,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 ${full ? styles.formGridFull : ""}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-text-primary">
        {label}
        {required && <span className="text-accent-red ml-1">*</span>}
      </label>
      {children}
      {hint && <span className="text-xs text-text-secondary">{hint}</span>}
    </div>
  );
}

// ── Text input ────────────────────────────────────────────────────────────────

export function TextField({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="text"
      className={styles.input}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ── Number input ──────────────────────────────────────────────────────────────

export function NumberField({
  value,
  onChange,
  min,
  max,
  placeholder,
  id,
}: {
  value: number | string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="number"
      className={styles.input}
      value={value}
      min={min}
      max={max}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ── Select dropdown ───────────────────────────────────────────────────────────

export function SelectField({
  options,
  value,
  onChange,
  id,
  placeholder = "— select —",
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  id?: string;
  placeholder?: string;
}) {
  return (
    <select
      id={id}
      className={styles.input}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

// ── Section header + body ─────────────────────────────────────────────────────

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <p className={styles.sectionTitle}>{title}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

// ── 2-column responsive form grid ─────────────────────────────────────────────

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className={styles.formGrid}>{children}</div>;
}

// ── Conditional reveal (indented accent border + fade-in) ─────────────────────

export function ConditionalReveal({ children }: { children: ReactNode }) {
  return <div className={styles.reveal}>{children}</div>;
}

// ── Dynamic list card (repeating row container) ───────────────────────────────

export function DynamicListCard({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove?: () => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.listCard}>
      <div className={styles.listCardHeader}>
        <span>{title}</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-medium text-accent-red hover:opacity-70"
          >
            Remove
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
