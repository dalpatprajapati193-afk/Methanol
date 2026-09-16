"use client";

import { useEffect, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  piConfigAtom,
  statsResultsAtom,
  isGeneratingAtom,
  errorAtom,
  dirtyAtom,
  saveStatusAtom,
} from "../store/PiAtoms";
import type { PiPullConfig, SensorMapping } from "../store/Types";
import { loadInitialConfig, generateStatistics, submitConfig } from "../actions/Actions";
import { useDraftAutosave } from "../hooks/UseDraftAutosave";
import { TagMappingTable } from "./TagMappingTable";
import { TimeRangeControls } from "./TimeRangeControls";
import { StatsResultTable } from "./StatsResultTable";

export function StatsShell({ id, instanceName }: { id: string; instanceName: string }) {
  const instanceId = parseInt(id, 10);
  const [config, setConfig] = useAtom(piConfigAtom);
  const [results, setResults] = useAtom(statsResultsAtom);
  const [generating, setGenerating] = useAtom(isGeneratingAtom);
  const [error, setError] = useAtom(errorAtom);
  const setDirty = useSetAtom(dirtyAtom);
  const saveStatus = useAtomValue(saveStatusAtom);
  const { flush } = useDraftAutosave(Number.isNaN(instanceId) ? null : instanceId);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (Number.isNaN(instanceId)) return;
    loadInitialConfig(instanceId)
      .then((r) => setConfig(r.data))
      .catch(() => setConfig(null));
  }, [instanceId, setConfig]);

  if (!config) {
    return <div className="p-6 text-text-secondary">Loading…</div>;
  }

  const patch = (p: Partial<PiPullConfig>) => {
    setConfig({ ...config, ...p });
    setDirty(true);
  };
  const setMappings = (mappings: SensorMapping[]) => patch({ mappings });

  const onGenerate = async () => {
    setGenerating(true);
    setError(null);
    setSubmitted(false);
    try {
      await flush(); // persist draft before pulling
      const res = await generateStatistics(config);
      setResults(res.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate statistics");
    } finally {
      setGenerating(false);
    }
  };

  const onSubmit = async () => {
    if (Number.isNaN(instanceId)) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitConfig(instanceId, config, results);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Test PI Pulling</h1>
          <p className="text-sm text-text-secondary">{instanceName}</p>
        </div>
        <span className="text-xs text-text-secondary">{saveStatus === "saved" ? "Draft saved" : saveStatus}</span>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-text-primary">Sensor → PI Tag Mapping</h2>
        <TagMappingTable mappings={config.mappings} onChange={setMappings} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-text-primary">Time Range</h2>
        <TimeRangeControls config={config} onChange={patch} />
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={onGenerate}
          disabled={generating}
          className="rounded-md bg-accent-blue px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {generating ? "Generating…" : "Generate Statistics"}
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting || results.length === 0}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit & Save Snapshot"}
        </button>
        {submitted && <span className="text-sm text-accent-green">Snapshot saved</span>}
        {error && <span className="text-sm text-accent-red">{error}</span>}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-text-primary">Statistics</h2>
        <StatsResultTable results={results} />
      </section>
    </div>
  );
}
