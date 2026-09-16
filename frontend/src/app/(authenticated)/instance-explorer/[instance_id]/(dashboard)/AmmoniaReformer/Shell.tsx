"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  activeTabAtom,
  blueprintAtom,
  hierarchyAtom,
  requiresHierarchyConfirmationAtom,
  loadDefaultBlueprintAtom,
  hydrateFromDraftAtom,
  loadWizardStateAtom,
  saveStatusAtom,
  submitStatusAtom,
  instanceIdAtom,
  plantNameAtom,
  uomCatalogAtom,
} from "./store/Index";
import {
  TabNav,
  SystemConfigTab,
  ConnectivityTab,
  KPIApplicabilityTab,
  ModelConfigTab,
} from "./components/Index";
import { useDraftAutosave } from "./hooks/UseDraftAutosave";
import { SYSTEM_NAME, formatSystemName, SHOW_BLUEPRINT, SHOW_CONNECTIVITY } from "./Constants";
import type { DraftConfigPayload, UomCatalog } from "./types/Index";

type Props = {
  instanceId: number;
  plantName: string;
  initialConfig: DraftConfigPayload | null;
  configSource: "draft" | "snapshot" | "default";
  uomCatalog: UomCatalog;
};

const ALL_TABS = [
  { label: "System Config",  content: <SystemConfigTab key="sysconfig" />,           show: true },
  { label: "Connectivity",   content: <ConnectivityTab key="connectivity" />,         show: SHOW_CONNECTIVITY },
  { label: "KPI Packages",   content: <KPIApplicabilityTab key="kpiapplicability" />, show: true },
  { label: "Model Config",   content: <ModelConfigTab key="modelconfig" />,           show: true },
];

const VISIBLE_TABS      = ALL_TABS.filter((t) => t.show);
const DASHBOARD_TABS    = VISIBLE_TABS.map((t) => t.label);
const DASHBOARD_CONTENT = VISIBLE_TABS.map((t) => t.content);

export default function Shell({ instanceId, plantName, initialConfig, configSource, uomCatalog }: Props) {
  const setInstanceId    = useSetAtom(instanceIdAtom);
  const setPlantName     = useSetAtom(plantNameAtom);
  const setUomCatalog    = useSetAtom(uomCatalogAtom);
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const blueprint        = useAtomValue(blueprintAtom);
  const hierarchy        = useAtomValue(hierarchyAtom);
  const requiresConfirmation = useAtomValue(requiresHierarchyConfirmationAtom);
  const loadDefaultBlueprint = useSetAtom(loadDefaultBlueprintAtom);
  const hydrateFromDraft = useSetAtom(hydrateFromDraftAtom);
  const loadWizardState  = useSetAtom(loadWizardStateAtom);
  const saveStatus       = useAtomValue(saveStatusAtom);
  const submitStatus     = useAtomValue(submitStatusAtom);

  // Drive draft autosave for this instance (dirty-guarded + flush on tab hide/close).
  useDraftAutosave();

  // Wire instanceId + the instance's Plant name into the atom store so all atoms/tabs
  // read the same per-instance values.
  useEffect(() => {
    setInstanceId(instanceId);
  }, [instanceId, setInstanceId]);

  useEffect(() => {
    setPlantName(plantName);
  }, [plantName, setPlantName]);

  // Seed the RSC-fetched UOM catalog so attribute rows can resolve their units by category.
  useEffect(() => {
    setUomCatalog(uomCatalog);
  }, [uomCatalog, setUomCatalog]);

  // Load the blueprint template, then resume the instance's saved config (draft or
  // last snapshot) if one exists. Hydration replays it into the FastAPI session.
  //
  // Ordering matters: the Shell owns the initial blueprint→wizard load so the wizard is
  // only fetched AFTER the current system's blueprint (Constants.SYSTEM_NAME) is in the
  // session. SystemConfigTab deliberately does NOT fetch the wizard on first mount —
  // doing so (a child effect, which React runs before this parent effect) would hit the
  // backend before the blueprint is loaded and surface its arbitrary autoload default
  // (a different system's blueprint). See SystemConfigTab's mount effect.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadDefaultBlueprint();
      if (cancelled) return;
      if (configSource !== "default" && initialConfig?.systemConfig) {
        try {
          await hydrateFromDraft(initialConfig); // resume path also loads the wizard
        } catch (e) {
          console.error("Failed to resume saved configuration", e);
        }
      } else {
        // Fresh start: load the wizard now that the correct blueprint is in the session.
        await loadWizardState().catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const systemChosen = !!hierarchy.root;
  const lockedTabs = (!systemChosen || requiresConfirmation)
    ? DASHBOARD_TABS.slice(1).map((_, i) => i + 1)
    : [];

  useEffect(() => {
    if ((!systemChosen || requiresConfirmation) && activeTab !== 0) {
      setActiveTab(0);
    }
  }, [systemChosen, requiresConfirmation, activeTab, setActiveTab]);

  const safeActiveTab = activeTab >= 0 && activeTab < DASHBOARD_CONTENT.length ? activeTab : 0;

  // The Plant label is the instance's Plant (resolved from the hierarchy master), not the
  // build-session database name.
  const displayPlantName = plantName;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* System info bar */}
      <div className="bg-surface border-b border-border px-5 h-9 flex items-center gap-2 shrink-0">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-surface border border-border rounded-full text-[11px] text-text-secondary">
          Plant:&nbsp;<strong className="text-text-primary font-semibold">{displayPlantName}</strong>
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-surface border border-border rounded-full text-[11px] text-text-secondary">
          System:&nbsp;<strong className="text-text-primary font-semibold">{formatSystemName(SYSTEM_NAME)}</strong>
        </span>

        <div className="ml-auto flex items-center gap-2">
          {blueprint.isLoading && (
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="inline-block w-3 h-3 border-2 border-text-secondary border-t-transparent rounded-full animate-spin" />
              Loading config…
            </span>
          )}

          {saveStatus === "saving" && (
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="inline-block w-3 h-3 border-2 border-text-secondary border-t-transparent rounded-full animate-spin" />
              Saving…
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-xs text-accent-green">Saved</span>
          )}
          {saveStatus === "error" && (
            <span className="text-xs text-accent-red">Save failed — retrying</span>
          )}

          {submitStatus === "submitting" && (
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="inline-block w-3 h-3 border-2 border-text-secondary border-t-transparent rounded-full animate-spin" />
              Submitting to database…
            </span>
          )}
          {submitStatus === "submitted" && (
            <span className="text-xs text-accent-green">Configuration submitted</span>
          )}
          {submitStatus === "error" && (
            <span className="text-xs text-accent-red">Submit failed</span>
          )}

          {SHOW_BLUEPRINT && (
            <Link
              href={`/instance-explorer/${instanceId}/AmmoniaReformer/blueprint`}
              title="Blueprint editor (admin)"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 border border-border rounded-full text-[11px] text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
            >
              Blueprint
            </Link>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <TabNav
        labels={DASHBOARD_TABS as unknown as string[]}
        activeTab={safeActiveTab}
        onTabChange={setActiveTab}
        statuses={DASHBOARD_TABS.map(() => "none" as const)}
        disabledTabs={lockedTabs}
      />

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {systemChosen || safeActiveTab === 0 ? (
          DASHBOARD_CONTENT[safeActiveTab]
        ) : (
          <div className="py-16 text-center text-text-secondary text-sm">
            Select a system in System Config first to unlock the remaining tabs.
          </div>
        )}
      </div>

    </div>
  );
}
