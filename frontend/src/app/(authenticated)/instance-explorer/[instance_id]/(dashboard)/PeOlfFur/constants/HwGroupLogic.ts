import {
  FmsState, HwSection, HwSectionTemplate,
  ConvFields, TleFields, RadFields, RadCell,
  convEmptyFields, tleEmptyFields, radEmptyFields, radEmptyCell,
} from '../store/FmsAtoms';
import { cbIsComplete } from '../components/pages/hw/ConvEditor';
import { tleIsComplete } from '../components/pages/hw/TleEditor';

/* ──────────────────────────────────────────────────────────────────────────
   Hardware-template autofill from Basic Info — ported from Furnace_UI_V418.html
   (_hwComputeHomeGroups / _hwAutoInit*FromHomeGroups / _hwSync*FromHomeGroups).

   The basic-info "Copy Setup From" relationships ARE the template groups: one
   Conv/TLE + Radiation template is seeded per distinct group. Conv and TLE stay
   positionally paired; Radiation pre-fills cells/passes/tubes from the furnace's
   basic-info numbers. Re-running reconciles by `_rootFi`, preserving entered data.
────────────────────────────────────────────────────────────────────────────── */

// ── Shared pure pass-map helpers (also used by RadEditor) ──────────────────
export function rzTotalPasses(f: RadFields): number {
  return (f.cells || []).reduce((s, c) => s + (parseInt(c.passesPerCell) || 0), 0);
}

/** Auto-assign every still-null passMap slot to its cell, balancing groups 1/2.
 *  Mutates f.passMap. Mirrors RadEditor's prefill. */
export function rzAutoPrefill(f: RadFields) {
  const nc = parseInt(f.numCells) || 0;
  const total = rzTotalPasses(f);
  const cellPpc = f.cells.slice(0, nc).map(c => parseInt(c.passesPerCell) || 0);
  // Single-cell: auto-assign all passes to cell 0
  if (nc === 1) {
    for (let p = 0; p < total; p++) {
      if (!f.passMap[p]) {
        const gppc = Math.ceil(cellPpc[0] / 2);
        const g1used = f.passMap.slice(0, p).filter(m => m && m.cell === 0 && m.group === 1).length;
        f.passMap[p] = { cell: 0, group: g1used < gppc ? 1 : 2 };
      } else {
        (f.passMap[p] as { cell: number; group: number }).cell = 0;
      }
    }
    return;
  }
  let passIdx = 0;
  for (let c = 0; c < nc; c++) {
    const ppc = cellPpc[c];
    const gppc = Math.ceil(ppc / 2);
    let g1used = 0, g2used = 0;
    for (let p = 0; p < total; p++) {
      const m = f.passMap[p];
      if (m && m.cell === c) { if (m.group === 1) g1used++; if (m.group === 2) g2used++; }
    }
    for (let i = 0; i < ppc; i++) {
      const p = passIdx + i;
      if (p >= total) break;
      if (f.passMap[p] !== null) continue;  // already assigned
      const wantGrp = g1used < gppc ? 1 : 2;
      f.passMap[p] = { cell: c, group: wantGrp };
      if (wantGrp === 1) g1used++; else g2used++;
    }
    passIdx += ppc;
  }
}

// ── Grouping ────────────────────────────────────────────────────────────────
export interface HomeGroups {
  rootOf: number[];        // furnace idx → its group root idx
  orderedRoots: number[];  // distinct roots, in first-appearance order
  allSame: boolean;
}

export function computeHomeGroups(fms: FmsState): HomeGroups {
  const nF = fms.furnaceCount;
  const info = fms.furnaceInfo;
  const rootOf = Array.from({ length: nF }, (_, fi) => {
    const cf = info[fi]?.copyFrom;
    return (cf === null || cf === undefined) ? fi : cf;
  });
  const orderedRoots: number[] = [];
  const seen = new Set<number>();
  for (let fi = 0; fi < nF; fi++) {
    const r = rootOf[fi];
    if (!seen.has(r)) { seen.add(r); orderedRoots.push(r); }
  }
  const allSame = nF === 1 || fms.homeSameForAll || orderedRoots.length === 1;
  return { rootOf, orderedRoots, allSame };
}

