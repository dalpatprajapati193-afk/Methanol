"use client";

import { useAtom } from "jotai";
import { useState } from "react";
import { wizardStateAtom } from "../../config/ConfigAtoms";
import {
  AUX_OPTIONS,
  BEARING_OPTIONS,
  COND_ARR_OPTIONS,
  DGS_COMP_OPTIONS,
  DGS_OPTIONS,
  DRIVER_OPTIONS,
  LOC_OPTIONS,
  OIL_OPTIONS,
  SERVICE_OPTIONS,
  STAGE_EQ_BASE_OPTIONS,
  STAGE_EQ_REFRIGERATION_OPTIONS,
  SUBSYS_OPTIONS,
  TREAT_OPTIONS,
  TURBINE_BEARING_OPTIONS,
  TURB_OPTIONS,
  type Option,
} from "../../config/ConfigCatalog";
import { buildStageGroups, stageGroupEquipmentKey, stageGroupLabel } from "../../config/SubAssets";
import { newCasing, newTurbine, type Casing, type Turbine } from "../../config/ConfigTypes";
import { PillSelect } from "./PillSelect";

const numberOptions = (from: number, to: number, plus = false): Option[] => {
  const opts = Array.from({ length: to - from + 1 }, (_, i) => {
    const n = from + i;
    const isLast = plus && n === to;
    return { value: isLast ? `${n}+` : String(n), label: isLast ? `${n}+` : String(n) };
  });
  return opts;
};
const STAGE_OPTIONS: Option[] = [1, 2, 3, 4, 5, 6].map((n) => ({ value: `stage_${n}`, label: `Stage ${n}` }));

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-sm font-medium text-text-primary">{label}</p>
      {hint && <p className="mb-2 text-xs italic text-text-secondary">{hint}</p>}
      {children}
    </div>
  );
}

type Section = "identification" | "casings" | "oil" | "process" | "driver";

