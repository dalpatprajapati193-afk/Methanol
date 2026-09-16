'use client';
import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { TleFields, ConvFields, fmsStateAtom } from '../../../store/FmsAtoms';
import { TLE_PARAMS, TLE_PARAM_LABELS, TLE_SECTIONS_ORDER, TLE_SECTION_LABELS, bankDisplayCode } from '../../../constants/Components';
import { tleDroppedSections, tlePressTagOptions } from '../../../constants/TleLogic';
import SegYesNo from './SegYesNo';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import styles from '../../../Style.module.css';
import { TEXT, TABLE, FIELD } from '../../../theme/Index';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

interface Props {
  fields: TleFields;
  onChange: (f: TleFields) => void;
  convFields: ConvFields;
  disabled?: boolean;
}

// Active sections based on stle/ttle flags
function tleExistsMap(f: TleFields) {
  return {
    PTLE:             true,
    PTLE_STLE_PIPING: f.stle === 1,
    STLE:             f.stle === 1,
    STLE_TTLE_PIPING: f.stle === 1 && f.ttle === 1,
    TTLE:             f.stle === 1 && f.ttle === 1,
  };
}

// Derived propagated values (null = user-editable, non-null = computed/locked)
function tleDerived(f: TleFields): Record<string, Record<string, string | null>> {
  const d: Record<string, Record<string, string | null>> = {};
  const tc = f.tempCont === 1, pc = f.pressCont === 1;
  const mfc = f.massFlowConst === 1, mwc = f.moleWeightConst === 1;
  const p = f.sections['PTLE'] || {};
  const pi1 = f.sections['PTLE_STLE_PIPING'] || {};
  const s = f.sections['STLE'] || {};
  const pi2 = f.sections['STLE_TTLE_PIPING'] || {};

  d['PTLE'] = { INLET_TEMPERATURE:null, OUTLET_TEMPERATURE:null, MASS_FLOW:null, MOLE_WEIGHT:null, INLET_PRESSURE:null, OUTLET_PRESSURE:null };
  d['PTLE_STLE_PIPING'] = {
    INLET_TEMPERATURE : tc  ? (p.OUTLET_TEMPERATURE||'') : null,
    OUTLET_TEMPERATURE: tc  ? (p.OUTLET_TEMPERATURE||'') : null,
    MASS_FLOW         : mfc ? (p.MASS_FLOW||'')          : null,
    MOLE_WEIGHT       : mwc ? (p.MOLE_WEIGHT||'')         : null,
    INLET_PRESSURE    : pc  ? (p.OUTLET_PRESSURE||'')    : null,
    OUTLET_PRESSURE   : null,
  };
  d['STLE'] = {
    INLET_TEMPERATURE : tc  ? (p.OUTLET_TEMPERATURE||'')   : null,
    OUTLET_TEMPERATURE: null,
    MASS_FLOW         : mfc ? (p.MASS_FLOW||'')             : null,
    MOLE_WEIGHT       : mwc ? (p.MOLE_WEIGHT||'')            : null,
    INLET_PRESSURE    : pc  ? (pi1.OUTLET_PRESSURE||'')    : null,
    OUTLET_PRESSURE   : null,
  };
  d['STLE_TTLE_PIPING'] = {
    INLET_TEMPERATURE : tc  ? (s.OUTLET_TEMPERATURE||'')   : null,
    OUTLET_TEMPERATURE: tc  ? (s.OUTLET_TEMPERATURE||'')   : null,
    MASS_FLOW         : mfc ? (p.MASS_FLOW||'')             : null,
    MOLE_WEIGHT       : mwc ? (p.MOLE_WEIGHT||'')            : null,
    INLET_PRESSURE    : pc  ? (s.OUTLET_PRESSURE||'')      : null,
    OUTLET_PRESSURE   : null,
  };
  d['TTLE'] = {
    INLET_TEMPERATURE : tc  ? (s.OUTLET_TEMPERATURE||'')   : null,
    OUTLET_TEMPERATURE: null,
    MASS_FLOW         : mfc ? (p.MASS_FLOW||'')             : null,
    MOLE_WEIGHT       : mwc ? (p.MOLE_WEIGHT||'')            : null,
    INLET_PRESSURE    : pc  ? (pi2.OUTLET_PRESSURE||'')    : null,
    OUTLET_PRESSURE   : null,
  };
  return d;
}