// ── Radiation field pre-fill from one furnace's basic info ────────────────────
export function radFieldsFromFurnace(fms: FmsState, fi: number): RadFields {
  const info = fms.furnaceInfo[fi];
  const nc  = parseInt(info?.cells ?? '') || 0;
  const ppc = parseInt(info?.passPerCell ?? '') || 0;
  const tpp = parseInt(info?.tubesPerPass ?? '') || 0;

  const f = radEmptyFields();
  if (nc <= 0) return f;

  f.numCells = String(nc);
  f.identicalCells = nc > 1 ? true : null;   // >1 cells: default "all identical"; 1 cell: no question shown
  f.cells = Array.from({ length: nc }, (): RadCell => {
    const cell = radEmptyCell();
    cell.passesPerCell = ppc > 0 ? String(ppc) : '';
    cell.tubesPerPass  = tpp > 0 ? String(tpp) : '';
    return cell;
  });
  const total = rzTotalPasses(f);
  f.passMap = Array.from({ length: total }, () => null);
  // Auto-prefill pass→cell/group mapping only when passes/cell is a valid even count
  if (ppc > 0 && ppc % 2 === 0) rzAutoPrefill(f);
  return f;
}

// ── Per-section reconcilers ───────────────────────────────────────────────────

/** Structural completeness check for a Radiation template — mirrors the auto-save
 *  check in HardwareDefinePage (no duplicate check, just "is this fillable form done"). */
export function radStructuralComplete(f: RadFields): boolean {
  if (!f.numCells || parseInt(f.numCells) <= 0) return false;
  const n = parseInt(f.numCells);
  if (f.cells.length !== n) return false;
  if (!f.cells.every(c => c.passesPerCell && c.tubesPerPass)) return false;
  const totalPasses = f.cells.reduce((sum, c) => sum + (parseInt(c.passesPerCell) || 0), 0);
  if (f.passMap.length < totalPasses) return false;
  if (!f.passMap.slice(0, totalPasses).every(p => p !== null)) return false;
  return true;
}

// Recompute saved/defineDone from the actual field content rather than tracking
// "did the grouping change" — so reconciling templates after a Basic Info edit
// (furnace count, copy-from, etc.) never loses "Completed" for data that's still
// intact. Mirrors the auto-save completeness checks in HardwareDefinePage.
function finishConvTle(
  convTpls: HwSectionTemplate<ConvFields>[],
  tleTpls: HwSectionTemplate<TleFields>[],
): { convTpls: HwSectionTemplate<ConvFields>[]; tleTpls: HwSectionTemplate<TleFields>[]; done: boolean } {
  const completeAt = (i: number) => cbIsComplete(convTpls[i].fields) && tleIsComplete(tleTpls[i]?.fields ?? tleEmptyFields());
  const newConvTpls = convTpls.map((t, i) => ({ ...t, saved: completeAt(i) }));
  const newTleTpls  = tleTpls.map((t, i) => ({ ...t, saved: completeAt(i) }));
  return { convTpls: newConvTpls, tleTpls: newTleTpls, done: newConvTpls.every(t => t.saved) };
}

function finishRad(tpls: HwSectionTemplate<RadFields>[]): { tpls: HwSectionTemplate<RadFields>[]; done: boolean } {
  const newTpls = tpls.map(t => ({ ...t, saved: radStructuralComplete(t.fields) }));
  return { tpls: newTpls, done: newTpls.every(t => t.saved) };
}

