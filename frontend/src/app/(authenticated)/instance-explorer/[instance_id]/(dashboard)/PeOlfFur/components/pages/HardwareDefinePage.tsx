'use client';
import { useState, useRef, useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { fmsStateAtom, activePageAtom, confirmedFmsAtom, draftFmsAtom, HwSection, ConvFields, RadFields, TleFields, convEmptyFields, radEmptyFields, tleEmptyFields, FmsState } from '../../store/FmsAtoms';
import SvPanel from '../SvPanel';
import { usePanelRows } from '../usePanelRows';
import HwTemplateList from './hw/HwTemplateList';
import HwFurnaceBar from './hw/HwFurnaceBar';
import RadEditor from './hw/RadEditor';
import ConvEditor, { cbIsComplete } from './hw/ConvEditor';
import { tleIsComplete } from './hw/TleEditor';
import { radStructuralComplete } from '../../constants/HwGroupLogic';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import styles from '../../Style.module.css';
import { MODAL } from '../../theme/Index';
import { useFmsSave } from '../../constants/SaveState';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

const TLE_PARAMS = ['INLET_TEMPERATURE','OUTLET_TEMPERATURE','MASS_FLOW','MOLE_WEIGHT','INLET_PRESSURE','OUTLET_PRESSURE'];
const TLE_SECTIONS_ORDER = ['PTLE','PTLE_STLE_PIPING','STLE','STLE_TTLE_PIPING','TTLE'];

function tleExistsMap(f: TleFields) {
  return {
    PTLE: true,
    PTLE_STLE_PIPING: f.stle === 1,
    STLE: f.stle === 1,
    STLE_TTLE_PIPING: f.stle === 1 && f.ttle === 1,
    TTLE: f.stle === 1 && f.ttle === 1,
  };
}

function tleDerivedLocal(f: TleFields): Record<string, Record<string, string | null>> {
  const d: Record<string, Record<string, string | null>> = {};
  const tc = f.tempCont === 1, pc = f.pressCont === 1;
  const mfc = f.massFlowConst === 1, mwc = f.moleWeightConst === 1;
  const p = f.sections['PTLE'] || {}; const pi1 = f.sections['PTLE_STLE_PIPING'] || {};
  const s = f.sections['STLE'] || {};  const pi2 = f.sections['STLE_TTLE_PIPING'] || {};
  d['PTLE'] = { INLET_TEMPERATURE:null, OUTLET_TEMPERATURE:null, MASS_FLOW:null, MOLE_WEIGHT:null, INLET_PRESSURE:null, OUTLET_PRESSURE:null };
  d['PTLE_STLE_PIPING'] = { INLET_TEMPERATURE:tc?(p.OUTLET_TEMPERATURE||''):null, OUTLET_TEMPERATURE:tc?(p.OUTLET_TEMPERATURE||''):null, MASS_FLOW:mfc?(p.MASS_FLOW||''):null, MOLE_WEIGHT:mwc?(p.MOLE_WEIGHT||''):null, INLET_PRESSURE:pc?(p.OUTLET_PRESSURE||''):null, OUTLET_PRESSURE:null };
  d['STLE'] = { INLET_TEMPERATURE:tc?(p.OUTLET_TEMPERATURE||''):null, OUTLET_TEMPERATURE:null, MASS_FLOW:mfc?(p.MASS_FLOW||''):null, MOLE_WEIGHT:mwc?(p.MOLE_WEIGHT||''):null, INLET_PRESSURE:pc?(pi1.OUTLET_PRESSURE||''):null, OUTLET_PRESSURE:null };
  d['STLE_TTLE_PIPING'] = { INLET_TEMPERATURE:tc?(s.OUTLET_TEMPERATURE||''):null, OUTLET_TEMPERATURE:tc?(s.OUTLET_TEMPERATURE||''):null, MASS_FLOW:mfc?(p.MASS_FLOW||''):null, MOLE_WEIGHT:mwc?(p.MOLE_WEIGHT||''):null, INLET_PRESSURE:pc?(s.OUTLET_PRESSURE||''):null, OUTLET_PRESSURE:null };
  d['TTLE'] = { INLET_TEMPERATURE:tc?(s.OUTLET_TEMPERATURE||''):null, OUTLET_TEMPERATURE:null, MASS_FLOW:mfc?(p.MASS_FLOW||''):null, MOLE_WEIGHT:mwc?(p.MOLE_WEIGHT||''):null, INLET_PRESSURE:pc?(pi2.OUTLET_PRESSURE||''):null, OUTLET_PRESSURE:null };
  return d;
}

function cbComputeVars(fms: FmsState): Record<string, string | number> {
  const state = fms.hwConv;
  const vars: Record<string, string | number> = {};
  for (let fi = 0; fi < fms.furnaceCount; fi++) {
    let tpl = null;
    if (state.sameForAll === 1 || fms.furnaceCount === 1) { tpl = state.templates[0] || null; }
    else { const id = state.applyMap[fi]; tpl = id ? state.templates.find(t => t.id === id) || null : null; }
    const n = fi + 1;
    if (tpl && cbIsComplete(tpl.fields as ConvFields)) {
      const f = tpl.fields as ConvFields;
      const numBanks = parseInt(f.numBanks) || 0;
      vars[`Furnace_${n}_Convection_Draft_Type`] = f.draft || 'EMPTY';
      vars[`Furnace_${n}_Convection_Bank_Count`] = numBanks;
      for (let m = 1; m <= 9; m++) {
        const code = (f.banks[m-1] && f.banks[m-1] !== '') ? f.banks[m-1] : 'EMPTY';
        vars[`Furnace_${n}_Convection_Bank_${m}_Code`] = code;
        vars[`Furnace_${n}_Convection_Bank_${m}_Name`] = code === 'EMPTY' ? 'EMPTY' : ((f.bankAliases && f.bankAliases[code]) || code);
      }
      vars[`Furnace_${n}_Convection_Attemperator`] = f.attemperator || 0;
      vars[`Furnace_${n}_Convection_FPH_Series`]   = f.fphSeries !== undefined ? f.fphSeries : 1;
    } else {
      vars[`Furnace_${n}_Convection_Draft_Type`] = 'EMPTY';
      vars[`Furnace_${n}_Convection_Bank_Count`] = '—';
      for (let m = 1; m <= 9; m++) {
        vars[`Furnace_${n}_Convection_Bank_${m}_Code`] = 'EMPTY';
        vars[`Furnace_${n}_Convection_Bank_${m}_Name`] = 'EMPTY';
      }
      vars[`Furnace_${n}_Convection_Attemperator`] = 0;
      vars[`Furnace_${n}_Convection_FPH_Series`]   = 1;
    }
  }
  return vars;
}

function tleComputeVars(fms: FmsState): Record<string, string | number> {
  const state = fms.hwTle;
  const convState = fms.hwConv;
  const vars: Record<string, string | number> = {};
  for (let fi = 0; fi < fms.furnaceCount; fi++) {
    let tpl = null;
    if (convState.sameForAll === 1 || fms.furnaceCount === 1) { tpl = state.templates[0] || null; }
    else {
      const convTplId = convState.applyMap[fi];
      const convIdx = convTplId ? convState.templates.findIndex(t => t.id === convTplId) : -1;
      tpl = convIdx >= 0 ? (state.templates[convIdx] || null) : null;
    }
    const n = fi + 1;
    if (!tpl) continue;
    const f = tpl.fields as TleFields;
    const exists = tleExistsMap(f);
    const derived = tleDerivedLocal(f);
    vars[`Furnace_${n}_MASS_FLOW_CONSTANT`]       = f.massFlowConst;
    vars[`Furnace_${n}_MOLE_WEIGHT_CONSTANT`]     = f.moleWeightConst;
    vars[`Furnace_${n}_TEMPERATURE_CONTINUITY`]   = f.tempCont;
    vars[`Furnace_${n}_PRESSURE_CONTINUITY`]      = f.pressCont !== undefined ? f.pressCont : 1;
    vars[`Furnace_${n}_TLE_DESIGN_DATA_SELECTED`] = f.designData;
    vars[`Furnace_${n}_PTLE_EXISTS`] = 1;
    vars[`Furnace_${n}_STLE_EXISTS`] = f.stle === 1 ? 1 : 0;
    vars[`Furnace_${n}_TTLE_EXISTS`] = (f.stle === 1 && f.ttle === 1) ? 1 : 0;
    vars[`Furnace_${n}_PTLE_NAME`] = f.ptleName || 'PTLE';
    vars[`Furnace_${n}_STLE_NAME`] = f.stleName || 'STLE';
    vars[`Furnace_${n}_TTLE_NAME`] = f.ttleName || 'TTLE';
    vars[`Furnace_${n}_PTLE_COLD_FLUID`] = 'BFW_STEAM_DRUM';
    vars[`Furnace_${n}_STLE_COLD_FLUID`] = f.stle===1 ? (f.ttle===1 ? 'BFW_STEAM_DRUM' : (f.stleColdFluid||'BFW_STEAM_DRUM')) : 'EMPTY';
    vars[`Furnace_${n}_TTLE_COLD_FLUID`] = (f.stle===1&&f.ttle===1) ? (f.ttleColdFluid||'COLD_BFW') : 'EMPTY';
    vars[`Furnace_${n}_PTLE_ORIENTATION`] = 'N/A';
    {
      const stleCf = vars[`Furnace_${n}_STLE_COLD_FLUID`];
      if (stleCf==='EMPTY') vars[`Furnace_${n}_STLE_ORIENTATION`] = 'EMPTY';
      else if (stleCf==='BFW_STEAM_DRUM') vars[`Furnace_${n}_STLE_ORIENTATION`] = 'N/A';
      else {
        const convTpl = (convState.sameForAll===1||fms.furnaceCount===1) ? convState.templates[0] : (() => { const cid=convState.applyMap[fi]; return cid?convState.templates.find(t2=>t2.id===cid):undefined; })();
        const cbBanks = (convTpl?.fields as ConvFields)?.banks || [];
        const hasEco1=cbBanks.includes('ECO1'), hasEco2=cbBanks.includes('ECO2');
        if (!hasEco1&&!hasEco2) vars[`Furnace_${n}_STLE_ORIENTATION`]='N/A';
        // Canonical code, not alias — orientation is stored/compared canonically everywhere.
        else vars[`Furnace_${n}_STLE_ORIENTATION`]=f.stleOrientation||'SERIES_UPSTREAM_ECO1';
      }
    }
    {
      const ttleCf = vars[`Furnace_${n}_TTLE_COLD_FLUID`];
      if (ttleCf==='EMPTY') vars[`Furnace_${n}_TTLE_ORIENTATION`] = 'EMPTY';
      else if (ttleCf==='BFW_STEAM_DRUM') vars[`Furnace_${n}_TTLE_ORIENTATION`] = 'N/A';
      else {
        const convTpl = (convState.sameForAll===1||fms.furnaceCount===1) ? convState.templates[0] : (() => { const cid=convState.applyMap[fi]; return cid?convState.templates.find(t2=>t2.id===cid):undefined; })();
        const cbBanks = (convTpl?.fields as ConvFields)?.banks || [];
        const hasEco1=cbBanks.includes('ECO1'), hasEco2=cbBanks.includes('ECO2');
        if (!hasEco1&&!hasEco2) vars[`Furnace_${n}_TTLE_ORIENTATION`]='N/A';
        // Canonical code, not alias — orientation is stored/compared canonically everywhere.
        else vars[`Furnace_${n}_TTLE_ORIENTATION`]=f.ttleOrientation||'SERIES_UPSTREAM_ECO1';
      }
    }
    for (const sec of TLE_SECTIONS_ORDER) {
      const secExists = exists[sec as keyof typeof exists];
      if (!secExists || !f.designData) {
        for (const p of TLE_PARAMS) { vars[`Furnace_${n}_${sec}_${p}`] = 0; vars[`Furnace_${n}_${sec}_${p}_UOM`] = 'EMPTY'; }
        continue;
      }
      const d = derived[sec]; const sd = f.sections[sec] || {};
      for (const p of TLE_PARAMS) {
        const dv = d?.[p]; const isDerived = dv !== null && dv !== undefined;
        const val = isDerived ? (dv !== '' ? dv! : 0) : (sd[p] !== '' ? sd[p] : 0);
        vars[`Furnace_${n}_${sec}_${p}`] = val || 0;
        vars[`Furnace_${n}_${sec}_${p}_UOM`] = sd[p+'_UOM'] || 'EMPTY';
      }
    }
  }
  return vars;
}

function rzTotalPassesFn(f: RadFields): number {
  return (f.cells||[]).reduce((s,c)=>s+(parseInt(c.passesPerCell)||0),0);
}

function rzIsCompleteFn(tpl: {fields: RadFields; saved: boolean}, allTpls: {fields: RadFields; saved: boolean}[]): boolean {
  if (!tpl.saved) return false;
  const f = tpl.fields as RadFields;
  const nc = parseInt(f.numCells);
  if (isNaN(nc)||nc<=0||!f.cells||f.cells.length!==nc) return false;
  for (let c=0;c<nc;c++){
    const cell=f.cells[c];
    if(!cell) return false;
    const hearthOn=cell.hearthExists===true,wallOn=cell.wallExists===true;
    if(!hearthOn&&!wallOn) return false;
    if(hearthOn){const hb=parseInt(cell.hearthBurnerCount);if(isNaN(hb)||hb<1)return false;}
    if(wallOn){const wb=parseInt(cell.wallBurnerCount);if(isNaN(wb)||wb<1)return false;}
    const ppc=parseInt(cell.passesPerCell),tp=parseInt(cell.tubesPerPass);
    if(isNaN(ppc)||ppc<=0||ppc%2!==0||isNaN(tp)||tp<=0)return false;
  }
  const total=rzTotalPassesFn(f);
  if(f.passMap.length<total)return false;
  for(let c=0;c<nc;c++){
    const ppc=parseInt(f.cells[c].passesPerCell)||0;
    const cellPasses=f.passMap.slice(0,total).filter(pm=>pm&&pm.cell===c);
    if(cellPasses.length!==ppc)return false;
    const g1=cellPasses.filter(pm=>pm!.group===1).length;
    const g2=cellPasses.filter(pm=>pm!.group===2).length;
    if(g1!==Math.ceil(ppc/2)||g2!==Math.floor(ppc/2))return false;
  }
  return true;
}

function rzComputeVars(fms: FmsState): Record<string, string | number> {
  const state = fms.hwRad;
  const vars: Record<string, string | number> = {};
  const defMfUom = fms.uom?.massFlow || 't/h';
  for (let fi=0;fi<fms.furnaceCount;fi++){
    let tpl: typeof state.templates[0] | null = null;
    if(state.sameForAll===1||fms.furnaceCount===1){tpl=state.templates[0]||null;}
    else{const id=state.applyMap[fi];tpl=id?state.templates.find(t=>t.id===id)||null:null;}
    const n=fi+1;
    if(tpl && rzIsCompleteFn(tpl as {fields:RadFields;saved:boolean}, state.templates as {fields:RadFields;saved:boolean}[])){
      const f=tpl.fields as RadFields;
      const nc=parseInt(f.numCells);
      const total=rzTotalPassesFn(f);
      vars[`Furnace_${n}_Cell_Count`]=nc;
      vars[`Furnace_${n}_Pass_Count`]=total;
      let totalTubes=0,totalHearth=0,totalWall=0;
      for(let c=0;c<nc;c++){
        const cell=f.cells[c];
        const ppc=parseInt(cell.passesPerCell)||0;
        const tp=parseInt(cell.tubesPerPass)||0;
        const hb=cell.hearthExists===true?(parseInt(cell.hearthBurnerCount)||0):0;
        const wb=cell.wallExists===true?(parseInt(cell.wallBurnerCount)||0):0;
        vars[`Furnace_${n}_Cell_${c+1}_Hearth_Burner_Exists`]=cell.hearthExists===true?1:0;
        vars[`Furnace_${n}_Cell_${c+1}_Hearth_Burners_Count`]=hb;
        vars[`Furnace_${n}_Cell_${c+1}_Hearth_Burner_Type`]=cell.hearthExists===true?(cell.hearthBurnerType||'Conventional'):'Conventional';
        vars[`Furnace_${n}_Cell_${c+1}_Hearth_FGR_Percent`]=cell.hearthExists===true&&(cell.hearthBurnerType==='Low NOx'||cell.hearthBurnerType==='Ultra Low NOx')?(cell.hearthFgrPercent||0):0;
        vars[`Furnace_${n}_Cell_${c+1}_Wall_Burner_Exists`]=cell.wallExists===true?1:0;
        vars[`Furnace_${n}_Cell_${c+1}_Wall_Burners_Count`]=wb;
        vars[`Furnace_${n}_Cell_${c+1}_Wall_Burner_Type`]=cell.wallExists===true?(cell.wallBurnerType||'Conventional'):'Conventional';
        vars[`Furnace_${n}_Cell_${c+1}_Wall_FGR_Percent`]=cell.wallExists===true&&(cell.wallBurnerType==='Low NOx'||cell.wallBurnerType==='Ultra Low NOx')?(cell.wallFgrPercent||0):0;
        const bothBurnersOn=cell.hearthExists===true&&cell.wallExists===true;
        vars[`Furnace_${n}_Cell_${c+1}_Burner_Design_Same`]=bothBurnersOn?(cell.burnerDesignSame===true?1:0):0;
        vars[`Furnace_${n}_Cell_${c+1}_Separate_Flow_Tag`]=(bothBurnersOn&&cell.burnerDesignSame===false)?(cell.separateFlowTag===true?1:0):0;
        vars[`Furnace_${n}_Cell_${c+1}_Wall_Design_Flow_Rate`]=parseFloat(cell.wallDesignFlowRate)||0;
        vars[`Furnace_${n}_Cell_${c+1}_Wall_Design_Flow_Rate_Uom`]=cell.wallDesignFlowRateUom||defMfUom;
        vars[`Furnace_${n}_Cell_${c+1}_Hearth_Design_Flow_Rate`]=parseFloat(cell.hearthDesignFlowRate)||0;
        vars[`Furnace_${n}_Cell_${c+1}_Hearth_Design_Flow_Rate_Uom`]=cell.hearthDesignFlowRateUom||defMfUom;
        vars[`Furnace_${n}_Cell_${c+1}_Pass_Count`]=ppc;
        vars[`Furnace_${n}_Cell_${c+1}_Tubes_Per_Pass_Count`]=tp;
        vars[`Furnace_${n}_Cell_${c+1}_Tube_Orientation`]=cell.tubeOrientation||'—';
        vars[`Furnace_${n}_Cell_${c+1}_Flow_Entry`]=cell.flowEntry||'top';
        vars[`Furnace_${n}_Cell_${c+1}_Feed_Type`]=cell.feedType||'control_valve';
        const orient=cell.tubeOrientation||'';
        let cellExitTubes=tp,adiaExitTubes=0;
        if(orient&&tp>0){
          const hasAMid=orient.includes('-A-'),hasAEnd=!hasAMid&&orient.endsWith('-A');
          const cellPart=hasAEnd?orient.slice(0,-2):hasAMid?orient.split('-A-')[0]:orient;
          const cnums=cellPart.split('-').map(Number);
          cellExitTubes=Math.round(tp*cnums[cnums.length-1]/cnums[0]);
          if(hasAMid)adiaExitTubes=Math.round(cellExitTubes/cnums[cnums.length-1]);
          else if(hasAEnd)adiaExitTubes=cellExitTubes;
        }
        vars[`Furnace_${n}_Cell_${c+1}_Cell_Exit_Tubes_Per_Pass`]=cellExitTubes;
        vars[`Furnace_${n}_Cell_${c+1}_Adia_Exit_Tubes_Per_Pass`]=adiaExitTubes;
        const bends=cell.cellBends||[];
        const cpB2=(cell.tubeOrientation||'').includes('-A-')?(cell.tubeOrientation||'').split('-A-')[0]:(cell.tubeOrientation||'').endsWith('-A')?(cell.tubeOrientation||'').slice(0,-2):(cell.tubeOrientation||'1');
        const numsB=cpB2?cpB2.split('-').map(Number):[1];
        for(let bi=0;bi<numsB.length;bi++)vars[`Furnace_${n}_Cell_${c+1}_Bend_${bi+1}`]=bends[bi]||0;
        const cotAMV2=cell.cotAfterAdiaMerge||0;
        vars[`Furnace_${n}_Cell_${c+1}_COT_After_Adia_Merge`]=cotAMV2;
        const cotCount=(cotAMV2===1&&adiaExitTubes>0)?adiaExitTubes:cellExitTubes;
        vars[`Furnace_${n}_Cell_${c+1}_COT_Tube_Count`]=cotCount;
        const cotSensors=Array.isArray(cell.cotSensorTubes)?cell.cotSensorTubes:[];
        for(let ti=0;ti<cotCount;ti++)vars[`Furnace_${n}_Cell_${c+1}_COT_Tube_${ti+1}_Has_Sensor`]=cotSensors[ti]?1:0;
        vars[`Furnace_${n}_Cell_${c+1}_Name`]=(f.cellNames?.[c])||`Cell ${c+1}`;
        totalTubes+=ppc*tp; totalHearth+=hb; totalWall+=wb;
      }
      vars[`Furnace_${n}_Tube_Count`]=totalTubes;
      vars[`Furnace_${n}_Hearth_Burner_Count`]=totalHearth;
      vars[`Furnace_${n}_Wall_Count`]=totalWall;
      for(let p=0;p<total;p++){
        const pm=f.passMap[p]||{cell:null,group:null};
        const passCell=pm.cell!=null?pm.cell:-1,passGrp=pm.group||0;
        const passLabel=(f.passNames?.[p])||`Pass ${p+1}`;
        vars[`Furnace_${n}_Cell_${passCell+1}_Pass_${p+1}_Name`]=passLabel;
        for(let c=0;c<nc;c++){
          const belongs=passCell===c?1:0;
          vars[`Furnace_${n}_Cell_${c+1}_Pass_${p+1}_Exists`]=belongs;
          vars[`Furnace_${n}_Cell_${c+1}_Group_1_Pass_${p+1}_Exists`]=(belongs&&passGrp===1)?1:0;
          vars[`Furnace_${n}_Cell_${c+1}_Group_2_Pass_${p+1}_Exists`]=(belongs&&passGrp===2)?1:0;
        }
      }
    } else {
      vars[`Furnace_${n}_Cell_Count`]=0;
      vars[`Furnace_${n}_Pass_Count`]=0;
      vars[`Furnace_${n}_Tube_Count`]=0;
      vars[`Furnace_${n}_Hearth_Burner_Count`]=0;
      vars[`Furnace_${n}_Wall_Count`]=0;
    }
  }
  return vars;
}

function furnaceName(fms: { furnaceInfo: { name: string }[] }, fi: number) {
  const n = fms.furnaceInfo[fi]?.name?.trim();
  return n ? `Furnace ${n}` : `Furnace ${fi + 1}`;
}

export default function HardwareDefinePage() {
  const [fms, setFms] = useAtom(fmsStateAtom);
  const [, setActivePage] = useAtom(activePageAtom);
  // Confirmed / draft snapshots — drive the per-entry save-state indicator in
  // ConvEditor (compare each control's live value to these).
  const confirmedFms = useAtomValue(confirmedFmsAtom);
  const draftFms = useAtomValue(draftFmsAtom);
  // Indicator active whenever any snapshot exists (so a NEW template reads as all-
  // unsaved). `save` marks section-level controls (all-furnaces-same, furnace assign).
  const snapshotsActive = confirmedFms != null || draftFms != null;
  const save = useFmsSave();

  const sec = fms.hwCurSec;
  if (!sec) { setActivePage('hwcfg'); return null; }

  // Active feed headers, derived LIVE from the P&ID exists flags (same 6 feeds as v418's
  // getActiveFeeds) — fms.activeFeeds is only populated on import and goes stale, which
  // wrongly forced the FPH-series lock into its "single feed" branch.
  const liveActiveFeeds = (['eth_exists', 'pro_exists', 'but_exists', 'nap_exists', 'gen_fr_exists', 'gen_tf_exists'] as const)
    .filter(k => fms.pidVars[k] === 1)
    .map(k => ({ key: k }));

  const [keepPickerOpen, setKeepPickerOpen] = useState(false);

  const single = fms.furnaceCount === 1;
  const hwSec  = sec === 'conv' ? fms.hwConv as HwSection<ConvFields>
               :                  fms.hwRad  as HwSection<RadFields>;

  const sameForAll = hwSec.sameForAll === 1 || single;
  const selIdx     = hwSec.selectedIdx;
  const selTpl     = selIdx >= 0 && selIdx < hwSec.templates.length ? hwSec.templates[selIdx] : null;

  // Conv snapshot fields for the selected template (matched by id) — feed the
  // per-entry save-state indicator in ConvEditor. undefined until a snapshot exists.
  const confirmedConvFields = sec === 'conv' && selTpl
    ? (confirmedFms?.hwConv.templates.find(t => t.id === selTpl.id)?.fields as ConvFields | undefined)
    : undefined;
  const draftConvFields = sec === 'conv' && selTpl
    ? (draftFms?.hwConv.templates.find(t => t.id === selTpl.id)?.fields as ConvFields | undefined)
    : undefined;

  // Section-level save-state markers: the "All furnaces same?" toggle and each
  // furnace-assignment chip act as edits (compare to the draft/confirmed snapshot).
  const sameForAllCls = save(hwSec.sameForAll, f => (sec === 'conv' ? f.hwConv : f.hwRad).sameForAll);
  const assignCls = (fi: number) => save(hwSec.applyMap[fi], f => (sec === 'conv' ? f.hwConv : f.hwRad).applyMap[fi]);
  const nameCls = (i: number) => {
    const tpl = hwSec.templates[i];
    return tpl ? save(tpl.name, f => (sec === 'conv' ? f.hwConv : f.hwRad).templates.find(t => t.id === tpl.id)?.name) : '';
  };

  // Reset the editor scroll to the top whenever a different template (or section) is
  // selected, so the diagram is in view rather than wherever the previous template was
  // scrolled to (the scroll container lives here, outside the per-template ConvEditor).
  const editorScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { editorScrollRef.current?.scrollTo({ top: 0 }); }, [selIdx, sec]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function patchSec(patch: Partial<HwSection<any>>) {
    setFms(prev => {
      const s = { ...(sec==='conv'?prev.hwConv:prev.hwRad), ...patch };
      return {
        ...prev,
        hwConv: sec==='conv' ? s as HwSection<ConvFields> : prev.hwConv,
        hwRad:  sec==='rad'  ? s as HwSection<RadFields>  : prev.hwRad,
      };
    });
  }

  // ── Same-for-All: pick-which-to-keep logic ──────────────────────────────
  function applySameYes(keptIdx: number) {
    setKeepPickerOpen(false);
    setFms(prev => {
      const cur = sec === 'conv' ? prev.hwConv : prev.hwRad;
      const keptTpl = cur.templates[keptIdx];
      if (!keptTpl) return prev;
      const collapsed = { ...keptTpl, id: `${sec}-T1`, name: 'Template 1' };
      const next = { ...cur, templates: [collapsed], sameForAll: 1 as 0|1, applyMap: {}, applyDone: false, selectedIdx: 0 };
      // For conv: also collapse the paired TLE template
      const newTle = sec === 'conv'
        ? { ...prev.hwTle, templates: prev.hwTle.templates[keptIdx]
            ? [{ ...prev.hwTle.templates[keptIdx], id: 'tle-T1', name: 'Template 1' }]
            : prev.hwTle.templates.slice(0, 1) }
        : prev.hwTle;
      return {
        ...prev,
        hwConv: sec === 'conv' ? next as HwSection<ConvFields> : prev.hwConv,
        hwRad:  sec === 'rad'  ? next as HwSection<RadFields>  : prev.hwRad,
        hwTle: newTle,
      };
    });
  }

  function setSameForAllYes() {
    if (hwSec.templates.length <= 1) {
      applySameYes(0);
    } else {
      setKeepPickerOpen(true);
    }
  }

  // ── Radiation duplicate detection ────────────────────────────────────────
  function rzStructuralSignature(f: RadFields): string | null {
    const nc = parseInt(f.numCells);
    if (isNaN(nc) || nc <= 0 || !f.cells || f.cells.length !== nc) return null;
    const cellSigs = f.cells.map((c, ci) => {
      const ppc = parseInt(c.passesPerCell) || 0;
      const passes = f.passMap.filter(pm => pm && pm.cell === ci);
      const grpSeq = passes.map(pm => pm!.group || 0).join(',');
      return [
        c.hearthBurnerCount, c.wallBurnerCount, ppc,
        c.tubesPerPass, c.tubeOrientation || '',
        c.flowEntry || 'top',
        JSON.stringify(c.cellBends || []),
        grpSeq,
      ].join(';');
    });
    cellSigs.sort();
    return nc + '|' + cellSigs.join('|');
  }

  function rzHasDuplicate(f: RadFields, allTemplates: HwSection<RadFields>['templates'], selfIdx: number): boolean {
    const sig = rzStructuralSignature(f);
    if (!sig) return false;
    return allTemplates.some((t, i) => i !== selfIdx && t.saved && rzStructuralSignature(t.fields as RadFields) === sig);
  }

  function addTemplate() {
    const id = `${sec}-T${Date.now()}`;
    const emptyFields = sec==='conv' ? convEmptyFields() : radEmptyFields();
    const newTpl = { id, name: `Template ${hwSec.templates.length + 1}`, fields: emptyFields as never, saved: false };
    patchSec({ templates: [...hwSec.templates, newTpl], selectedIdx: hwSec.templates.length });
    // Sync TLE template when conv template is added
    if (sec === 'conv') {
      setFms(prev => {
        const tleId = `tle-T${Date.now()}`;
        const tleTpl = { id: tleId, name: `Template ${prev.hwTle.templates.length + 1}`, fields: tleEmptyFields(), saved: false };
        return { ...prev, hwTle: { ...prev.hwTle, templates: [...prev.hwTle.templates, tleTpl], selectedIdx: prev.hwTle.templates.length } };
      });
    }
  }

  function removeTemplate() {
    if (hwSec.templates.length <= 1) return;
    const idx = selIdx >= 0 ? selIdx : 0;
    const removedId = hwSec.templates[idx]?.id;
    // Keep names sequential ("Template 1", "Template 2", …) after removal.
    const tpls = hwSec.templates.filter((_, i) => i !== idx).map((t, i) => ({ ...t, name: `Template ${i + 1}` }));
    const newApplyMap = { ...hwSec.applyMap };
    if (removedId) Object.keys(newApplyMap).forEach(k => { if (newApplyMap[+k] === removedId) delete newApplyMap[+k]; });
    patchSec({ templates: tpls, selectedIdx: Math.min(idx, tpls.length - 1), applyMap: newApplyMap });
    // Conv: drop & renumber the paired TLE template at the same index.
    if (sec === 'conv') {
      setFms(prev => ({
        ...prev,
        hwTle: { ...prev.hwTle, templates: prev.hwTle.templates.filter((_, i) => i !== idx).map((t, i) => ({ ...t, name: `Template ${i + 1}` })) },
      }));
    }
  }

  function renameTemplate(idx: number, name: string) {
    const tpls = hwSec.templates.map((t, i) => i === idx ? { ...t, name } : t);
    patchSec({ templates: tpls });
  }

  function toggleFurnace(fi: number) {
    if (!selTpl) return;
    const curId = selTpl.id;
    const newMap = { ...hwSec.applyMap };
    if (newMap[fi] === curId) delete newMap[fi]; else newMap[fi] = curId;
    const allAssigned = Array.from({ length: fms.furnaceCount }, (_, i) => i).every(i => !!newMap[i]);
    const allTplUsed  = hwSec.templates.every(t => Object.values(newMap).includes(t.id));
    patchSec({ applyMap: newMap, applyDone: allAssigned && allTplUsed });
  }

  const furnaceNames = Array.from({ length: fms.furnaceCount }, (_, fi) => furnaceName(fms, fi));

  const hwPanelSection =
    sec === 'conv' ? ['Hardware › Convection', 'Hardware › TLE'] as string[] :
                     'Hardware › Radiation';
  const svRows = usePanelRows(hwPanelSection);

  // The "Assign setting…" bar is rendered inside the sticky header (with the pill tabs for
  // conv) so it stays pinned while content scrolls. HwFurnaceBar returns null when
  // same-for-all / single furnace, so the wrappers below collapse to nothing then.
  const furnaceBarEl = selTpl ? (
    <HwFurnaceBar
      furnaceCount={fms.furnaceCount}
      furnaceNames={furnaceNames}
      applyMap={hwSec.applyMap}
      currentTplId={selTpl.id}
      totalTemplates={hwSec.templates.length}
      onToggle={toggleFurnace}
      sameForAll={sameForAll}
      assignCls={assignCls}
    />
  ) : null;

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 bg-background">
      <SvPanel rows={svRows} />
      <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Template sidebar — "All furnaces same?" toggle now lives atop the repository */}
        <HwTemplateList
          templates={hwSec.templates}
          selectedIdx={selIdx}
          onSelect={i => patchSec({ selectedIdx: i })}
          onAdd={addTemplate}
          onRemove={removeTemplate}
          onRename={renameTemplate}
          sameForAll={sameForAll}
          furnaceCount={fms.furnaceCount}
          applyMap={hwSec.applyMap}
          isConv={sec === 'conv'}
          single={single}
          onSameForAll={val => (val === 1 ? setSameForAllYes() : patchSec({ sameForAll: 0 }))}
          sameForAllCls={sameForAllCls}
          nameCls={nameCls}
          seamlessSelect
        />

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {selTpl ? (
            // No top padding here: a sticky child with top-0 would otherwise leave a
            // pt-gap at the scrollport top through which scrolled content peeks. The
            // sticky header supplies its own top spacing (pt-4) instead.
            <div ref={editorScrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
              {/* Radiation zone editor */}
              {sec === 'rad' && (
                  <RadEditor
                    key={selTpl.id}
                    fields={selTpl.fields as RadFields}
                    defaultMassFlowUom={fms.uom?.massFlow || 't/h'}
                    furnaceBar={furnaceBarEl}
                    notice={selTpl.saved && rzHasDuplicate(selTpl.fields as RadFields, hwSec.templates as HwSection<RadFields>['templates'], selIdx) ? (
                      <div className={clsx(styles.mono, 'mb-3 px-3 py-2 text-[8px] text-accent-red bg-accent-red/15 border border-accent-red rounded')}>
                        ⚠ Duplicate — this template is structurally identical to another. Reassign passes differently.
                      </div>
                    ) : null}
                    onChange={radFields => {
                      // Auto-save: store the edit and mark this template saved when it is
                      // structurally valid; recompute defineDone (duplicate-aware) so the
                      // section completes without a manual Save click.
                      setFms(prev => {
                        const tpls = prev.hwRad.templates.map((t, i) =>
                          i === selIdx ? { ...t, fields: radFields, saved: radStructuralComplete(radFields) } : t);
                        const allComplete = tpls.every((t, i) => {
                          const f = t.fields as RadFields;
                          return radStructuralComplete(f)
                            && !rzHasDuplicate(f, tpls as HwSection<RadFields>['templates'], i);
                        });
                        return { ...prev, hwRad: { ...prev.hwRad, templates: tpls as HwSection<RadFields>['templates'], defineDone: allComplete } };
                      });
                    }}
                  />
              )}

              {/* Convection + TLE editor */}
              {sec === 'conv' && (
                <ConvEditor
                  key={selTpl.id}
                  fields={selTpl.fields as ConvFields}
                  confirmedFields={confirmedConvFields ?? null}
                  draftFields={draftConvFields ?? null}
                  snapshotsActive={snapshotsActive}
                  tleFields={(fms.hwTle.templates[selIdx]?.fields as TleFields) || tleEmptyFields()}
                  onChange={convFields => {
                    // Auto-save: store the edit and mark this conv template (and its paired
                    // TLE) saved when both are complete; recompute defineDone — no manual Save.
                    setFms(prev => {
                      const convTpls = prev.hwConv.templates.map((t, i) => {
                        const cf = i === selIdx ? convFields : (t.fields as ConvFields);
                        const tleF = prev.hwTle.templates[i]?.fields as TleFields | undefined;
                        const complete = cbIsComplete(cf) && (tleF ? tleIsComplete(tleF) : false);
                        return i === selIdx ? { ...t, fields: convFields, saved: complete } : { ...t, saved: complete };
                      });
                      const tleTpls = prev.hwTle.templates.map((t, i) => ({ ...t, saved: convTpls[i]?.saved ?? t.saved }));
                      const allComplete = convTpls.every(t => t.saved);
                      return {
                        ...prev,
                        hwConv: { ...prev.hwConv, templates: convTpls as HwSection<ConvFields>['templates'], defineDone: allComplete },
                        hwTle: { ...prev.hwTle, templates: tleTpls },
                      };
                    });
                  }}
                  onTleChange={tleFields => {
                    setFms(prev => {
                      const tleTpls = [...prev.hwTle.templates];
                      // Grow the array if the slot doesn't exist yet
                      while (tleTpls.length <= selIdx) {
                        const i = tleTpls.length;
                        tleTpls.push({ id: `tle-T${i + 1}`, name: `Template ${i + 1}`, fields: tleEmptyFields(), saved: false });
                      }
                      tleTpls[selIdx] = { ...tleTpls[selIdx], fields: tleFields };
                      // TLE completeness gates conv completeness — recompute saved/defineDone.
                      const convTpls = prev.hwConv.templates.map((t, i) => {
                        const cf = t.fields as ConvFields;
                        const tleF = tleTpls[i]?.fields as TleFields | undefined;
                        const complete = cbIsComplete(cf) && (tleF ? tleIsComplete(tleF) : false);
                        return { ...t, saved: complete };
                      });
                      const tleTpls2 = tleTpls.map((t, i) => ({ ...t, saved: convTpls[i]?.saved ?? t.saved }));
                      const allComplete = convTpls.every(t => t.saved);
                      return {
                        ...prev,
                        hwConv: { ...prev.hwConv, templates: convTpls as HwSection<ConvFields>['templates'], defineDone: allComplete },
                        hwTle: { ...prev.hwTle, templates: tleTpls2 },
                      };
                    });
                  }}
                  satDsgValue={fms.satVars['sat_dsg'] as 0|1|null}
                  activeFeeds={liveActiveFeeds}
                  mixedFeedOp={fms.mixedFeedOp}
                  furnaceBar={furnaceBarEl}
                />
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className={clsx(styles.mono, 'text-[10px] text-text-secondary text-center')}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 opacity-40">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/>
                </svg>
                Select a template to edit
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keep-picker modal — shown when switching to same-for-all with multiple templates */}
      {keepPickerOpen && (
        <div className={cn(MODAL.overlay, 'fixed inset-0 p-0')} onClick={() => setKeepPickerOpen(false)}>
          <div className={cn(MODAL.panel, 'p-6 gap-4 min-w-[300px]')} onClick={e => e.stopPropagation()}>
            <div className={clsx(styles.mono, 'text-[10px] text-text-primary uppercase tracking-widest')}>Select Template to Retain</div>
            <div className={clsx(styles.mono, 'text-[9px] text-text-secondary')}>All other templates will be deleted.</div>
            <div className="flex flex-col gap-2">
              {hwSec.templates.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => applySameYes(i)}
                  className={clsx(styles.mono, 'w-full text-left px-3 py-2 text-[9px] border border-border rounded hover:border-accent-blue hover:text-accent-blue hover:bg-surface-hover transition')}
                >
                  Keep <strong>{t.name}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