// TLE UOM defaults + selectable options
const TLE_DEFAULT_UOM: Record<string, string> = {
  INLET_TEMPERATURE:'deg C', OUTLET_TEMPERATURE:'deg C',
  MASS_FLOW:'t/h', MOLE_WEIGHT:'g/gmol',
  INLET_PRESSURE:'barg', OUTLET_PRESSURE:'barg',
};
const TLE_PARAM_OPTS: Record<string, string[]> = {
  INLET_TEMPERATURE: ['deg C','deg F'],
  OUTLET_TEMPERATURE: ['deg C','deg F'],
  MASS_FLOW: ['kg/s','kg/h','t/h','t/s','lb/h','lb/s','MMlb/h'],
  MOLE_WEIGHT: ['g/gmol'],
  INLET_PRESSURE: ['barg','bar(a)','kPa','MPa','kg/cm2','psi'],
  OUTLET_PRESSURE: ['barg','bar(a)','kPa','MPa','kg/cm2','psi'],
};

// Cold-fluid option values (must match what ConvBankSvg reads)
const CF_BFW_SD   = 'BFW_STEAM_DRUM';
const CF_COLD_BFW = 'COLD_BFW';
const CF_HC_FEED  = 'HC_FEED';
const CF_LABELS: Record<string, string> = {
  [CF_BFW_SD]: 'BFW from Steam Drum',
  [CF_COLD_BFW]: 'Cold BFW',
  [CF_HC_FEED]: 'HC Feed',
};

const isPipingSec = (sec: string) => sec === 'PTLE_STLE_PIPING' || sec === 'STLE_TTLE_PIPING';

// Effective value: derived (locked) value wins over user-entered.
function effVal(f: TleFields, derived: ReturnType<typeof tleDerived>, sec: string, p: string): string {
  const dv = derived[sec]?.[p];
  return dv !== null && dv !== undefined ? dv : (f.sections[sec]?.[p] || '');
}

export function tleIsComplete(f: TleFields): boolean {
  if (f.stle === 0 && f.ttle === 0 && !f.designData) return true; // only PTLE, no design data needed
  if (!f.designData) return true;
  const exists = tleExistsMap(f);
  const derived = tleDerived(f);
  for (const sec of TLE_SECTIONS_ORDER) {
    if (!exists[sec as keyof typeof exists]) continue;
    const inT = effVal(f, derived, sec, 'INLET_TEMPERATURE');
    const outT = effVal(f, derived, sec, 'OUTLET_TEMPERATURE');
    // Non-piping: outlet temp must be strictly less than inlet
    if (!isPipingSec(sec) && inT !== '' && outT !== '') {
      const inV = parseFloat(inT), outV = parseFloat(outT);
      if (!isNaN(inV) && !isNaN(outV) && outV >= inV) return false;
    }
    // Pressure: inlet must be >= outlet
    const inP = effVal(f, derived, sec, 'INLET_PRESSURE');
    const outP = effVal(f, derived, sec, 'OUTLET_PRESSURE');
    if (inP !== '' && outP !== '') {
      const inPV = parseFloat(inP), outPV = parseFloat(outP);
      if (!isNaN(inPV) && !isNaN(outPV) && outPV > inPV) return false;
    }
    for (const p of TLE_PARAMS) {
      const val = effVal(f, derived, sec, p);
      if (val === '' || val === null || val === undefined) return false;
      const n = parseFloat(val);
      if (!isNaN(n) && n <= 0) return false;
    }
  }
  return true;
}

