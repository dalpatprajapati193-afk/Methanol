// ─── Generate the AFP config Excel workbook from wizard state ───────────────
// Ported from buildMachineConfigRows() and buildConfigExcelWorkbook() in
// asset_config_ui/index.html (lines ~3214-3332, ~3462-3701). Produces the same
// 4 sheets (Summary, Sensor Mapping, Models, Machine Config) the Python
// pipeline's input_tables_creation.py already parses.
//
// Deliberate fix vs. the original: the original's "append Oil System sensors
// to every Turbine" branch checked `group.groupId` (always undefined — a typo
// for `group.id`) and so never fired. Here it's checked correctly.

import * as XLSX from "xlsx";
import {
  AUX_MAP,
  BEARING_MAP,
  COND_ARR_MAP,
  DGS_COMP_MAP,
  DGS_MAP,
  DRIVER_MAP,
  LOC_MAP,
  MODEL_CHAIN,
  OIL_MAP,
  SERVICE_MAP,
  STAGE_EQ_MAP,
  SUBSYS_MAP,
  TREAT_MAP,
  TURB_MAP,
  toKey,
} from "./ConfigCatalog";
import {
  buildStageGroups,
  computeShowWhenSatisfied,
  generateSubAssets,
  stageGroupLabel,
  type GeneratedSubAsset,
} from "./SubAssets";
import type { AfpWizardState, SensorRow } from "./ConfigTypes";

const mapArr = (arr: string[] | undefined, map: Record<string, string>): string[] =>
  (arr || []).map((v) => map[v] || v);

const stageLabel = (id: string) => id.replace("stage_", "Stage ");

