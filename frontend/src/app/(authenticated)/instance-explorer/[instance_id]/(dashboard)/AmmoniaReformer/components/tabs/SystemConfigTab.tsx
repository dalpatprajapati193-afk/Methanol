"use client";

import { useEffect, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  hierarchyAtom,
  blueprintAtom,
  requiresHierarchyConfirmationAtom,
  loadWizardStateAtom,
  navigateWizardAtom,
  submitWizardAnswerAtom,
  updateWizardCountAtom,
  configureElementAtom,
  deleteElementAtom,
  buildHierarchyAtom,
  resetHierarchyAtom,
  uploadHierarchyConfigAtom,
  downloadSystemConfigAtom,
  confirmHierarchyAtom,
  plantNameAtom,
} from "../../store/Index";
import CountCard from "../shared/CountCard";
import FileUpload from "../shared/FileUpload";
import { SYSTEM_NAME, formatSystemName } from "../../Constants";
import type { WizardStep, QuestionDef, LandingTile, HierarchyNode } from "../../types/Index";

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));

// ── Hierarchy tree preview ────────────────────────────────────────────────────

const DEPTH_DOTS = [
  "bg-accent-blue",
  "bg-accent-green",
  "bg-accent-orange",
  "bg-accent-yellow",
  "bg-accent-red",
];

function countNodes(node: HierarchyNode): number {
  return 1 + (node.children?.reduce((sum, c) => sum + countNodes(c), 0) ?? 0);
}

