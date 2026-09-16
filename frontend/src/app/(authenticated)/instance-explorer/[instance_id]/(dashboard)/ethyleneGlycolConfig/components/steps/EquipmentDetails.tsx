"use client";

import { useAtom } from "jotai";
import { configDataAtom, wizardDirtyAtom } from "../../store/WizardAtoms";
import type {
  EgConfigData,
  DirectSteamInput,
  FpeExchanger,
  OeEquipmentItem,
  EquipmentSectionId,
} from "../../store/Types";
import {
  Section,
  Field,
  TextField,
  NumberField,
  SelectField,
  ToggleGroup,
  YesNoToggle,
  CheckboxGroup,
  ConditionalReveal,
  DynamicListCard,
} from "../ui/Index";

// ── Option constants (exact legacy values, app.js STEPS_MASTER) ───────────────

const COLUMN_TYPE_OPTIONS = ["Packed", "Tray"] as const;
const ABSORPTION_MEDIUM_OPTIONS = ["Process Water", "Lean Glycol Water", "Recycle water", "Other"];
const INTERCOOLER_MEDIUM_OPTIONS = ["Cooling Water", "Tempered Water", "Other"];
const AFTERCOOLER_SOURCE_OPTIONS = ["Reactor Effluent", "Steam", "Condensate", "Other"];
const STRIPPING_PURPOSE_OPTIONS = ["CO₂ Removal", "Dissolved Gas Removal", "Both"];
const OVERHEAD_VENT_OPTIONS = ["Atmosphere", "Flare", "Recycle to reabsorber"];
const REACTOR_TYPE_OPTIONS = ["Adiabatic Tubular", "Isothermal Tubular", "CSTR"];
const EXCHANGER_TYPE_OPTIONS = ["Shell & Tube", "Plate", "Plate-fin"];
const OE_TYPE_OPTIONS = ["Exchanger", "Pump", "Compressor", "Ejector", "Heater", "Other"];
const SC_REBOILER_MEDIUM_OPTIONS = ["LP Steam", "MP Steam", "Hot Water", "Other"];
const GFS_REBOILER_MEDIUM_OPTIONS = ["LP Steam", "MP Steam", "Reactor Effluent", "Other"];
const HEAT_RECOVERY_SINK_OPTIONS = ["Feed Preheat", "Steam Generation", "Evaporator", "Hot Water Loop"];
const FLOW_ARRANGEMENT_OPTIONS = ["Forward-feed", "Backward-feed", "Mixed-feed"];
const FIRST_EFFECT_SOURCE_OPTIONS = ["HP Steam", "MP Steam", "LP Steam", "Reactor Effluent Heat", "Other"];