/** [sub_asset, macro_name, macro_value] rows for the "Machine Config" sheet. */
function buildMachineConfigRows(state: AfpWizardState): (string | number)[][] {
  const { mc, modelConfig } = state;
  const rows: (string | number)[][] = [];

  function push(sub: string, name: string, value: string | number | string[] | undefined | null) {
    if (value === null || value === undefined || value === "") return;
    if (Array.isArray(value) && !value.length) return;
    rows.push([toKey(sub), name.replace(/ /g, "_"), Array.isArray(value) ? value.join(", ") : value]);
  }

  // ── Machine level
  push("Machine", "Compressor Service", SERVICE_MAP[mc.service] || mc.service || "");
  push("Machine", "Driver Type", DRIVER_MAP[mc.driverType] || mc.driverType || "");
  push("Machine", "Number of Casings", mc.numCasings);
  if (mc.driverType === "steam_turbine") push("Machine", "Number of Turbines", mc.numTurbines);
  push("Machine", "Test Start Date", modelConfig.testStartDate);
  push("Machine", "Test End Date", modelConfig.testEndDate);
  (modelConfig.plantOnlineTags || []).forEach((tag, idx) => {
    const n = idx + 1;
    if (tag.piName) push("Machine", `plant_online_tag_${n}_pi_name`, tag.piName);
    if (tag.min !== "" && tag.min != null) push("Machine", `plant_online_tag_${n}_Min`, tag.min);
    if (tag.max !== "" && tag.max != null) push("Machine", `plant_online_tag_${n}_Max`, tag.max);
  });

  // Machine-level "show only when" facts (process treatment selections like
  // Caustic Tower, etc.) — gates Master_KPI_Calc_File PI tags scoped to
  // Common Parameters. See SubAssets.ts#computeShowWhenSatisfied.
  push("Common Parameters", "show_when_satisfied", computeShowWhenSatisfied({ mc }));

  // ── Per casing
  (mc.casings || []).slice(0, mc.numCasings || 0).forEach((ca, ci) => {
    const caName = ca.name || `Casing ${ci + 1}`;
    push(caName, "Stages", (ca.stages || []).map(stageLabel));
    push(
      caName,
      "Internally Connected",
      ca.internallyConnected === true ? "Yes" : ca.internallyConnected === false ? "No" : ""
    );
    if (ca.internallyConnected === true && (ca.internalConnections || []).length > 0) {
      push(
        caName,
        "Internal Connections",
        (ca.internalConnections || [])
          .map((c) => c.split("-").map((p) => p.replace("stage_", "Stage ")).join("-"))
          .join(", ")
      );
    }
    push(caName, "Suction Streams", ca.suctionStreams);
    push(caName, "Discharge Streams", ca.dischargeStreams);
    push(caName, "Side Loads", ca.hasSideLoads === true ? "Yes" : ca.hasSideLoads === false ? "No" : "");
    if (ca.hasSideLoads === true) {
      push(caName, "Side Load Count", ca.numSideStreams);
      (ca.sideLoads || []).forEach((sl, si) => {
        if (sl.stage) push(caName, `Side Load ${si + 1} - Enters Before Stage`, sl.stage);
      });
    }
    push(caName, "Subsystems", mapArr(ca.subsystems, SUBSYS_MAP).join(", "));
    if ((ca.subsystems || []).includes("dry_gas_seal") && (ca.dgsSupport || []).length > 0) {
      const dgsName = `${caName}_DGS`;
      push(dgsName, "sub_asset_components", mapArr(ca.dgsSupport, DGS_MAP).map((v) => `${ca.name} ${v}`).join(", "));
      if ((ca.dgsSupport || []).includes("de_dgs") && (ca.deDgsComponents || []).length > 0)
        push(dgsName, "DE_DGS_Components", mapArr(ca.deDgsComponents, DGS_COMP_MAP).map((v) => `${ca.name} ${v}`).join(", "));
      if ((ca.dgsSupport || []).includes("nde_dgs") && (ca.ndeDgsComponents || []).length > 0)
        push(dgsName, "NDE_DGS_Components", mapArr(ca.ndeDgsComponents, DGS_COMP_MAP).map((v) => `${ca.name} ${v}`).join(", "));
    }
    if ((ca.subsystems || []).includes("condition_monitoring") && (ca.bearings || []).length > 0)
      push(`${caName}_Mechanical`, "sub_asset_components", mapArr(ca.bearings, BEARING_MAP).map((v) => `${ca.name} ${v}`).join(", "));

    // Casing-level "show only when" facts (bearings, DGS support/components)
    // — gates Master_KPI_Calc_File PI tags on this casing's Mechanical/DGS.
    const casingShowWhen = computeShowWhenSatisfied({ casing: ca, mc });
    push(`${caName}_Mechanical`, "show_when_satisfied", casingShowWhen);
    push(`${caName}_DGS`, "show_when_satisfied", casingShowWhen);

    const caStageGroups = buildStageGroups(ca);
    if (caStageGroups.length > 0) {
      const stageLabels = caStageGroups.map(stageGroupLabel);
      push(`${caName} Mechanical`, "connected_casing_to_stage", stageLabels.map(toKey).join(", "));
      push(`${caName} DGS`, "connected_dgs_to_stage", stageLabels.map(toKey).join(", "));
      push(`${caName} Mechanical`, "number_of_stages_connected", caStageGroups.length);
    }

    caStageGroups.forEach((grp) => {
      const sid = grp.length === 1 ? `stage_${grp[0]}` : grp.map((n) => `stage_${n}`).join("-");
      const seq = (ca.stageEquipment || {})[sid];
      const slbl = stageGroupLabel(grp);
      // Stage-level "show only when" facts (Intercooler, Aftercooler, KOD,
      // etc.) — pushed even when no stage equipment is configured, so a
      // Master_KPI_Calc_File tag conditioned on something outside
      // stageEquipment (casing/mc-level) still resolves correctly for this
      // stage.
      push(slbl, "show_when_satisfied", computeShowWhenSatisfied({ stageEquipment: seq, casing: ca, mc }));
      if (!seq || !(seq.equipment || []).length) return;
      push(slbl, "sub_asset_components", mapArr(seq.equipment, STAGE_EQ_MAP).map((v) => `${toKey(slbl)} ${v}`).join(", "));
      if (seq.equipment.includes("intercooler")) {
        push(slbl, "Intercooler Count", seq.intercoolerCount ?? "");
        push(slbl, "Intercooler Location", (seq.intercoolerLocation && LOC_MAP[seq.intercoolerLocation]) || seq.intercoolerLocation || "");
      }
      if (seq.equipment.includes("kod")) {
        push(slbl, "KOD Count", seq.kodCount ?? "");
        push(slbl, "KOD Location", (seq.kodLocation && LOC_MAP[seq.kodLocation]) || seq.kodLocation || "");
      }
      if (seq.equipment.includes("recycle_loop")) {
        push(slbl, "Recycle Source Stage", seq.recycleSource);
        push(slbl, "Recycle Destination Stage", seq.recycleDestination);
      }
      if (seq.equipment.includes("ref_desuperheater")) push(slbl, "Refrigerant_Desuperheater_Count", seq.refDesuperheaterCount ?? "");
      if (seq.equipment.includes("ref_condenser")) push(slbl, "Refrigerant_Condenser_Count", seq.refCondenserCount ?? "");
      if (seq.equipment.includes("ref_accumulator")) push(slbl, "Refrigerant_Accumulator_Count", seq.refAccumulatorCount ?? "");
    });
  });

  // ── Oil System
  if ((mc.oilEquipment || []).length > 0) push("Oil System", "Components", mapArr(mc.oilEquipment, OIL_MAP).join(", "));
  push("Oil System", "show_when_satisfied", computeShowWhenSatisfied({ mc }));
  if (mc.driverType === "steam_turbine" && (mc.oilEquipment || []).length > 0 && (mc.numTurbines || 0) > 0) {
    const oilTbNames = Array.from({ length: Number(mc.numTurbines) }, (_, i) => `Turbine ${i + 1}`);
    push("Oil System", "connected_turbine_to_oil", oilTbNames.map(toKey).join(", "));
  }

  // ── Process Treatment
  if ((mc.processTreatment || []).length > 0) {
    push("Process Treatment", "Systems", mapArr(mc.processTreatment, TREAT_MAP).join(", "));
    if ((mc.processTreatment || []).includes("caustic_tower") && mc.causticConnection)
      push("Process Treatment", "Caustic Loop Connection", mc.causticConnection.replace("after_stage_", "After Stage "));
  }

  // ── Turbines
  if (mc.driverType === "steam_turbine") {
    let condenserOffset = 0;
    (mc.turbines || []).slice(0, mc.numTurbines || 0).forEach((tb, ti) => {
      const tbLabel = `Turbine ${ti + 1}`;
      push(tbLabel, "Type", TURB_MAP[tb.type] || tb.type);
      push(tbLabel, "Connected Casings", (tb.connectedCasings || []).map((c) => c.toUpperCase()).join(", "));
      // Turbine-level "show only when" facts (turbine type, aux systems,
      // bearing condition monitoring) — gates Master_KPI_Calc_File PI tags
      // scoped to this turbine.
      push(tbLabel, "show_when_satisfied", computeShowWhenSatisfied({ turbine: tb, mc }));
      if ((tb.auxiliarySystems || []).length > 0) {
        push(tbLabel, "sub_asset_components", mapArr(tb.auxiliarySystems, AUX_MAP).map((v) => `${toKey(tbLabel)} ${v}`).join(", "));
        if ((tb.auxiliarySystems || []).includes("surface_condenser")) {
          push(tbLabel, "Surface Condenser Count", tb.surfaceCondenserCount || "");
          push(tbLabel, "Surface Condenser Arrangement", COND_ARR_MAP[tb.surfaceCondenserArrangement] || tb.surfaceCondenserArrangement);
          if ((tb.scAuxSystems || []).includes("surface_condenser_pump"))
            push(tbLabel, "Surface Condenser Pump Count", tb.surfaceCondenserPumpCount || "");
          if ((tb.scAuxSystems || []).length > 0) {
            const scLabel = `Surface Condenser ${condenserOffset + 1}`;
            push(scLabel, "sub_asset_components", mapArr(tb.scAuxSystems, AUX_MAP).map((v) => `${toKey(scLabel)} ${v}`).join(", "));
            // Same turbine context as tbLabel's own push above — covers
            // scAuxSystems-based conditions (Steam Ejector System, Surface
            // Condenser Pump) via SHOW_WHEN_PHRASES.
            push(scLabel, "show_when_satisfied", computeShowWhenSatisfied({ turbine: tb, mc }));
          }
        }
      }
      if ((tb.turbineCondMonitoring || []).length > 0)
        push(tbLabel, "sub_asset_components", mapArr(tb.turbineCondMonitoring, BEARING_MAP).map((v) => `${toKey(tbLabel)} ${v}`).join(", "));

      if ((tb.connectedCasings || []).length > 0)
        push(tbLabel, "connected_mechanical_casing_to_turbine", tb.connectedCasings.map((c) => toKey(`${c} Mechanical`)).join(", "));

      if ((tb.auxiliarySystems || []).includes("surface_condenser") && tb.surfaceCondenserCount) {
        const cnt = typeof tb.surfaceCondenserCount === "number" ? tb.surfaceCondenserCount : parseInt(String(tb.surfaceCondenserCount), 10) || 1;
        const scNames: string[] = [];
        for (let sci = 0; sci < cnt; sci++) scNames.push(`Surface Condenser ${condenserOffset + sci + 1}`);
        push(tbLabel, "connected_sc_to_turbine", scNames.map(toKey).join(", "));
        condenserOffset += cnt;
      }

      if ((tb.connectedCasings || []).length > 0) {
        const stagesForTurbine: string[] = [];
        tb.connectedCasings.forEach((casingName) => {
          const ca = (mc.casings || []).slice(0, mc.numCasings || 0).find((c) => c.name === casingName);
          if (ca) buildStageGroups(ca).forEach((grp) => stagesForTurbine.push(stageGroupLabel(grp)));
        });
        if (stagesForTurbine.length > 0) push(tbLabel, "connected_stage_to_turbine", stagesForTurbine.map(toKey).join(", "));
      }

      const ordered = tb.connectedCasingsOrdered.length ? tb.connectedCasingsOrdered : tb.connectedCasings;
      ordered.forEach((caName, idx) => {
        const downstream = idx < ordered.length - 1 ? toKey(`${ordered[idx + 1]} Mechanical`) : toKey(tbLabel);
        push(`${caName} Mechanical`, "connected_downstream_sub_asset", downstream);
      });

      const trainStages: string[] = [];
      ordered.forEach((caName) => {
        const ca = (mc.casings || []).slice(0, mc.numCasings || 0).find((c) => c.name === caName);
        if (!ca) return;
        buildStageGroups(ca).forEach((grp) => trainStages.push(stageGroupLabel(grp)));
      });
      trainStages.forEach((stgLbl, idx) => {
        if (idx < trainStages.length - 1) push(stgLbl, "connected_downstream_sub_asset", toKey(trainStages[idx + 1]));
      });
    });
  }

  return rows;
}