function TreeNode({ node, depth = 0, defaultOpenDepth = 2 }: {
  node: HierarchyNode;
  depth?: number;
  defaultOpenDepth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < defaultOpenDepth);
  const hasChildren = node.children?.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 py-1 px-1.5 rounded-md transition-colors hover:bg-surface-hover",
          hasChildren && "cursor-pointer"
        )}
        onClick={() => hasChildren && setExpanded((e) => !e)}
      >
        {hasChildren ? (
          <span className="w-3.5 text-center text-text-secondary text-[9px] leading-none shrink-0">
            {expanded ? "▾" : "▸"}
          </span>
        ) : (
          <span className="w-3.5 flex justify-center shrink-0">
            <span className="w-1 h-1 rounded-full bg-border" />
          </span>
        )}
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", DEPTH_DOTS[depth % DEPTH_DOTS.length])} />
        <span title={node.name} className="text-xs text-text-primary min-w-0 flex-1 truncate">{node.name}</span>
        {hasChildren && !expanded && (
          <span className="text-[10px] text-text-secondary bg-surface-hover rounded-full px-1.5 py-px leading-tight shrink-0 ml-1">
            {node.children.length}
          </span>
        )}
      </div>
      {expanded && hasChildren && (
        <div className="ml-[13px] pl-1.5 border-l border-border">
          {node.children.map((child, i) => (
            <TreeNode key={i} node={child} depth={depth + 1} defaultOpenDepth={defaultOpenDepth} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Two-axis preview: the System root sits on top, its direct children fan out
 * as horizontal columns, and each column's descendants stack vertically beneath it.
 */
function TreePreview({ root, openDepth, rev }: {
  root: HierarchyNode;
  openDepth: number;
  rev: number;
}) {
  const firstLevel = root.children ?? [];

  // A child whose vertical list would run long is promoted to a full-width band
  // where its own children fan out horizontally instead of stacking.
  const WIDE_THRESHOLD = 10; // descendant rows beyond which we go horizontal
  const wide = firstLevel.filter((c) => countNodes(c) - 1 > WIDE_THRESHOLD);
  const compact = firstLevel.filter((c) => countNodes(c) - 1 <= WIDE_THRESHOLD);

  return (
    <div className="flex flex-col gap-3">
      {/* Root */}
      <div className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-lg bg-surface-hover border border-border">
        <span className={cn("w-2 h-2 rounded-full shrink-0", DEPTH_DOTS[0])} />
        <span className="text-sm font-semibold text-text-primary">{root.name}</span>
        {root.level && <span className="text-[10px] text-text-secondary">{root.level}</span>}
      </div>

      {firstLevel.length === 0 ? (
        <p className="text-xs text-text-secondary italic">System has no child elements.</p>
      ) : (
        <>
          {/* Tall elements (e.g. Primary Reformer): a band whose direct children
              fan out horizontally, each keeping its own vertical subtree. The band
              is sized to the columns it actually needs (capped at 4 per row, then
              wrapping), so a child with few branches no longer leaves empty space. */}
          {wide.length > 0 && (
            <div className="flex flex-wrap gap-3 items-start">
              {wide.map((child) => {
                const cols = Math.min(child.children.length, 4);
                const bandRem = cols * 12 + (cols - 1) * 1.25 + 1; // col + gap-x-5 + p-2
                return (
                  <div
                    key={child.id}
                    style={{ width: `${bandRem}rem`, maxWidth: "100%" }}
                    className="min-w-0 border border-border rounded-lg bg-background flex flex-col"
                  >
                    <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-border">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", DEPTH_DOTS[1 % DEPTH_DOTS.length])} />
                      <span title={child.name} className="text-xs font-medium text-text-primary truncate flex-1 min-w-0">{child.name}</span>
                      <span className="text-[10px] text-text-secondary bg-surface-hover rounded-full px-1.5 py-px leading-tight shrink-0">
                        {child.children.length}
                      </span>
                      {child.level && (
                        <span className="text-[10px] text-text-secondary shrink-0 whitespace-nowrap">{child.level}</span>
                      )}
                    </div>
                    <div className="p-2 flex flex-wrap gap-x-5 gap-y-1 items-start">
                      {child.children.map((gk, j) => (
                        <div key={`${rev}-${j}`} className="basis-[12rem] grow max-w-[15rem] min-w-0">
                          <TreeNode node={gk} depth={2} defaultOpenDepth={openDepth} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Compact elements → masonry columns, packing vertically. */}
          {compact.length > 0 && (
            <div className="columns-[14rem] gap-3">
              {compact.map((child) => {
                const childCount = child.children?.length ?? 0;
                return (
                  <div key={child.id} className="break-inside-avoid mb-3 border border-border rounded-lg bg-background flex flex-col">
                    <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-border">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", DEPTH_DOTS[1 % DEPTH_DOTS.length])} />
                      <span title={child.name} className="text-xs font-medium text-text-primary truncate flex-1 min-w-0">{child.name}</span>
                      {child.level && (
                        <span className="text-[10px] text-text-secondary shrink-0 whitespace-nowrap">{child.level}</span>
                      )}
                    </div>
                    <div className="p-1.5">
                      {childCount > 0 ? (
                        child.children.map((gc, j) => (
                          <TreeNode key={`${rev}-${j}`} node={gc} depth={2} defaultOpenDepth={openDepth} />
                        ))
                      ) : (
                        <p className="text-[11px] text-text-secondary italic px-1.5 py-1">No child elements</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Question renderer ─────────────────────────────────────────────────────────

function QuestionInput({
  q,
  onAnswer,
}: {
  q: QuestionDef;
  elLevel: string;
  instIdx: number | null;
  onAnswer: (qid: string, ans: string) => void;
}) {
  const [localVal, setLocalVal] = useState(q.currentAnswer ?? q.default ?? "");
  // Sync when the backend sends a fresh currentAnswer (e.g. navigating back to a step)
  const prevAnswerRef = useRef(q.currentAnswer);
  if (prevAnswerRef.current !== q.currentAnswer) {
    prevAnswerRef.current = q.currentAnswer;
    setLocalVal(q.currentAnswer ?? q.default ?? "");
  }
  const handleChange = (v: string) => { setLocalVal(v); onAnswer(q.questionId, v); };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-text-primary mb-1">
        {q.questionText}
        {q.required && <span className="text-accent-red ml-1">*</span>}
      </label>
      {q.helpText && <p className="text-xs text-text-secondary mb-1">{q.helpText}</p>}
      {q.type === "select" ? (
        <select className="border border-border rounded px-2 py-1.5 text-sm w-full max-w-xs bg-surface" value={localVal} onChange={(e) => handleChange(e.target.value)}>
          <option value="">— Select —</option>
          {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : q.type === "boolean" ? (
        <div className="flex gap-3">
          {["Yes", "No"].map((v) => (
            <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm">
              <input type="radio" name={`q_${q.questionId}`} value={v} checked={localVal === v} onChange={() => handleChange(v)} />
              {v}
            </label>
          ))}
        </div>
      ) : q.type === "count" || q.type === "number" ? (
        <input type="number" min={0} className="border border-border rounded px-2 py-1.5 text-sm w-24 bg-surface" value={localVal} onChange={(e) => handleChange(e.target.value)} onBlur={(e) => {
          // Only submit on blur if the value differs from the loaded/default baseline.
          // Without this guard, simply focusing and blurring a number input submits
          // the blueprint default, silently overwriting the restored hier_lcount value.
          const baseline = q.currentAnswer ?? q.default ?? "";
          if (e.target.value !== baseline) onAnswer(q.questionId, e.target.value);
        }} />
      ) : (
        <input type="text" className="border border-border rounded px-2 py-1.5 text-sm w-full max-w-xs bg-surface" value={localVal} onChange={(e) => setLocalVal(e.target.value)} onBlur={(e) => handleChange(e.target.value)} />
      )}
    </div>
  );
}

// ── WizardStepView ────────────────────────────────────────────────────────────

function WizardStepView({ step, elLevel, instIdx, onAnswer, onCountChange }: {
  step: WizardStep;
  elLevel: string;
  instIdx: number | null;
  onAnswer: (qid: string, ans: string) => void;
  onCountChange: (parentLevel: string, childLevel: string, delta: number) => void;
}) {
  if (step.type === "count") return (
    <div className="p-3 bg-background rounded border border-border">
      <p className="text-sm text-text-secondary mb-2">How many <strong>{step.level}</strong> instances?</p>
      <CountCard level={step.level!} currentCount={step.currentCount ?? 0} onIncrement={() => onCountChange("System", step.level!, 1)} onDecrement={() => onCountChange("System", step.level!, -1)} />
    </div>
  );

  if (step.type === "question_group") return (
    <div>
      {step.questions?.map((q) => (
        <QuestionInput key={q.questionId} q={q} elLevel={elLevel} instIdx={instIdx} onAnswer={onAnswer} />
      ))}
    </div>
  );

  if (step.type === "children") return (
    <div>
      <p className="text-sm text-text-secondary mb-3">Configure children of <strong>{step.parentLevel}</strong>:</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {step.children?.map((ch) => (
          <CountCard key={ch.level} level={ch.level} currentCount={ch.currentCount} minRequired={ch.minRequired}
            onIncrement={() => onCountChange(step.parentLevel!, ch.level, 1)}
            onDecrement={() => onCountChange(step.parentLevel!, ch.level, -1)}
          />
        ))}
      </div>
    </div>
  );

  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SystemConfigTab() {
  const hierarchy = useAtomValue(hierarchyAtom);
  const blueprint = useAtomValue(blueprintAtom);
  const instancePlant = useAtomValue(plantNameAtom);
  const requiresHierarchyConfirmation = useAtomValue(requiresHierarchyConfirmationAtom);

  const loadWizardState = useSetAtom(loadWizardStateAtom);
  const navigateWizard = useSetAtom(navigateWizardAtom);
  const submitWizardAnswer = useSetAtom(submitWizardAnswerAtom);
  const updateCount = useSetAtom(updateWizardCountAtom);
  const configureElement = useSetAtom(configureElementAtom);
  const deleteElement = useSetAtom(deleteElementAtom);
  const buildHierarchy = useSetAtom(buildHierarchyAtom);
  const resetHierarchy = useSetAtom(resetHierarchyAtom);
  const uploadHierarchyConfig = useSetAtom(uploadHierarchyConfigAtom);
  const downloadSystemConfig = useSetAtom(downloadSystemConfigAtom);
  const confirmHierarchy = useSetAtom(confirmHierarchyAtom);

  const [loading, setLoading] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // Level of the tile awaiting delete confirmation (null = none).
  const [confirmDeleteLevel, setConfirmDeleteLevel] = useState<string | null>(null);
  // rev remounts the tree so defaultOpenDepth re-applies (expand/collapse all)
  const [treeRender, setTreeRender] = useState({ rev: 0, depth: 99 });
  const [treeOpen, setTreeOpen] = useState(false);

  const wizard = hierarchy.wizardState;

  // Show the built hierarchy's plant once one exists, otherwise the instance's Plant
  // (resolved from the hierarchy master). New builds default to the instance's Plant.
  const plantDisplayName = (hierarchy.databaseName && hierarchy.databaseName !== "Default Enterprise")
    ? hierarchy.databaseName
    : instancePlant;

  const buildName = plantDisplayName || "Ammonia";

  useEffect(() => {
    // The Shell drives the initial blueprint→wizard load in the correct order. Only
    // self-load on a remount (tab switch back), when the current system's blueprint is
    // already in the session. Fetching on the first mount would race the blueprint load
    // and render the backend's arbitrary autoload default (a different system).
    if (blueprint.isLoaded) loadWizardState().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const wrap = async (fn: () => Promise<void>) => {
    setLoading(true);
    try { await fn(); } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // ── WIZARD (blueprint not yet loaded guard) ───────────────────────────────────
  if (!wizard) {
    // Keep showing the spinner while the blueprint is loading, OR while it has loaded
    // but the (separate) wizard fetch hasn't populated yet. Only a finished load with no
    // blueprint is a genuine "not found" — a loaded blueprint must never read as missing.
    if (blueprint.isLoading || blueprint.isLoaded) {
      return (
        <div className="py-16 flex flex-col items-center gap-3 text-text-secondary">
          <span className="inline-block w-6 h-6 border-2 border-text-secondary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Loading system configuration…</p>
        </div>
      );
    }
    return (
      <div className="py-16 text-center text-text-secondary">
        <p className="text-sm font-medium">Blueprint not found for <strong>{formatSystemName(SYSTEM_NAME)}</strong>.</p>
        <p className="mt-1 text-xs">Ensure <code>Blueprint_{SYSTEM_NAME}.xlsx</code> exists in the backend inputs folder.</p>
      </div>
    );
  }

  // ── LANDING MODE ─────────────────────────────────────────────────────────────
  if (wizard.mode === "landing") {
    return (
      <div className="max-w-full">

          {requiresHierarchyConfirmation && (
            <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-surface border border-accent-yellow rounded-xl shadow-sm">
              <span className="text-accent-yellow text-lg shrink-0">⚠</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">Review loaded hierarchy before continuing</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  A system configuration was loaded. Verify the hierarchy is correct for{" "}
                  <strong>{plantDisplayName || "this plant"}</strong> below, then click <strong>Confirm &amp; Proceed</strong> to unlock all other tabs.
                </p>
              </div>
              <button
                className="shrink-0 px-4 py-1.5 bg-accent-yellow hover:bg-accent-yellow text-surface text-sm font-medium rounded-lg transition-colors"
                onClick={() => confirmHierarchy()}
              >
                Confirm &amp; Proceed →
              </button>
            </div>
          )}

          {/* Plant / System are shown in the page-level info bar (Shell); not repeated here. */}
          <div className="flex items-center justify-end mb-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              {/* Load */}
              <FileUpload
                accept=".json"
                disabled={loading}
                tooltip={"Load a previously saved system configuration\n.json only"}
                onFile={async (f) => {
                  setLoading(true);
                  try { await uploadHierarchyConfig(f); }
                  catch (err) { console.error("Config upload failed:", err); }
                  finally { setLoading(false); }
                }}
              />

              {/* Download config */}
              <div className="relative inline-flex group">
                <button
                  type="button"
                  disabled={loading || !wizard.hierarchyBuilt}
                  className="inline-flex items-center justify-center w-8 h-8 border border-border rounded-[7px] bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                  onClick={() => wrap(async () => {
                    const res = await downloadSystemConfig();
                    if (!res) return;
                    const url = URL.createObjectURL(new Blob([res.json], { type: "application/json" }));
                    const a = document.createElement("a");
                    a.href = url; a.download = res.filename; a.click();
                    URL.revokeObjectURL(url);
                  })}
                >
                  {/* Download arrow icon */}
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v7M3.5 5.5 6 8l2.5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M1 10h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </button>
                <div className="absolute top-full right-0 mt-2 z-50 w-max max-w-60 px-2.5 py-1.5 bg-surface border border-border rounded-lg shadow-md text-xs text-text-primary pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-pre-line leading-relaxed">
                  Download system configuration{"\n"}Saves a .json file you can re-upload later
                  <div className="absolute bottom-full right-3 border-4 border-transparent border-b-border" />
                </div>
              </div>

              {/* Reset */}
              {confirmReset ? (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-accent-red">Reset system configuration? This cannot be undone.</span>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="px-2 py-1 text-xs border border-border rounded text-text-secondary hover:bg-surface-hover transition-colors shrink-0"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { setConfirmReset(false); wrap(resetHierarchy); }}
                    disabled={loading}
                    className="px-2 py-1 text-xs border border-accent-red rounded text-accent-red hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    Confirm reset
                  </button>
                </div>
              ) : (
                <div className="relative inline-flex group ml-auto">
                  <button
                    className="h-8 px-3 text-sm border border-accent-red text-accent-red rounded hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => setConfirmReset(true)}
                    disabled={loading}
                  >
                    Reset
                  </button>
                  <div className="absolute top-full right-0 mt-2 z-50 w-max max-w-60 px-2.5 py-1.5 bg-surface border border-border rounded-lg shadow-md text-xs text-text-primary pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-pre-line leading-relaxed">
                    Reset the system configuration{"\n"}This action cannot be undone
                    <div className="absolute bottom-full right-3 border-4 border-transparent border-b-border" />
                  </div>
                </div>
              )}
            </div>

          </div>

          {wizard.missingRequired.length > 0 && (
            <div className="mb-3 p-2 bg-surface border border-accent-yellow rounded text-xs text-accent-yellow">
              Required elements not yet configured: {wizard.missingRequired.join(", ")}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
            {wizard.landingTiles.map((tile: LandingTile) => {
              const isConfirming = confirmDeleteLevel === tile.level;
              return (
                <div
                  key={tile.level}
                  className={cn(
                    "border rounded-lg p-3 bg-surface flex flex-col gap-2",
                    isConfirming ? "border-accent-red" : "border-border"
                  )}
                >
                  {isConfirming ? (
                    <>
                      <p className="text-xs text-text-primary leading-relaxed">
                        Remove <strong>{tile.level}</strong> from the system configuration? Its settings and any sub-elements will be cleared.
                      </p>
                      <div className="flex gap-2 mt-auto">
                        <button
                          className="px-2 py-1 text-xs border border-border rounded text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
                          onClick={() => setConfirmDeleteLevel(null)}
                          disabled={loading}
                        >
                          Cancel
                        </button>
                        <button
                          className="px-2 py-1 text-xs border border-accent-red rounded text-accent-red hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => { setConfirmDeleteLevel(null); wrap(() => deleteElement(tile.level)); }}
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          tile.isConfigured ? "bg-accent-green" : tile.isRequired ? "bg-accent-red" : "bg-surface-hover"
                        )} />
                        <span className="text-sm font-medium truncate">{tile.level}</span>
                        {tile.isConfigured && (
                          <button
                            title={`Remove ${tile.level} from system config`}
                            className="ml-auto shrink-0 w-6 h-6 -mr-1 inline-flex items-center justify-center rounded text-text-secondary hover:text-accent-red hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            onClick={() => setConfirmDeleteLevel(tile.level)}
                            disabled={loading}
                          >
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                              <path d="M2 3.5h10M5.5 3.5V2.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M3 3.5l.5 8a1 1 0 0 0 1 .95h5a1 1 0 0 0 1-.95l.5-8M5.5 6v4M8.5 6v4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary">
                        {tile.isConfigured ? `Count: ${tile.count}` : tile.isSilent ? "Auto-created" : tile.isRequired ? "Required" : "Optional"}
                      </p>
                      <button
                        className="mt-auto text-xs text-accent-blue hover:text-accent-blue font-medium text-left"
                        onClick={() => wrap(() => navigateWizard({ mode: "element_wizard", activeElement: tile.level, elementStep: 0 }))}
                      >
                        {tile.isConfigured ? "Reconfigure →" : "Configure →"}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
            <button
              className="px-4 py-1.5 bg-accent-blue text-surface text-sm rounded font-medium hover:bg-accent-blue disabled:opacity-50"
              disabled={loading || wizard.missingRequired.length > 0}
              onClick={() => wrap(() => buildHierarchy(buildName || undefined))}
            >
              {wizard.hierarchyBuilt ? "Rebuild" : "Build"} Plant Config
            </button>
          </div>

          {/* Tree preview — collapsible, below the build action */}
          {hierarchy.root && (
            <div className="mt-4 border border-border rounded-xl bg-surface overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  className="flex items-center gap-2 text-text-primary hover:text-accent-blue transition-colors"
                  onClick={() => setTreeOpen((o) => !o)}
                >
                  <span className="text-text-secondary text-[10px] leading-none w-3 text-center">
                    {treeOpen ? "▾" : "▸"}
                  </span>
                  <h3 className="text-xs font-semibold uppercase tracking-wide">Tree Preview</h3>
                </button>
                <span className="text-[10px] text-text-secondary bg-surface-hover rounded-full px-1.5 py-px leading-tight">
                  {countNodes(hierarchy.root)} nodes
                </span>
                {treeOpen && (
                  <span className="ml-auto flex items-center gap-0.5">
                    <button
                      title="Expand all"
                      className="w-5 h-5 inline-flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                      onClick={() => setTreeRender((t) => ({ rev: t.rev + 1, depth: 99 }))}
                    >
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 2.5l4 3 4-3M2 6.5l4 3 4-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      title="Collapse all"
                      className="w-5 h-5 inline-flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                      onClick={() => setTreeRender((t) => ({ rev: t.rev + 1, depth: 1 }))}
                    >
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 9.5l4-3 4 3M2 5.5l4-3 4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </span>
                )}
              </div>
              {treeOpen && (
                <div className="p-3 border-t border-border">
                  <TreePreview root={hierarchy.root} openDepth={treeRender.depth} rev={treeRender.rev} />
                </div>
              )}
            </div>
          )}
      </div>
    );
  }

  // ── ELEMENT WIZARD MODE ───────────────────────────────────────────────────────
  const activeEl = wizard.activeElement || "";
  const steps = wizard.activeSteps;
  const stepIdx = wizard.elementStep;
  const curStep = steps[stepIdx];

  const instIdx = wizard.instanceIdx;
  const instanceCount = wizard.instanceCount ?? 0;
  const isDiffMode = instIdx !== null && instanceCount > 1;
  const isLastInstance = !isDiffMode || instIdx === instanceCount - 1;
  const isLastStep = stepIdx === steps.length - 1;

  return (
    <div className="flex gap-6 max-w-3xl">
      <div className="w-48 shrink-0 border border-border rounded-lg p-3 bg-surface">
        <button className="text-xs text-text-secondary hover:text-text-primary mb-3 block" onClick={() => wrap(() => navigateWizard({ mode: "landing" }))}>
          ← Back to overview
        </button>
        <h3 className="text-sm font-semibold text-text-primary mb-1">{activeEl}</h3>

        {isDiffMode && (
          <div className="flex flex-wrap gap-1 mb-2">
            {Array.from({ length: instanceCount }, (_, i) => (
              <button
                key={i}
                className={cn(
                  "px-2 py-0.5 text-xs rounded border transition-colors",
                  i === instIdx
                    ? "bg-accent-blue text-surface border-accent-blue font-medium"
                    : i < instIdx!
                    ? "bg-surface text-accent-green border-accent-green hover:bg-surface-hover"
                    : "bg-surface text-text-secondary border-border hover:bg-surface-hover"
                )}
                onClick={() => i !== instIdx && wrap(() => navigateWizard({ mode: "element_wizard", activeElement: activeEl, elementStep: 0, instanceIdx: i }))}
              >
                {i < instIdx! ? "✓" : ""}{i + 1}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-1">
          {steps.map((step, i) => {
            const tooltip =
              step.type === "question_group"
                ? step.questions?.[0]?.questionText ?? ""
                : step.type === "count"
                ? `How many ${step.level}?`
                : `Configure ${step.parentLevel} children`;
            return (
              <div key={i} className="relative group">
                <button
                  className={cn(
                    "w-full text-left text-xs px-2 py-1.5 rounded",
                    i === stepIdx
                      ? "bg-surface-hover text-accent-blue font-medium"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                  onClick={() => wrap(() => navigateWizard({ mode: "element_wizard", activeElement: activeEl, elementStep: i }))}
                >
                  {i < stepIdx ? "✓ " : i === stepIdx ? "▶ " : "· "}Step {i + 1}
                </button>
                {tooltip && (
                  <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 hidden group-hover:block w-56 rounded bg-surface border border-border shadow-lg px-2.5 py-2 text-xs text-text-primary leading-snug">
                    {tooltip}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {isDiffMode && (
          <div className="mb-3 px-3 py-1.5 bg-surface border border-accent-yellow rounded-lg text-xs text-accent-yellow">
            Configuring instance <strong>{instIdx! + 1}</strong> of <strong>{instanceCount}</strong>
            {instIdx! < instanceCount - 1 && (
              <span className="ml-1 text-accent-yellow"> — complete all steps then advance to the next instance</span>
            )}
          </div>
        )}

        <div className="mb-4">
          <span className="text-xs text-text-secondary">Step {stepIdx + 1} of {steps.length}</span>
          <div className="h-1 bg-surface-hover rounded mt-1">
            <div className="h-1 bg-accent-blue rounded transition-all" style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }} />
          </div>
        </div>

        {curStep && (
          <WizardStepView
            step={curStep}
            elLevel={activeEl}
            instIdx={instIdx}
            onAnswer={(qid, ans) => wrap(() => submitWizardAnswer({ questionId: qid, elementLevel: activeEl, answer: ans, instIdx: instIdx ?? undefined }))}
            onCountChange={(pl, cl, delta) => wrap(() => updateCount({ parentLevel: pl, childLevel: cl, delta, elLevel: activeEl, instIdx: instIdx ?? undefined }))}
          />
        )}

        <div className="flex gap-3 mt-6">
          {stepIdx > 0 ? (
            <button className="px-4 py-2 border border-border text-sm rounded hover:bg-surface-hover"
              onClick={() => wrap(() => navigateWizard({ mode: "element_wizard", activeElement: activeEl, elementStep: stepIdx - 1 }))}>
              ← Back
            </button>
          ) : isDiffMode && instIdx! > 0 ? (
            <button className="px-4 py-2 border border-border text-sm rounded hover:bg-surface-hover"
              onClick={() => wrap(() => navigateWizard({ mode: "element_wizard", activeElement: activeEl, elementStep: steps.length - 1, instanceIdx: instIdx! - 1 }))}>
              ← Instance {instIdx!}
            </button>
          ) : null}

          {!isLastStep ? (
            <button className="px-4 py-2 bg-accent-blue text-surface text-sm rounded hover:bg-accent-blue"
              onClick={() => wrap(() => navigateWizard({ mode: "element_wizard", activeElement: activeEl, elementStep: stepIdx + 1 }))}>
              Next →
            </button>
          ) : !isLastInstance ? (
            <button className="px-4 py-2 bg-accent-blue text-surface text-sm rounded hover:bg-accent-blue"
              onClick={() => wrap(() => navigateWizard({ mode: "element_wizard", activeElement: activeEl, elementStep: 0, instanceIdx: instIdx! + 1 }))}>
              Next instance ({instIdx! + 2} of {instanceCount}) →
            </button>
          ) : (
            <button className="px-4 py-2 bg-accent-green text-surface text-sm rounded hover:bg-accent-green"
              onClick={() => wrap(() => configureElement(activeEl))}>
              Done ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