export default function EquipmentDetails({ only }: { only?: EquipmentSectionId }) {
  const [cfg, setCfg] = useAtom(configDataAtom);
  const [, setDirty] = useAtom(wizardDirtyAtom);

  const show = (id: EquipmentSectionId) => !only || only === id;

  const headers = cfg.steamHeaders.map((h) => h.headerLabel).filter(Boolean);
  // Legacy dynamic option logic (app.js ~lines 1328–1338) with fallbacks.
  const heatSourceOptions = headers.length
    ? [...headers, "Condensate", "Other"]
    : ["HP Steam", "MP Steam", "LP Steam", "Condensate", "Other"];
  const mediaSourceOptions = headers.length
    ? [...headers, "Other"]
    : ["LP Steam", "MP Steam", "HP Steam", "Other"];

  // Steam-source dropdowns: user-defined header labels + the relevant extras + "Other",
  // falling back to the fixed legacy lists when no headers are defined.
  const withHeaders = (extras: string[], fallback: string[]) =>
    headers.length ? [...headers, ...extras, "Other"] : fallback;
  const scReboilerOptions = withHeaders(["Hot Water"], SC_REBOILER_MEDIUM_OPTIONS);
  const gfsReboilerOptions = withHeaders(["Reactor Effluent"], GFS_REBOILER_MEDIUM_OPTIONS); // GFS + Integrated
  const firstEffectSourceOptions = withHeaders(["Reactor Effluent Heat"], FIRST_EFFECT_SOURCE_OPTIONS);
  const aftercoolerSourceOptions = withHeaders(["Reactor Effluent", "Condensate"], AFTERCOOLER_SOURCE_OPTIONS);

  function set<K extends keyof EgConfigData>(field: K, value: EgConfigData[K]) {
    setCfg((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  }

  // ── Repeating-group sync helpers ──────────────────────────────────────────

  function syncDirectSteamInputs(count: number, current: DirectSteamInput[]): DirectSteamInput[] {
    const blank: DirectSteamInput = { freshSteam: "no", mediaSource: "", otherLabel: "" };
    return Array.from({ length: Math.max(0, count) }, (_, i) => current[i] ?? blank);
  }

  function syncFpeExchangers(count: number, current: FpeExchanger[]): FpeExchanger[] {
    const blank: FpeExchanger = { freshSteam: "no", heatSource: "", heatSourceOther: "", exchangerType: "" };
    return Array.from({ length: Math.max(0, count) }, (_, i) => current[i] ?? blank);
  }

  function syncOeEquipment(count: number, current: OeEquipmentItem[]): OeEquipmentItem[] {
    const blank: OeEquipmentItem = {
      oe_name: "",
      oe_type: "",
      oe_freshSteam: "no",
      oe_heatSource: "",
      oe_heatSourceOther: "",
    };
    return Array.from({ length: Math.max(0, count) }, (_, i) => current[i] ?? blank);
  }

  function updateDirectSteam(
    prefix: "sc" | "int" | "gfs",
    index: number,
    field: keyof DirectSteamInput,
    value: string
  ) {
    const key = `${prefix}_directSteamInputs` as const;
    const list = cfg[key] as DirectSteamInput[];
    set(key, list.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function updateFpeExchanger(index: number, field: keyof FpeExchanger, value: string) {
    set(
      "fpe_exchangers",
      cfg.fpe_exchangers.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex))
    );
  }

  function updateOeItem(index: number, field: keyof OeEquipmentItem, value: string) {
    set(
      "oe_equipment",
      cfg.oe_equipment.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function toggleHeatSink(label: string) {
    const current = cfg.gr_heatRecoverySinks;
    set(
      "gr_heatRecoverySinks",
      current.includes(label) ? current.filter((s) => s !== label) : [...current, label]
    );
  }

  const showSeparate = cfg.eq_hasGFS === "yes" && cfg.eq_gfsArrangement === "Separate Columns";
  const showIntegrated = cfg.eq_hasGFS === "yes" && cfg.eq_gfsArrangement === "Integrated Single Column";

  const scDSInputs = syncDirectSteamInputs(cfg.sc_numDirectSteam, cfg.sc_directSteamInputs);
  const intDSInputs = syncDirectSteamInputs(cfg.int_numDirectSteam, cfg.int_directSteamInputs);
  const gfsDSInputs = syncDirectSteamInputs(cfg.gfs_numDirectSteam, cfg.gfs_directSteamInputs);
  const fpeExchangers = syncFpeExchangers(cfg.fpe_numExchangers, cfg.fpe_exchangers);
  const oeItems = syncOeEquipment(cfg.oe_numEquipment, cfg.oe_equipment);

  return (
    <div className="flex flex-col gap-8">
      {!only && (
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Equipment Details</h2>
          <p className="text-sm text-text-secondary mt-1">
            Configure each equipment section and its steam/heat sources.
          </p>
        </div>
      )}

      {/* ── Stripping Column ──────────────────────────────────────────────── */}
      {show("strippingColumn") && (
        <Section title="Stripping Column">
          <Field label="Column Type">
            <ToggleGroup options={COLUMN_TYPE_OPTIONS} value={cfg.sc_columnType} onChange={(v) => set("sc_columnType", v)} />
          </Field>
          <Field label="Is Reboiler Present?">
            <YesNoToggle value={cfg.sc_hasReboiler} onChange={(v) => set("sc_hasReboiler", v)} />
          </Field>
          {cfg.sc_hasReboiler === "yes" && (
            <ConditionalReveal>
              <Field label="Is there fresh steam consumption for the Reboiler?">
                <YesNoToggle value={cfg.sc_reboilerFreshSteam} onChange={(v) => set("sc_reboilerFreshSteam", v)} />
              </Field>
              <Field label="Reboiler Heating Medium">
                <SelectField options={scReboilerOptions} value={cfg.sc_reboilerMedium} onChange={(v) => set("sc_reboilerMedium", v)} />
              </Field>
            </ConditionalReveal>
          )}
          <Field label="Is Direct Steam Injected into Column?">
            <YesNoToggle value={cfg.sc_hasDirectSteam} onChange={(v) => set("sc_hasDirectSteam", v)} />
          </Field>
          {cfg.sc_hasDirectSteam === "yes" && (
            <ConditionalReveal>
              <Field label="Is there fresh steam consumption for Direct Steam?">
                <YesNoToggle value={cfg.sc_directSteamFreshSteam} onChange={(v) => set("sc_directSteamFreshSteam", v)} />
              </Field>
              <Field label="Number of Direct Steam Inputs">
                <NumberField
                  min={0}
                  value={cfg.sc_numDirectSteam}
                  onChange={(val) => {
                    const n = Math.max(0, parseInt(val) || 0);
                    set("sc_numDirectSteam", n);
                    set("sc_directSteamInputs", syncDirectSteamInputs(n, cfg.sc_directSteamInputs));
                  }}
                />
              </Field>
              {scDSInputs.map((item, i) => (
                <DirectSteamRow key={i} index={i} item={item} mediaOptions={mediaSourceOptions}
                  onChange={(field, val) => updateDirectSteam("sc", i, field, val)} />
              ))}
            </ConditionalReveal>
          )}
          <Field label="Does part of bottom go to cycle water treating unit as bleed?">
            <YesNoToggle value={cfg.sc_hasBottomBleed} onChange={(v) => set("sc_hasBottomBleed", v)} />
          </Field>
        </Section>
      )}

      {/* ── Reabsorber (Separate Columns only) ───────────────────────────── */}
      {showSeparate && show("reabsorber") && (
        <Section title="Reabsorber">
          <Field label="Column Type">
            <ToggleGroup options={COLUMN_TYPE_OPTIONS} value={cfg.ra_columnType} onChange={(v) => set("ra_columnType", v)} />
          </Field>
          <Field label="Absorption Medium">
            <SelectField options={ABSORPTION_MEDIUM_OPTIONS} value={cfg.ra_absorptionMedium} onChange={(v) => set("ra_absorptionMedium", v)} />
          </Field>
          {cfg.ra_absorptionMedium === "Other" && (
            <Field label="Specify Other Absorption Medium">
              <TextField value={cfg.ra_absorptionMediumOther} onChange={(v) => set("ra_absorptionMediumOther", v)} />
            </Field>
          )}
          <Field label="Is Intercooler Present to Control Bottom Temperature?">
            <YesNoToggle value={cfg.ra_hasIntercooler} onChange={(v) => set("ra_hasIntercooler", v)} />
          </Field>
          {cfg.ra_hasIntercooler === "yes" && (
            <ConditionalReveal>
              <Field label="Intercooler Cooling Medium">
                <SelectField options={INTERCOOLER_MEDIUM_OPTIONS} value={cfg.ra_intercoolerMedium} onChange={(v) => set("ra_intercoolerMedium", v)} />
              </Field>
              {cfg.ra_intercoolerMedium === "Other" && (
                <Field label="Specify Other Cooling Medium">
                  <TextField value={cfg.ra_intercoolerMediumOther} onChange={(v) => set("ra_intercoolerMediumOther", v)} />
                </Field>
              )}
            </ConditionalReveal>
          )}
          <Field label="Is Aftercooler Present to Preheat Reabsorber Bottom Going to GFS?">
            <YesNoToggle value={cfg.ra_hasAftercooler} onChange={(v) => set("ra_hasAftercooler", v)} />
          </Field>
          {cfg.ra_hasAftercooler === "yes" && (
            <ConditionalReveal>
              <Field label="Is there fresh steam consumption for the Aftercooler?">
                <YesNoToggle value={cfg.ra_aftercoolerFreshSteam} onChange={(v) => set("ra_aftercoolerFreshSteam", v)} />
              </Field>
              <Field label="Aftercooler Hot-Side Source">
                <SelectField options={aftercoolerSourceOptions} value={cfg.ra_aftercoolerSource} onChange={(v) => set("ra_aftercoolerSource", v)} />
              </Field>
              {cfg.ra_aftercoolerSource === "Other" && (
                <Field label="Specify Other Hot-Side Source">
                  <TextField value={cfg.ra_aftercoolerSourceOther} onChange={(v) => set("ra_aftercoolerSourceOther", v)} />
                </Field>
              )}
            </ConditionalReveal>
          )}
        </Section>
      )}

      {/* ── GFS Separate Column ───────────────────────────────────────────── */}
      {showSeparate && show("gfs") && (
        <Section title="Glycol Feed Stripper — GFS">
          <Field label="Column Type">
            <ToggleGroup options={COLUMN_TYPE_OPTIONS} value={cfg.gfs_columnType} onChange={(v) => set("gfs_columnType", v)} />
          </Field>
          <Field label="Is Reboiler Present?">
            <YesNoToggle value={cfg.gfs_hasReboiler} onChange={(v) => set("gfs_hasReboiler", v)} />
          </Field>
          {cfg.gfs_hasReboiler === "yes" && (
            <ConditionalReveal>
              <Field label="Is there fresh steam consumption for the Reboiler?">
                <YesNoToggle value={cfg.gfs_reboilerFreshSteam} onChange={(v) => set("gfs_reboilerFreshSteam", v)} />
              </Field>
              <Field label="Reboiler Heating Medium">
                <SelectField options={gfsReboilerOptions} value={cfg.gfs_reboilerMedium} onChange={(v) => set("gfs_reboilerMedium", v)} />
              </Field>
            </ConditionalReveal>
          )}
          <Field label="Is Direct Steam Injected into Column?">
            <YesNoToggle value={cfg.gfs_hasDirectSteam} onChange={(v) => set("gfs_hasDirectSteam", v)} />
          </Field>
          {cfg.gfs_hasDirectSteam === "yes" && (
            <ConditionalReveal>
              <Field label="Is there fresh steam consumption for Direct Steam?">
                <YesNoToggle value={cfg.gfs_directSteamFreshSteam} onChange={(v) => set("gfs_directSteamFreshSteam", v)} />
              </Field>
              <Field label="Number of Direct Steam Inputs">
                <NumberField
                  min={0}
                  value={cfg.gfs_numDirectSteam}
                  onChange={(val) => {
                    const n = Math.max(0, parseInt(val) || 0);
                    set("gfs_numDirectSteam", n);
                    set("gfs_directSteamInputs", syncDirectSteamInputs(n, cfg.gfs_directSteamInputs));
                  }}
                />
              </Field>
              {gfsDSInputs.map((item, i) => (
                <DirectSteamRow key={i} index={i} item={item} mediaOptions={mediaSourceOptions}
                  onChange={(field, val) => updateDirectSteam("gfs", i, field, val)} />
              ))}
            </ConditionalReveal>
          )}
          <Field label="Purpose of Stripping">
            <SelectField options={STRIPPING_PURPOSE_OPTIONS} value={cfg.gfs_strippingPurpose} onChange={(v) => set("gfs_strippingPurpose", v)} />
          </Field>
          <Field label="Overhead Vent Destination">
            <SelectField options={OVERHEAD_VENT_OPTIONS} value={cfg.gfs_overheadVent} onChange={(v) => set("gfs_overheadVent", v)} />
          </Field>
        </Section>
      )}

      {/* ── Integrated Reabsorber & GFS ───────────────────────────────────── */}
      {showIntegrated && show("integrated") && (
        <Section title="Integrated Reabsorber & GFS">
          <Field label="Column Type">
            <ToggleGroup options={COLUMN_TYPE_OPTIONS} value={cfg.int_columnType} onChange={(v) => set("int_columnType", v)} />
          </Field>
          <Field label="Absorption Medium">
            <SelectField options={ABSORPTION_MEDIUM_OPTIONS} value={cfg.int_absorptionMedium} onChange={(v) => set("int_absorptionMedium", v)} />
          </Field>
          {cfg.int_absorptionMedium === "Other" && (
            <Field label="Specify Other Absorption Medium">
              <TextField value={cfg.int_absorptionMediumOther} onChange={(v) => set("int_absorptionMediumOther", v)} />
            </Field>
          )}
          <Field label="Is Intercooler Present?">
            <YesNoToggle value={cfg.int_hasIntercooler} onChange={(v) => set("int_hasIntercooler", v)} />
          </Field>
          {cfg.int_hasIntercooler === "yes" && (
            <ConditionalReveal>
              <Field label="Intercooler Cooling Medium">
                <SelectField options={INTERCOOLER_MEDIUM_OPTIONS} value={cfg.int_intercoolerMedium} onChange={(v) => set("int_intercoolerMedium", v)} />
              </Field>
              {cfg.int_intercoolerMedium === "Other" && (
                <Field label="Specify Other Cooling Medium">
                  <TextField value={cfg.int_intercoolerMediumOther} onChange={(v) => set("int_intercoolerMediumOther", v)} />
                </Field>
              )}
            </ConditionalReveal>
          )}
          <Field label="Is Reboiler Present?">
            <YesNoToggle value={cfg.int_hasReboiler} onChange={(v) => set("int_hasReboiler", v)} />
          </Field>
          {cfg.int_hasReboiler === "yes" && (
            <ConditionalReveal>
              <Field label="Is there fresh steam consumption for the Reboiler?">
                <YesNoToggle value={cfg.int_reboilerFreshSteam} onChange={(v) => set("int_reboilerFreshSteam", v)} />
              </Field>
              <Field label="Reboiler Heating Medium">
                <SelectField options={gfsReboilerOptions} value={cfg.int_reboilerMedium} onChange={(v) => set("int_reboilerMedium", v)} />
              </Field>
            </ConditionalReveal>
          )}
          <Field label="Is Direct Steam Injected into Column?">
            <YesNoToggle value={cfg.int_hasDirectSteam} onChange={(v) => set("int_hasDirectSteam", v)} />
          </Field>
          {cfg.int_hasDirectSteam === "yes" && (
            <ConditionalReveal>
              <Field label="Is there fresh steam consumption for Direct Steam?">
                <YesNoToggle value={cfg.int_directSteamFreshSteam} onChange={(v) => set("int_directSteamFreshSteam", v)} />
              </Field>
              <Field label="Number of Direct Steam Inputs">
                <NumberField
                  min={0}
                  value={cfg.int_numDirectSteam}
                  onChange={(val) => {
                    const n = Math.max(0, parseInt(val) || 0);
                    set("int_numDirectSteam", n);
                    set("int_directSteamInputs", syncDirectSteamInputs(n, cfg.int_directSteamInputs));
                  }}
                />
              </Field>
              {intDSInputs.map((item, i) => (
                <DirectSteamRow key={i} index={i} item={item} mediaOptions={mediaSourceOptions}
                  onChange={(field, val) => updateDirectSteam("int", i, field, val)} />
              ))}
            </ConditionalReveal>
          )}
          <Field label="Purpose of Stripping">
            <SelectField options={STRIPPING_PURPOSE_OPTIONS} value={cfg.int_strippingPurpose} onChange={(v) => set("int_strippingPurpose", v)} />
          </Field>
          <Field label="Overhead Vent Destination">
            <SelectField options={OVERHEAD_VENT_OPTIONS} value={cfg.int_overheadVent} onChange={(v) => set("int_overheadVent", v)} />
          </Field>
        </Section>
      )}

      {/* ── Feed Preheat Exchangers ───────────────────────────────────────── */}
      {show("feedPreheat") && (
        <Section title="Feed Preheat Exchangers">
          <Field label="Number of Feed Preheat Exchangers in Series">
            <NumberField
              min={0}
              value={cfg.fpe_numExchangers}
              onChange={(val) => {
                const n = Math.max(0, parseInt(val) || 0);
                set("fpe_numExchangers", n);
                set("fpe_exchangers", syncFpeExchangers(n, cfg.fpe_exchangers));
              }}
            />
          </Field>
          {fpeExchangers.map((ex, i) => (
            <DynamicListCard key={i} title={`Exchanger ${i + 1}`}>
              <Field label="Is there fresh steam consumption?">
                <YesNoToggle value={ex.freshSteam} onChange={(v) => updateFpeExchanger(i, "freshSteam", v)} />
              </Field>
              <Field label="Heat Source">
                <SelectField options={heatSourceOptions} value={ex.heatSource} onChange={(v) => updateFpeExchanger(i, "heatSource", v)} />
              </Field>
              {ex.heatSource === "Other" && (
                <Field label="Specify Other Source">
                  <TextField value={ex.heatSourceOther} onChange={(v) => updateFpeExchanger(i, "heatSourceOther", v)} />
                </Field>
              )}
              <Field label="Exchanger Type">
                <SelectField options={EXCHANGER_TYPE_OPTIONS} value={ex.exchangerType} onChange={(v) => updateFpeExchanger(i, "exchangerType", v)} />
              </Field>
            </DynamicListCard>
          ))}
        </Section>
      )}

      {/* ── Glycol Reactor ────────────────────────────────────────────────── */}
      {show("glycolReactor") && (
        <Section title="Glycol Reactor">
          <Field label="Reactor Type">
            <SelectField options={REACTOR_TYPE_OPTIONS} value={cfg.gr_reactorType} onChange={(v) => set("gr_reactorType", v)} />
          </Field>
          <Field label="Number of Reactors (if in series)">
            <NumberField min={1} value={cfg.gr_numReactors} onChange={(val) => set("gr_numReactors", Math.max(1, parseInt(val) || 1))} />
          </Field>
          <Field label="Is Reactor Exotherm Heat Recovered?">
            <YesNoToggle value={cfg.gr_heatRecovered} onChange={(v) => set("gr_heatRecovered", v)} />
          </Field>
          {cfg.gr_heatRecovered === "yes" && (
            <ConditionalReveal>
              <Field label="Heat Recovery Sink(s)">
                <CheckboxGroup options={HEAT_RECOVERY_SINK_OPTIONS} selected={cfg.gr_heatRecoverySinks} onToggle={toggleHeatSink} />
              </Field>
            </ConditionalReveal>
          )}
          <Field label="Number of Inter-stage Coolers" hint="Enter 0 if single reactor">
            <NumberField min={0} value={cfg.gr_numInterstage} onChange={(val) => set("gr_numInterstage", Math.max(0, parseInt(val) || 0))} />
          </Field>
        </Section>
      )}

      {/* ── Evaporation System ────────────────────────────────────────────── */}
      {show("evaporation") && (
        <Section title="Evaporation System">
          <Field label="Number of Evaporator Effects" hint="Typical: 3–6">
            <NumberField min={1} value={cfg.ev_numEffects} onChange={(val) => set("ev_numEffects", Math.max(1, parseInt(val) || 1))} />
          </Field>
          <Field label="Flow Arrangement">
            <SelectField options={FLOW_ARRANGEMENT_OPTIONS} value={cfg.ev_flowArrangement} onChange={(v) => set("ev_flowArrangement", v)} />
          </Field>
          <Field label="Is there fresh steam consumption for the 1st Effect?">
            <YesNoToggle value={cfg.ev_firstEffectFreshSteam} onChange={(v) => set("ev_firstEffectFreshSteam", v)} />
          </Field>
          <Field label="Energy Source for 1st Effect">
            <SelectField options={firstEffectSourceOptions} value={cfg.ev_firstEffectSource} onChange={(v) => set("ev_firstEffectSource", v)} />
          </Field>
          <Field label="Mechanical Vapour Recompression (MVR) Used?">
            <YesNoToggle value={cfg.ev_hasMVR} onChange={(v) => set("ev_hasMVR", v)} />
          </Field>
          {cfg.ev_hasMVR === "yes" && (
            <ConditionalReveal>
              <Field label="MVR on Which Effect?">
                <NumberField min={1} max={cfg.ev_numEffects} value={cfg.ev_mvrEffect} onChange={(val) => set("ev_mvrEffect", Math.max(1, parseInt(val) || 1))} />
              </Field>
            </ConditionalReveal>
          )}
          <Field label="Thermal Vapour Recompression (TVR) Used?">
            <YesNoToggle value={cfg.ev_hasTVR} onChange={(v) => set("ev_hasTVR", v)} />
          </Field>
          {cfg.ev_hasTVR === "yes" && (
            <ConditionalReveal>
              <Field label="TVR on Which Effect?">
                <NumberField min={1} max={cfg.ev_numEffects} value={cfg.ev_tvrEffect} onChange={(val) => set("ev_tvrEffect", Math.max(1, parseInt(val) || 1))} />
              </Field>
            </ConditionalReveal>
          )}
          <Field label="Condensate Flash Recovery Between Effects?">
            <YesNoToggle value={cfg.ev_condensateFlash} onChange={(v) => set("ev_condensateFlash", v)} />
          </Field>
        </Section>
      )}

      {/* ── Other Energy Sensitive Equipment ─────────────────────────────── */}
      {show("otherEquipment") && (
        <Section title="Other Energy Sensitive Equipment">
          <Field label="Is there any other energy sensitive equipment?">
            <YesNoToggle value={cfg.oe_hasOther} onChange={(v) => set("oe_hasOther", v)} />
          </Field>
          {cfg.oe_hasOther === "yes" && (
            <ConditionalReveal>
              <Field label="Number of other energy sensitive equipment">
                <NumberField
                  min={0}
                  value={cfg.oe_numEquipment}
                  onChange={(val) => {
                    const n = Math.max(0, parseInt(val) || 0);
                    set("oe_numEquipment", n);
                    set("oe_equipment", syncOeEquipment(n, cfg.oe_equipment));
                  }}
                />
              </Field>
              {oeItems.map((item, i) => (
                <DynamicListCard
                  key={i}
                  title={`Equipment ${i + 1}`}
                  onRemove={() => {
                    const updated = cfg.oe_equipment.filter((_, idx) => idx !== i);
                    set("oe_numEquipment", updated.length);
                    set("oe_equipment", updated);
                  }}
                >
                  <Field label="Equipment Name/Description">
                    <TextField value={item.oe_name} onChange={(v) => updateOeItem(i, "oe_name", v)} />
                  </Field>
                  <Field label="Equipment Type">
                    <SelectField options={OE_TYPE_OPTIONS} value={item.oe_type} onChange={(v) => updateOeItem(i, "oe_type", v)} />
                  </Field>
                  <Field label="Is there fresh steam consumption?">
                    <YesNoToggle value={item.oe_freshSteam} onChange={(v) => updateOeItem(i, "oe_freshSteam", v)} />
                  </Field>
                  <Field label="Heat Source">
                    <SelectField options={heatSourceOptions} value={item.oe_heatSource} onChange={(v) => updateOeItem(i, "oe_heatSource", v)} />
                  </Field>
                  {item.oe_heatSource === "Other" && (
                    <Field label="Specify Other Heat Source">
                      <TextField value={item.oe_heatSourceOther} onChange={(v) => updateOeItem(i, "oe_heatSourceOther", v)} />
                    </Field>
                  )}
                </DynamicListCard>
              ))}
            </ConditionalReveal>
          )}
        </Section>
      )}
    </div>
  );
}

// ── Direct steam injection row ───────────────────────────────────────────────

function DirectSteamRow({
  index,
  item,
  mediaOptions,
  onChange,
}: {
  index: number;
  item: DirectSteamInput;
  mediaOptions: string[];
  onChange: (field: keyof DirectSteamInput, value: string) => void;
}) {
  return (
    <DynamicListCard title={`Steam Point ${index + 1}`}>
      <Field label="Is there fresh steam consumption?">
        <YesNoToggle value={item.freshSteam} onChange={(v) => onChange("freshSteam", v)} />
      </Field>
      <Field label="Heating Media">
        <SelectField options={mediaOptions} value={item.mediaSource} onChange={(v) => onChange("mediaSource", v)} />
      </Field>
      {item.mediaSource === "Other" && (
        <Field label="Other Steam Label">
          <TextField value={item.otherLabel} onChange={(v) => onChange("otherLabel", v)} />
        </Field>
      )}
    </DynamicListCard>
  );
}