/** Fill in any sensor rows missing from state (sub-asset never visited in Step 6)
 * using the sub-asset's template defaults, mirroring buildConfigExcelWorkbook()'s
 * sync-before-export step. */
function ensureSensorRows(state: AfpWizardState, item: GeneratedSubAsset): SensorRow[] {
  const existing = state.sensors[item.id];
  if (existing && existing.length) return existing;
  return item.sensorTemplate.map((t) => ({
    templateId: t.id,
    defaultName: t.name,
    defaultUom: t.uom,
    name: "",
    uom: t.uom,
    paramType: "PI" as const,
  }));
}

/** Fill in any OEM-limit rows missing from state, same pattern as
 * ensureSensorRows() — one row per sub-asset parameter, defaulting to blank
 * limits until the user fills them in. */
function ensureOemLimitRows(state: AfpWizardState, item: GeneratedSubAsset) {
  const existing = state.oemLimits[item.id];
  if (existing && existing.length) {
    // Backfill defaultUom/uom for rows saved before those fields existed.
    return existing.map((r) => {
      if (r.defaultUom) return r;
      const defaultUom = item.oemTemplate.find((t) => t.id === r.templateId)?.uom || "-";
      return { ...r, defaultUom, uom: r.uom || defaultUom };
    });
  }
  return item.oemTemplate.map((t) => ({
    templateId: t.id,
    parameter: t.parameter,
    uom: t.uom || "-",
    defaultUom: t.uom || "-",
    designLow: "" as const,
    designHigh: "" as const,
    rated: "" as const,
  }));
}

