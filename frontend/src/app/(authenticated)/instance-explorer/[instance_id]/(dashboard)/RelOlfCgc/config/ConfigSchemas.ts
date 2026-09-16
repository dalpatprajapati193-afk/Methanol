// ─── Zod schema for AfpWizardState — structural validation before the server
// action builds a workbook from it. Business-rule validation (required fields
// per step) lives in Validation.ts and runs client-side during the wizard;
// this schema just guards against a malformed/tampered payload.
//
// Every field below has a `.default()` matching its ConfigTypes.ts factory
// (newCasing/newTurbine/newMachineConfig/...) — this state has grown fields
// many times over this feature's life (uom/defaultUom, paramType, hasSideLoads,
// tripLimits, ...), and a draft/snapshot saved before any one of those existed
// must still parse instead of throwing and silently dropping the whole wizard
// back to blank (see ConfigWizard.tsx's loadInitialConfig error handling).

import { z } from "zod";

const StageEquipmentConfigSchema = z.object({
  equipment: z.array(z.string()).default([]),
  intercoolerCount: z.number().optional(),
  intercoolerLocation: z.string().optional(),
  kodCount: z.number().optional(),
  kodLocation: z.string().optional(),
  recycleSource: z.string().optional(),
  recycleDestination: z.string().optional(),
  refDesuperheaterCount: z.number().optional(),
  refCondenserCount: z.number().optional(),
  refAccumulatorCount: z.number().optional(),
});

const CasingSchema = z.object({
  name: z.string().default(""),
  stages: z.array(z.string()).default([]),
  internallyConnected: z.boolean().nullable().default(null),
  internalConnections: z.array(z.string()).default([]),
  suctionStreams: z.string().default(""),
  dischargeStreams: z.string().default(""),
  hasSideLoads: z.boolean().nullable().default(null),
  numSideStreams: z.string().default(""),
  sideLoads: z.array(z.object({ stage: z.string() })).default([]),
  subsystems: z.array(z.string()).default([]),
  dgsSupport: z.array(z.string()).default([]),
  deDgsComponents: z.array(z.string()).default([]),
  ndeDgsComponents: z.array(z.string()).default([]),
  bearings: z.array(z.string()).default([]),
  stageEquipment: z.record(z.string(), StageEquipmentConfigSchema).default({}),
});

const TurbineSchema = z.object({
  type: z.string().default(""),
  connectedCasingsOrdered: z.array(z.string()).default([]),
  connectedCasings: z.array(z.string()).default([]),
  auxiliarySystems: z.array(z.string()).default([]),
  scAuxSystems: z.array(z.string()).default([]),
  surfaceCondenserCount: z.union([z.number(), z.literal("")]).default(""),
  surfaceCondenserArrangement: z.string().default(""),
  surfaceCondenserPumpCount: z.union([z.number(), z.literal("")]).default(""),
  turbineCondMonitoring: z.array(z.string()).default([]),
});

const MachineConfigSchema = z.object({
  service: z.string().default(""),
  driverType: z.string().default(""),
  numCasings: z.union([z.number(), z.literal("")]).default(""),
  casings: z.array(CasingSchema).default([]),
  oilEquipment: z.array(z.string()).default([]),
  processTreatment: z.array(z.string()).default([]),
  causticConnection: z.string().default(""),
  numTurbines: z.union([z.number(), z.literal("")]).default(""),
  turbines: z.array(TurbineSchema).default([]),
});

const PlantOnlineTagSchema = z.object({
  piName: z.string().default(""),
  min: z.union([z.number(), z.literal("")]).default(""),
  max: z.union([z.number(), z.literal("")]).default(""),
});

const ModelConfigSchema = z.object({
  testStartDate: z.string().default(""),
  testEndDate: z.string().default(""),
  plantOnlineTags: z.array(PlantOnlineTagSchema).default([]),
});

const SensorRowSchema = z.object({
  templateId: z.string().default(""),
  defaultName: z.string().default(""),
  defaultUom: z.string().default(""),
  name: z.string().default(""),
  uom: z.string().default(""),
  // Drafts saved before paramType existed lack this key entirely — default
  // to "PI", matching every fresh-row generator elsewhere in the wizard.
  paramType: z.enum(["PI", "Constant"]).default("PI"),
});

const OemLimitRowSchema = z.object({
  templateId: z.string().default(""),
  parameter: z.string().default(""),
  // Backward-compatible defaults — drafts saved before uom/defaultUom
  // existed lack these keys; StepSensors.tsx/BuildWorkbook.ts backfill an
  // empty string to the current template's uom on next read.
  uom: z.string().default(""),
  defaultUom: z.string().default(""),
  designLow: z.union([z.number(), z.literal("")]).default(""),
  designHigh: z.union([z.number(), z.literal("")]).default(""),
  rated: z.union([z.number(), z.literal("")]).default(""),
});

const TripLimitRowSchema = z.object({
  templateId: z.string().default(""),
  parameter: z.string().default(""),
  uom: z.string().default(""),
  defaultUom: z.string().default(""),
  tripLimit: z.union([z.number(), z.literal("")]).default(""),
  // Backward-compatible defaults — drafts saved before these existed lack
  // these keys entirely.
  tripDirection: z.string().default(""),
  tripLimitBasis: z.string().default(""),
});

export const AfpWizardStateSchema = z.object({
  asset: z.literal("cracked_gas_compressor"),
  mc: MachineConfigSchema,
  modelConfig: ModelConfigSchema,
  models: z.record(z.string(), z.array(z.string())).default({}),
  sensors: z.record(z.string(), z.array(SensorRowSchema)).default({}),
  commonSensors: z.array(SensorRowSchema).default([]),
  oemLimits: z.record(z.string(), z.array(OemLimitRowSchema)).default({}),
  // Backward-compatible default — drafts saved before the Trip Limit tab
  // existed lack this key entirely.
  tripLimits: z.record(z.string(), z.array(TripLimitRowSchema)).default({}),
});
