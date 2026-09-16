"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  listConfigurations,
  createConfiguration,
  deleteConfiguration,
} from "../actions/Actions";
import type { EgConfigListItem, EgConfigData } from "../store/Types";

const EMPTY_CONFIG: EgConfigData = {
  configName: "",
  plantCapacity: "",
  commissioningYear: "",
  techLicensor: "",
  waterToEORatio: "",
  numSteamHeaders: 1,
  steamHeaders: [{ headerLabel: "HP Steam", isSuperheated: "no" }],
  eq_hasGFS: "no",
  eq_gfsArrangement: "",
  sc_columnType: "", sc_hasReboiler: "no", sc_reboilerFreshSteam: "no", sc_reboilerMedium: "",
  sc_hasDirectSteam: "no", sc_directSteamFreshSteam: "no", sc_numDirectSteam: 0, sc_directSteamInputs: [], sc_hasBottomBleed: "no",
  ra_columnType: "", ra_absorptionMedium: "", ra_absorptionMediumOther: "", ra_hasIntercooler: "no", ra_intercoolerMedium: "", ra_intercoolerMediumOther: "",
  ra_hasAftercooler: "no", ra_aftercoolerFreshSteam: "no", ra_aftercoolerSource: "", ra_aftercoolerSourceOther: "",
  int_columnType: "", int_absorptionMedium: "", int_absorptionMediumOther: "", int_hasIntercooler: "no", int_intercoolerMedium: "", int_intercoolerMediumOther: "",
  int_hasReboiler: "no", int_reboilerFreshSteam: "no", int_reboilerMedium: "", int_hasDirectSteam: "no",
  int_directSteamFreshSteam: "no", int_numDirectSteam: 0, int_directSteamInputs: [], int_strippingPurpose: "", int_overheadVent: "",
  gfs_columnType: "", gfs_hasReboiler: "no", gfs_reboilerFreshSteam: "no", gfs_reboilerMedium: "",
  gfs_hasDirectSteam: "no", gfs_directSteamFreshSteam: "no", gfs_numDirectSteam: 0, gfs_directSteamInputs: [], gfs_strippingPurpose: "", gfs_overheadVent: "",
  fpe_numExchangers: 1,
  fpe_exchangers: [{ freshSteam: "no", heatSource: "", heatSourceOther: "", exchangerType: "" }],
  gr_reactorType: "", gr_numReactors: 1, gr_heatRecovered: "no", gr_heatRecoverySinks: [], gr_numInterstage: 0,
  ev_numEffects: 1, ev_flowArrangement: "", ev_firstEffectFreshSteam: "no", ev_firstEffectSource: "",
  ev_hasMVR: "no", ev_mvrEffect: 1, ev_hasTVR: "no", ev_tvrEffect: 1, ev_condensateFlash: "no",
  oe_hasOther: "no", oe_numEquipment: 0, oe_equipment: [],
  output_kpis: {}, additional_inputs: {}, soft_sensor_mappings: {}, forecast_config: {},
};

export default function ConfigList() {
  const router = useRouter();
  const [configs, setConfigs] = useState<EgConfigListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newInstanceId, setNewInstanceId] = useState("");
  const [creating, startCreating] = useTransition();
  const [actionId, setActionId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await listConfigurations();
      setConfigs(list);
    } catch {
      setError("Failed to load configurations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleNew() {
    const instanceId = parseInt(newInstanceId, 10);
    if (isNaN(instanceId) || instanceId <= 0) {
      setError("Instance ID must be a positive integer.");
      return;
    }
    setError(null);
    startCreating(async () => {
      try {
        const rec = await createConfiguration(instanceId, EMPTY_CONFIG);
        router.push(`/ethyleneGlycolConfig/${rec.instanceId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create configuration.");
      }
    });
  }

  async function handleDelete(instanceConfigurationId: number, instanceId: number) {
    if (!confirm(`Delete configuration for Instance ${instanceId}? This cannot be undone.`)) return;
    setActionId(instanceConfigurationId);
    try {
      await deleteConfiguration(instanceConfigurationId);
      await load();
    } catch {
      setError("Failed to delete configuration.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Ethylene Glycol Configurations
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage plant configurations for EG digital twin models.
          </p>
        </div>
        <button
          onClick={() => { setShowNewForm((v) => !v); setError(null); }}
          className="btn-primary"
        >
          {showNewForm ? "Cancel" : "+ New Configuration"}
        </button>
      </div>

      {showNewForm && (
        <div className="p-4 bg-surface border border-border rounded-xl flex gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-primary">Instance ID</label>
            <input
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 1"
              value={newInstanceId}
              onChange={(e) => setNewInstanceId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNew()}
              className="input-base w-32"
              autoFocus
            />
          </div>
          <button onClick={handleNew} disabled={creating} className="btn-primary">
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-accent-red-light border border-accent-red rounded-lg text-sm text-accent-red">
          {error}
        </div>
      )}

      {loading && (
        <p className="text-sm text-text-secondary">Loading configurations…</p>
      )}

      {!loading && configs.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 border border-dashed border-border rounded-xl">
          <p className="text-text-secondary">No configurations yet.</p>
          <button
            onClick={() => setShowNewForm(true)}
            className="btn-primary text-sm"
          >
            Create First Configuration
          </button>
        </div>
      )}

      {!loading && configs.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {configs.map((cfg) => (
            <div
              key={cfg.instanceConfigurationId}
              className="p-4 bg-surface border border-border rounded-xl flex items-center justify-between gap-4 hover:bg-surface-hover transition-colors"
            >
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => router.push(`/ethyleneGlycolConfig/${cfg.instanceId}`)}
              >
                <p className="font-medium text-text-primary">Instance {cfg.instanceId}</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Updated {new Date(cfg.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => router.push(`/ethyleneGlycolConfig/${cfg.instanceId}`)}
                  className="btn-secondary text-sm"
                >
                  Open
                </button>
                <button
                  onClick={() => handleDelete(cfg.instanceConfigurationId, cfg.instanceId)}
                  disabled={actionId === cfg.instanceConfigurationId}
                  className="text-accent-red text-sm hover:opacity-70 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