/** Fill in any Trip Limit rows missing from state, same pattern as
 * ensureOemLimitRows() — only meaningful for sub-assets with the Failure
 * Prediction model selected, but harmless to export blank otherwise. */
function ensureTripLimitRows(state: AfpWizardState, item: GeneratedSubAsset) {
  const existing = state.tripLimits[item.id];
  if (existing && existing.length) {
    return existing.map((r) => {
      if (r.defaultUom) return r;
      const template = item.tripLimitTemplate.find((t) => t.id === r.templateId);
      const defaultUom = template?.uom || "-";
      return {
        ...r,
        defaultUom,
        uom: r.uom || defaultUom,
        tripDirection: r.tripDirection || template?.tripDirection || "",
      };
    });
  }
  return item.tripLimitTemplate.map((t) => ({
    templateId: t.id,
    parameter: t.parameter,
    uom: t.uom || "-",
    defaultUom: t.uom || "-",
    tripLimit: "" as const,
    tripDirection: t.tripDirection || "",
    tripLimitBasis: "",
  }));
}

/** Build the full 6-sheet AFP config workbook as raw bytes, ready to hand to
 * the existing runOnboarding() action (same shape it already expects from a
 * hand-built upload). */
export function buildConfigWorkbookBytes(state: AfpWizardState): ArrayBuffer {
  const items = generateSubAssets(state.mc);
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Summary ──
  const assetName = SERVICE_MAP[state.mc.service] || state.mc.service || "";
  const summaryRows: (string | number)[][] = [
    ["Asset Failure Prediction Dashboard — Configuration"],
    [],
    ["Asset", "Centrifugal Compressor"],
    ["Asset Name", assetName],
    ["Created At", new Date().toLocaleString()],
    [],
    ["Sub-Asset", "Group", "Default Name", "Custom Name", "Models Selected"],
  ];
  items.forEach((item) => {
    const models = (state.models[item.id] || [])
      .map((id) => MODEL_CHAIN.find((m) => m.value === id)?.label || id)
      .join(", ");
    summaryRows.push([toKey(item.label), item.groupLabel, item.label, item.label, models]);
  });
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 28 }, { wch: 28 }, { wch: 60 }];
  wsSummary["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // ── Sheet 2: Sensor Mapping ──
  const sensorRows: (string | number)[][] = [
    ["Sub-Asset", "Group", "Sensor (Template Default)", "Your Tag / Name", "User UoM", "Default UoM", "Parameter Type"],
  ];
  (state.commonSensors || []).forEach((s) => {
    sensorRows.push(["Common Parameters", "Common", s.defaultName, s.name, s.uom, s.defaultUom || "", s.paramType || "PI"]);
  });
  sensorRows.push([]);
  const oilItem = items.find((i) => i.groupId === "oil_system");
  items.forEach((item) => {
    const rows = ensureSensorRows(state, item);
    rows.forEach((s) => {
      sensorRows.push([item.label, item.groupLabel, s.defaultName, s.name, s.uom, s.defaultUom || "", s.paramType || "PI"]);
    });
    // Fixed vs. the original: correctly checks groupId (was a groupId/id typo
    // upstream that made this dead code) — Oil System sensors now do get
    // duplicated onto every Turbine sub-asset, as originally intended.
    if (item.groupId === "turbine" && oilItem) {
      ensureSensorRows(state, oilItem).forEach((s) => {
        sensorRows.push([item.label, item.groupLabel, s.defaultName, s.name, s.uom, s.defaultUom || "", s.paramType || "PI"]);
      });
    }
    sensorRows.push([]);
  });
  sensorRows.forEach((row, i) => {
    if (i === 0 || !row.length || !row[0]) return;
    row[0] = toKey(String(row[0]));
    if (row[2]) row[2] = toKey(String(row[2]));
  });
  const wsSensors = XLSX.utils.aoa_to_sheet(sensorRows);
  wsSensors["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 32 }, { wch: 26 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsSensors, "Sensor Mapping");

  // ── Sheet 3: Models ──
  const modelRows: (string | number)[][] = [["Sub-Asset", "Group", ...MODEL_CHAIN.map((m) => m.label)]];
  items.forEach((item) => {
    const selected = new Set(state.models[item.id] || []);
    modelRows.push([item.label, item.groupLabel, ...MODEL_CHAIN.map((m) => (selected.has(m.value) ? "YES" : ""))]);
  });
  const wsModels = XLSX.utils.aoa_to_sheet(modelRows);
  wsModels["!cols"] = [{ wch: 28 }, { wch: 22 }, ...MODEL_CHAIN.map(() => ({ wch: 26 }))];
  XLSX.utils.book_append_sheet(wb, wsModels, "Models");

  // ── Sheet 4: Machine Config ──
  const mcRows = [["sub_asset", "macro_name", "macro_value"], ...buildMachineConfigRows(state)];
  const wsMC = XLSX.utils.aoa_to_sheet(mcRows);
  wsMC["!cols"] = [{ wch: 28 }, { wch: 36 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsMC, "Machine Config");

  // ── Sheet 5: OEM Limits ──
  // Not read by the Python pipeline today (no consumer sheet defined there yet)
  // — captured and persisted here so it isn't silently dropped like it was in
  // the original app, ready for a future consumer to pick up.
  const oemRows: (string | number)[][] = [
    ["Sub-Asset", "Group", "Parameter", "User UoM", "Default UoM", "Design Low", "Design High", "Rated"],
  ];
  items.forEach((item) => {
    ensureOemLimitRows(state, item).forEach((r) => {
      oemRows.push([item.label, item.groupLabel, r.parameter, r.uom, r.defaultUom, r.designLow, r.designHigh, r.rated]);
    });
  });
  oemRows.forEach((row, i) => {
    if (i === 0 || !row.length || !row[0]) return;
    row[0] = toKey(String(row[0]));
  });
  const wsOem = XLSX.utils.aoa_to_sheet(oemRows);
  wsOem["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 32 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsOem, "OEM Limits");

  // ── Sheet 6: Trip Limit ──
  // Only sub-assets with the Failure Prediction model selected — same gate
  // the wizard's Trip Limit tab uses (config/TripLimitTemplates.ts, ported
  // from Failure_Prediction_Tags.xlsx).
  const tripRows: (string | number)[][] = [
    ["Sub-Asset", "Group", "Parameter", "User UoM", "Default UoM", "Trip Limit", "Trip Direction", "Trip Limit Basis"],
  ];
  items
    .filter((item) => (state.models[item.id] || []).includes("failure_prediction"))
    .forEach((item) => {
      ensureTripLimitRows(state, item).forEach((r) => {
        tripRows.push([
          item.label, item.groupLabel, r.parameter, r.uom, r.defaultUom, r.tripLimit,
          r.tripDirection, r.tripLimitBasis,
        ]);
      });
    });
  tripRows.forEach((row, i) => {
    if (i === 0 || !row.length || !row[0]) return;
    row[0] = toKey(String(row[0]));
  });
  const wsTrip = XLSX.utils.aoa_to_sheet(tripRows);
  wsTrip["!cols"] = [
    { wch: 28 }, { wch: 22 }, { wch: 32 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 50 },
  ];
  XLSX.utils.book_append_sheet(wb, wsTrip, "Trip Limit");

  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