/** Build Conv + paired TLE sections from home groups (init when empty, else sync). */
function syncConvTle(fms: FmsState, g: HomeGroups): { conv: HwSection<ConvFields>; tle: HwSection<TleFields> } {
  const conv = fms.hwConv;
  const tle  = fms.hwTle;
  const nF   = fms.furnaceCount;
  const { rootOf, orderedRoots, allSame } = g;

  const newConv = (root: number, num: number): HwSectionTemplate<ConvFields> =>
    ({ id: `conv-T${num}`, name: `Template ${num}`, _rootFi: root, fields: convEmptyFields(), saved: false });
  const newTle = (num: number): HwSectionTemplate<TleFields> =>
    ({ id: `tle-T${num}`, name: `Template ${num}`, fields: tleEmptyFields(), saved: false });

  // ── INIT (no templates yet) ────────────────────────────────────────────────
  if (conv.templates.length === 0) {
    if (allSame) {
      const rootFi = orderedRoots[0] ?? 0;
      const { convTpls, tleTpls, done } = finishConvTle([newConv(rootFi, 1)], [newTle(1)]);
      return {
        conv: { ...conv, templates: convTpls, applyMap: {}, sameForAll: 1, selectedIdx: 0, defineDone: done, applyDone: done },
        tle:  { ...tle,  templates: tleTpls,  applyMap: {}, sameForAll: 1, selectedIdx: 0, defineDone: done, applyDone: done },
      };
    }
    const convTpls: HwSectionTemplate<ConvFields>[] = [];
    const tleTpls: HwSectionTemplate<TleFields>[]  = [];
    const applyMap: Record<number, string> = {};
    orderedRoots.forEach((rootFi, ti) => {
      const tpl = newConv(rootFi, ti + 1);
      convTpls.push(tpl);
      tleTpls.push(newTle(ti + 1));
      for (let fi = 0; fi < nF; fi++) if (rootOf[fi] === rootFi) applyMap[fi] = tpl.id;
    });
    const fin = finishConvTle(convTpls, tleTpls);
    return {
      conv: { ...conv, templates: fin.convTpls, applyMap, sameForAll: 0, selectedIdx: 0, defineDone: fin.done, applyDone: fin.done },
      tle:  { ...tle,  templates: fin.tleTpls,  applyMap, sameForAll: 0, selectedIdx: 0, defineDone: fin.done, applyDone: fin.done },
    };
  }

  const existingByRoot = new Map<number, HwSectionTemplate<ConvFields>>();
  conv.templates.forEach(t => { if (t._rootFi !== undefined) existingByRoot.set(t._rootFi, t); });

  // ── SYNC, collapsed to a single template ───────────────────────────────────
  if (allSame) {
    const rootFi = orderedRoots[0] ?? 0;
    const keptConv = existingByRoot.get(rootFi) || conv.templates[0];
    const keptIdx  = conv.templates.indexOf(keptConv);
    const keptTle  = (keptIdx >= 0 && tle.templates[keptIdx]) ? tle.templates[keptIdx] : tle.templates[0];
    const fin = finishConvTle(
      [{ ...keptConv, id: 'conv-T1', _rootFi: rootFi }],
      [keptTle ? { ...keptTle, id: 'tle-T1' } : newTle(1)],
    );
    return {
      conv: { ...conv, templates: fin.convTpls, applyMap: {}, sameForAll: 1, selectedIdx: 0, defineDone: fin.done, applyDone: fin.done },
      tle:  { ...tle,  templates: fin.tleTpls,  applyMap: {}, sameForAll: 1, selectedIdx: 0, defineDone: fin.done, applyDone: fin.done },
    };
  }

  // ── SYNC, multiple groups ──────────────────────────────────────────────────
  const newConvTpls: HwSectionTemplate<ConvFields>[] = [];
  const newTleTpls: HwSectionTemplate<TleFields>[]  = [];
  const applyMap: Record<number, string> = {};
  orderedRoots.forEach((rootFi, ti) => {
    const tplId = `conv-T${ti + 1}`;
    const oldConv = existingByRoot.get(rootFi);
    const oldIdx  = oldConv ? conv.templates.indexOf(oldConv) : -1;
    newConvTpls.push(oldConv ? { ...oldConv, id: tplId, _rootFi: rootFi } : newConv(rootFi, ti + 1));
    const oldTle = oldIdx >= 0 ? tle.templates[oldIdx] : undefined;
    newTleTpls.push(oldTle ? { ...oldTle, id: `tle-T${ti + 1}` } : newTle(ti + 1));
    for (let fi = 0; fi < nF; fi++) if (rootOf[fi] === rootFi) applyMap[fi] = tplId;
  });

  const sel = Math.min(Math.max(conv.selectedIdx, 0), newConvTpls.length - 1);
  const fin = finishConvTle(newConvTpls, newTleTpls);
  return {
    conv: { ...conv, templates: fin.convTpls, applyMap, sameForAll: 0, selectedIdx: sel, defineDone: fin.done, applyDone: fin.done },
    tle:  { ...tle,  templates: fin.tleTpls,  applyMap, sameForAll: 0, selectedIdx: sel, defineDone: fin.done, applyDone: fin.done },
  };
}

