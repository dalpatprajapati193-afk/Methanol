export const MASTER_COMPONENTS = [
  'Hydrogen','Methane','Ethane','Ethylene','Acetylene',
  'Propane','Propylene','MAPD','nButane','iButane',
  '1-Butene','2-Butene','Butadiene','Pentane','Isopentane',
  'Neopentane','1-Pentene','2-Pentene','Hydrogen Sulfide',
  'Carbonyl Sulfide','Benzene','Nitrogen','Oxygen','Argon',
  'Carbon Dioxide','Water','Paraffin','Olefin','Napthalene','Aromatics',
] as const;

export const FIXED_COMPONENTS = ['Nitrogen','Oxygen','Argon','Carbon Dioxide','Water'] as const;
export const FIXED_OFFSET = 5;

export const FUEL_MASTER_COMPONENTS = [
  'Hydrogen','Methane','Ethane','Ethylene','Propane','Propylene','Carbon Dioxide',
] as const;

export const FUEL_DEFAULT_COUNT = 4;

export const HEADER_COMPONENTS: Record<string, string[]> = {
  eth: ['Methane','Ethane','Ethylene','Propane'],
  pro: ['Ethane','Propane','Propylene','nButane'],
  but: ['nButane','iButane','Propane','1-Butene','Butadiene','Pentane'],
  nap: ['Paraffin','Olefin','Napthalene','Aromatics'],
};

export const FI_LICENSORS = ['KBR','Lummus','Technip','KTI'] as const;

export const CB_BANKS = [
  { code:'APH',    label:'Air Preheater',                    zone:'top' },
  { code:'FPH1',   label:'Feed Preheater 1',                 zone:'top' },
  { code:'FPH2',   label:'Feed Preheater 2',                 zone:'top' },
  { code:'ECO1',   label:'Boiler Feed Water Preheater 1',    zone:'top' },
  { code:'ECO2',   label:'Boiler Feed Water Preheater 2',    zone:'top' },
  { code:'HPSSH1', label:'High Pressure Steam Superheater 1',zone:'bot' },
  { code:'HPSSH2', label:'High Pressure Steam Superheater 2',zone:'bot' },
  { code:'HTC1',   label:'High Temperature Coil 1',          zone:'bot' },
  { code:'HTC2',   label:'High Temperature Coil 2',          zone:'bot' },
] as const;

// Display-only bank code. Variables / exports ALWAYS use the canonical code (FPH1/FPH2,
// ECO1/ECO2, HPSSH1/HPSSH2, HTC1/HTC2), but for DISPLAY a paired family with only ONE
// instance present drops its numeric suffix — a lone Feed Preheater shows as "FPH", not
// "FPH1" (the "1" only means something once an FPH2 also exists). APH, and any code with
// no trailing 1/2, is returned unchanged.
export function bankDisplayCode(code: string, banks: readonly string[] = []): string {
  if (!code) return code;
  const m = /^(.+?)([12])$/.exec(code);
  if (!m) return code;                       // e.g. APH — no numeric suffix to drop
  const prefix = m[1];
  const siblings = banks.filter(b => b && /^(.+?)[12]$/.exec(b)?.[1] === prefix).length;
  return siblings <= 1 ? prefix : code;
}

// The label to SHOW for a bank: a user-set custom alias wins; otherwise the display code
// above (so a solo paired bank reads "FPH", not "FPH1"). Never use this for variables.
export function bankLabel(code: string, banks: readonly string[] = [], aliases?: Record<string, string> | null): string {
  return (aliases && aliases[code]) || bankDisplayCode(code, banks);
}

export const CB_DRAFT_TYPES = ['Natural','Forced','Induced','Balanced'] as const;
export const CB_DRAFT_MAX: Record<string, number> = { Natural:8, Forced:9, Induced:8, Balanced:9 };

export const TLE_PARAMS = ['INLET_TEMPERATURE','OUTLET_TEMPERATURE','MASS_FLOW','MOLE_WEIGHT','INLET_PRESSURE','OUTLET_PRESSURE'] as const;
export const TLE_PARAM_LABELS: Record<string,string> = {
  INLET_TEMPERATURE:'Inlet Temperature', OUTLET_TEMPERATURE:'Outlet Temperature',
  MASS_FLOW:'Mass Flow', MOLE_WEIGHT:'Mole Weight',
  INLET_PRESSURE:'Inlet Pressure', OUTLET_PRESSURE:'Outlet Pressure',
};
export const TLE_SECTIONS_ORDER = ['PTLE','PTLE_STLE_PIPING','STLE','STLE_TTLE_PIPING','TTLE'] as const;
export const TLE_SECTION_LABELS: Record<string,string> = {
  PTLE:'PTLE', PTLE_STLE_PIPING:'PTLE → STLE Piping',
  STLE:'STLE', STLE_TTLE_PIPING:'STLE → TTLE Piping', TTLE:'TTLE',
};

export const COIL_TYPES = [
  'SRT I','SRT II','SRT III','SRT IV','SRT V','SRT VI','SRT VII',
  'SCORE','GK-1','GK-2','GK-2M','GK-3','GK-4','GK-5','GK6',
  'M Type','W Type','SMK','USC-U','USC-W','S Coil','Triple Lane',
  'PyroCrack','SC Coil','FFS Coil',
] as const;