export function StepMachineConfig() {
  const [state, setState] = useAtom(wizardStateAtom);
  const { mc } = state;
  const [section, setSection] = useState<Section>("identification");
  const [casingTab, setCasingTab] = useState(0);
  const [casingSubTab, setCasingSubTab] = useState<"stages" | "subsystems">("stages");
  const [turbineTab, setTurbineTab] = useState(0);

  const setMc = (patch: Partial<typeof mc>) => setState({ ...state, mc: { ...mc, ...patch } });

  const setNumCasings = (n: number) => {
    const casings = [...mc.casings];
    while (casings.length < n) casings.push(newCasing());
    setMc({ numCasings: n, casings });
    setCasingTab(0);
  };
  const setCasing = (idx: number, patch: Partial<Casing>) => {
    const casings = mc.casings.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    setMc({ casings });
  };

  const setNumTurbines = (n: number) => {
    const turbines = [...mc.turbines];
    while (turbines.length < n) turbines.push(newTurbine());
    setMc({ numTurbines: n, turbines });
    setTurbineTab(0);
  };
  const setTurbine = (idx: number, patch: Partial<Turbine>) => {
    const turbines = mc.turbines.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    setMc({ turbines });
  };

  const sections: { id: Section; label: string }[] = [
    { id: "identification", label: "Compressor classification" },
    { id: "casings", label: "Casing Config" },
    { id: "oil", label: "Oil System" },
    { id: "process", label: "Process Treatment" },
    ...(mc.driverType === "steam_turbine" ? [{ id: "driver" as const, label: "Driver System" }] : []),
  ];

  const casing = mc.casings[casingTab];
  const stageGroups = casing ? buildStageGroups(casing) : [];
  const isRefrigeration = mc.service === "c2r" || mc.service === "c3r";
  const stageEqOptions = isRefrigeration ? [...STAGE_EQ_BASE_OPTIONS, ...STAGE_EQ_REFRIGERATION_OPTIONS] : STAGE_EQ_BASE_OPTIONS;

  const casingNames = mc.casings.slice(0, Number(mc.numCasings) || 0).map((c, i) => c.name || `Casing ${i + 1}`);

  return (
    <div className="flex gap-4">
      <nav className="w-48 shrink-0 rounded-md border border-border bg-surface">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={
              "block w-full border-l-2 px-3 py-2 text-left text-xs " +
              (section === s.id ? "border-accent-blue bg-accent-blue/10 text-accent-blue" : "border-transparent text-text-secondary")
            }
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 rounded-md border border-border bg-surface p-5">
        {section === "identification" && (
          <>
            <Field label="Compressor Service *">
              <PillSelect options={SERVICE_OPTIONS} value={mc.service ? [mc.service] : []} onChange={(v) => setMc({ service: v[0] || "" })} />
            </Field>
            <Field label="Driver Type *">
              <PillSelect options={DRIVER_OPTIONS} value={mc.driverType ? [mc.driverType] : []} onChange={(v) => setMc({ driverType: v[0] || "" })} />
            </Field>
          </>
        )}

        {section === "casings" && (
          <>
            <Field label="Number of Casings *">
              <PillSelect
                options={numberOptions(1, 5)}
                value={mc.numCasings ? [String(mc.numCasings)] : []}
                onChange={(v) => setNumCasings(Number(v[0]) || 0)}
              />
            </Field>

            {casing && (
              <>
                <div className="mb-3 flex flex-wrap gap-1 border-b border-border">
                  {mc.casings.slice(0, Number(mc.numCasings)).map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCasingTab(i)}
                      className={
                        "px-3 py-2 text-xs font-medium " +
                        (casingTab === i ? "border-b-2 border-accent-blue text-accent-blue" : "text-text-secondary")
                      }
                    >
                      {c.name || `Casing ${i + 1}`}
                    </button>
                  ))}
                </div>

                <Field label="Casing Name *">
                  <input
                    type="text"
                    value={casing.name}
                    onChange={(e) => setCasing(casingTab, { name: e.target.value })}
                    placeholder="e.g. LP, MP, HP"
                    className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
                  />
                </Field>
                <Field label="Stages *">
                  <PillSelect options={STAGE_OPTIONS} value={casing.stages} onChange={(v) => setCasing(casingTab, { stages: v })} multi />
                </Field>
                <Field label="Internally Connected? *">
                  <PillSelect
                    options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
                    value={casing.internallyConnected === null ? [] : [casing.internallyConnected ? "yes" : "no"]}
                    onChange={(v) => setCasing(casingTab, { internallyConnected: v[0] === "yes" })}
                  />
                </Field>
                {casing.internallyConnected && casing.stages.length >= 2 && (
                  <Field label="Internal Connections" hint="Which adjacent stages are connected?">
                    <PillSelect
                      options={casing.stages.slice(0, -1).map((s, i) => {
                        const next = casing.stages[i + 1];
                        return { value: `${s}-${next}`, label: `${s.replace("stage_", "Stage ")}-${next.replace("stage_", "Stage ")}` };
                      })}
                      value={casing.internalConnections}
                      onChange={(v) => setCasing(casingTab, { internalConnections: v })}
                      multi
                    />
                  </Field>
                )}
                <Field label="Suction Streams *">
                  <PillSelect options={numberOptions(0, 4, true)} value={casing.suctionStreams ? [casing.suctionStreams] : []} onChange={(v) => setCasing(casingTab, { suctionStreams: v[0] || "" })} />
                </Field>
                <Field label="Discharge Streams *">
                  <PillSelect options={numberOptions(0, 4, true)} value={casing.dischargeStreams ? [casing.dischargeStreams] : []} onChange={(v) => setCasing(casingTab, { dischargeStreams: v[0] || "" })} />
                </Field>
                <Field label="Side Loads? *">
                  <PillSelect
                    options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
                    value={casing.hasSideLoads === null ? [] : [casing.hasSideLoads ? "yes" : "no"]}
                    onChange={(v) => setCasing(casingTab, { hasSideLoads: v[0] === "yes" })}
                  />
                </Field>
                {casing.hasSideLoads && (
                  <Field label="Number of Side Loads *">
                    <PillSelect
                      options={numberOptions(1, 2, true)}
                      value={casing.numSideStreams ? [casing.numSideStreams] : []}
                      onChange={(v) => {
                        const n = v[0] === "3+" ? 3 : Number(v[0]) || 0;
                        const sideLoads = Array.from({ length: n }, (_, i) => casing.sideLoads[i] || { stage: "" });
                        setCasing(casingTab, { numSideStreams: v[0] || "", sideLoads });
                      }}
                    />
                    {casing.sideLoads.map((sl, si) => (
                      <input
                        key={si}
                        type="text"
                        value={sl.stage}
                        onChange={(e) => {
                          const sideLoads = casing.sideLoads.map((s, i) => (i === si ? { stage: e.target.value } : s));
                          setCasing(casingTab, { sideLoads });
                        }}
                        placeholder={`Side load ${si + 1}: enters before stage`}
                        className="mt-2 w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
                      />
                    ))}
                  </Field>
                )}

                <div className="mb-3 mt-4 flex gap-4 border-b border-border">
                  {(["stages", "subsystems"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCasingSubTab(t)}
                      className={
                        "pb-2 text-xs font-medium " +
                        (casingSubTab === t ? "border-b-2 border-accent-blue text-accent-blue" : "text-text-secondary")
                      }
                    >
                      {t === "stages" ? "Stage Config" : "Casing Subsystems"}
                    </button>
                  ))}
                </div>

                {casingSubTab === "stages" &&
                  stageGroups.map((grp) => {
                    const sid = stageGroupEquipmentKey(grp);
                    const slbl = stageGroupLabel(grp);
                    const seq = casing.stageEquipment[sid] || { equipment: [] };
                    const setSeq = (patch: Partial<typeof seq>) =>
                      setCasing(casingTab, { stageEquipment: { ...casing.stageEquipment, [sid]: { ...seq, ...patch } } });
                    return (
                      <div key={sid} className="mb-4 rounded-md border border-border bg-background p-4">
                        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-text-secondary">{slbl}</p>
                        <Field label="Equipment *">
                          <PillSelect options={stageEqOptions} value={seq.equipment} onChange={(v) => setSeq({ equipment: v })} multi />
                        </Field>
                        {seq.equipment.includes("intercooler") && (
                          <div className="mb-3 flex gap-6">
                            <Field label="Intercooler Count">
                              <PillSelect options={numberOptions(1, 4, true)} value={seq.intercoolerCount ? [String(seq.intercoolerCount)] : []} onChange={(v) => setSeq({ intercoolerCount: Number(v[0]) || undefined })} />
                            </Field>
                            <Field label="Location">
                              <PillSelect options={[{ value: "suction", label: "Suction" }, { value: "discharge", label: "Discharge" }]} value={seq.intercoolerLocation ? [seq.intercoolerLocation] : []} onChange={(v) => setSeq({ intercoolerLocation: v[0] })} />
                            </Field>
                          </div>
                        )}
                        {seq.equipment.includes("kod") && (
                          <div className="mb-3 flex gap-6">
                            <Field label="KOD Count">
                              <PillSelect options={numberOptions(1, 2, true)} value={seq.kodCount ? [String(seq.kodCount)] : []} onChange={(v) => setSeq({ kodCount: Number(v[0]) || undefined })} />
                            </Field>
                            <Field label="Location">
                              <PillSelect options={LOC_OPTIONS} value={seq.kodLocation ? [seq.kodLocation] : []} onChange={(v) => setSeq({ kodLocation: v[0] })} />
                            </Field>
                          </div>
                        )}
                        {seq.equipment.includes("recycle_loop") && (
                          <div className="mb-3 flex gap-3">
                            <input type="text" value={seq.recycleSource || ""} onChange={(e) => setSeq({ recycleSource: e.target.value })} placeholder="Recycle source stage" className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary" />
                            <input type="text" value={seq.recycleDestination || ""} onChange={(e) => setSeq({ recycleDestination: e.target.value })} placeholder="Recycle destination stage" className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary" />
                          </div>
                        )}
                        {(["ref_desuperheater", "ref_condenser", "ref_accumulator"] as const).map((eq) =>
                          seq.equipment.includes(eq) ? (
                            <Field key={eq} label={`${eq.replace("ref_", "Refrigerant ")} Count`}>
                              <PillSelect
                                options={numberOptions(1, 4)}
                                value={
                                  eq === "ref_desuperheater" ? (seq.refDesuperheaterCount ? [String(seq.refDesuperheaterCount)] : [])
                                  : eq === "ref_condenser" ? (seq.refCondenserCount ? [String(seq.refCondenserCount)] : [])
                                  : seq.refAccumulatorCount ? [String(seq.refAccumulatorCount)] : []
                                }
                                onChange={(v) =>
                                  setSeq(
                                    eq === "ref_desuperheater" ? { refDesuperheaterCount: Number(v[0]) || undefined }
                                    : eq === "ref_condenser" ? { refCondenserCount: Number(v[0]) || undefined }
                                    : { refAccumulatorCount: Number(v[0]) || undefined }
                                  )
                                }
                              />
                            </Field>
                          ) : null
                        )}
                      </div>
                    );
                  })}

                {casingSubTab === "subsystems" && (
                  <>
                    <Field label="Casing Subsystems *">
                      <PillSelect options={SUBSYS_OPTIONS} value={casing.subsystems} onChange={(v) => setCasing(casingTab, { subsystems: v })} multi />
                    </Field>
                    {casing.subsystems.includes("dry_gas_seal") && (
                      <>
                        <Field label="DGS Support *">
                          <PillSelect options={DGS_OPTIONS} value={casing.dgsSupport} onChange={(v) => setCasing(casingTab, { dgsSupport: v })} multi />
                        </Field>
                        {casing.dgsSupport.includes("de_dgs") && (
                          <Field label="DE DGS Components *">
                            <PillSelect options={DGS_COMP_OPTIONS} value={casing.deDgsComponents} onChange={(v) => setCasing(casingTab, { deDgsComponents: v })} multi />
                          </Field>
                        )}
                        {casing.dgsSupport.includes("nde_dgs") && (
                          <Field label="NDE DGS Components *">
                            <PillSelect options={DGS_COMP_OPTIONS} value={casing.ndeDgsComponents} onChange={(v) => setCasing(casingTab, { ndeDgsComponents: v })} multi />
                          </Field>
                        )}
                      </>
                    )}
                    {casing.subsystems.includes("condition_monitoring") && (
                      <Field label="Bearings *">
                        <PillSelect options={BEARING_OPTIONS} value={casing.bearings} onChange={(v) => setCasing(casingTab, { bearings: v })} multi />
                      </Field>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {section === "oil" && (
          <Field label="Oil System Equipment *">
            <PillSelect options={OIL_OPTIONS} value={mc.oilEquipment} onChange={(v) => setMc({ oilEquipment: v })} multi />
          </Field>
        )}

        {section === "process" && (
          <>
            <Field label="Process Treatment *">
              <PillSelect options={TREAT_OPTIONS} value={mc.processTreatment} onChange={(v) => setMc({ processTreatment: v })} multi />
            </Field>
            {mc.processTreatment.includes("caustic_tower") && (
              <Field label="Caustic Loop Connection">
                <PillSelect
                  options={mc.casings.slice(0, Number(mc.numCasings)).flatMap((c) =>
                    buildStageGroups(c).map((grp) => ({
                      value: `after_stage_${grp.join("-")}`,
                      label: `After ${stageGroupLabel(grp)}`,
                    }))
                  )}
                  value={mc.causticConnection ? [mc.causticConnection] : []}
                  onChange={(v) => setMc({ causticConnection: v[0] || "" })}
                />
              </Field>
            )}
          </>
        )}

        {section === "driver" && (
          <>
            <Field label="Number of Turbines *">
              <PillSelect options={numberOptions(1, 3)} value={mc.numTurbines ? [String(mc.numTurbines)] : []} onChange={(v) => setNumTurbines(Number(v[0]) || 0)} />
            </Field>
            {mc.turbines[turbineTab] && (
              <>
                <div className="mb-3 flex flex-wrap gap-1 border-b border-border">
                  {mc.turbines.slice(0, Number(mc.numTurbines)).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTurbineTab(i)}
                      className={
                        "px-3 py-2 text-xs font-medium " +
                        (turbineTab === i ? "border-b-2 border-accent-blue text-accent-blue" : "text-text-secondary")
                      }
                    >
                      Turbine {i + 1}
                    </button>
                  ))}
                </div>
                {(() => {
                  const tb = mc.turbines[turbineTab];
                  return (
                    <>
                      <Field label="Turbine Type *">
                        <PillSelect options={TURB_OPTIONS} value={tb.type ? [tb.type] : []} onChange={(v) => setTurbine(turbineTab, { type: v[0] || "" })} />
                      </Field>
                      <Field label="Connected Casings (in train order) *" hint="Click casings in flow order.">
                        <div className="mb-2 flex flex-wrap gap-2">
                          {tb.connectedCasingsOrdered.map((c, i) => (
                            <span key={i} className="rounded-md border border-accent-blue bg-accent-blue/10 px-2 py-1 text-xs text-accent-blue">
                              {i + 1}. {c}
                            </span>
                          ))}
                        </div>
                        <PillSelect
                          options={casingNames.map((c) => ({ value: c, label: c }))}
                          value={tb.connectedCasingsOrdered}
                          onChange={(v) => {
                            // PillSelect toggles a single value in/out — reconstruct order accordingly.
                            const clicked = v.find((x) => !tb.connectedCasingsOrdered.includes(x));
                            const removed = tb.connectedCasingsOrdered.find((x) => !v.includes(x));
                            let ordered = tb.connectedCasingsOrdered;
                            if (clicked) ordered = [...ordered, clicked];
                            if (removed) ordered = ordered.filter((x) => x !== removed);
                            setTurbine(turbineTab, { connectedCasingsOrdered: ordered, connectedCasings: ordered });
                          }}
                          multi
                        />
                        <button
                          type="button"
                          onClick={() => setTurbine(turbineTab, { connectedCasingsOrdered: [], connectedCasings: [] })}
                          className="mt-2 text-xs text-text-secondary underline"
                        >
                          Reset order
                        </button>
                      </Field>
                      <Field label="Auxiliary Systems *">
                        <PillSelect options={AUX_OPTIONS} value={tb.auxiliarySystems} onChange={(v) => setTurbine(turbineTab, { auxiliarySystems: v })} multi />
                      </Field>
                      {tb.auxiliarySystems.includes("surface_condenser") && (
                        <>
                          <Field label="Surface Condenser Aux Systems">
                            <PillSelect
                              options={[{ value: "steam_ejector", label: "Steam Ejector System" }, { value: "surface_condenser_pump", label: "Surface Condenser Pump" }]}
                              value={tb.scAuxSystems}
                              onChange={(v) => setTurbine(turbineTab, { scAuxSystems: v })}
                              multi
                            />
                          </Field>
                          <Field label="Surface Condenser Count">
                            <PillSelect options={numberOptions(1, 3)} value={tb.surfaceCondenserCount ? [String(tb.surfaceCondenserCount)] : []} onChange={(v) => setTurbine(turbineTab, { surfaceCondenserCount: Number(v[0]) || "" })} />
                          </Field>
                          <Field label="Arrangement">
                            <PillSelect options={COND_ARR_OPTIONS} value={tb.surfaceCondenserArrangement ? [tb.surfaceCondenserArrangement] : []} onChange={(v) => setTurbine(turbineTab, { surfaceCondenserArrangement: v[0] || "" })} />
                          </Field>
                          {tb.scAuxSystems.includes("surface_condenser_pump") && (
                            <Field label="Pump Count">
                              <PillSelect options={numberOptions(1, 4)} value={tb.surfaceCondenserPumpCount ? [String(tb.surfaceCondenserPumpCount)] : []} onChange={(v) => setTurbine(turbineTab, { surfaceCondenserPumpCount: Number(v[0]) || "" })} />
                            </Field>
                          )}
                        </>
                      )}
                      <Field label="Turbine Condition Monitoring">
                        <PillSelect options={TURBINE_BEARING_OPTIONS} value={tb.turbineCondMonitoring} onChange={(v) => setTurbine(turbineTab, { turbineCondMonitoring: v })} multi />
                      </Field>
                    </>
                  );
                })()}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
