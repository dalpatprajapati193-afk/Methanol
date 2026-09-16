"use client";

import { useState } from "react";
import { useAtomValue } from "jotai";
import type { ResolvedModel, ResolvedTag, ResolvedOdsRule } from "../../actions/Index";
import { attributeFulfillmentAtom } from "../../store/Index";
import type { AttrFulfillment } from "../../store/Index";

interface Props {
  model: ResolvedModel;
  defaultExpanded?: boolean;
}

/** Pretty-print a group key like "performance_tags" → "Performance Tags". */
function prettyGroup(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Preferred section order; unknown groups fall in after, ODS Rules renders last. */
const GROUP_ORDER = ["performance_tags", "match_tags", "contributor_tags", "input_tags", "output_tags"];

const PILLAR_CLASS: Record<string, string> = {
  Energy: "text-accent-orange border-accent-orange",
  Production: "text-accent-blue border-accent-blue",
  Process: "text-accent-green border-accent-green",
  Environment: "text-accent-green border-accent-green",
};

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border whitespace-nowrap bg-background text-text-secondary border-border ${className}`}
    >
      {children}
    </span>
  );
}

/** Per-attribute fulfilment chip — one readiness layer beyond resolution:
 *  green when the input is mapped / the computed attribute's inputs are all fulfilled,
 *  amber when not, nothing when there's nothing to map. */
// Colours match the KPI Applicability tab's status glyphs: ready ✓ green, partial – yellow,
// insufficient/unmapped ✗ red.
const FULFILL_STYLE: Record<AttrFulfillment, { icon: string; label: string; cls: string } | null> = {
  mapped: { icon: "✓", label: "mapped", cls: "text-accent-green border-accent-green" },
  fulfilled: { icon: "✓", label: "inputs ready", cls: "text-accent-green border-accent-green" },
  partial: { icon: "–", label: "partial", cls: "text-accent-yellow border-accent-yellow" },
  unmapped: { icon: "✗", label: "unmapped", cls: "text-accent-red border-accent-red" },
  "inputs-missing": { icon: "✗", label: "inputs missing", cls: "text-accent-red border-accent-red" },
  na: null,
};

function FulfillChip({ status }: { status: AttrFulfillment }) {
  const s = FULFILL_STYLE[status];
  if (!s) return null;
  return <Chip className={s.cls}>{s.icon} {s.label}</Chip>;
}

function directionLabel(d: string | number | undefined): string | null {
  if (d === undefined || d === null || d === "") return null;
  const s = String(d);
  if (s === "1" || s === "maximize") return `↑ ${s}`;
  if (s === "-1" || s === "minimize") return `↓ ${s}`;
  return s;
}

function iterBand(it: { min_tol: number; max_tol: number }): string {
  return -it.min_tol === it.max_tol ? `±${it.max_tol}` : `[${it.min_tol}, ${it.max_tol}]`;
}

/** Section-specific metadata chips for one resolved tag. */
function MetaChips({ group, tag }: { group: string; tag: ResolvedTag }) {
  if (group === "match_tags" && tag.iterations?.length) {
    return (
      <span className="flex flex-wrap gap-1">
        <span className="text-text-secondary text-[10px] self-center">iters</span>
        {tag.iterations.map((it) => (
          <Chip key={it.iter}>{iterBand(it)}</Chip>
        ))}
      </span>
    );
  }
  if (group === "contributor_tags") {
    const dir = directionLabel(tag.direction);
    return (
      <span className="flex flex-wrap gap-1">
        {tag.pillar && <Chip className={PILLAR_CLASS[tag.pillar] ?? ""}>{tag.pillar}</Chip>}
        {dir && <Chip>{dir}</Chip>}
        {tag.weight !== undefined && tag.weight !== null && <Chip>w {tag.weight}</Chip>}
      </span>
    );
  }
  // performance_tags + any group carrying a plain direction
  const dir = directionLabel(tag.direction);
  return dir ? <Chip>{dir}</Chip> : null;
}

function TagRow({ group, tag, fulfillment }: { group: string; tag: ResolvedTag; fulfillment: AttrFulfillment }) {
  return (
    <li className="flex items-start justify-between gap-2 text-xs">
      <span className="font-mono text-text-primary break-all">{tag.tag}</span>
      <span className="shrink-0 flex items-center gap-1">
        <MetaChips group={group} tag={tag} />
        <FulfillChip status={fulfillment} />
      </span>
    </li>
  );
}

function OdsRuleRow({ rule }: { rule: ResolvedOdsRule }) {
  const [open, setOpen] = useState(false);
  const hasDetails =
    !!rule.cause_condition || !!rule.effect_condition || !!rule.message_category;
  return (
    <li className="rounded bg-background px-2 py-1.5 flex flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs text-text-primary break-all">
          {rule.cause_monitoring_tag} <span className="text-text-secondary">→</span> {rule.effect_monitoring_tag}
        </span>
        {rule.actionable_tolerance !== undefined && rule.actionable_tolerance !== null && (
          <Chip className="shrink-0">tol {rule.actionable_tolerance}</Chip>
        )}
      </div>
      {rule.message && <p className="text-[11px] italic text-text-secondary">{rule.message}</p>}
      {hasDetails && (
        <>
          <button
            className="self-start text-[10px] text-accent-blue hover:underline"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "▲ hide details" : "▼ details"}
          </button>
          {open && (
            <div className="flex flex-col gap-1 border-t border-border pt-1">
              {rule.message_category && (
                <div className="flex items-center gap-1 text-[10px] text-text-secondary">
                  <span>category</span>
                  <Chip>{rule.message_category}</Chip>
                </div>
              )}
              {rule.cause_condition && (
                <div className="text-[10px]">
                  <span className="text-text-secondary">cause </span>
                  <span className="font-mono text-text-primary break-all">{rule.cause_tag}</span>
                  <div className="font-mono text-text-secondary break-all">{rule.cause_condition}</div>
                </div>
              )}
              {rule.effect_condition && (
                <div className="text-[10px]">
                  <span className="text-text-secondary">effect </span>
                  <span className="font-mono text-text-primary break-all">{rule.effect_tag}</span>
                  <div className="font-mono text-text-secondary break-all">{rule.effect_condition}</div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </li>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-text-secondary mb-1">
        {title} ({count})
      </p>
      {count === 0 ? (
        <p className="text-xs text-text-secondary italic">None resolved.</p>
      ) : (
        <ul className="flex flex-col gap-1">{children}</ul>
      )}
    </div>
  );
}

export default function ModelBlueprintStatus({ model, defaultExpanded = false }: Props) {
  const [showResolved, setShowResolved] = useState(defaultExpanded);
  const fulfillmentOf = useAtomValue(attributeFulfillmentAtom);

  const odsRules = model.ods_rules ?? [];
  const groupEntries = Object.entries(model.groups).sort(
    ([a], [b]) => {
      const ia = GROUP_ORDER.indexOf(a);
      const ib = GROUP_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    },
  );
  const resolvedCount =
    groupEntries.reduce((sum, [, tags]) => sum + tags.length, 0) + odsRules.length;

  // Fulfilment layer (beyond resolution): map each resolved attribute to its readiness,
  // then aggregate over the attributes that actually have something to map/fulfil.
  const applicable = groupEntries
    .flatMap(([, tags]) => tags.map((t) => fulfillmentOf(t.attribute)))
    .filter((s) => s !== "na");
  const fulfilledCount = applicable.filter((s) => s === "mapped" || s === "fulfilled").length;
  const hasFulfilment = applicable.length > 0;
  const allFulfilled = hasFulfilment && fulfilledCount === applicable.length;

  return (
    <div className={`rounded-xl border ${model.ready ? "bg-surface border-accent-green" : "bg-surface border-accent-yellow"}`}>
      <div
        className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none ${model.ready ? "text-accent-green" : "text-accent-yellow"}`}
        onClick={() => setShowResolved((v) => !v)}
      >
        <span className="text-xs font-medium">
          {model.ready
            ? <>✓ {model.label} ready — <strong>{resolvedCount} entr{resolvedCount !== 1 ? "ies" : "y"} resolved</strong></>
            : <>✗ {model.label} not ready — <strong>{model.missing.length} path{model.missing.length !== 1 ? "s" : ""} unresolved</strong></>}
        </span>
        <span className="text-xs ml-3 shrink-0">{showResolved ? "▲" : "▼"}</span>
      </div>

      {/* Mapping fulfilment — the layer beyond resolution: are the resolved input
          attributes mapped / are computed attributes' input variables all fulfilled. */}
      {hasFulfilment && (
        <div className="px-4 pb-2 -mt-1">
          <span className={`text-[11px] font-medium ${allFulfilled ? "text-accent-green" : "text-accent-orange"}`}>
            {allFulfilled ? "✓" : "⚠"} Inputs: {fulfilledCount} of {applicable.length} attribute{applicable.length !== 1 ? "s" : ""} fulfilled
            {allFulfilled ? "." : " — map the remaining inputs to proceed."}
          </span>
        </div>
      )}

      {showResolved && (
        <div className="border-t border-border px-4 pb-3 pt-2 flex flex-col gap-3">
          {model.missing.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-accent-yellow mb-1">Unresolved paths (no matching hierarchy node)</p>
              <ul className="flex flex-col gap-0.5">
                {model.missing.map((m) => (
                  <li key={m} className="text-xs font-mono text-accent-red bg-background rounded px-2 py-0.5">{m}</li>
                ))}
              </ul>
            </div>
          )}

          {groupEntries.map(([group, tags]) => (
            <Section key={group} title={prettyGroup(group)} count={tags.length}>
              {tags.map((t) => (
                <TagRow key={`${group}-${t.tag}`} group={group} tag={t} fulfillment={fulfillmentOf(t.attribute)} />
              ))}
            </Section>
          ))}

          {odsRules.length > 0 && (
            <Section title="ODS Rules" count={odsRules.length}>
              {odsRules.map((r) => (
                <OdsRuleRow key={`${r.cause_tag}-${r.effect_tag}`} rule={r} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