/** Build the Radiation section from home groups (init when empty, else sync). */
function syncRad(fms: FmsState, g: HomeGroups): HwSection<RadFields> {
  const rad = fms.hwRad;
  const nF  = fms.furnaceCount;
  const { rootOf, orderedRoots, allSame } = g;

  const newRad = (rootFi: number, num: number): HwSectionTemplate<RadFields> =>
    ({ id: `rad-T${num}`, name: `Template ${num}`, _rootFi: rootFi, fields: radFieldsFromFurnace(fms, rootFi), saved: false });

  // ── INIT ───────────────────────────────────────────────────────────────────
  if (rad.templates.length === 0) {
    if (allSame) {
      const rootFi = orderedRoots[0] ?? 0;
      const fin = finishRad([newRad(rootFi, 1)]);
      return { ...rad, templates: fin.tpls, applyMap: {}, sameForAll: 1, selectedIdx: 0, defineDone: fin.done, applyDone: fin.done };
    }
    const tpls: HwSectionTemplate<RadFields>[] = [];
    const applyMap: Record<number, string> = {};
    orderedRoots.forEach((rootFi, ti) => {
      const tpl = newRad(rootFi, ti + 1);
      tpls.push(tpl);
      for (let fi = 0; fi < nF; fi++) if (rootOf[fi] === rootFi) applyMap[fi] = tpl.id;
    });
    const fin = finishRad(tpls);
    return { ...rad, templates: fin.tpls, applyMap, sameForAll: 0, selectedIdx: 0, defineDone: fin.done, applyDone: fin.done };
  }

  const existingByRoot = new Map<number, HwSectionTemplate<RadFields>>();
  rad.templates.forEach(t => { if (t._rootFi !== undefined) existingByRoot.set(t._rootFi, t); });

  // ── SYNC, collapsed ──────────────────────────────────────────────────────────
  if (allSame) {
    const rootFi = orderedRoots[0] ?? 0;
    const kept = existingByRoot.get(rootFi) || rad.templates[0];
    const fin = finishRad([{ ...kept, id: 'rad-T1', _rootFi: rootFi }]);
    return { ...rad, templates: fin.tpls, applyMap: {}, sameForAll: 1, selectedIdx: 0, defineDone: fin.done, applyDone: fin.done };
  }

  // ── SYNC, multiple groups ────────────────────────────────────────────────────
  const newTpls: HwSectionTemplate<RadFields>[] = [];
  const applyMap: Record<number, string> = {};
  orderedRoots.forEach((rootFi, ti) => {
    const tplId = `rad-T${ti + 1}`;
    const old = existingByRoot.get(rootFi);
    newTpls.push(old ? { ...old, id: tplId, _rootFi: rootFi } : newRad(rootFi, ti + 1));
    for (let fi = 0; fi < nF; fi++) if (rootOf[fi] === rootFi) applyMap[fi] = tplId;
  });

  const sel = Math.min(Math.max(rad.selectedIdx, 0), newTpls.length - 1);
  const fin = finishRad(newTpls);
  return { ...rad, templates: fin.tpls, applyMap, sameForAll: 0, selectedIdx: sel, defineDone: fin.done, applyDone: fin.done };
}

/** Single entry point: seed/reconcile Conv, TLE and Radiation from basic-info groups. */
export function syncHwTemplatesFromGroups(fms: FmsState): Pick<FmsState, 'hwConv' | 'hwTle' | 'hwRad'> {
  if (fms.furnaceCount <= 0) return { hwConv: fms.hwConv, hwTle: fms.hwTle, hwRad: fms.hwRad };
  const g = computeHomeGroups(fms);
  const { conv, tle } = syncConvTle(fms, g);
  return { hwConv: conv, hwTle: tle, hwRad: syncRad(fms, g) };
}