export default function TleEditor({ fields, onChange, convFields, disabled }: Props) {
  const exists = tleExistsMap(fields);
  const derived = tleDerived(fields);
  // V418 — sections dropped by the press-tag answer are removed from the table too
  const dropped = tleDroppedSections(fields);
  const activeSecs = TLE_SECTIONS_ORDER.filter(s => exists[s as keyof typeof exists] && !dropped.has(s));

  // Default UOM per parameter, pulled from the global UOM settings (falls back to constants)
  const globalUom = useAtomValue(fmsStateAtom).uom;
  const defaultUom = (p: string): string => {
    switch (p) {
      case 'INLET_TEMPERATURE':
      case 'OUTLET_TEMPERATURE': return globalUom.temperature || TLE_DEFAULT_UOM[p];
      case 'MASS_FLOW':          return globalUom.massFlow || TLE_DEFAULT_UOM[p];
      case 'INLET_PRESSURE':
      case 'OUTLET_PRESSURE':    return globalUom.pressure || TLE_DEFAULT_UOM[p];
      default:                   return TLE_DEFAULT_UOM[p] || '';
    }
  };

  // ── Convection-bank context (drives cold-fluid + orientation options) ──
  const cbAliases = convFields?.bankAliases || {};
  const cbBanks = convFields?.banks || [];
  // Dropdown labels: custom alias wins, else the display code (solo paired bank → "FPH").
  const alias = (code: string) => cbAliases[code] || bankDisplayCode(code, cbBanks);
  const hasEco1 = cbBanks.includes('ECO1');
  const hasEco2 = cbBanks.includes('ECO2');
  const hasFph1 = cbBanks.includes('FPH1');
  const hasFph2 = cbBanks.includes('FPH2');
  const bothFph = hasFph1 && hasFph2;
  const hcFeedAllowed = (hasFph1 || hasFph2) && !bothFph;

  // ── Reconcile stored cold fluid / orientation against the current bank config ──
  // The convection layout can change AFTER the TLE was configured (e.g. a second FPH is
  // added, making HC Feed invalid, or an ECO is removed, invalidating the parallel-ECO2
  // orientation). The dropdowns fall back to a valid label on display, but the STORED
  // value stayed stale — which left the SVG rendering the old routing (e.g. HC feed
  // through a "Cold BFW" TTLE) and the orientation cell showing "Not Applicable". Repair
  // the stored value so every consumer (diagram, orientation cell, export) stays in sync.
  useEffect(() => {
    const patch: Partial<TleFields> = {};
    if (!hcFeedAllowed) {
      if (fields.stle === 1 && fields.ttle !== 1 && fields.stleColdFluid === CF_HC_FEED) {
        patch.stleColdFluid = CF_BFW_SD; patch.stleOrientation = '';
      }
      if (fields.stle === 1 && fields.ttle === 1 && fields.ttleColdFluid === CF_HC_FEED) {
        patch.ttleColdFluid = CF_COLD_BFW; patch.ttleOrientation = hasEco1 ? 'SERIES_UPSTREAM_ECO1' : '';
      }
    }
    if (!(hasEco1 && hasEco2)) {
      if (fields.stleOrientation === 'SERIES_ECO2_PARALLEL_ECO1') patch.stleOrientation = 'SERIES_UPSTREAM_ECO1';
      if (fields.ttleOrientation === 'SERIES_ECO2_PARALLEL_ECO1') patch.ttleOrientation = 'SERIES_UPSTREAM_ECO1';
    }
    if (Object.keys(patch).length) onChange({ ...fields, ...patch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hcFeedAllowed, hasEco1, hasEco2, fields.stle, fields.ttle, fields.stleColdFluid, fields.ttleColdFluid, fields.stleOrientation, fields.ttleOrientation]);

  const coldFluidOptsStle = [
    CF_BFW_SD, CF_COLD_BFW,
    ...(hcFeedAllowed ? [CF_HC_FEED] : []),
  ];
  const coldFluidOptsTtle = [
    CF_COLD_BFW,
    ...(hcFeedAllowed ? [CF_HC_FEED] : []),
  ];

  // ── Setters (whole-object onChange) ──
  function setCtrl(key: keyof TleFields, val: number) {
    onChange({ ...fields, [key]: val });
  }
  function setExist(key: 'stle' | 'ttle', val: 0 | 1) {
    const patch: Partial<TleFields> = { [key]: val };
    if (key === 'stle' && val === 0) patch.ttle = 0;
    if (key === 'ttle' && val === 1) patch.stleColdFluid = CF_BFW_SD; // TTLE present → STLE cold fluid fixed
    patch.pressTagAt = 'DOWNSTREAM'; // V418 — reset press tag when TLE structure changes
    onChange({ ...fields, ...patch });
  }
  function setPressTag(val: string) {
    onChange({ ...fields, pressTagAt: val });
  }
  function setName(key: 'ptleName' | 'stleName' | 'ttleName', val: string) {
    onChange({ ...fields, [key]: val });
  }
  function setColdFluid(key: 'stleColdFluid' | 'ttleColdFluid', val: string) {
    const orientKey = key === 'stleColdFluid' ? 'stleOrientation' : 'ttleOrientation';
    const patch: Partial<TleFields> = { [key]: val };
    // Always persist a concrete, valid orientation (canonical bank code; the label shows
    // the alias) so the diagram renders on the FIRST selection. Two gaps made the SVG
    // need repeated reselections before the line appeared:
    //   • the single-ECO COLD_BFW cell renders a static label and never fires onChange, so
    //     the orientation stayed blank; and
    //   • switching cold fluids left a stale orientation from the previous fluid (e.g. an
    //     FPH value lingering after HC Feed → Cold BFW),
    // both of which ConvBankSvg's detection failed to match. Keep a current value only if
    // it's still valid for the new fluid; otherwise reset to that fluid's default.
    const fphCode = hasFph1 ? 'FPH1' : 'FPH2';
    let validOrients: string[] = [];
    let defOrient = '';
    if (val === CF_COLD_BFW) {
      validOrients = ['SERIES_UPSTREAM_ECO1', ...((hasEco1 && hasEco2) ? ['SERIES_ECO2_PARALLEL_ECO1'] : [])];
      defOrient = 'SERIES_UPSTREAM_ECO1';
    } else if (val === CF_HC_FEED) {
      validOrients = [`SERIES_UPSTREAM_${fphCode}`, `SERIES_DOWNSTREAM_${fphCode}`];
      defOrient = `SERIES_UPSTREAM_${fphCode}`;
    }
    // BFW_STEAM_DRUM (and any other) has no orientation → cleared to ''.
    if (!validOrients.includes(fields[orientKey] || '')) patch[orientKey] = defOrient;
    onChange({ ...fields, ...patch });
  }
  function setOrientation(key: 'stleOrientation' | 'ttleOrientation', val: string) {
    onChange({ ...fields, [key]: val });
  }
  function setParam(sec: string, param: string, val: string) {
    onChange({
      ...fields,
      sections: { ...fields.sections, [sec]: { ...fields.sections[sec], [param]: val } },
    });
  }
  function setUom(param: string, uom: string) {
    // Apply to every active section for this parameter (v411 tleUomChange)
    const sections = { ...fields.sections };
    for (const sec of TLE_SECTIONS_ORDER) {
      if (exists[sec as keyof typeof exists]) {
        sections[sec] = { ...sections[sec], [param + '_UOM']: uom };
      }
    }
    onChange({ ...fields, sections });
  }

  // ── Effective cold fluids (what's actually in effect, accounting for TTLE forcing) ──
  const stleColdFluidEff = fields.stle === 1 ? (fields.ttle === 1 ? CF_BFW_SD : (fields.stleColdFluid || CF_BFW_SD)) : null;
  const ttleColdFluidEff = (fields.stle === 1 && fields.ttle === 1) ? (fields.ttleColdFluid || CF_COLD_BFW) : null;

  // ── Cell-level validation (red border) ──
  function cellInvalid(sec: string, param: string): boolean {
    const raw = effVal(fields, derived, sec, param);
    if (raw === '' ) return false;
    const v = parseFloat(raw);
    if (!isNaN(v) && v <= 0) return true;
    if (param === 'OUTLET_TEMPERATURE' && !isPipingSec(sec)) {
      const inV = parseFloat(effVal(fields, derived, sec, 'INLET_TEMPERATURE'));
      if (!isNaN(inV) && !isNaN(v) && v >= inV) return true;
    }
    if (param === 'OUTLET_PRESSURE') {
      const inPV = parseFloat(effVal(fields, derived, sec, 'INLET_PRESSURE'));
      if (!isNaN(inPV) && !isNaN(v) && v > inPV) return true;
    }
    return false;
  }

  // ── Small UI helpers ──
  const SegYN = SegYesNo;

  const matrixCell = 'px-2.5 py-2 border-r border-b border-border flex items-center justify-center';
  const naDiv = <div className={cn(TEXT.annotation, 'text-center px-1.5 py-1')}>Not Applicable</div>;
  const dashDiv = <div className={cn(TEXT.annotation, FIELD.input, 'text-center py-1 opacity-40 cursor-default')}>—</div>;

  // Cold-fluid control for a column
  function coldFluidCtrl(col: 'PTLE' | 'STLE' | 'TTLE') {
    if (col === 'PTLE') {
      return <div className={cn(TEXT.annotation, FIELD.input, 'text-center py-1 cursor-default')}>BFW from Steam Drum</div>;
    }
    if (col === 'STLE') {
      if (fields.stle !== 1) return dashDiv;
      if (fields.ttle === 1) return <div className={cn(TEXT.annotation, FIELD.input, 'text-center py-1 cursor-default')}>BFW from Steam Drum</div>;
      return (
        <select value={fields.stleColdFluid || CF_BFW_SD} onChange={e => setColdFluid('stleColdFluid', e.target.value)}
          className={cn(TEXT.annotation, FIELD.input, 'w-full py-1 cursor-pointer')}>
          {coldFluidOptsStle.map(v => <option key={v} value={v}>{CF_LABELS[v]}</option>)}
        </select>
      );
    }
    // TTLE
    if (fields.stle !== 1 || fields.ttle !== 1) return dashDiv;
    return (
      <select value={fields.ttleColdFluid || CF_COLD_BFW} onChange={e => setColdFluid('ttleColdFluid', e.target.value)}
        className={cn(TEXT.annotation, FIELD.input, 'w-full py-1 cursor-pointer')}>
        {coldFluidOptsTtle.map(v => <option key={v} value={v}>{CF_LABELS[v]}</option>)}
      </select>
    );
  }

  // Orientation control for STLE / TTLE
  function orientationCtrl(key: 'stleOrientation' | 'ttleOrientation', coldFluid: string | null, active: boolean) {
    if (!active) return dashDiv;
    if (!coldFluid || coldFluid === CF_BFW_SD) return naDiv;
    const val = fields[key] || '';
    if (coldFluid === CF_COLD_BFW) {
      if (!hasEco1 && !hasEco2) return naDiv;
      const opts: { v: string; l: string }[] = [];
      if (hasEco1) opts.push({ v: 'SERIES_UPSTREAM_ECO1', l: `In series and upstream of ${alias('ECO1')}` });
      if (hasEco1 && hasEco2) opts.push({ v: 'SERIES_ECO2_PARALLEL_ECO1', l: `In series with ${alias('ECO2')} but in parallel with ${alias('ECO1')}` });
      if (opts.length === 1) return <div className={cn(TEXT.annotation, FIELD.input, 'text-center py-1 leading-tight cursor-default')}>{opts[0].l}</div>;
      return (
        <select value={val || opts[0].v} onChange={e => setOrientation(key, e.target.value)}
          className={cn(TEXT.annotation, FIELD.input, 'w-full py-1 cursor-pointer')}>
          {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      );
    }
    if (coldFluid === CF_HC_FEED) {
      if (!hcFeedAllowed) return naDiv;
      // V418 — value uses canonical bank code; label shows alias
      const fphCode = hasFph1 ? 'FPH1' : 'FPH2';
      const fphName = alias(fphCode);
      const opts = [
        { v: `SERIES_UPSTREAM_${fphCode}`,   l: `In series and upstream of ${fphName}` },
        { v: `SERIES_DOWNSTREAM_${fphCode}`, l: `In series and downstream of ${fphName}` },
      ];
      return (
        <select value={val || opts[0].v} onChange={e => setOrientation(key, e.target.value)}
          className={cn(TEXT.annotation, FIELD.input, 'w-full py-1 cursor-pointer')}>
          {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      );
    }
    return naDiv;
  }

  return (
    <div className="mt-4 relative">
      {disabled && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 cursor-not-allowed"
             title="Assign all banks including HTC 1 to unlock the TLE section">
          <span className={cn(TEXT.eyebrow, 'tracking-wide')}>Assign all banks (incl. HTC 1) to unlock</span>
        </div>
      )}
      <div className={clsx('flex flex-col gap-3', disabled && 'opacity-45 pointer-events-none')}>
        {/* ── 4-column matrix: row1 exists+name, row2 cold fluid, row3 orientation ── */}
        <div className={cn(TABLE.wrap, 'grid rounded')} style={{ gridTemplateColumns: '1.2fr 1fr 1fr 1fr' }}>
          {/* Row 1 — Which TLE exists + name + YES/NO */}
          <div className={clsx(matrixCell, cn(TEXT.eyebrow, TABLE.header, 'tracking-wide justify-start'))}>Which Transfer Line Exchanger Exists</div>
          {/* PTLE — always exists */}
          <div className={clsx(matrixCell, TABLE.row, 'flex-col gap-1.5')}>
            <input value={fields.ptleName} placeholder="PTLE" onChange={e => setName('ptleName', e.target.value)}
              className={cn(TEXT.annotation, 'w-full bg-transparent border-0 border-b border-border text-center text-text-primary uppercase tracking-wide outline-none focus:border-accent-blue')} />
            <SegYesNo value={1} locked />{/* PTLE always exists — auto-filled */}
          </div>
          {/* STLE */}
          <div className={clsx(matrixCell, TABLE.row, 'flex-col gap-1.5')}>
            <input value={fields.stleName} placeholder="STLE" disabled={fields.stle !== 1} onChange={e => setName('stleName', e.target.value)}
              className={cn(TEXT.annotation, 'w-full bg-transparent border-0 border-b border-border text-center uppercase tracking-wide outline-none focus:border-accent-blue', fields.stle === 1 ? 'text-text-primary' : 'text-text-secondary opacity-40')} />
            <SegYN value={fields.stle} onYes={() => setExist('stle',1)} onNo={() => setExist('stle',0)} />
          </div>
          {/* TTLE */}
          <div className={clsx(matrixCell, TABLE.row, 'flex-col gap-1.5 border-r-0', fields.stle !== 1 && 'opacity-40 pointer-events-none')}>
            <input value={fields.ttleName} placeholder="TTLE" disabled={fields.stle !== 1 || fields.ttle !== 1} onChange={e => setName('ttleName', e.target.value)}
              className={cn(TEXT.annotation, 'w-full bg-transparent border-0 border-b border-border text-center uppercase tracking-wide outline-none focus:border-accent-blue', (fields.stle === 1 && fields.ttle === 1) ? 'text-text-primary' : 'text-text-secondary opacity-40')} />
            <SegYN value={fields.ttle} onYes={() => setExist('ttle',1)} onNo={() => setExist('ttle',0)} disabled={fields.stle !== 1} />
          </div>

          {/* Row 2 — Cold fluid */}
          <div className={clsx(matrixCell, cn(TEXT.eyebrow, TABLE.header, 'tracking-wide justify-start'))}>What is the Cold Fluid</div>
          <div className={clsx(matrixCell, TABLE.row)}>{coldFluidCtrl('PTLE')}</div>
          <div className={clsx(matrixCell, TABLE.row)}>{coldFluidCtrl('STLE')}</div>
          <div className={clsx(matrixCell, TABLE.row, 'border-r-0')}>{coldFluidCtrl('TTLE')}</div>

          {/* Row 3 — Orientation */}
          <div className={clsx(matrixCell, cn(TEXT.eyebrow, TABLE.header, 'tracking-wide justify-start border-b-0'))}>Orientation with Convection Bank</div>
          <div className={clsx(matrixCell, TABLE.row, 'border-b-0')}>{naDiv}</div>
          <div className={clsx(matrixCell, TABLE.row, 'border-b-0')}>{orientationCtrl('stleOrientation', stleColdFluidEff, fields.stle === 1)}</div>
          <div className={clsx(matrixCell, TABLE.row, 'border-r-0 border-b-0')}>{orientationCtrl('ttleOrientation', ttleColdFluidEff, fields.stle === 1 && fields.ttle === 1)}</div>
        </div>

        {/* Design data checkbox */}
        <label className={cn(TEXT.annotation, 'flex items-start gap-2 cursor-pointer py-2 border-t border-border')}>
          <input type="checkbox" checked={fields.designData === 1} onChange={e => setCtrl('designData', e.target.checked ? 1 : 0)} className="mt-0.5 flex-shrink-0" />
          If coil outlet pressure tag is absent for the furnace where this template is intended, please fill design details
        </label>

        {/* V418 — Reference pressure tag location + continuity toggles, one line */}
        {fields.designData === 1 && (
          <div className="flex items-center gap-4 flex-wrap px-3 py-2 bg-surface border border-border rounded">
            <span className={cn(TEXT.annotation, 'flex-shrink-0')}>Where is the reference pressure tag available?</span>
            <select value={fields.pressTagAt || 'DOWNSTREAM'} onChange={e => setPressTag(e.target.value)}
              className={cn(TEXT.annotation, FIELD.input, 'bg-surface-hover px-2 py-1 cursor-pointer flex-shrink-0')}>
              {tlePressTagOptions(fields).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            {([['massFlowConst','Mass Flow Constant'],['moleWeightConst','Mole Weight Constant'],['tempCont','Temperature Continuity'],['pressCont','Pressure Continuity']] as const).map(([key,label]) => (
              <div key={key} className="flex items-center gap-2 flex-shrink-0">
                <span className={TEXT.annotation}>{label}</span>
                <SegYN value={(fields as unknown as Record<string,number>)[key] as 0|1} onYes={() => setCtrl(key as keyof TleFields, 1)} onNo={() => setCtrl(key as keyof TleFields, 0)} />
              </div>
            ))}
          </div>
        )}

        {/* Parameter grid */}
        {fields.designData === 1 && activeSecs.length > 0 && (
          <div className="overflow-x-auto mt-2 border-t border-border pt-3">
            <div className={cn(TABLE.wrap, 'rounded')} style={{ minWidth: 400 }}>
            <table className="w-full border-collapse">
              <thead>
                <tr className={TABLE.header}>
                  <th className={cn(TEXT.tableHeader, 'text-text-secondary text-center px-2 py-1 w-32')}>Parameter</th>
                  <th className={cn(TEXT.tableHeader, 'text-text-secondary text-center px-2 py-1 w-16')}>UOM</th>
                  {activeSecs.map(s => (
                    <th key={s} className={cn(TEXT.tableHeader, 'text-text-secondary text-center px-2 py-1 w-28')}>
                      {TLE_SECTION_LABELS[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={TABLE.divide}>
                {TLE_PARAMS.map((p) => {
                  const uom = fields.sections['PTLE']?.[p+'_UOM'] || defaultUom(p);
                  return (
                    <tr key={p} className={TABLE.row}>
                      <td className={cn(TEXT.tableRowLabel, 'text-left px-2 py-1.5')}>
                        {TLE_PARAM_LABELS[p]}
                      </td>
                      <td className="px-2 py-1 text-center">
                        <div className="inline-flex w-20 h-7 items-center justify-center">
                          {p === 'MOLE_WEIGHT' ? (
                            <span className={TEXT.annotation}>g/gmol</span>
                          ) : TLE_PARAM_OPTS[p] && TLE_PARAM_OPTS[p].length > 1 ? (
                            <select value={uom} onChange={e => setUom(p, e.target.value)}
                              className={cn(TEXT.annotation, FIELD.input, 'w-full h-full px-1 text-center cursor-pointer')}>
                              {TLE_PARAM_OPTS[p].map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <span className={TEXT.annotation}>{uom}</span>
                          )}
                        </div>
                      </td>
                      {activeSecs.map(s => {
                        const dv = derived[s]?.[p];
                        const isDerived = dv !== null && dv !== undefined;
                        const val = isDerived ? String(dv) : (fields.sections[s]?.[p] || '');
                        const invalid = !isDerived && cellInvalid(s, p);
                        return (
                          <td key={s} className="px-2 py-1 text-center">
                            {p === 'MOLE_WEIGHT' && !isDerived ? (
                              <input type="number" step="any" value={val} onChange={e => setParam(s, p, e.target.value)}
                                className={cn(TEXT.annotation, FIELD.input, 'w-full py-0.5 text-center', invalid ? 'border-accent-red text-accent-red' : 'text-text-primary')} />
                            ) : isDerived ? (
                              <input value={val} readOnly tabIndex={-1}
                                className={cn(TEXT.annotation, FIELD.input, 'w-full py-0.5 bg-surface-hover text-text-secondary text-center')} />
                            ) : (
                              <input type="number" step="any" value={val} onChange={e => setParam(s, p, e.target.value)}
                                className={cn(TEXT.annotation, FIELD.input, 'w-full py-0.5 text-center', invalid ? 'border-accent-red text-accent-red' : 'text-text-primary')} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
