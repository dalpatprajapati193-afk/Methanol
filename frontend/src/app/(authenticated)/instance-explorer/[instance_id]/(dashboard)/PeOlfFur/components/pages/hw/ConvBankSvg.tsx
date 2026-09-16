'use client';
import { useMemo } from 'react';
import { ConvFields, TleFields } from '../../../store/FmsAtoms';
import { bankDisplayCode } from '../../../constants/Components';

// Module-level counter for unique clip-path IDs
let _cbSvgCounter = 0;

// ── SVG palette — permanently theme-locked (never branches on light/dark). ──
// Mirrored 1:1 as --svg-* custom properties in globals.css for documentation;
// those CSS vars are NOT consumed here since the diagram is a static SVG string.
// See THEME.md "SVG / diagram zones".
const SVG_BG               = '#0d1117';
const SVG_PANEL_BG         = '#0f172a';
const SVG_PANEL_BORDER     = '#334155';
const SVG_HATCH            = '#3a4e5c';
const SVG_TEXT_MUTED       = '#6b7280';
const SVG_TEXT_LABEL       = '#8899aa';
const SVG_TEXT_DIM         = '#a8b0bd';
const SVG_TEXT_NAME        = '#cbd5e1';
const SVG_STREAM_AMBER     = '#f59e0b';
const SVG_STREAM_BANK      = '#d4a93a';
const SVG_STREAM_DIM       = '#2c3a4e';
const SVG_STREAM_FPH       = '#34c472';
const SVG_STREAM_HTC       = '#34c472';
const SVG_STREAM_ECO       = '#60a5fa';
const SVG_STREAM_APH       = '#7dd3fc';
const SVG_STREAM_STEAM     = '#a78bfa';
const SVG_STREAM_CRACKED_GAS = '#e57c3a';
const SVG_STREAM_FUEL      = '#ef4444';
const SVG_COMPOUND_BORDER  = '#94a3b8';

// Concrete colour replacements for CSS vars (dark theme)
const BG4  = SVG_PANEL_BG;
const BG   = SVG_BG;
const BD2  = SVG_PANEL_BORDER;

// ── Feed-mode overlay config (FFI "Feed Mode View" only) ─────────────────────
// Supplied by FeedFurnaceInteractionPage when a feed mode is selected. When null the
// SVG renders exactly as before — the Convection and TLE tiles never pass this, so
// their diagrams are unaffected. All stream LINE colours stay green (every feed/steam/
// air stream is the same green as fph_c), so the overlay only changes inlet LABELS,
// dims FPH banks the active stream doesn't route through, and shows a mode badge.
// A single feed-mode stream (steam / air / feed / DS) and the heating banks it routes
// through. `f1`/`f2` mirror the routing table's two heating-stage columns (FPH1/FPH2 or a
// TLE stage that maps onto the FPH1/FPH2 slot); `htc` is the always-merged HTC stage. The
// SVG derives each stream's ENTRY bank (first bank it occupies in flow order) and from the
// two entry banks decides the inlet picture: same bank ⇒ Y-fork; different banks ⇒ the
// later stream is an injection on the connector feeding its entry bank; an unrouted bank
// is dimmed. See the "Feed-mode overlay engine" below.
export interface ConvModeStream {
  label: string;
  f1: boolean;   // routes through FPH1 (upstream heating stage)
  f2: boolean;   // routes through FPH2 (downstream heating stage)
  htc: boolean;  // routes through HTC (all active streams have merged by HTC1)
  tle?: boolean; // routes through the HC-feed TLE stage (STLE/TTLE), when present
}

export interface ConvModeCfg {
  /** Label(s) for the stream(s) entering FPH1 / FPH2 (overrides the "HC feed" inlet text). */
  fphStreams: { label: string }[] | null;
  /** Label for the stream entering HTC directly (used when the template has no FPH banks). */
  htcStreams: { label: string }[] | null;
  /** Canonical bank codes (FPH1 / FPH2) to render dimmed — not routed in this mode. */
  dimBanks: string[] | null;
  /** Badge text shown at the top of the diagram, e.g. "DECOKE", "ETH + DS". */
  modeLabel: string;
  /** Badge accent colour. */
  tagColor: string;
  /** Up to two streams driving the fork / injection / dim overlay (null → label-only). */
  streams?: ConvModeStream[] | null;
}

interface Props {
  fields: ConvFields;
  tleFields: TleFields | null;
  numBanks: number;
  satDsgValue: 0 | 1 | null;
  modeCfg?: ConvModeCfg | null;
}

// ── Shared vertical-layout geometry ──────────────────────────────────────────
// Single source of truth for the SVG's vertical positions so the Step-3 form
// column (ConvEditor) can align its bank rows + attemperator/FPH boxes exactly to
// the SVG's bank boxes, bridgewall and radiation-zone. MUST match the constants
// used inside buildConvSvg below.
const CB_GEOM = { labelH: 18, arrowH: 14, boxH: 38, connH: 19, bottomPad: 110 };

export interface ConvBankLayout {
  bankCenters: number[];   // y-centre of each bank box
  bankStackBottom: number; // y of the last bank box's bottom edge
  boxH: number;            // height of a bank box (so form rows can match it)
  rzY: number;             // y of the radiation-zone box top
  rzCenterY: number;       // y-centre of the radiation-zone box
  bridgewallY: number;     // y-centre of the bridgewall hatch
  totalHeight: number;     // full SVG height (so the form column can match it)
}

export function convBankLayout(numBanks: number): ConvBankLayout {
  const { labelH, arrowH, boxH, connH, bottomPad } = CB_GEOM;
  const rzH = boxH;
  let y = labelH + arrowH;
  const bankCenters: number[] = [];
  for (let i = 0; i < numBanks; i++) {
    bankCenters.push(y + boxH / 2);
    y += boxH;
    if (i < numBanks - 1) y += connH;
  }
  const bankStackBottom = y;
  // Bridgewall gap = one bank box + two bank spacings, so the attemperator/FPH
  // question box fits centred in it with connH clearance above and below.
  const rzY = bankStackBottom + boxH + 2 * connH;
  const rzCenterY = rzY + rzH / 2;
  const lastBankBottom = (bankCenters[numBanks - 1] ?? labelH + arrowH) + boxH / 2;
  const bridgewallY = ((lastBankBottom + 2) + (rzY - 2)) / 2;
  const totalHeight = rzY + rzH + bottomPad;
  return { bankCenters, bankStackBottom, boxH, rzY, rzCenterY, bridgewallY, totalHeight };
}

export default function ConvBankSvg({ fields, tleFields, numBanks, satDsgValue, modeCfg = null }: Props) {
  const svgHtml = useMemo(
    () => buildConvSvg(fields, numBanks, tleFields, satDsgValue, modeCfg),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(fields), numBanks, JSON.stringify(tleFields), satDsgValue, JSON.stringify(modeCfg)]
  );
  if (!svgHtml) return null;
  return (
    <div
      // Theme-locked: this zone is always dark regardless of light/dark mode,
      // so the fill is the raw SVG_BG constant, never a theme token.
      style={{
        overflowX: 'auto', overflowY: 'hidden',
        backgroundColor: SVG_BG, border: `1px solid ${SVG_PANEL_BORDER}`,
        borderRadius: 6, padding: 12,
      }}
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Core SVG builder — ported from Furnace_UI_V411.html cbBankVisualHTML()
// ─────────────────────────────────────────────────────────────────────────────
function buildConvSvg(
  f: ConvFields,
  numBanks: number,
  tleFields: TleFields | null,
  satDsgValue: 0 | 1 | null,
  modeCfg: ConvModeCfg | null = null,
): string {
  if (numBanks < 1 || !f.banks) return '';

  // Feed-mode overlay (null for Convection/TLE tiles → no effect)
  const mc = modeCfg || null;
  const dimSet = new Set(mc?.dimBanks || []);

  // ── TLE info ──
  const tleTpl = tleFields || null;
  const ptleName = tleTpl ? (tleTpl.ptleName || 'PTLE') : 'PTLE';
  const stleName = tleTpl ? (tleTpl.stleName || 'STLE') : 'STLE';
  const ttleName = tleTpl ? (tleTpl.ttleName || 'TTLE') : 'TTLE';
  const hasStle  = tleTpl ? tleTpl.stle === 1 : false;
  const hasTtle  = tleTpl ? (tleTpl.stle === 1 && tleTpl.ttle === 1) : false;

  // ── Bank boolean flags ──
  const aliases   = f.bankAliases || {};
  // A solo paired bank displays without its "1" suffix (FPH, not FPH1); a custom alias
  // still wins. Variables/routing below keep matching the canonical codes (FPH1 etc.).
  function displayName(code: string): string { return aliases[code] || bankDisplayCode(code, f.banks) || '—'; }

  const hpssh1Idx = f.banks.indexOf('HPSSH1');
  const hpssh2Idx = f.banks.indexOf('HPSSH2');
  const eco1Idx   = f.banks.indexOf('ECO1');
  const eco2Idx   = f.banks.indexOf('ECO2');
  const fph1Idx   = f.banks.indexOf('FPH1');
  const fph2Idx   = f.banks.indexOf('FPH2');
  const htc1Idx   = f.banks.indexOf('HTC1');
  const htc2Idx   = f.banks.indexOf('HTC2');
  const aphIdx    = f.banks.indexOf('APH');

  const hasHPSSH1 = hpssh1Idx >= 0, hasHPSSH2 = hpssh2Idx >= 0;
  const bothHPSSH = hasHPSSH1 && hasHPSSH2;
  const hasECO1   = eco1Idx >= 0,   hasECO2   = eco2Idx >= 0;
  const bothECO   = hasECO1 && hasECO2;
  const hasFPH1   = fph1Idx >= 0,   hasFPH2   = fph2Idx >= 0;
  const bothFPH   = hasFPH1 && hasFPH2;
  // HC Feed is only a valid TLE cold fluid with exactly ONE FPH. With both (or zero) FPH
  // it must never route HC feed — guards against a stale HC_FEED value lingering after the
  // bank layout changed from one FPH to two (TleEditor reconciles the stored value too).
  const hcFeedAllowed = (hasFPH1 || hasFPH2) && !bothFPH;
  const hasHTC1   = htc1Idx >= 0,   hasHTC2   = htc2Idx >= 0;
  const hasAPH    = aphIdx >= 0;
  const fphSeries = (f.fphSeries !== undefined ? f.fphSeries : 1) === 1;
  const hasAtmp   = bothHPSSH && f.attemperator === 1;

  const hasDsg        = satDsgValue === 1;
  const fphInletText  = hasDsg ? 'HC feed / Dil. Steam' : 'HC feed';
  // Feed-mode inlet label overrides (fall back to the default "HC feed" text when absent).
  const fph1Label = mc?.fphStreams?.[0]?.label || fphInletText;
  const fph2Label = mc?.fphStreams?.[1]?.label || mc?.fphStreams?.[0]?.label || fphInletText;
  const htcInletLabel = mc?.htcStreams?.[0]?.label || mc?.fphStreams?.[0]?.label || null;

  // ── ECO / TLE special routing flags ──
  // Orientation values are stored as CANONICAL bank codes by TleEditor (the alias is
  // only used for the dropdown label), so they're matched against the canonical code
  // here — NOT the alias — or the routing silently fails the moment a bank is renamed
  // (e.g. ECO1 → "ECO01"). Mirrors Furnace_UI_V418.html.
  const parallelEco1Val = 'SERIES_ECO2_PARALLEL_ECO1';
  // COLD_BFW always routes into ECO1 — either "in series, upstream of ECO1" (the default)
  // or "in series with ECO2, parallel to ECO1" (only possible when both ECOs exist).
  // Treat anything that isn't the explicit parallel value as the upstream case, so the
  // diagram renders even when the stored orientation is blank (the single-ECO cell shows
  // a static label and never persists a value) or a stale leftover from a prior cold-fluid
  // choice. The "parallel" branch below stays an exact match.
  const stleColdBfwUpstreamEco1 = hasStle && !hasTtle && hasECO1 && !!tleTpl &&
    (tleTpl.stleColdFluid || 'BFW_STEAM_DRUM') === 'COLD_BFW' &&
    !(bothECO && tleTpl.stleOrientation === parallelEco1Val);
  const ttleColdBfwUpstreamEco1 = hasTtle && hasECO1 && !!tleTpl &&
    (tleTpl.ttleColdFluid || 'COLD_BFW') === 'COLD_BFW' &&
    !(bothECO && tleTpl.ttleOrientation === parallelEco1Val);
  const tleColdBfwUpstreamEco1 = !!(stleColdBfwUpstreamEco1 || ttleColdBfwUpstreamEco1);

  // Canonical code (see note above) — not alias-derived. Only "downstream" is matched
  // exactly; "upstream of FPH1" is the default, so HC Feed that isn't explicitly
  // downstream routes upstream — covering a blank/stale orientation too, mirroring the
  // COLD_BFW handling above so the diagram renders on the first selection.
  const dsDownFph1Val   = 'SERIES_DOWNSTREAM_FPH1';
  const hcFeedDownstreamFph1 = !!(hasFPH1 && hcFeedAllowed && tleTpl && (
    (hasStle && !hasTtle && tleTpl.stleColdFluid === 'HC_FEED' && tleTpl.stleOrientation === dsDownFph1Val) ||
    (hasTtle && tleTpl.ttleColdFluid === 'HC_FEED' && tleTpl.ttleOrientation === dsDownFph1Val)
  ));
  const hcFeedUpstreamFph1 = !!(hasFPH1 && hcFeedAllowed && tleTpl && !hcFeedDownstreamFph1 && (
    (hasStle && !hasTtle && tleTpl.stleColdFluid === 'HC_FEED') ||
    (hasTtle && tleTpl.ttleColdFluid === 'HC_FEED')
  ));

  const tleParallelEco1 = !!(bothECO && hasStle && tleTpl && (() => {
    if (hasTtle) return (tleTpl.ttleColdFluid || 'COLD_BFW') === 'COLD_BFW' && tleTpl.ttleOrientation === parallelEco1Val;
    return (tleTpl.stleColdFluid || 'BFW_STEAM_DRUM') === 'COLD_BFW' && tleTpl.stleOrientation === parallelEco1Val;
  })());

  const ttleHcFeedDownFph1 = !!(hasTtle && tleTpl && tleTpl.ttleColdFluid === 'HC_FEED' && tleTpl.ttleOrientation === dsDownFph1Val);
  // Upstream is the default — HC Feed on TTLE that isn't explicitly downstream is upstream.
  const ttleHcFeedUpFph1   = !!(hasTtle && tleTpl && tleTpl.ttleColdFluid === 'HC_FEED' && !ttleHcFeedDownFph1);

  // ── Flow direction ──
  const fphSeriesActive = bothFPH && fphSeries;
  const htc1EntersLeft  = !hasFPH1 || fphSeriesActive;

  // ── Lane constants ──
  const STUB_LEN       = 34;
  const STRIP_W        = 30;
  const X2             = STUB_LEN;
  const X3             = STUB_LEN + STRIP_W;
  const X4             = STUB_LEN + STRIP_W * 2;
  const X5             = STUB_LEN + STRIP_W * 3;
  const X6             = STUB_LEN + STRIP_W * 4;
  const X7             = STUB_LEN + STRIP_W * 5;
  const X_1_5          = X3;
  const X_2_5          = (X4 + X5) / 2;
  const X_3_5          = (X5 + X6) / 2;
  const X_4_5          = (X6 + X7) / 2;
  const R_LANES        = [X2, X4, X5, X6, X7];
  const L_LANES        = [X2, X4, X5, X6, X7];
  const HALF_LANES     = [
    { off: X_1_5, lo: X2, hi: X4 },
    { off: X_2_5, lo: X4, hi: X5 },
    { off: X_3_5, lo: X5, hi: X6 },
    { off: X_4_5, lo: X6, hi: X7 },
  ];
  const STUB_TEXT_REACH = X4;
  const TEXT_HALF       = 14;

  // ── Obstacle & lane segment state ──
  const rightObs:  { reach: number; yMid: number; half: number }[] = [];
  const leftObs:   { reach: number; yMid: number; half: number }[] = [];
  // ── The one model: every side occupant is rectangle(s) in (offset × y) ──────────
  // A lane occupant is described by two things in offset space (offset = distance
  // from the trunk; the lane line is at `off`):
  //   • a thin VERTICAL run at `off` spanning [yTop, yBot]  (the connector itself)
  //   • an optional solid BOX rectangle [off-innerE, off+outerE] × [boxYTop, boxYBot]
  //     covering its drawn body PLUS any attached stub/label (a box, e.g. attemperator)
  // Collisions (see _assignLane): box∩box and line∩box are forbidden (a box is solid —
  // un-crossable), while line∩line is allowed except on the same lane (two connectors
  // may simply cross). This single rule subsumes width, trapping and stub clearance.
  // A thin connector has innerE=outerE=0 and no box; boxYTop/boxYBot default to its span.
  type Seg = { off: number; innerE: number; outerE: number; yTop: number; yBot: number; boxYTop: number; boxYBot: number };
  const rightSegs: Seg[] = [];
  const leftSegs:  Seg[] = [];
  const laneRequests: { side: string; yTop: number; yBot: number; span: number; innerE: number; outerE: number; boxYTop: number; boxYBot: number; drawFn: (x: number) => void }[] = [];
  const LANE_GAP = 5;  // minimum clear gap (px) between adjacent lane footprints

  // Fixed solid equipment rectangles (absolute x/y) that NO lane may route through —
  // the far-side boxes a gutter lane can actually reach (steam drum, PTLE/STLE/TTLE).
  // Banks and the radiation zone sit at the trunk (x in [boxLeft, boxRight]) where no
  // side lane goes, AND connectors attach to them, so they are deliberately NOT listed
  // (listing them would falsely block every bank/RZ connection). Registered upfront,
  // before resolveAllLanes(), and honoured in _assignLane (vertical, box and legs).
  const solidRects: { x1: number; y1: number; x2: number; y2: number; label: string }[] = [];
  function addSolidRect(x: number, y: number, w: number, h: number, label: string) {
    solidRects.push({ x1: x, y1: y, x2: x + w, y2: y + h, label });
  }

  function addObsRight(reach: number, yMid: number, half?: number) { rightObs.push({ reach, yMid, half: half || TEXT_HALF }); }
  function addObsLeft (reach: number, yMid: number, half?: number) { leftObs .push({ reach, yMid, half: half || TEXT_HALF }); }

  // ── H-lane system ──
  const _hLanesR: { id: string; y: number }[] = [];
  const _hLanesL: { id: string; y: number }[] = [];
  function _addHLane(id: string, y: number) { _hLanesR.push({ id, y }); _hLanesL.push({ id, y }); }
  const _hOccR: Record<number, { xLeft: number; xRight: number }[]> = {};
  const _hOccL: Record<number, { xLeft: number; xRight: number }[]> = {};
  function _hKey(y: number) { return Math.round(y * 10); }
  function _hIsOccupied(occ: typeof _hOccR, y: number, xL: number, xR: number) {
    const segs = occ[_hKey(y)];
    if (!segs) return false;
    return segs.some(s => !(xR <= s.xLeft - 1 || xL >= s.xRight + 1));
  }
  function _hOccupy(occ: typeof _hOccR, y: number, xL: number, xR: number) {
    const k = _hKey(y);
    if (!occ[k]) occ[k] = [];
    occ[k].push({ xLeft: xL, xRight: xR });
  }
  function _hPreRegisterStub(side: 'R' | 'L', yMid: number, reach: number) {
    if (side === 'R') _hOccupy(_hOccR, yMid, boxRight, boxRight + reach);
    else              _hOccupy(_hOccL, yMid, boxLeft - reach, boxLeft);
  }

  // ── Layout constants ──
  const boxW    = 130, boxH = 38, connH = Math.round(boxH * 0.5), labelH = 18;
  const leftPad = 200, rightPad = 600;
  const totalW  = leftPad + boxW + rightPad;
  const arrowH  = 14;
  const am      = SVG_STREAM_AMBER;
  const bank_c  = SVG_STREAM_BANK;
  const dim     = SVG_STREAM_DIM;
  const fph_c   = SVG_STREAM_FPH;
  const htc_c   = SVG_STREAM_HTC;
  const eco_c   = SVG_STREAM_ECO;
  const aph_c   = SVG_STREAM_APH;
  const stm_c   = SVG_STREAM_STEAM;
  const cgCol   = SVG_STREAM_CRACKED_GAS;   // cracked gas (orange)
  const fuel_c  = SVG_STREAM_FUEL;   // fuel (red) — kept distinct from the orange cracked-gas stream
  // Neutral equipment-box styling. Deliberately NOT any stream colour (BFW, HC
  // feed, flue gas, fuel, steam, air…) so a box is never confused with the stream
  // that happens to flow through it. Shared by EVERY equipment box (banks, RZ,
  // steam drum, TLE) so border / fill / name text read uniformly across the tile.
  const compBd  = SVG_COMPOUND_BORDER;   // border
  const boxFill = BG4;         // interior fill (#0f172a)
  const boxName = SVG_TEXT_NAME;   // equipment-name text
  const r       = 5;

  const boxLeft  = leftPad;
  const boxRight = leftPad + boxW;

  // ── Vertical layout (shared with the Step-3 form column via convBankLayout) ──
  const { bankCenters: yMap, rzY, totalHeight: totalH } = convBankLayout(numBanks);
  const rzH    = boxH;
  const rzW    = boxW;
  const rzX    = leftPad;
  const ptleBoxH = boxH, ptleBoxW = 100;
  const cgExitYForAlign = (hasHTC1 || hasHTC2) ? (rzY + rzH * 2 / 3) : (rzY + rzH / 2);
  const ptleBoxY = cgExitYForAlign - ptleBoxH / 2;
  const ptleBoxX = boxRight + 180;
  const ptleBoxCX = ptleBoxX + ptleBoxW / 2;
  const tleGapConst = 20;
  const stleBoxX = ptleBoxX + ptleBoxW + tleGapConst;
  const ttleBoxX = stleBoxX + ptleBoxW + tleGapConst;
  const sdH      = boxH;
  const sdX      = ptleBoxX;
  const stleBfwSd = hasStle && tleTpl && ((tleTpl.ttle === 1) ? true : (tleTpl.stleColdFluid || 'BFW_STEAM_DRUM') === 'BFW_STEAM_DRUM');
  const sdW = stleBfwSd ? (ptleBoxW + tleGapConst + ptleBoxW) : ptleBoxW;

  // ── H-lane table ──
  for (let i = 0; i < numBanks; i++) {
    const cy = yMap[i];
    const tag = `B${i + 1}`;
    _addHLane(`HR${tag}T`, cy - boxH / 2);
    _addHLane(`HR${tag}M`, cy);
    _addHLane(`HR${tag}B`, cy + boxH / 2);
  }
  { const rzCy = rzY + rzH / 2; _addHLane('HRRZT', rzY); _addHLane('HRRZM', rzCy); _addHLane('HRRZB', rzY + rzH); }
  { const ptCy = ptleBoxY + ptleBoxH / 2; _addHLane('HRPTET', ptleBoxY); _addHLane('HRPTEM', ptCy); _addHLane('HRPTEB', ptleBoxY + ptleBoxH); }
  _hLanesR.sort((a, b) => a.y - b.y);
  _hLanesL.sort((a, b) => a.y - b.y);

  const _bankYRanges = yMap.map(cy => ({ top: cy - boxH / 2, bot: cy + boxH / 2 }));
  function _crossesBank(hy: number, xL: number, xR: number) {
    if (xR <= boxLeft || xL >= boxRight) return false;
    return _bankYRanges.some(b => hy >= b.top && hy <= b.bot);
  }
  function _resolveHLane(side: 'R' | 'L', xL: number, xR: number, preferredY: number) {
    const lanes = side === 'R' ? _hLanesR : _hLanesL;
    const occ   = side === 'R' ? _hOccR   : _hOccL;
    let bestIdx = 0, bestDist = Infinity;
    lanes.forEach((l, i) => { const d = Math.abs(l.y - preferredY); if (d < bestDist) { bestDist = d; bestIdx = i; } });
    for (let delta = 0; delta < lanes.length; delta++) {
      for (const sign of [0, 1, -1]) {
        if (delta === 0 && sign !== 0) continue;
        if (delta > 0 && sign === 0) continue;
        const idx = bestIdx + sign * delta;
        if (idx < 0 || idx >= lanes.length) continue;
        const l = lanes[idx];
        if (_crossesBank(l.y, xL, xR)) continue;
        if (!_hIsOccupied(occ, l.y, xL, xR)) { _hOccupy(occ, l.y, xL, xR); return l.y; }
      }
    }
    // Fallback: nearest non-bank-crossing lane even if occupied (overlap beats crossing a box)
    for (let delta = 0; delta < lanes.length; delta++) {
      for (const sign of [0, 1, -1]) {
        if (delta === 0 && sign !== 0) continue;
        if (delta > 0 && sign === 0) continue;
        const idx = bestIdx + sign * delta;
        if (idx < 0 || idx >= lanes.length) continue;
        const l = lanes[idx];
        if (!_crossesBank(l.y, xL, xR)) { _hOccupy(occ, l.y, xL, xR); return l.y; }
      }
    }
    _hOccupy(occ, preferredY, xL, xR);
    return preferredY;
  }
  // Jog state recorded by requestHLane, consumed by drawHJog (mirrors v411 requestHLane._lastJog)
  let _lastJog: { jogX: number; entryY: number; resolvedY: number; goingDown: boolean; side: 'R' | 'L' } | null = null;
  function requestHLane(side: 'R' | 'L', xLeft: number, xRight: number, entryX: number, entryY: number, drawFn: (y: number) => void) {
    const resolvedY = _resolveHLane(side, xLeft, xRight, entryY);
    if (Math.abs(resolvedY - entryY) > 0.5) {
      const jogTop = Math.min(entryY, resolvedY);
      const jogBot = Math.max(entryY, resolvedY);
      const jogOff = _assignLane(side, jogTop, jogBot);
      const jogX   = side === 'R' ? boxRight + jogOff : boxLeft - jogOff;
      _lastJog = { jogX, entryY, resolvedY, goingDown: resolvedY > entryY, side };
    } else {
      _lastJog = null;
    }
    drawFn(resolvedY);
  }
  // Draws the vertical transition entryY→resolvedY at jogX with rounded corners (v411 drawHJog).
  // Call at the START of a drawFn when _lastJog is set; caller draws the horizontal at resolvedY.
  function drawHJog(stroke: string, strokeWidth?: number, entryConnX?: number) {
    const j = _lastJog;
    if (!j) return;
    const { jogX, entryY, resolvedY, goingDown, side } = j;
    const rj = 4;
    const start = entryConnX ?? jogX;
    let d: string;
    if (side === 'R') {
      if (goingDown) {
        d = `M ${start} ${entryY} L ${jogX - rj} ${entryY} Q ${jogX} ${entryY} ${jogX} ${entryY + rj} L ${jogX} ${resolvedY - rj} Q ${jogX} ${resolvedY} ${jogX - rj} ${resolvedY}`;
      } else {
        d = `M ${start} ${entryY} L ${jogX - rj} ${entryY} Q ${jogX} ${entryY} ${jogX} ${entryY - rj} L ${jogX} ${resolvedY + rj} Q ${jogX} ${resolvedY} ${jogX - rj} ${resolvedY}`;
      }
    } else {
      if (goingDown) {
        d = `M ${start} ${entryY} L ${jogX + rj} ${entryY} Q ${jogX} ${entryY} ${jogX} ${entryY + rj} L ${jogX} ${resolvedY - rj} Q ${jogX} ${resolvedY} ${jogX + rj} ${resolvedY}`;
      } else {
        d = `M ${start} ${entryY} L ${jogX + rj} ${entryY} Q ${jogX} ${entryY} ${jogX} ${entryY - rj} L ${jogX} ${resolvedY + rj} Q ${jogX} ${resolvedY} ${jogX + rj} ${resolvedY}`;
      }
    }
    svg += `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth || 1.4}"/>`;
  }

  // ── Half-lane availability check ──
  function _halfLaneActive(obs: typeof rightObs, yLo: number, yHi: number, loNeighbour: number) {
    return !obs.some(o => o.reach > loNeighbour && yLo <= o.yMid + o.half && yHi >= o.yMid - o.half);
  }
  // 1-D interval overlap (with a clearance gap).
  const xOverlap = (aL: number, aR: number, bL: number, bR: number) => aL < bR + LANE_GAP && aR > bL - LANE_GAP;
  // y overlap (2px slack so near-touching ranges are treated as overlapping).
  const yOverlap = (aT: number, aB: number, bT: number, bB: number) => !(aB < bT - 2 || aT > bB + 2);
  // Place an occupant at the inner-most candidate offset where neither its box rect
  // nor its vertical line collides with any placed segment, per the one model above:
  // box∩box and line∩box are forbidden; line∩line only clashes on the same lane.
  function _assignLane(side: 'R' | 'L', yTop: number, yBot: number, innerE = 0, outerE = 0, boxYTop?: number, boxYBot?: number): number {
    const obs   = side === 'R' ? rightObs  : leftObs;
    const segs  = side === 'R' ? rightSegs : leftSegs;
    const slots = side === 'R' ? R_LANES   : L_LANES;
    const yLo   = Math.min(yTop, yBot), yHi = Math.max(yTop, yBot);
    const isBox = innerE > 0 || outerE > 0;
    const qbT = boxYTop ?? yLo, qbB = boxYBot ?? yHi;   // this occupant's box y-range
    const candidates: number[] = [];
    candidates.push(slots[0]);
    for (let i = 0; i < HALF_LANES.length; i++) {
      const hl = HALF_LANES[i];
      if (_halfLaneActive(obs, yLo, yHi, hl.lo)) candidates.push(hl.off);
      if (i + 1 < slots.length) candidates.push(slots[i + 1]);
    }
    const clashes = (off: number) => {
      const near = off - innerE;
      // Trunk obstacles occupy [0, reach]; the occupant's inner edge must clear them.
      if (obs.some(o => near < o.reach && yLo <= o.yMid + o.half && yHi >= o.yMid - o.half)) return true;
      for (const s of segs) {
        const sBox = s.innerE > 0 || s.outerE > 0;
        // box ∩ box — two solid rectangles may not overlap.
        if (isBox && sBox
          && xOverlap(off - innerE, off + outerE, s.off - s.innerE, s.off + s.outerE)
          && yOverlap(qbT, qbB, s.boxYTop, s.boxYBot)) return true;
        // this line ∩ placed box — a connector may not pass through a solid box.
        if (sBox && off > s.off - s.innerE - LANE_GAP && off < s.off + s.outerE + LANE_GAP
          && yOverlap(yLo, yHi, s.boxYTop, s.boxYBot)) return true;
        // this box ∩ placed line — a solid box may not swallow a connector lane.
        if (isBox && s.off > off - innerE - LANE_GAP && s.off < off + outerE + LANE_GAP
          && yOverlap(qbT, qbB, s.yTop, s.yBot)) return true;
        // this box ∩ placed connector's horizontal LEG — a connector turns at its
        // endpoint rows, where its feeder runs from the trunk (0 → s.off). If that
        // turn is inside the box's y-range, the leg slices through the box unless the
        // box sits OUTER of the connector's lane. (This is the leg the vertical test
        // above misses — a box must step outside any connector that turns within it.)
        if (isBox && !sBox
          && ((s.yTop > qbT + 1 && s.yTop < qbB - 1) || (s.yBot > qbT + 1 && s.yBot < qbB - 1))
          && (off - innerE) < s.off + LANE_GAP) return true;
        // line ∩ line — only a problem if they share the same lane (else they cross).
        if (Math.abs(off - s.off) < LANE_GAP && yOverlap(yLo, yHi, s.yTop, s.yBot)) return true;
      }
      // Fixed equipment rectangles (absolute coords): the occupant's vertical line, its
      // box footprint and its two feeder legs (trunk → lane, at yLo and yHi) must all
      // clear every solid box. Convert this candidate to absolute x for the test.
      if (solidRects.length) {
        const laneX = side === 'R' ? boxRight + off : boxLeft - off;
        const bxL = side === 'R' ? boxRight + off - innerE : boxLeft - off - outerE;
        const bxR = side === 'R' ? boxRight + off + outerE : boxLeft - off + innerE;
        const legL = side === 'R' ? boxRight : laneX, legR = side === 'R' ? laneX : boxLeft;
        const onRow = (r: { y1: number; y2: number }) =>
          (yLo > r.y1 - 2 && yLo < r.y2 + 2) || (yHi > r.y1 - 2 && yHi < r.y2 + 2);
        for (const r of solidRects) {
          if (laneX > r.x1 - LANE_GAP && laneX < r.x2 + LANE_GAP && yOverlap(yLo, yHi, r.y1, r.y2)) return true;   // vertical ∩ box
          if (isBox && bxL < r.x2 + LANE_GAP && bxR > r.x1 - LANE_GAP && yOverlap(qbT, qbB, r.y1, r.y2)) return true; // box ∩ box
          if (legL < r.x2 && legR > r.x1 && onRow(r)) return true;                                                    // leg ∩ box
        }
      }
      return false;
    };
    let chosen = slots[slots.length - 1];
    for (const off of candidates) { if (!clashes(off)) { chosen = off; break; } }
    segs.push({ off: chosen, innerE, outerE, yTop: yLo, yBot: yHi, boxYTop: qbT, boxYBot: qbB });
    return chosen;
  }
  // `footprint` declares the width a request's drawn content reserves around its lane
  // (innerE toward the trunk, outerE away from it). Box-drawing requests pass their
  // real extent so the resolver keeps neighbouring lanes clear and assigns them last
  // (widest are placed after thin ones), letting thin lines take inner lanes and
  // simply cross the box's feeders — a simple cross beats wrapping around the box.
  // `footprint` declares a box occupant's solid rectangle: how far its content reaches
  // toward the trunk (innerE) and away from it (outerE), and the actual y-range the box
  // body occupies (boxYTop/boxYBot — defaults to the connector span). Thin connectors
  // omit it. Width does not drive ordering; it only governs overlap in _assignLane.
  function requestLane(side: 'R' | 'L' | '_draw', yTop: number, yBot: number, drawFn: (x: number) => void, footprint?: { innerE?: number; outerE?: number; boxYTop?: number; boxYBot?: number }) {
    laneRequests.push({
      side, yTop, yBot, span: Math.abs(yBot - yTop),
      innerE: footprint?.innerE ?? 0, outerE: footprint?.outerE ?? 0,
      boxYTop: footprint?.boxYTop ?? Math.min(yTop, yBot), boxYBot: footprint?.boxYBot ?? Math.max(yTop, yBot),
      drawFn,
    });
  }
  function queueRightLane(yTop: number, yBot: number, drawFn: (x: number) => void) { requestLane('R', yTop, yBot, drawFn); }
  function queueLeftLane (yTop: number, yBot: number, drawFn: (x: number) => void) { requestLane('L', yTop, yBot, drawFn); }

  function resolveAllLanes() {
    const hooks = laneRequests.filter(q => q.side === '_draw');
    const reqs  = laneRequests.filter(q => q.side !== '_draw');
    // Assignment order encodes who must be inner of whom:
    //   rank 0 — connectors that TURN inside a box's y-range ("trapped"): they must be
    //            inner of that box (else the box would block their feeder leg), so they
    //            are placed first and grab the inner lanes.
    //   rank 1 — boxes: placed next, stepping OUTER of any trapped connector (leg rule
    //            in _assignLane) while still sitting inner of longer runs that merely
    //            span them.
    //   rank 2 — remaining connectors: placed last; a long run that only spans a box
    //            (its turns lie outside the box) goes OUTER of it, its legs clearing it.
    // Within a rank, smaller y-span takes the more-inner lane (nesting ⇒ fewer crossings).
    const boxReqs = reqs.filter(q => q.innerE + q.outerE > 0);
    const turnsInsideABox = (q: typeof reqs[number]) => boxReqs.some(b => b !== q
      && ((q.yTop > b.boxYTop + 1 && q.yTop < b.boxYBot - 1) || (q.yBot > b.boxYTop + 1 && q.yBot < b.boxYBot - 1)));
    const rank = (q: typeof reqs[number]) => (q.innerE + q.outerE > 0) ? 1 : (turnsInsideABox(q) ? 0 : 2);
    reqs.sort((a, b) => (rank(a) - rank(b)) || (a.span - b.span));
    const assigned = reqs.map(q => {
      const obsCountBeforeL = leftObs.length;
      const obsCountBeforeR = rightObs.length;
      const off = _assignLane(q.side as 'R' | 'L', q.yTop, q.yBot, q.innerE, q.outerE, q.boxYTop, q.boxYBot);
      q.drawFn(q.side === 'R' ? boxRight + off : boxLeft - off);
      return { q, off, obsCountBeforeL, obsCountBeforeR };
    });
    assigned.forEach(({ q, off, obsCountBeforeL, obsCountBeforeR }) => {
      const obs  = q.side === 'R' ? rightObs  : leftObs;
      const segs = q.side === 'R' ? rightSegs : leftSegs;
      const obsCountBefore = q.side === 'R' ? obsCountBeforeR : obsCountBeforeL;
      const yLo  = Math.min(q.yTop, q.yBot), yHi = Math.max(q.yTop, q.yBot);
      const nowClash = obs.slice(0, obsCountBefore).some(o => (off - q.innerE) < o.reach && yLo <= o.yMid + o.half && yHi >= o.yMid - o.half);
      if (nowClash) {
        const idx = segs.findIndex(s => s.off === off && s.yTop === yLo && s.yBot === yHi);
        if (idx >= 0) segs.splice(idx, 1);
        const newOff = _assignLane(q.side as 'R' | 'L', q.yTop, q.yBot, q.innerE, q.outerE, q.boxYTop, q.boxYBot);
        q.drawFn(q.side === 'R' ? boxRight + newOff : boxLeft - newOff);
      }
    });
    hooks.forEach(h => h.drawFn(0));
  }

  // ── Stub obstacle registration ──
  function stubRight(yMid: number, lineLen: number, _textAnchorOff: number, textStr: string | null) {
    const reach = textStr ? STUB_TEXT_REACH : lineLen;
    addObsRight(reach, yMid);
    _hPreRegisterStub('R', yMid, reach);
  }
  function stubLeft(yMid: number, lineLen: number, _textAnchorOff: number, textStr: string | null) {
    const reach = textStr ? STUB_TEXT_REACH : lineLen;
    addObsLeft(reach, yMid);
    _hPreRegisterStub('L', yMid, reach);
  }

  // ── Feed-mode overlay engine ────────────────────────────────────────────────
  // From the mode's ≤2 streams, decide the inlet picture for the FPH/HTC heating
  // chain. Each stream's ENTRY bank is the first present bank it routes through, in
  // flow order FPH1 → FPH2 → HTC1 (HTC2 never differs — everything has merged by
  // HTC1). The two entry banks then map to:
  //   • same bank                → a Y-FORK at that bank's inlet (both enter together)
  //   • different banks, series  → leading stream = normal inlet; trailing stream =
  //                                INJECTION on the connector feeding its entry bank
  //   • different banks, parallel→ FPH1/FPH2 are siblings (two real inlets); only a
  //                                stream entering HTC injects onto the live downcomer
  //   • a bank on no route       → dimmed (mc.dimBanks, set by the page)
  // Disabled for the bespoke TLE-stage geometry (HC feed up/downstream of FPH1),
  // which keeps the existing label-only behaviour.
  type MOInlet = { bank: 'FPH1' | 'FPH2' | 'HTC1'; side: 'L'; kind: 'single' | 'fork'; labels: string[] };
  type MOInj   = { feedBank: 'FPH2' | 'HTC1'; label: string };
  interface MO { occ: { FPH1: boolean; FPH2: boolean; HTC1: boolean }; inlets: MOInlet[]; inj: MOInj | null }
  function buildModeOverlay(): MO | null {
    const streams = mc?.streams;
    if (!streams || !streams.length) return null;
    if (!hasFPH1 && !hasFPH2 && !hasHTC1) return null;
    const occ = {
      FPH1: hasFPH1 && streams.some(s => s.f1),
      FPH2: hasFPH2 && streams.some(s => s.f2),
      HTC1: hasHTC1 && streams.some(s => s.htc),
    };
    const entryBank = (s: ConvModeStream): 'FPH1' | 'FPH2' | 'HTC1' | null =>
      (hasFPH1 && s.f1) ? 'FPH1' : (hasFPH2 && s.f2) ? 'FPH2' : hasHTC1 ? 'HTC1' : null;
    const enter: Record<'FPH1' | 'FPH2' | 'HTC1', string[]> = { FPH1: [], FPH2: [], HTC1: [] };
    for (const s of streams) { const e = entryBank(s); if (e) enter[e].push(s.label); }

    const seriesTopo = bothFPH && fphSeries;
    const inlets: MOInlet[] = [];
    let inj: MOInj | null = null;
    // FPH1 entry — always the head of a chain / a parallel head → a real inlet.
    if (enter.FPH1.length)
      inlets.push({ bank: 'FPH1', side: 'L', kind: enter.FPH1.length >= 2 ? 'fork' : 'single', labels: enter.FPH1 });
    // FPH2 entry — an injection only when it sits downstream of a live FPH1 in series;
    // otherwise (parallel sibling, or series with FPH1 dimmed) it is its own inlet.
    if (enter.FPH2.length) {
      if (seriesTopo && occ.FPH1) inj = { feedBank: 'FPH2', label: enter.FPH2[0] };
      else inlets.push({ bank: 'FPH2', side: 'L', kind: enter.FPH2.length >= 2 ? 'fork' : 'single', labels: enter.FPH2 });
    }
    // HTC1 entry — an injection when any FPH is live above it; else a real inlet
    // (both FPH dimmed, or a template with no FPH at all).
    if (enter.HTC1.length) {
      if (occ.FPH1 || occ.FPH2) inj = { feedBank: 'HTC1', label: enter.HTC1[0] };
      else inlets.push({ bank: 'HTC1', side: 'L', kind: enter.HTC1.length >= 2 ? 'fork' : 'single', labels: enter.HTC1 });
    }
    return { occ, inlets, inj };
  }
  // A single-FPH template whose HC feed runs through a TLE stage in series uses the
  // bespoke TLE geometry (HC feed up/downstream of FPH1). There the heating chain is
  // [TLE, FPH1, HTC1] (upstream) or [FPH1, TLE, HTC1] (downstream), handled by the TLE
  // overlay below; the plain FPH engine drives every other topology.
  const isTleStage = (hcFeedUpstreamFph1 || hcFeedDownstreamFph1) && hasFPH1;
  const mo: MO | null = !isTleStage ? buildModeOverlay() : null;

  // ── Feed-mode overlay engine (TLE stage) ─────────────────────────────────────
  type TleStageId = 'TLE' | 'FPH1' | 'HTC1';
  interface MOTle {
    up: boolean;
    occ: { TLE: boolean; FPH1: boolean; HTC1: boolean };
    entry: { stage: TleStageId; kind: 'single' | 'fork'; labels: string[] };
    inj: { onLeg: string; label: string } | null;   // onLeg = `${pred}>${stage}`
  }
  function buildTleOverlay(): MOTle | null {
    const streams = mc?.streams;
    if (!streams || !streams.length) return null;
    const up = hcFeedUpstreamFph1;
    const occOf = (id: TleStageId, s: ConvModeStream) =>
      id === 'TLE' ? !!s.tle : id === 'FPH1' ? (hasFPH1 && !!s.f1) : !!s.htc;
    const occ = {
      TLE:  streams.some(s => occOf('TLE', s)),
      FPH1: streams.some(s => occOf('FPH1', s)),
      HTC1: streams.some(s => occOf('HTC1', s)),
    };
    const order: TleStageId[] = up ? ['TLE', 'FPH1', 'HTC1'] : ['FPH1', 'TLE', 'HTC1'];
    const entryOf = (s: ConvModeStream): TleStageId => order.find(id => occOf(id, s)) ?? 'HTC1';
    const enter: Record<TleStageId, string[]> = { TLE: [], FPH1: [], HTC1: [] };
    for (const s of streams) enter[entryOf(s)].push(s.label);
    const leadStage = order.find(id => enter[id].length) ?? 'HTC1';
    const entry = { stage: leadStage, kind: (enter[leadStage].length >= 2 ? 'fork' : 'single') as 'single' | 'fork', labels: enter[leadStage] };
    let inj: { onLeg: string; label: string } | null = null;
    for (const id of order) {
      if (id === leadStage || !enter[id].length) continue;
      const idx = order.indexOf(id);
      inj = { onLeg: `${order[idx - 1]}>${id}`, label: enter[id][0] };
    }
    return { up, occ, entry, inj };
  }
  const moTle: MOTle | null = isTleStage ? buildTleOverlay() : null;
  // The HC-feed TLE box (STLE/TTLE) is dimmed when no stream routes through it (bypassed).
  const tleHcSrcBoxX = isTleStage
    ? (hcFeedUpstreamFph1
        ? ((hasTtle && ttleHcFeedUpFph1) ? ttleBoxX : stleBoxX)
        : ((hasTtle && ttleHcFeedDownFph1) ? ttleBoxX : stleBoxX))
    : null;
  const tleBoxDimX = (moTle && !moTle.occ.TLE) ? tleHcSrcBoxX : null;

  // ── Pre-register obstacle stubs ──
  if (hasAPH) stubRight(yMap[aphIdx], 28, 0, null);
  if (hasHPSSH2 && bothHPSSH) stubRight(yMap[hpssh2Idx], STUB_LEN, 0, 'Sup. Steam To Header');
  if (hasECO1 && bothECO) stubRight(yMap[eco1Idx], 22, (tleParallelEco1 || tleColdBfwUpstreamEco1) ? 0 : 24, (tleParallelEco1 || tleColdBfwUpstreamEco1) ? null : 'Boiler feed water');
  if (hasHTC1 && htc1EntersLeft && !hasHTC2) stubRight(yMap[htc1Idx], 28, 0, null);

  if (hasHPSSH1 && !bothHPSSH) stubLeft(yMap[hpssh1Idx], STUB_LEN, 0, 'Sup. Steam To Header');
  if (hasECO1 && !bothECO && !tleColdBfwUpstreamEco1) stubLeft(yMap[eco1Idx], 34, 36, 'Boiler feed water');
  // HC feed inlet to FPH1 sits on the RIGHT when the TLE is downstream of FPH1 (the
  // outlet exits left and routes under the RZ to the TLE), otherwise on the LEFT.
  // In feed-mode view the overlay engine owns the FPH/HTC inlets, so reserve gutter
  // space from its computed inlets (fork/single) instead of the default HC-feed stubs.
  if (mo) {
    for (const inl of mo.inlets) {
      const yIn = yMap[inl.bank === 'FPH1' ? fph1Idx : inl.bank === 'FPH2' ? fph2Idx : htc1Idx];
      stubLeft(yIn, 34, 36, inl.labels.join(' '));
    }
  } else if (moTle) {
    // Only an FPH1 entry sits in a gutter; the TLE-bottom inlet lives in open space.
    if (moTle.entry.stage === 'FPH1') {
      const reserveRight = !moTle.up && moTle.occ.TLE;   // downstream → FPH1 inlet on the right
      if (reserveRight) stubRight(yMap[fph1Idx], 34, 36, moTle.entry.labels.join(' '));
      else stubLeft(yMap[fph1Idx], 34, 36, moTle.entry.labels.join(' '));
    }
  } else {
    if (hasFPH1 && hcFeedDownstreamFph1) stubRight(yMap[fph1Idx], 34, 36, fphInletText.indexOf('/') >= 0 ? 'HC feed / Dil. Steam' : fphInletText);
    else if (hasFPH1 && !hcFeedUpstreamFph1) stubLeft(yMap[fph1Idx], 34, 36, fphInletText.indexOf('/') >= 0 ? 'HC feed / Dil. Steam' : fphInletText);
    if (hasFPH2 && !fphSeries) stubLeft(yMap[fph2Idx], 34, 36, fphInletText.indexOf('/') >= 0 ? 'HC feed / Dil. Steam' : fphInletText);
    if (hasHTC1 && !hasFPH1) stubLeft(yMap[htc1Idx], 34, 36, hasDsg ? 'HC feed / Dil. Steam' : 'HC feed');
  }
  if (hasAPH) stubLeft(yMap[aphIdx], 34, 36, 'Air from Atmosphere');
  if (hasHTC1 && !htc1EntersLeft && !hasHTC2) stubLeft(yMap[htc1Idx], 0, 36, null);
  if (hasHTC2 && htc1EntersLeft) stubLeft(yMap[htc2Idx], 0, 36, null);

  // ── SVG helpers ──
  function rightUbend(y1: number, y2: number, laneX: number) {
    return `M ${boxRight} ${y1} L ${laneX - r} ${y1} Q ${laneX} ${y1} ${laneX} ${y1 + r} L ${laneX} ${y2 - r} Q ${laneX} ${y2} ${laneX - r} ${y2} L ${boxRight + 8} ${y2}`;
  }
  function arrowLeft(y2: number) { return `<polygon points="${boxRight},${y2} ${boxRight + 8},${y2 - 4} ${boxRight + 8},${y2 + 4}"`; }
  function leftUbend(y1: number, y2: number, laneX: number) {
    return `M ${boxLeft} ${y1} L ${laneX + r} ${y1} Q ${laneX} ${y1} ${laneX} ${y1 + r} L ${laneX} ${y2 - r} Q ${laneX} ${y2} ${laneX + r} ${y2} L ${boxLeft} ${y2}`;
  }
  function arrowRight(y2: number) { return `<polygon points="${boxLeft},${y2} ${boxLeft - 8},${y2 - 4} ${boxLeft - 8},${y2 + 4}"`; }

  // ── Build SVG string ──
  let svg = `<svg viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg" style="font-family:'IBM Plex Mono',monospace;display:block;overflow:visible;">`;

  // ── Top label + arrow ──
  svg += `<text x="${leftPad + boxW / 2}" y="${labelH - 4}" text-anchor="middle" font-size="7" fill="${bank_c}" letter-spacing="1">FLUE GAS TO ATMOSPHERE</text>`;
  // Bank 1 → atmosphere outlet: a flue-gas flow line (drawn bottom→top so the dash
  // animation rises) ending in the static arrowhead marker, replacing the old ↑ glyph.
  svg += `<line x1="${leftPad + boxW / 2}" y1="${labelH + arrowH}" x2="${leftPad + boxW / 2}" y2="${labelH + 1}" stroke="${bank_c}" stroke-width="1.5" marker-end="url(#arrFluGas)"/>`;

  // ── Feed-mode badge (top-left, only when a mode is active) ──
  if (mc && mc.modeLabel) {
    const bw = Math.max(64, mc.modeLabel.length * 6.2 + 18);
    const bh = 16, bx = 8, by = 8;
    svg += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="${mc.tagColor}22" stroke="${mc.tagColor}" stroke-width="1"/>`;
    svg += `<circle cx="${bx + 9}" cy="${by + bh / 2}" r="3" fill="${mc.tagColor}"/>`;
    svg += `<text x="${bx + 16}" y="${by + bh / 2 + 3}" text-anchor="start" font-size="8" font-weight="600" fill="${mc.tagColor}" letter-spacing="0.5">${mc.modeLabel}</text>`;
  }

  // ── Bank boxes + connectors ──
  for (let i = 0; i < numBanks; i++) {
    const code   = f.banks[i] || '';
    const cx     = leftPad;
    const yTop   = yMap[i] - boxH / 2;
    const filled = !!code;
    const col    = filled ? compBd : dim;
    const bg2    = boxFill;
    const nameCol = filled ? boxName : SVG_TEXT_MUTED;
    const bankNumCol = SVG_TEXT_MUTED;
    // Feed-mode overlay: dim banks the active stream doesn't route through.
    const bankDim = dimSet.has(code);
    if (bankDim) svg += `<g opacity="0.3">`;
    svg += `<rect x="${cx}" y="${yTop}" width="${boxW}" height="${boxH}" rx="4" fill="${bg2}" stroke="${col}" stroke-width="1.2"/>`;
    svg += `<text x="${cx + boxW / 2}" y="${yTop + 13}" text-anchor="middle" font-size="7" fill="${bankNumCol}" letter-spacing="1">BANK ${i + 1}</text>`;
    svg += `<text x="${cx + boxW / 2}" y="${yTop + 28}" text-anchor="middle" font-size="10" font-weight="600" fill="${nameCol}">${code ? displayName(code) : '—'}</text>`;
    if (bankDim) svg += `</g>`;
    if (i < numBanks - 1) {
      const connY = yTop + boxH;
      // Flue gas rises (bank N → bank 1), so draw the connector bottom→top to make
      // the dash animation flow upward. Geometry is unchanged — only start/end swap.
      svg += `<line x1="${cx + boxW / 2}" y1="${connY + connH}" x2="${cx + boxW / 2}" y2="${connY}" stroke="${bank_c}" stroke-width="1.5"/>`;
    }
  }

  // ── Radiation Zone ──
  const rzCX = rzX + rzW / 2;
  svg += `<rect x="${rzX}" y="${rzY}" width="${rzW}" height="${rzH}" rx="4" fill="${boxFill}" stroke="${compBd}" stroke-width="1.4"/>`;
  svg += `<text x="${rzCX}" y="${rzY + 13}" text-anchor="middle" font-size="7" fill="${SVG_TEXT_MUTED}" letter-spacing="1">RADIATION ZONE</text>`;
  const lastBankBottom = yMap[numBanks - 1] + boxH / 2;
  svg += `<line x1="${rzCX}" y1="${rzY}" x2="${rzCX}" y2="${lastBankBottom + 2}" stroke="${bank_c}" stroke-width="1.4" marker-end="url(#arrFluGas)"/>`;

  // ── Bridgewall hatch ──
  {
    const bwX1 = rzX, bwX2 = rzX + rzW;
    const bwY1 = lastBankBottom + 2, bwY2 = rzY - 2;
    const bwMidY = (bwY1 + bwY2) / 2;
    const bwH = bwY2 - bwY1, bwW = rzW;
    const hatchSpacing = 10;
    const clipId = `bwClip${++_cbSvgCounter}`;
    svg += `<defs><clipPath id="${clipId}"><rect x="${bwX1}" y="${bwY1}" width="${bwW}" height="${bwH}"/></clipPath></defs>`;
    let hatchSvg = '';
    for (let d = -bwH; d < bwW + bwH; d += hatchSpacing) {
      hatchSvg += `<line x1="${bwX1 + d}" y1="${bwY1}" x2="${bwX1 + d + bwH}" y2="${bwY2}" stroke="${SVG_HATCH}" stroke-width="1"/>`;
    }
    svg += `<g clip-path="url(#${clipId})">${hatchSvg}</g>`;
    const twW = 58, twH = 11;
    svg += `<rect x="${rzCX - twW / 2}" y="${bwMidY - twH / 2}" width="${twW}" height="${twH}" rx="2" fill="${BG}" opacity="0.9"/>`;
    svg += `<text x="${rzCX}" y="${bwMidY + 4}" text-anchor="middle" font-size="7.5" fill="${SVG_TEXT_LABEL}" letter-spacing="1" font-weight="500">Bridgewall</text>`;
  }

  // ── Combustion air/fuel at RZ bottom (no APH) ──
  let fuelStubClearY: number | null = null;
  if (!hasAPH) {
    const rzBot2  = rzY + rzH;
    const rzAirX2  = rzX + rzW * 2 / 3;
    const rzFuelX2 = rzX + rzW * 1 / 3;
    const airArrowLen = 22;
    const fuelTextBot = rzBot2 + airArrowLen + 10 + 7;
    svg += `<line x1="${rzAirX2}" y1="${rzBot2 + airArrowLen}" x2="${rzAirX2}" y2="${rzBot2 + 1}" stroke="${aph_c}" stroke-width="1.5" marker-end="url(#arrAPH)"/>`;
    svg += `<text x="${rzAirX2}" y="${rzBot2 + airArrowLen + 10}" text-anchor="middle" font-size="7" fill="${aph_c}">Combustion Air</text>`;
    svg += `<line x1="${rzFuelX2}" y1="${rzBot2 + airArrowLen}" x2="${rzFuelX2}" y2="${rzBot2 + 1}" stroke="${fuel_c}" stroke-width="1.5" marker-end="url(#arrFuel)"/>`;
    svg += `<text x="${rzFuelX2}" y="${rzBot2 + airArrowLen + 10}" text-anchor="middle" font-size="7" fill="${fuel_c}">Fuel</text>`;
    _hOccupy(_hOccL, rzBot2 + airArrowLen, 0, boxLeft);
    _hOccupy(_hOccL, fuelTextBot, 0, boxLeft);
    fuelStubClearY = fuelTextBot + 4;
  }

  // Attemperator BFW spray: a fine downward water mist from the BFW inlet nozzle,
  // fanning out to ~half the box width and falling toward the floor (desuperheating
  // spray). Built from a soft cone (a <polygon>, so the flow-dash post-processor
  // never touches it) plus staggered droplet circles, all clipped to the box so the
  // spray stays inside the vessel. (nozzleX, nozzleY) is the cone apex / spray origin;
  // `len` is the spray's vertical length (clamped so it never passes the floor).
  function attmpSpray(nozzleX: number, nozzleY: number, len: number, bx: number, by: number, bw: number, bh: number, key: string): string {
    const n2 = (v: number) => v.toFixed(2);
    const endY    = Math.min(by + bh - 2, nozzleY + len);
    const fanHalf = bw / 4;                       // full spread = bw/2  (½ box width)
    if (endY <= nozzleY + 2) return '';
    let s = `<defs><clipPath id="spray_${key}"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3"/></clipPath></defs>`;
    s += `<g clip-path="url(#spray_${key})">`;
    s += `<polygon points="${n2(nozzleX)},${n2(nozzleY)} ${n2(nozzleX - fanHalf)},${n2(endY)} ${n2(nozzleX + fanHalf)},${n2(endY)}" fill="${eco_c}" opacity="0.14"/>`;
    const DROPS = 7;
    for (let d = 0; d < DROPS; d++) {
      const frac  = (d / (DROPS - 1)) * 2 - 1;   // -1..1 across the fan
      const xEnd  = nozzleX + frac * fanHalf;
      const dur   = 0.9 + (d % 3) * 0.25;
      const begin = -(d * 0.13);
      const dr    = 0.7 + (d % 2) * 0.3;
      s += `<circle cx="${n2(nozzleX)}" cy="${n2(nozzleY)}" r="${n2(dr)}" fill="${eco_c}">`
        + `<animate attributeName="cx" values="${n2(nozzleX)};${n2(xEnd)}" dur="${dur}s" begin="${begin}s" calcMode="linear" repeatCount="indefinite"/>`
        + `<animate attributeName="cy" values="${n2(nozzleY)};${n2(endY)}" dur="${dur}s" begin="${begin}s" calcMode="linear" repeatCount="indefinite"/>`
        + `<animate attributeName="opacity" values="0.95;0.9;0" keyTimes="0;0.85;1" dur="${dur}s" begin="${begin}s" calcMode="linear" repeatCount="indefinite"/>`
        + `</circle>`;
    }
    s += `</g>`;
    return s;
  }

  // ── HPSSH steam ──
  if (hasHPSSH1) {
    const y1 = yMap[hpssh1Idx];
    if (!bothHPSSH) {
      svg += `<line x1="${boxLeft}" y1="${y1}" x2="${boxLeft - STUB_LEN}" y2="${y1}" stroke="${stm_c}" stroke-width="1.5" marker-end="url(#arrSTM2)"/>`;
      svg += `<text x="${boxLeft - STUB_LEN - 2}" y="${y1 - 4}" text-anchor="end" font-size="7" fill="${stm_c}">Sup. Steam</text>`;
      svg += `<text x="${boxLeft - STUB_LEN - 2}" y="${y1 + 6}" text-anchor="end" font-size="7" fill="${stm_c}">To Header</text>`;
    } else {
      const y2 = yMap[hpssh2Idx];
      if (!hasAtmp) {
        requestLane('L', y1, y2, bendX => {
          svg += `<path d="${leftUbend(y1, y2, bendX)}" fill="none" stroke="${stm_c}" stroke-width="1.5"/>`;
          svg += `${arrowRight(y2)} fill="${stm_c}"/>`;
        });
      } else {
        const ar = 5;
        const span = Math.abs(y2 - y1);
        const adjacentThreshold = (boxH + connH) * 1.5;
        const useVertical = span > adjacentThreshold;
        if (useVertical) {
          const atmpW = 20, atmpH = 54;
          requestLane('L', y1, y2, laneX => {  // box footprint declared below
            const atmpX = laneX - atmpW / 2;
            const atmpY = (y1 + y2) / 2 - atmpH / 2;
            const atmpMidY = atmpY + atmpH / 2;
            svg += `<path d="M ${boxLeft} ${y1} L ${laneX + ar} ${y1} Q ${laneX} ${y1} ${laneX} ${y1 + ar} L ${laneX} ${atmpY + 1}" fill="none" stroke="${stm_c}" stroke-width="1.5" marker-end="url(#arrSTM)"/>`;
            svg += `<rect x="${atmpX}" y="${atmpY}" width="${atmpW}" height="${atmpH}" rx="3" fill="${BG4}" stroke="${BD2}" stroke-width="1"/>`;
            svg += `<text x="${laneX}" y="${atmpMidY + 3}" text-anchor="middle" font-size="7" fill="${SVG_TEXT_DIM}" transform="rotate(-90,${laneX},${atmpMidY})">Attemperator</text>`;
            const bfwX = atmpX - STUB_LEN;
            svg += `<line x1="${bfwX}" y1="${atmpMidY}" x2="${atmpX - 1}" y2="${atmpMidY}" stroke="${eco_c}" stroke-width="1.5" marker-end="url(#arrECO)"/>`;
            svg += `<text x="${bfwX - 4}" y="${atmpMidY - 4}" text-anchor="end" font-size="7" fill="${eco_c}">BFW to</text>`;
            svg += `<text x="${bfwX - 4}" y="${atmpMidY + 6}" text-anchor="end" font-size="7" fill="${eco_c}">attemp.</text>`;
            // BFW spray: vertical box → vertical spray of length = ½ box height,
            // falling from the inlet (left-mid) down toward the floor.
            svg += attmpSpray(atmpX + atmpW / 4, atmpMidY, atmpH / 2, atmpX, atmpY, atmpW, atmpH, `${Math.round(laneX)}_${Math.round(atmpY)}`);
            svg += `<path d="M ${laneX} ${atmpY + atmpH} L ${laneX} ${y2 - ar} Q ${laneX} ${y2} ${laneX + ar} ${y2} L ${boxLeft - 8} ${y2}" fill="none" stroke="${stm_c}" stroke-width="1.5"/>`;
            svg += `${arrowRight(y2)} fill="${stm_c}"/>`;
            // outerE reaches past the box AND its left BFW feeder stub + label, so an
            // outer lane is routed beyond the "BFW to attemp." stub, not across it. The
            // solid rectangle is only the box body's y-range — the thin steam legs above
            // and below it don't reserve width, so other lanes pack tight there.
          }, { innerE: atmpW / 2, outerE: atmpW / 2 + STUB_LEN + 36, boxYTop: (y1 + y2) / 2 - atmpH / 2, boxYBot: (y1 + y2) / 2 + atmpH / 2 });
        } else {
          const atmpW = 54, atmpH = 20;
          requestLane('L', y1, y2, laneX => {
            const atmpRightX = laneX, atmpX = atmpRightX - atmpW;
            const atmpY    = (y1 + y2) / 2 - atmpH / 2;
            const atmpMidY = atmpY + atmpH / 2;
            const bfwTopX  = atmpX + atmpW * 1 / 3;
            const stmTopX  = atmpX + atmpW * 2 / 3;
            svg += `<path d="M ${boxLeft} ${y1} L ${stmTopX} ${y1} L ${stmTopX} ${atmpY}" stroke="${stm_c}" stroke-width="1.5" fill="none" marker-end="url(#arrSTM)"/>`;
            svg += `<rect x="${atmpX}" y="${atmpY}" width="${atmpW}" height="${atmpH}" rx="3" fill="${BG4}" stroke="${BD2}" stroke-width="1"/>`;
            svg += `<text x="${atmpX + atmpW / 2}" y="${atmpY + atmpH / 2 + 3}" text-anchor="middle" font-size="7" fill="${SVG_TEXT_DIM}">Attemperator</text>`;
            const bfwStubTopY = atmpY - STUB_LEN;
            svg += `<line x1="${bfwTopX}" y1="${bfwStubTopY}" x2="${bfwTopX}" y2="${atmpY}" stroke="${eco_c}" stroke-width="1.5" marker-end="url(#arrECO)"/>`;
            svg += `<text x="${bfwTopX}" y="${bfwStubTopY - 4}" text-anchor="middle" font-size="7" fill="${eco_c}">BFW to</text>`;
            svg += `<text x="${bfwTopX}" y="${bfwStubTopY - 13}" text-anchor="middle" font-size="7" fill="${eco_c}">attemp.</text>`;
            // BFW spray: horizontal box → spray falls from the inlet (top) down to
            // the floor (length = box height).
            svg += attmpSpray(bfwTopX, atmpY, atmpH, atmpX, atmpY, atmpW, atmpH, `${Math.round(laneX)}_${Math.round(atmpY)}`);
            const atmpBotMidX = atmpX + atmpW / 2;
            svg += `<path d="M ${atmpBotMidX} ${atmpY + atmpH} L ${atmpBotMidX} ${y2 - ar} Q ${atmpBotMidX} ${y2} ${atmpBotMidX + ar} ${y2} L ${boxLeft - 8} ${y2}" stroke="${stm_c}" stroke-width="1.5" fill="none"/>`;
            svg += `${arrowRight(y2)} fill="${stm_c}"/>`;
          }, { innerE: 0, outerE: atmpW, boxYTop: (y1 + y2) / 2 - atmpH / 2, boxYBot: (y1 + y2) / 2 + atmpH / 2 });   // box extends outward from its lane
        }
      }
      svg += `<line x1="${boxRight}" y1="${yMap[hpssh2Idx]}" x2="${boxRight + STUB_LEN}" y2="${yMap[hpssh2Idx]}" stroke="${stm_c}" stroke-width="1.5" marker-end="url(#arrSTM)"/>`;
      svg += `<text x="${boxRight + STUB_LEN + 4}" y="${yMap[hpssh2Idx] - 4}" text-anchor="start" font-size="7" fill="${stm_c}">Sup. Steam</text>`;
      svg += `<text x="${boxRight + STUB_LEN + 4}" y="${yMap[hpssh2Idx] + 5}" text-anchor="start" font-size="7" fill="${stm_c}">To Header</text>`;
    }
  }

  // ── ECO ──
  if (hasECO1) {
    const yE1 = yMap[eco1Idx];
    if (!bothECO) {
      if (!tleColdBfwUpstreamEco1) {
        svg += `<text x="${boxLeft - STUB_LEN - 2}" y="${yE1 - 5}" text-anchor="end" font-size="7" fill="${eco_c}">Boiler feed</text>`;
        svg += `<text x="${boxLeft - STUB_LEN - 2}" y="${yE1 + 5}" text-anchor="end" font-size="7" fill="${eco_c}">water</text>`;
        svg += `<line x1="${boxLeft - STUB_LEN}" y1="${yE1}" x2="${boxLeft}" y2="${yE1}" stroke="${eco_c}" stroke-width="1.5" marker-end="url(#arrECO)"/>`;
      }
    } else {
      const yE2 = yMap[eco2Idx];
      if (!tleParallelEco1 && !tleColdBfwUpstreamEco1) {
        svg += `<text x="${boxRight + STUB_LEN + 2}" y="${yE1 - 4}" text-anchor="start" font-size="7" fill="${eco_c}">Boiler feed</text>`;
        svg += `<text x="${boxRight + STUB_LEN + 2}" y="${yE1 + 6}" text-anchor="start" font-size="7" fill="${eco_c}">water</text>`;
      }
      if (!tleParallelEco1) {
        svg += `<line x1="${boxRight + STUB_LEN}" y1="${yE1}" x2="${boxRight}" y2="${yE1}" stroke="${eco_c}" stroke-width="1.5" marker-end="url(#arrECO)"/>`;
        requestLane('L', yE1, yE2, lx => {
          svg += `<path d="${leftUbend(yE1, yE2, lx)}" fill="none" stroke="${eco_c}" stroke-width="1.5"/>`;
          svg += `${arrowRight(yE2)} fill="${eco_c}"/>`;
        });
      } else {
        // Parallel ECO1 / TLE path (simplified)
        const lastTleBoxX = hasTtle ? ttleBoxX : stleBoxX;
        const tleCX = lastTleBoxX + ptleBoxW / 2;
        const tleTopY = ptleBoxY;
        const tleBotY = ptleBoxY + ptleBoxH;
        const yBranchLen = 16, cr = 5, qrp = 5;
        const _topBankT = yMap[0] - boxH / 2;
        const iyForkX = sdX + sdW / 2;
        const iyForkY = _resolveHLane('R', iyForkX - 20, iyForkX + 20, _topBankT - connH);
        const iyStemY = iyForkY - 22;
        const iyLeftTipX  = iyForkX - yBranchLen * Math.cos(Math.PI * 45 / 180);
        const iyLeftTipY  = iyForkY + yBranchLen * Math.sin(Math.PI * 45 / 180);
        const iyRightTipX = iyForkX + yBranchLen * Math.cos(Math.PI * 45 / 180);
        const iyRightTipY = iyForkY + yBranchLen * Math.sin(Math.PI * 45 / 180);
        svg += `<line x1="${iyForkX}" y1="${iyStemY}" x2="${iyForkX}" y2="${iyForkY}" stroke="${eco_c}" stroke-width="1.5" marker-end="url(#arrECO)"/>`;
        svg += `<text x="${iyForkX + 4}" y="${iyStemY - 2}" text-anchor="start" font-size="7" fill="${eco_c}">BFW</text>`;
        svg += `<path d="M ${iyForkX} ${iyForkY} Q ${iyForkX - cr} ${iyForkY} ${iyLeftTipX} ${iyLeftTipY}" fill="none" stroke="${eco_c}" stroke-width="1.5"/>`;
        svg += `<path d="M ${iyForkX} ${iyForkY} Q ${iyForkX + cr} ${iyForkY} ${iyRightTipX} ${iyRightTipY}" fill="none" stroke="${eco_c}" stroke-width="1.5"/>`;
        _hOccupy(_hOccR, yE1, boxRight, iyLeftTipX);
        svg += `<path d="M ${iyLeftTipX} ${iyLeftTipY} L ${iyLeftTipX} ${yE1 - qrp} Q ${iyLeftTipX} ${yE1} ${iyLeftTipX - qrp} ${yE1} L ${boxRight + 1} ${yE1}" fill="none" stroke="${eco_c}" stroke-width="1.5" marker-end="url(#arrECO)"/>`;
        requestHLane('R', iyRightTipX, tleCX, iyRightTipX, iyRightTipY, hY => {
          svg += `<path d="M ${iyRightTipX} ${iyRightTipY} L ${iyRightTipX} ${hY - qrp} Q ${iyRightTipX} ${hY} ${iyRightTipX + qrp} ${hY} L ${tleCX - qrp} ${hY} Q ${tleCX} ${hY} ${tleCX} ${hY + qrp} L ${tleCX} ${tleTopY}" fill="none" stroke="${eco_c}" stroke-width="1.5" marker-end="url(#arrECO)"/>`;
        });
        const yrx = boxLeft, yry = yE2;
        const yrForkX = yrx - 14;
        const yr135x = yrForkX - yBranchLen * Math.cos(Math.PI * 45 / 180);
        const yr135y = yry - yBranchLen * Math.sin(Math.PI * 45 / 180);
        const yr225x = yrForkX - yBranchLen * Math.cos(Math.PI * 45 / 180);
        const yr225y = yry + yBranchLen * Math.sin(Math.PI * 45 / 180);
        svg += `<line x1="${yrForkX}" y1="${yry}" x2="${yrx}" y2="${yry}" stroke="${eco_c}" stroke-width="1.5" marker-end="url(#arrECO)"/>`;
        svg += `<path d="M ${yr135x} ${yr135y} Q ${yrForkX - cr} ${yry} ${yrForkX} ${yry}" fill="none" stroke="${eco_c}" stroke-width="1.5"/>`;
        svg += `<path d="M ${yr225x} ${yr225y} Q ${yrForkX - cr} ${yry} ${yrForkX} ${yry}" fill="none" stroke="${eco_c}" stroke-width="1.5"/>`;
        requestLane('L', Math.min(yE1, yr135y), Math.max(yE1, yr135y), lxE => {
          svg += `<path d="M ${boxLeft} ${yE1} L ${lxE + qrp} ${yE1} Q ${lxE} ${yE1} ${lxE} ${yE1 + qrp} L ${lxE} ${yr135y - qrp} Q ${lxE} ${yr135y} ${lxE + qrp} ${yr135y} L ${yr135x} ${yr135y}" fill="none" stroke="${eco_c}" stroke-width="1.5"/>`;
        });
        const fuelClearY = rzY + rzH + 38;
        const tleBelowY = Math.max(tleBotY + 4, fuelClearY);
        const tleBotMidX = tleCX;
        requestLane('L', yr225y, tleBelowY, lx => {
          svg += `<path d="M ${tleBotMidX} ${tleBotY} L ${tleBotMidX} ${tleBelowY - qrp} Q ${tleBotMidX} ${tleBelowY} ${tleBotMidX - qrp} ${tleBelowY} L ${lx + qrp} ${tleBelowY} Q ${lx} ${tleBelowY} ${lx} ${tleBelowY - qrp} L ${lx} ${yr225y + qrp} Q ${lx} ${yr225y} ${lx + qrp} ${yr225y} L ${yr225x} ${yr225y}" fill="none" stroke="${eco_c}" stroke-width="1.5" marker-end="url(#arrECO)"/>`;
        });
      }
    }
  }

  // ── FPH feed ──
  function drawLeftEntry(yMid: number, text: string, color: string) {
    if (text.indexOf('/') >= 0) {
      svg += `<text x="${boxLeft - STUB_LEN - 2}" y="${yMid - 5}" text-anchor="end" font-size="7" fill="${color}">HC feed /</text>`;
      svg += `<text x="${boxLeft - STUB_LEN - 2}" y="${yMid + 5}" text-anchor="end" font-size="7" fill="${color}">Dil. Steam</text>`;
    } else {
      svg += `<text x="${boxLeft - STUB_LEN - 2}" y="${yMid + 3}" text-anchor="end" font-size="7" fill="${color}">${text}</text>`;
    }
    svg += `<line x1="${boxLeft - STUB_LEN}" y1="${yMid}" x2="${boxLeft}" y2="${yMid}" stroke="${color}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
  }
  // Mirror of drawLeftEntry — feed arrow points LEFT into the box's right edge, with the
  // label to the right of the stub. Used when the inlet sits in the right gutter.
  function drawRightEntry(yMid: number, text: string, color: string) {
    if (text.indexOf('/') >= 0) {
      svg += `<text x="${boxRight + STUB_LEN + 2}" y="${yMid - 5}" text-anchor="start" font-size="7" fill="${color}">HC feed /</text>`;
      svg += `<text x="${boxRight + STUB_LEN + 2}" y="${yMid + 5}" text-anchor="start" font-size="7" fill="${color}">Dil. Steam</text>`;
    } else {
      svg += `<text x="${boxRight + STUB_LEN + 2}" y="${yMid + 3}" text-anchor="start" font-size="7" fill="${color}">${text}</text>`;
    }
    svg += `<line x1="${boxRight + STUB_LEN}" y1="${yMid}" x2="${boxRight}" y2="${yMid}" stroke="${color}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
  }

  // ── Feed-mode inlet helpers ──
  // Split a multi-word stream label onto two lines ("Decoke Steam" → "Decoke" / "Steam")
  // so inlet / fork / injection texts stay narrow and don't sprawl across the gutter into
  // neighbouring lanes. Single words stay on one line.
  function splitLabel(s: string): [string, string | null] {
    const i = s.lastIndexOf(' ');
    return i <= 0 ? [s, null] : [s.slice(0, i), s.slice(i + 1)];
  }
  // Two-line text anchored at (x, yMid). `anchor` is the SVG text-anchor (end = right-
  // aligned for left-gutter labels, start = left-aligned for right-gutter labels).
  function drawLabel(x: number, yMid: number, label: string, color: string, anchor: 'start' | 'middle' | 'end') {
    const [l1, l2] = splitLabel(label);
    if (l2) {
      svg += `<text x="${x}" y="${yMid - 4}" text-anchor="${anchor}" font-size="7" fill="${color}">${l1}</text>`;
      svg += `<text x="${x}" y="${yMid + 6}" text-anchor="${anchor}" font-size="7" fill="${color}">${l2}</text>`;
    } else {
      svg += `<text x="${x}" y="${yMid + 3}" text-anchor="${anchor}" font-size="7" fill="${color}">${l1}</text>`;
    }
  }
  // Left inlet stub with a (possibly two-line) mode label.
  function drawModeLeftEntry(yMid: number, label: string, color: string) {
    drawLabel(boxLeft - STUB_LEN - 2, yMid, label, color, 'end');
    svg += `<line x1="${boxLeft - STUB_LEN}" y1="${yMid}" x2="${boxLeft}" y2="${yMid}" stroke="${color}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
  }
  // Y-fork inlet: two labelled legs merge into one arrow entering the box's left edge
  // (both streams enter that bank together). Mirrors the ECO BFW Y-fork pattern.
  function drawLeftFork(yMid: number, labelA: string, labelB: string, color: string) {
    const forkX = boxLeft - STUB_LEN, legLen = 18, cr = 4;
    const dx = legLen * 0.7071, dy = legLen * 0.7071;
    const upTx = forkX - dx, upTy = yMid - dy;
    const dnTx = forkX - dx, dnTy = yMid + dy;
    svg += `<line x1="${forkX}" y1="${yMid}" x2="${boxLeft}" y2="${yMid}" stroke="${color}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
    svg += `<path d="M ${upTx} ${upTy} Q ${forkX - cr} ${yMid} ${forkX} ${yMid}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    svg += `<path d="M ${dnTx} ${dnTy} Q ${forkX - cr} ${yMid} ${forkX} ${yMid}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    svg += `<line x1="${upTx - 8}" y1="${upTy}" x2="${upTx}" y2="${upTy}" stroke="${color}" stroke-width="1.5"/>`;
    svg += `<line x1="${dnTx - 8}" y1="${dnTy}" x2="${dnTx}" y2="${dnTy}" stroke="${color}" stroke-width="1.5"/>`;
    drawLabel(upTx - 10, upTy, labelA, color, 'end');
    drawLabel(dnTx - 10, dnTy, labelB, color, 'end');
  }
  // Injection: a short (two-line-labelled) arrow pointing AT a connector's resolved
  // vertical lane at (lx, y) — the trailing stream joining the spine on the descending
  // segment. Drawn inside the connector's drawFn, where the lane x (lx) is already known.
  const INJ_LEN = 18;
  function drawInjAt(lx: number, y: number, label: string, color: string, gutter: 'R' | 'L') {
    if (gutter === 'R') {
      svg += `<line x1="${lx + INJ_LEN}" y1="${y}" x2="${lx}" y2="${y}" stroke="${color}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
      drawLabel(lx + INJ_LEN + 3, y, label, color, 'start');
    } else {
      svg += `<line x1="${lx - INJ_LEN}" y1="${y}" x2="${lx}" y2="${y}" stroke="${color}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
      drawLabel(lx - INJ_LEN - 3, y, label, color, 'end');
    }
  }
  // Footprint reserved OUTWARD of an injection-carrying connector lane, so the lane
  // resolver keeps other lanes clear of the injection arrow + label (fixes the text being
  // crossed). Only the injection ROW reserves the wide box; the rest of the connector
  // stays a thin line that other lanes may still cross.
  function injFootprint(yMid: number, label: string) {
    const [l1, l2] = splitLabel(label);
    const maxLen = Math.max(l1.length, l2 ? l2.length : 0);
    const textW = maxLen * 4.4 + 6;
    return { innerE: 0, outerE: INJ_LEN + textW + 4, boxYTop: yMid - 13, boxYBot: yMid + 13 };
  }
  function drawModeInlet(inl: MOInlet) {
    const idx = inl.bank === 'FPH1' ? fph1Idx : inl.bank === 'FPH2' ? fph2Idx : htc1Idx;
    const y = yMap[idx];
    const color = inl.bank === 'HTC1' ? htc_c : fph_c;
    if (inl.kind === 'fork') drawLeftFork(y, inl.labels[0], inl.labels[1] ?? inl.labels[0], color);
    else drawModeLeftEntry(y, inl.labels[0], color);
  }
  // Mode-driven FPH/HTC flow: inlets/forks at entry banks, the spine connectors for the
  // live banks only (a dimmed bank's inlet + outgoing connector are suppressed), and the
  // single injection on the connector feeding the trailing stream's entry bank.
  function drawModeFphHtc(m: MO) {
    for (const inl of m.inlets) drawModeInlet(inl);
    const inj = m.inj;

    if (bothFPH && fphSeries) {
      const yF1 = yMap[fph1Idx], yF2 = yMap[fph2Idx];
      if (m.occ.FPH1) {
        const hasInj = inj?.feedBank === 'FPH2', yMid = (yF1 + yF2) / 2;
        requestLane('R', yF1, yF2, lx => {
          svg += `<path d="${rightUbend(yF1, yF2, lx)}" fill="none" stroke="${fph_c}" stroke-width="1.5"/>`;
          svg += `${arrowLeft(yF2)} fill="${fph_c}"/>`;
          if (hasInj) drawInjAt(lx, yMid, inj!.label, fph_c, 'R');
        }, hasInj ? injFootprint(yMid, inj!.label) : undefined);
      }
      if (m.occ.FPH2) {
        if (hasHTC1) {
          const yH1 = yMap[htc1Idx];
          const hasInj = inj?.feedBank === 'HTC1', yMid = (yF2 + yH1) / 2;
          requestLane('L', yF2, yH1, lx => {
            svg += `<path d="M ${boxLeft} ${yF2} L ${lx + r} ${yF2} Q ${lx} ${yF2} ${lx} ${yF2 + r} L ${lx} ${yH1 - r} Q ${lx} ${yH1} ${lx + r} ${yH1} L ${boxLeft} ${yH1}" fill="none" stroke="${fph_c}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
            if (hasInj) drawInjAt(lx, yMid, inj!.label, fph_c, 'L');
          }, hasInj ? injFootprint(yMid, inj!.label) : undefined);
        } else {
          addObsLeft(STUB_TEXT_REACH, yF2);
          queueLeftLane(yF2, yF2 + TEXT_HALF, lx => {
            svg += `<line x1="${boxLeft}" y1="${yF2}" x2="${lx}" y2="${yF2}" stroke="${fph_c}" stroke-width="1.5" marker-end="url(#arrFPH2)"/>`;
            svg += `<text x="${lx - 4}" y="${yF2 - 4}" text-anchor="end" font-size="7" fill="${fph_c}">to HTC</text>`;
          });
        }
      }
    } else if (bothFPH && !fphSeries) {
      const yF2 = yMap[fph2Idx];
      const carrierIdx = m.occ.FPH1 ? fph1Idx : fph2Idx;
      const yC = yMap[carrierIdx];
      const bothFphLive = m.occ.FPH1 && m.occ.FPH2;
      if (m.occ.FPH1 || m.occ.FPH2) {
        if (hasHTC1) {
          const yH1 = yMap[htc1Idx];
          const hasInj = inj?.feedBank === 'HTC1', yMid = (yC + yH1) / 2;
          requestLane('R', yC, yH1, lx => {
            if (bothFphLive) {
              // The non-carrier FPH (FPH2) outlet merges into the FPH1 downcomer.
              svg += `<line x1="${boxRight}" y1="${yF2}" x2="${lx - 8}" y2="${yF2}" stroke="${fph_c}" stroke-width="1.5"/>`;
              svg += `<polygon points="${lx},${yF2} ${lx - 8},${yF2 - 4} ${lx - 8},${yF2 + 4}" fill="${fph_c}"/>`;
            }
            svg += `<path d="${rightUbend(yC, yH1, lx)}" fill="none" stroke="${fph_c}" stroke-width="1.5"/>`;
            svg += `${arrowLeft(yH1)} fill="${fph_c}"/>`;
            if (hasInj) drawInjAt(lx, yMid, inj!.label, fph_c, 'R');
          }, hasInj ? injFootprint(yMid, inj!.label) : undefined);
        } else {
          addObsRight(STUB_TEXT_REACH, yC);
          queueRightLane(yC, yC + TEXT_HALF, lx => {
            svg += `<line x1="${boxRight}" y1="${yC}" x2="${lx}" y2="${yC}" stroke="${fph_c}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
            svg += `<text x="${lx + 4}" y="${yC - 4}" text-anchor="start" font-size="7" fill="${fph_c}">to HTC</text>`;
          });
        }
      }
    } else if (hasFPH1 && !hasFPH2) {
      const yF1 = yMap[fph1Idx];
      if (m.occ.FPH1) {
        if (hasHTC1) {
          const yH1 = yMap[htc1Idx];
          const hasInj = inj?.feedBank === 'HTC1', yMid = (yF1 + yH1) / 2;
          requestLane('R', yF1, yH1, lx => {
            svg += `<path d="${rightUbend(yF1, yH1, lx)}" fill="none" stroke="${fph_c}" stroke-width="1.5"/>`;
            svg += `${arrowLeft(yH1)} fill="${fph_c}"/>`;
            if (hasInj) drawInjAt(lx, yMid, inj!.label, fph_c, 'R');
          }, hasInj ? injFootprint(yMid, inj!.label) : undefined);
        } else {
          addObsRight(STUB_TEXT_REACH, yF1);
          queueRightLane(yF1, yF1 + TEXT_HALF, lx => {
            svg += `<line x1="${boxRight}" y1="${yF1}" x2="${lx}" y2="${yF1}" stroke="${fph_c}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
            svg += `<text x="${lx + 4}" y="${yF1 - 4}" text-anchor="start" font-size="7" fill="${fph_c}">to HTC</text>`;
          });
        }
      }
    }
    // Templates with no FPH: the HTC1 inlet is one of m.inlets above; HTC1→HTC2 stays
    // in the dedicated HTC block below.
  }

  // Right-gutter mirrors of the inlet helpers, for the downstream-TLE FPH1 inlet.
  function drawModeRightEntry(yMid: number, label: string, color: string) {
    drawLabel(boxRight + STUB_LEN + 2, yMid, label, color, 'start');
    svg += `<line x1="${boxRight + STUB_LEN}" y1="${yMid}" x2="${boxRight}" y2="${yMid}" stroke="${color}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
  }
  function drawRightFork(yMid: number, labelA: string, labelB: string, color: string) {
    const forkX = boxRight + STUB_LEN, legLen = 18, cr = 4;
    const dx = legLen * 0.7071, dy = legLen * 0.7071;
    const upTx = forkX + dx, upTy = yMid - dy;
    const dnTx = forkX + dx, dnTy = yMid + dy;
    svg += `<line x1="${forkX}" y1="${yMid}" x2="${boxRight}" y2="${yMid}" stroke="${color}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
    svg += `<path d="M ${upTx} ${upTy} Q ${forkX + cr} ${yMid} ${forkX} ${yMid}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    svg += `<path d="M ${dnTx} ${dnTy} Q ${forkX + cr} ${yMid} ${forkX} ${yMid}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    svg += `<line x1="${upTx + 8}" y1="${upTy}" x2="${upTx}" y2="${upTy}" stroke="${color}" stroke-width="1.5"/>`;
    svg += `<line x1="${dnTx + 8}" y1="${dnTy}" x2="${dnTx}" y2="${dnTy}" stroke="${color}" stroke-width="1.5"/>`;
    drawLabel(upTx + 10, upTy, labelA, color, 'start');
    drawLabel(dnTx + 10, dnTy, labelB, color, 'start');
  }
  // Mode-driven HC-feed flow for a single-FPH template whose feed runs through a TLE
  // stage: chain [TLE, FPH1, HTC1] (upstream) or [FPH1, TLE, HTC1] (downstream). Inlets/
  // forks at the entry stage, the live legs only (a bypassed stage's feed leg is dropped
  // and the stage is dimmed elsewhere), and the injection on the trailing stream's leg.
  function drawModeTle(m: MOTle) {
    const { up, occ, entry, inj } = m;
    const tleSrcBoxX = tleHcSrcBoxX!;
    const tleIn23X  = tleSrcBoxX + ptleBoxW * 2 / 3;
    const tleOut13X = tleSrcBoxX + ptleBoxW * 1 / 3;
    const tleMidX   = tleSrcBoxX + ptleBoxW / 2;
    const tleBotY   = ptleBoxY + ptleBoxH, tleTopY = ptleBoxY;
    const yF1 = yMap[fph1Idx], yH1 = hasHTC1 ? yMap[htc1Idx] : yF1;
    const safeY = rzY + rzH + 46, qr = r;

    // HC-feed entry at the TLE bottom (single label, or a small two-leg fork).
    const drawTleInlet = (kind: 'single' | 'fork', labels: string[]) => {
      svg += `<line x1="${tleIn23X}" y1="${safeY}" x2="${tleIn23X}" y2="${tleBotY + 1}" stroke="${fph_c}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
      if (kind === 'fork') {
        const dxx = 13, dy = 12;
        svg += `<line x1="${tleIn23X - dxx}" y1="${safeY + dy}" x2="${tleIn23X}" y2="${safeY}" stroke="${fph_c}" stroke-width="1.5"/>`;
        svg += `<line x1="${tleIn23X + dxx}" y1="${safeY + dy}" x2="${tleIn23X}" y2="${safeY}" stroke="${fph_c}" stroke-width="1.5"/>`;
        drawLabel(tleIn23X - dxx, safeY + dy + 9, labels[0], fph_c, 'middle');
        drawLabel(tleIn23X + dxx, safeY + dy + 9, labels[1] ?? labels[0], fph_c, 'middle');
      } else {
        drawLabel(tleIn23X, safeY + 10, labels[0], fph_c, 'middle');
      }
    };

    if (up) {
      // chain TLE → FPH1 → HTC1
      if (entry.stage === 'TLE') drawTleInlet(entry.kind, entry.labels);
      else if (entry.stage === 'FPH1') {
        if (entry.kind === 'fork') drawLeftFork(yF1, entry.labels[0], entry.labels[1] ?? entry.labels[0], fph_c);
        else drawModeLeftEntry(yF1, entry.labels[0], fph_c);
      }
      if (occ.TLE && occ.FPH1) {
        const hasInj = inj?.onLeg === 'TLE>FPH1', yMid = (yF1 + safeY) / 2;
        requestLane('L', yF1, safeY, lx => {
          svg += `<path d="M ${tleOut13X} ${tleBotY} L ${tleOut13X} ${safeY - qr} Q ${tleOut13X} ${safeY} ${tleOut13X - qr} ${safeY} L ${lx + qr} ${safeY} Q ${lx} ${safeY} ${lx} ${safeY - qr} L ${lx} ${yF1 + qr} Q ${lx} ${yF1} ${lx + qr} ${yF1} L ${boxLeft} ${yF1}" fill="none" stroke="${fph_c}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
          if (hasInj) drawInjAt(lx, yMid, inj!.label, fph_c, 'L');
        }, hasInj ? injFootprint(yMid, inj!.label) : undefined);
      }
      if (occ.FPH1 && hasHTC1) {
        const hasInj = inj?.onLeg === 'FPH1>HTC1', yMid = (yF1 + yH1) / 2;
        requestLane('R', yF1, yH1, lx => {
          svg += `<path d="${rightUbend(yF1, yH1, lx)}" fill="none" stroke="${fph_c}" stroke-width="1.5"/>`;
          svg += `${arrowLeft(yH1)} fill="${fph_c}"/>`;
          if (hasInj) drawInjAt(lx, yMid, inj!.label, fph_c, 'R');
        }, hasInj ? injFootprint(yMid, inj!.label) : undefined);
      }
    } else {
      // chain FPH1 → TLE → HTC1
      const fph1Right = occ.TLE;   // FPH1 feeds the TLE on the right; bypassed-TLE uses a normal left inlet
      if (entry.stage === 'FPH1') {
        if (fph1Right) {
          if (entry.kind === 'fork') drawRightFork(yF1, entry.labels[0], entry.labels[1] ?? entry.labels[0], fph_c);
          else drawModeRightEntry(yF1, entry.labels[0], fph_c);
        } else {
          if (entry.kind === 'fork') drawLeftFork(yF1, entry.labels[0], entry.labels[1] ?? entry.labels[0], fph_c);
          else drawModeLeftEntry(yF1, entry.labels[0], fph_c);
        }
      } else if (entry.stage === 'TLE') {
        drawTleInlet(entry.kind, entry.labels);   // FPH1 bypassed → feed straight into the TLE
      }
      if (occ.FPH1 && occ.TLE) {
        const hasInj = inj?.onLeg === 'FPH1>TLE', yMid = (yF1 + safeY) / 2;
        requestLane('L', yF1, safeY, lx => {
          svg += `<path d="M ${boxLeft} ${yF1} L ${lx + qr} ${yF1} Q ${lx} ${yF1} ${lx} ${yF1 + qr} L ${lx} ${safeY - qr} Q ${lx} ${safeY} ${lx + qr} ${safeY} L ${tleMidX - qr} ${safeY} Q ${tleMidX} ${safeY} ${tleMidX} ${safeY - qr} L ${tleMidX} ${tleBotY + 1}" fill="none" stroke="${fph_c}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
          if (hasInj) drawInjAt(lx, yMid, inj!.label, fph_c, 'L');
        }, hasInj ? injFootprint(yMid, inj!.label) : undefined);
      }
      if (occ.TLE && hasHTC1) {
        svg += `<path d="M ${tleMidX} ${tleTopY} L ${tleMidX} ${yH1 + qr} Q ${tleMidX} ${yH1} ${tleMidX - qr} ${yH1} L ${boxRight + 8} ${yH1}" fill="none" stroke="${fph_c}" stroke-width="1.5"/>`;
        svg += `${arrowLeft(yH1)} fill="${fph_c}"/>`;
        if (inj?.onLeg === 'TLE>HTC1') drawInjAt(tleMidX, (tleTopY + yH1) / 2, inj.label, fph_c, 'L');
      }
      if (occ.FPH1 && !occ.TLE && hasHTC1) {
        requestLane('R', yF1, yH1, lx => {
          svg += `<path d="${rightUbend(yF1, yH1, lx)}" fill="none" stroke="${fph_c}" stroke-width="1.5"/>`;
          svg += `${arrowLeft(yH1)} fill="${fph_c}"/>`;
        });
      }
    }
  }

  if (mo) {
    drawModeFphHtc(mo);
  } else if (moTle) {
    drawModeTle(moTle);
  } else if (hasFPH1 && !hasFPH2) {
    const yF1 = yMap[fph1Idx];
    if (hcFeedDownstreamFph1) {
      // Inlet on the RIGHT; outlet (FPH1 left → under RZ → TLE bottom-centre) and the
      // TLE → HTC1 leg are drawn together in the "HC Feed downstream of FPH1" block below.
      drawRightEntry(yF1, fph1Label, fph_c);
    } else if (hasHTC1) {
      if (!hcFeedUpstreamFph1) drawLeftEntry(yF1, fph1Label, fph_c);
      const yH1 = yMap[htc1Idx];
      queueRightLane(yF1, yH1, lx => {
        svg += `<path d="${rightUbend(yF1, yH1, lx)}" fill="none" stroke="${fph_c}" stroke-width="1.5"/>`;
        svg += `${arrowLeft(yH1)} fill="${fph_c}"/>`;
      });
    } else {
      // No HTC — terminal right exit stub "to HTC"
      if (!hcFeedUpstreamFph1) drawLeftEntry(yF1, fph1Label, fph_c);
      addObsRight(STUB_TEXT_REACH, yF1);
      queueRightLane(yF1, yF1 + TEXT_HALF, lx => {
        svg += `<line x1="${boxRight}" y1="${yF1}" x2="${lx}" y2="${yF1}" stroke="${fph_c}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
        svg += `<text x="${lx + 4}" y="${yF1 - 4}" text-anchor="start" font-size="7" fill="${fph_c}">to HTC</text>`;
      });
    }
  } else if (bothFPH && fphSeries) {
    const yF1 = yMap[fph1Idx], yF2 = yMap[fph2Idx];
    // Skip the inlet label/arrow when a TLE feeds FPH1 from upstream — the feed (and
    // its "HC feed" text) is drawn at the TLE inlet instead (see HC-feed-upstream block).
    if (!hcFeedUpstreamFph1) drawLeftEntry(yF1, fph1Label, fph_c);
    queueRightLane(yF1, yF2, lx => {
      svg += `<path d="${rightUbend(yF1, yF2, lx)}" fill="none" stroke="${fph_c}" stroke-width="1.5"/>`;
      svg += `${arrowLeft(yF2)} fill="${fph_c}"/>`;
    });
    if (hasHTC1) {
      const yH1 = yMap[htc1Idx];
      queueLeftLane(yF2, yH1, lx => {
        svg += `<path d="M ${boxLeft} ${yF2} L ${lx + r} ${yF2} Q ${lx} ${yF2} ${lx} ${yF2 + r} L ${lx} ${yH1 - r} Q ${lx} ${yH1} ${lx + r} ${yH1} L ${boxLeft} ${yH1}" fill="none" stroke="${fph_c}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
      });
    } else {
      // No HTC — terminal left exit stub "to HTC"
      addObsLeft(STUB_TEXT_REACH, yF2);
      queueLeftLane(yF2, yF2 + TEXT_HALF, lx => {
        svg += `<line x1="${boxLeft}" y1="${yF2}" x2="${lx}" y2="${yF2}" stroke="${fph_c}" stroke-width="1.5" marker-end="url(#arrFPH2)"/>`;
        svg += `<text x="${lx - 4}" y="${yF2 - 4}" text-anchor="end" font-size="7" fill="${fph_c}">to HTC</text>`;
      });
    }
  } else if (bothFPH && !fphSeries) {
    const yF1 = yMap[fph1Idx], yF2 = yMap[fph2Idx];
    // FPH1 inlet label/arrow is suppressed when a TLE feeds it from upstream (text is
    // shown at the TLE inlet instead); FPH2 keeps its own parallel HC-feed entry.
    if (!hcFeedUpstreamFph1) drawLeftEntry(yF1, fph1Label, fph_c);
    drawLeftEntry(yF2, fph2Label, fph_c);
    const yTarget = hasHTC1 ? yMap[htc1Idx] : yF2;
    queueRightLane(yF1, yTarget, lx => {
      // FPH2 outlet travels straight out to the FPH1→HTC1 downcomer (the vertical lane
      // at x=lx) and points at it — the mixing point sits at (lx, yF2). Drawn first so
      // the downcomer line overlays the junction cleanly.
      svg += `<line x1="${boxRight}" y1="${yF2}" x2="${lx - 8}" y2="${yF2}" stroke="${fph_c}" stroke-width="1.5"/>`;
      svg += `<polygon points="${lx},${yF2} ${lx - 8},${yF2 - 4} ${lx - 8},${yF2 + 4}" fill="${fph_c}"/>`;
      if (hasHTC1) {
        const yH1 = yMap[htc1Idx];
        // FPH1 outlet traverses down the lane straight to the HTC1 inlet — the downcomer.
        svg += `<path d="${rightUbend(yF1, yH1, lx)}" fill="none" stroke="${fph_c}" stroke-width="1.5"/>`;
        svg += `${arrowLeft(yH1)} fill="${fph_c}"/>`;
      } else {
        // No HTC — FPH1 downcomer drops to the mixing level then exits right "to HTC".
        svg += `<path d="M ${boxRight} ${yF1} L ${lx - r} ${yF1} Q ${lx} ${yF1} ${lx} ${yF1 + r} L ${lx} ${yF2 - r} Q ${lx} ${yF2} ${lx + r} ${yF2} L ${lx + 14} ${yF2}" fill="none" stroke="${fph_c}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
        svg += `<text x="${lx + 18}" y="${yF2 - 4}" text-anchor="start" font-size="7" fill="${fph_c}">to HTC</text>`;
      }
    });
  }

  // ── HTC ──
  if (hasHTC1) {
    const yH1 = yMap[htc1Idx];
    // In feed-mode view the overlay engine draws the HTC1 inlet (fork/single) itself.
    if (!mo && htc1EntersLeft && !hasFPH1) drawLeftEntry(yH1, htcInletLabel || (hasDsg ? 'HC feed / Dil. Steam' : 'HC feed'), htc_c);
    if (hasHTC2) {
      const yH2 = yMap[htc2Idx];
      if (bothFPH) {
        queueRightLane(yH1, yH2, lx => {
          svg += `<path d="${rightUbend(yH1, yH2, lx)}" fill="none" stroke="${htc_c}" stroke-width="1.5"/>`;
          svg += `${arrowLeft(yH2)} fill="${htc_c}"/>`;
        });
      } else {
        queueLeftLane(yH1, yH2, lx => {
          svg += `<path d="${leftUbend(yH1, yH2, lx)}" fill="none" stroke="${htc_c}" stroke-width="1.5"/>`;
          svg += `${arrowRight(yH2)} fill="${htc_c}"/>`;
        });
      }
    }
  }

  // ── APH left stub ──
  if (hasAPH) {
    const yA = yMap[aphIdx];
    svg += `<text x="${boxLeft - STUB_LEN - 2}" y="${yA - 5}" text-anchor="end" font-size="7" fill="${aph_c}">Air from</text>`;
    svg += `<text x="${boxLeft - STUB_LEN - 2}" y="${yA + 5}" text-anchor="end" font-size="7" fill="${aph_c}">Atmosphere</text>`;
    svg += `<line x1="${boxLeft - STUB_LEN}" y1="${yA}" x2="${boxLeft}" y2="${yA}" stroke="${aph_c}" stroke-width="1.5" marker-end="url(#arrAPH)"/>`;
  }

  // ── Steam Drum ──
  const sdEcoExitY = hasECO1 ? (bothECO ? yMap[eco2Idx] : yMap[eco1Idx]) : (labelH + 4 + sdH / 2);
  let sdY = sdEcoExitY - sdH / 2;
  if (hasECO1 && !bothECO && hasHPSSH1) {
    const hLaneClearMin = 28;
    const sdYMin = labelH + arrowH + hLaneClearMin;
    if (sdY < sdYMin) sdY = sdYMin;
  }
  svg += `<rect x="${sdX}" y="${sdY}" width="${sdW}" height="${sdH}" rx="5" fill="${boxFill}" stroke="${compBd}" stroke-width="1.4"/>`;
  addSolidRect(sdX, sdY, sdW, sdH, 'STEAM DRUM');
  svg += `<text x="${sdX + sdW / 2}" y="${sdY + 14}" text-anchor="middle" font-size="7" fill="${SVG_TEXT_MUTED}" letter-spacing="1">STEAM DRUM</text>`;

  if (!hasHPSSH1) {
    const arrowX = sdX + sdW / 2, arrowY0 = sdY;
    const stubLen2 = STUB_LEN + 4;
    const arrowY1  = arrowY0 - stubLen2;
    svg += `<path d="M ${arrowX} ${arrowY0} L ${arrowX} ${arrowY1}" fill="none" stroke="${stm_c}" stroke-width="1.4" marker-end="url(#arrSTM)"/>`;
    svg += `<text x="${arrowX + 3}" y="${arrowY1 + 6}" text-anchor="start" font-size="6" fill="${stm_c}">Sat. Steam to Header</text>`;
  }

  // ECO → Steam Drum
  if (hasECO1) {
    const ecoExitIdx = bothECO ? eco2Idx : eco1Idx;
    const ecoMidY = yMap[ecoExitIdx];
    const sdMidY  = sdY + sdH / 2;
    const sdLeftX = sdX;
    const cr = 5;
    if (Math.abs(ecoMidY - sdMidY) < 1) {
      _hOccupy(_hOccR, ecoMidY, boxRight, sdLeftX);
      svg += `<line x1="${boxRight}" y1="${ecoMidY}" x2="${sdLeftX}" y2="${ecoMidY}" fill="none" stroke="${eco_c}" stroke-width="1.4" marker-end="url(#arrECO)"/>`;
    } else {
      const jogSpanTop = Math.min(ecoMidY, sdMidY);
      const jogSpanBot = Math.max(ecoMidY, sdMidY);
      const jogOff = _assignLane('R', jogSpanTop, jogSpanBot);
      const jogX   = boxRight + jogOff;
      const goDown = sdMidY > ecoMidY;
      _hOccupy(_hOccR, ecoMidY, boxRight, jogX);
      _hOccupy(_hOccR, sdMidY,  jogX,     sdLeftX);
      if (goDown) {
        svg += `<path d="M ${boxRight} ${ecoMidY} L ${jogX - cr} ${ecoMidY} Q ${jogX} ${ecoMidY} ${jogX} ${ecoMidY + cr} L ${jogX} ${sdMidY - cr} Q ${jogX} ${sdMidY} ${jogX + cr} ${sdMidY} L ${sdLeftX} ${sdMidY}" fill="none" stroke="${eco_c}" stroke-width="1.4" marker-end="url(#arrECO)"/>`;
      } else {
        svg += `<path d="M ${boxRight} ${ecoMidY} L ${jogX - cr} ${ecoMidY} Q ${jogX} ${ecoMidY} ${jogX} ${ecoMidY - cr} L ${jogX} ${sdMidY + cr} Q ${jogX} ${sdMidY} ${jogX + cr} ${sdMidY} L ${sdLeftX} ${sdMidY}" fill="none" stroke="${eco_c}" stroke-width="1.4" marker-end="url(#arrECO)"/>`;
      }
    }
  }

  // SD → HPSSH1
  if (hasHPSSH1) {
    const yH1SD = yMap[hpssh1Idx];
    const sdTopX = sdX + sdW / 2, sdTopY = sdY;
    const r6 = 6;
    const prefHY = sdTopY - r6 * 2;
    requestLane('R', prefHY, yH1SD, lx => {
      requestHLane('R', lx, sdTopX, sdTopX, prefHY, hY => {
        svg += `<path d="M ${sdTopX} ${sdTopY} L ${sdTopX} ${hY + r6} Q ${sdTopX} ${hY} ${sdTopX - r6} ${hY} L ${lx + r6} ${hY} Q ${lx} ${hY} ${lx} ${hY + r6} L ${lx} ${yH1SD - r6} Q ${lx} ${yH1SD} ${lx - r6} ${yH1SD} L ${boxRight + 1} ${yH1SD}" fill="none" stroke="${stm_c}" stroke-width="1.4" marker-end="url(#arrSTM)"/>`;
      });
    });
  }

  // ── PTLE box ──
  svg += `<rect x="${ptleBoxX}" y="${ptleBoxY}" width="${ptleBoxW}" height="${ptleBoxH}" rx="5" fill="${boxFill}" stroke="${compBd}" stroke-width="1.4"/>`;
  addSolidRect(ptleBoxX, ptleBoxY, ptleBoxW, ptleBoxH, 'PTLE');
  svg += `<text x="${ptleBoxCX}" y="${ptleBoxY + 14}" text-anchor="middle" font-size="7" fill="${SVG_TEXT_MUTED}" letter-spacing="1">PTLE</text>`;
  svg += `<text x="${ptleBoxCX}" y="${ptleBoxY + 30}" text-anchor="middle" font-size="10" font-weight="600" fill="${boxName}">${ptleName}</text>`;

  // SD ↔ PTLE
  const sdBotYPtle = sdY + sdH;
  const bfwX13 = ptleBoxX + ptleBoxW * 1 / 3;
  const stmX23 = ptleBoxX + ptleBoxW * 2 / 3;
  svg += `<path d="M ${bfwX13} ${sdBotYPtle} L ${bfwX13} ${ptleBoxY}" fill="none" stroke="${eco_c}" stroke-width="1.3" stroke-dasharray="3,2" marker-end="url(#arrECO)"/>`;
  svg += `<text x="${bfwX13 - 3}" y="${(sdBotYPtle + ptleBoxY) / 2}" text-anchor="end" font-size="6" fill="${eco_c}">BFW</text>`;
  svg += `<path d="M ${stmX23} ${ptleBoxY} L ${stmX23} ${sdBotYPtle}" fill="none" stroke="${stm_c}" stroke-width="1.3" stroke-dasharray="3,2" marker-end="url(#arrSTM)"/>`;
  svg += `<text x="${stmX23 + 3}" y="${(sdBotYPtle + ptleBoxY) / 2}" text-anchor="start" font-size="6" fill="${stm_c}">Steam</text>`;
  if (stleBfwSd) {
    const stleBfwX = sdX + sdW - ptleBoxW / 3;
    const stleStmX = sdX + sdW - 2 * ptleBoxW / 3;
    svg += `<path d="M ${stleBfwX} ${sdBotYPtle} L ${stleBfwX} ${ptleBoxY}" fill="none" stroke="${eco_c}" stroke-width="1.3" stroke-dasharray="3,2" marker-end="url(#arrECO)"/>`;
    svg += `<text x="${stleBfwX + 3}" y="${(sdBotYPtle + ptleBoxY) / 2}" text-anchor="start" font-size="6" fill="${eco_c}">BFW</text>`;
    svg += `<path d="M ${stleStmX} ${ptleBoxY} L ${stleStmX} ${sdBotYPtle}" fill="none" stroke="${stm_c}" stroke-width="1.3" stroke-dasharray="3,2" marker-end="url(#arrSTM)"/>`;
    svg += `<text x="${stleStmX - 3}" y="${(sdBotYPtle + ptleBoxY) / 2}" text-anchor="end" font-size="6" fill="${stm_c}">Steam</text>`;
  }

  // ── Cracked gas: RZ → PTLE ──
  const rzRight = rzX + rzW;
  function htcRightToRzRight(yHtc: number) {
    const entryY = rzY + rzH * 1 / 3;
    requestLane('R', yHtc, entryY, lx => {
      const qr = 5;
      svg += `<path d="M ${boxRight} ${yHtc} L ${lx - qr} ${yHtc} Q ${lx} ${yHtc} ${lx} ${yHtc + qr} L ${lx} ${entryY - qr} Q ${lx} ${entryY} ${lx - qr} ${entryY} L ${rzRight + 1} ${entryY}" fill="none" stroke="${htc_c}" stroke-width="1.5" marker-end="url(#arrHTC)"/>`;
    });
    return entryY;
  }
  function htcLeftToRzLeft(yHtc: number) {
    const entryY = rzY + rzH / 2;
    requestLane('L', yHtc, entryY, lx => {
      const qr = 5;
      svg += `<path d="M ${boxLeft} ${yHtc} L ${lx + qr} ${yHtc} Q ${lx} ${yHtc} ${lx} ${yHtc + qr} L ${lx} ${entryY - qr} Q ${lx} ${entryY} ${lx + qr} ${entryY} L ${rzX - 1} ${entryY}" fill="none" stroke="${htc_c}" stroke-width="1.5" marker-end="url(#arrHTC)"/>`;
    });
    return entryY;
  }
  function cgRzRightToPtle(cgY: number) {
    svg += `<line x1="${rzRight}" y1="${cgY}" x2="${ptleBoxX}" y2="${cgY}" stroke="${cgCol}" stroke-width="1.4" marker-end="url(#arrCG)"/>`;
  }

  if (hasHTC1 && !hasHTC2) {
    const cgExitY = rzY + rzH * 2 / 3;
    if (bothFPH && !fphSeries) htcLeftToRzLeft(yMap[htc1Idx]);
    else if (bothFPH && fphSeries) htcRightToRzRight(yMap[htc1Idx]);
    else if (!htc1EntersLeft) htcLeftToRzLeft(yMap[htc1Idx]);
    else {
      const wrapBotY = rzY + rzH + 30, htcEntryY = rzY + rzH / 2, yHtc1 = yMap[htc1Idx];
      const wrapState: { wrapLane?: number; htcLaneX?: number } = {};
      requestLane('R', yHtc1, wrapBotY, lx => { wrapState.wrapLane = lx; });
      requestLane('L', wrapBotY, htcEntryY, lx => { wrapState.htcLaneX = lx; });
      laneRequests.push({ side: '_draw', yTop: 0, yBot: 0, span: Infinity, innerE: 0, outerE: 0, boxYTop: 0, boxYBot: 0, drawFn: () => {
        const wl = wrapState.wrapLane!, hl = wrapState.htcLaneX!, qrh = 5;
        svg += `<path d="M ${boxRight} ${yHtc1} L ${wl - qrh} ${yHtc1} Q ${wl} ${yHtc1} ${wl} ${yHtc1 + qrh} L ${wl} ${wrapBotY - qrh} Q ${wl} ${wrapBotY} ${wl - qrh} ${wrapBotY} L ${hl + qrh} ${wrapBotY} Q ${hl} ${wrapBotY} ${hl} ${wrapBotY - qrh} L ${hl} ${htcEntryY + qrh} Q ${hl} ${htcEntryY} ${hl + qrh} ${htcEntryY} L ${rzX - 1} ${htcEntryY}" fill="none" stroke="${htc_c}" stroke-width="1.5" marker-end="url(#arrHTC)"/>`;
      }});
    }
    cgRzRightToPtle(cgExitY);
  } else if (hasHTC2) {
    const cgExitY2 = rzY + rzH * 2 / 3;
    if (bothFPH && fphSeries) htcLeftToRzLeft(yMap[htc2Idx]);
    else htcRightToRzRight(yMap[htc2Idx]);
    cgRzRightToPtle(cgExitY2);
  } else {
    const cgMidY = rzY + rzH / 2;
    svg += `<line x1="${rzRight}" y1="${cgMidY}" x2="${ptleBoxX}" y2="${cgMidY}" stroke="${cgCol}" stroke-width="1.4" marker-end="url(#arrCG)"/>`;
    svg += `<text x="${(rzRight + ptleBoxX) / 2}" y="${cgMidY - 4}" text-anchor="middle" font-size="6" fill="${cgCol}">Cracked Gas</text>`;
  }

  // APH → RZ
  if (hasAPH) {
    const yA2 = yMap[aphIdx];
    const rzBot2 = rzY + rzH, rzAirX2 = rzX + rzW * 2 / 3, rzFuelX2 = rzX + rzW * 1 / 3;
    const rzBotY2 = rzBot2 + 22;
    requestLane('R', yA2, rzBotY2, lx => {
      const qr2 = 6;
      svg += `<path d="M ${boxRight} ${yA2} L ${lx - qr2} ${yA2} Q ${lx} ${yA2} ${lx} ${yA2 + qr2} L ${lx} ${rzBotY2 - qr2} Q ${lx} ${rzBotY2} ${lx - qr2} ${rzBotY2} L ${rzAirX2 + qr2} ${rzBotY2} Q ${rzAirX2} ${rzBotY2} ${rzAirX2} ${rzBotY2 - qr2} L ${rzAirX2} ${rzBot2 + 1}" fill="none" stroke="${aph_c}" stroke-width="1.5" marker-end="url(#arrAPH)"/>`;
    });
    svg += `<line x1="${rzFuelX2}" y1="${rzBotY2}" x2="${rzFuelX2}" y2="${rzBot2 + 1}" stroke="${fuel_c}" stroke-width="1.5" marker-end="url(#arrFuel)"/>`;
    svg += `<text x="${rzFuelX2}" y="${rzBotY2 + 10}" text-anchor="middle" font-size="6" fill="${fuel_c}">Fuel</text>`;
  }

  // ── PTLE → STLE → TTLE chain ──
  const tleMidY = ptleBoxY + ptleBoxH / 2;
  if (hasStle) {
    svg += `<line x1="${ptleBoxX + ptleBoxW}" y1="${tleMidY}" x2="${stleBoxX}" y2="${tleMidY}" stroke="${cgCol}" stroke-width="1.4" marker-end="url(#arrCG)"/>`;
    // Dim the HC-feed TLE box (STLE/TTLE) when the active mode bypasses it (tleBoxDimX).
    if (tleBoxDimX === stleBoxX) svg += `<g opacity="0.3">`;
    svg += `<rect x="${stleBoxX}" y="${ptleBoxY}" width="${ptleBoxW}" height="${ptleBoxH}" rx="5" fill="${boxFill}" stroke="${compBd}" stroke-width="1.4"/>`;
    svg += `<text x="${stleBoxX + ptleBoxW / 2}" y="${ptleBoxY + 14}" text-anchor="middle" font-size="7" fill="${SVG_TEXT_MUTED}" letter-spacing="1">STLE</text>`;
    svg += `<text x="${stleBoxX + ptleBoxW / 2}" y="${ptleBoxY + 30}" text-anchor="middle" font-size="10" font-weight="600" fill="${boxName}">${stleName}</text>`;
    if (tleBoxDimX === stleBoxX) svg += `</g>`;
    addSolidRect(stleBoxX, ptleBoxY, ptleBoxW, ptleBoxH, 'STLE');
    if (hasTtle) {
      svg += `<line x1="${stleBoxX + ptleBoxW}" y1="${tleMidY}" x2="${ttleBoxX}" y2="${tleMidY}" stroke="${cgCol}" stroke-width="1.4" marker-end="url(#arrCG)"/>`;
      if (tleBoxDimX === ttleBoxX) svg += `<g opacity="0.3">`;
      svg += `<rect x="${ttleBoxX}" y="${ptleBoxY}" width="${ptleBoxW}" height="${ptleBoxH}" rx="5" fill="${boxFill}" stroke="${compBd}" stroke-width="1.4"/>`;
      svg += `<text x="${ttleBoxX + ptleBoxW / 2}" y="${ptleBoxY + 14}" text-anchor="middle" font-size="7" fill="${SVG_TEXT_MUTED}" letter-spacing="1">TTLE</text>`;
      svg += `<text x="${ttleBoxX + ptleBoxW / 2}" y="${ptleBoxY + 30}" text-anchor="middle" font-size="10" font-weight="600" fill="${boxName}">${ttleName}</text>`;
      if (tleBoxDimX === ttleBoxX) svg += `</g>`;
      addSolidRect(ttleBoxX, ptleBoxY, ptleBoxW, ptleBoxH, 'TTLE');
      const lastX = ttleBoxX + ptleBoxW;
      svg += `<line x1="${lastX}" y1="${tleMidY}" x2="${lastX + 20}" y2="${tleMidY}" stroke="${cgCol}" stroke-width="1.3" marker-end="url(#arrCG)"/>`;
      svg += `<text x="${lastX + 24}" y="${tleMidY - 4}" text-anchor="start" font-size="6" fill="${cgCol}">Cracked</text>`;
      svg += `<text x="${lastX + 24}" y="${tleMidY + 5}" text-anchor="start" font-size="6" fill="${cgCol}">Gas out</text>`;
    } else {
      const lastX = stleBoxX + ptleBoxW;
      svg += `<line x1="${lastX}" y1="${tleMidY}" x2="${lastX + 20}" y2="${tleMidY}" stroke="${cgCol}" stroke-width="1.3" marker-end="url(#arrCG)"/>`;
      svg += `<text x="${lastX + 24}" y="${tleMidY - 4}" text-anchor="start" font-size="6" fill="${cgCol}">Cracked</text>`;
      svg += `<text x="${lastX + 24}" y="${tleMidY + 5}" text-anchor="start" font-size="6" fill="${cgCol}">Gas out</text>`;
    }
  } else {
    const lastX = ptleBoxX + ptleBoxW;
    svg += `<line x1="${lastX}" y1="${tleMidY}" x2="${lastX + 20}" y2="${tleMidY}" stroke="${cgCol}" stroke-width="1.3" marker-end="url(#arrCG)"/>`;
    svg += `<text x="${lastX + 24}" y="${tleMidY - 4}" text-anchor="start" font-size="6" fill="${cgCol}">Cracked</text>`;
    svg += `<text x="${lastX + 24}" y="${tleMidY + 5}" text-anchor="start" font-size="6" fill="${cgCol}">Gas out</text>`;
  }

  // ── HC Feed upstream of FPH1 ──
  // Suppressed in feed-mode view — drawModeTle draws the (relabelled / forked / injected)
  // TLE→FPH1→HTC1 flow itself.
  if (!moTle && hcFeedUpstreamFph1 && hasFPH1) {
    const tleSrcBoxX = (hasTtle && ttleHcFeedUpFph1) ? ttleBoxX : stleBoxX;
    const tleIn23X  = tleSrcBoxX + ptleBoxW * 2 / 3;
    const tleOut13X = tleSrcBoxX + ptleBoxW * 1 / 3;
    const tleBotY   = ptleBoxY + ptleBoxH;
    const yF1       = yMap[fph1Idx];
    const rzBot     = rzY + rzH;
    const safeY     = rzBot + 46;
    const qr        = r;
    svg += `<line x1="${tleIn23X}" y1="${safeY}" x2="${tleIn23X}" y2="${tleBotY + 1}" stroke="${fph_c}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
    svg += `<text x="${tleIn23X}" y="${safeY + 10}" text-anchor="middle" font-size="7" fill="${fph_c}">HC feed</text>`;
    requestLane('L', yF1, safeY, lx => {
      svg += `<path d="M ${tleOut13X} ${tleBotY} L ${tleOut13X} ${safeY - qr} Q ${tleOut13X} ${safeY} ${tleOut13X - qr} ${safeY} L ${lx + qr} ${safeY} Q ${lx} ${safeY} ${lx} ${safeY - qr} L ${lx} ${yF1 + qr} Q ${lx} ${yF1} ${lx + qr} ${yF1} L ${boxLeft} ${yF1}" fill="none" stroke="${fph_c}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
    });
  }

  // ── HC Feed downstream of FPH1 → TLE → HTC1 ──
  // FPH1 left outlet drops down the left gutter, runs RIGHT under the radiation zone
  // (below the Fuel/Combustion-Air arrows at safeY), then turns UP into the TLE bottom
  // centre. The TLE top centre then rises and turns into the HTC1 right inlet.
  if (!moTle && hcFeedDownstreamFph1 && hasFPH1) {
    const tleSrcBoxX = (hasTtle && ttleHcFeedDownFph1) ? ttleBoxX : stleBoxX;
    const tleMidX  = tleSrcBoxX + ptleBoxW / 2;        // 1/2 of TLE width
    const tleTopY2 = ptleBoxY;
    const tleBotY  = ptleBoxY + ptleBoxH;
    const yF1      = yMap[fph1Idx];
    const rzBot    = rzY + rzH;
    const safeY    = rzBot + 46;                        // below fuel/combustion-air labels
    const qr       = r;
    // Leg 1: FPH1 left outlet → down left gutter → right under RZ → up into TLE bottom centre.
    requestLane('L', yF1, safeY, lx => {
      svg += `<path d="M ${boxLeft} ${yF1} L ${lx + qr} ${yF1} Q ${lx} ${yF1} ${lx} ${yF1 + qr} L ${lx} ${safeY - qr} Q ${lx} ${safeY} ${lx + qr} ${safeY} L ${tleMidX - qr} ${safeY} Q ${tleMidX} ${safeY} ${tleMidX} ${safeY - qr} L ${tleMidX} ${tleBotY + 1}" fill="none" stroke="${fph_c}" stroke-width="1.5" marker-end="url(#arrFPH)"/>`;
    });
    // Leg 2: TLE top centre → up → left into HTC1 right inlet.
    if (hasHTC1) {
      const yH1b = yMap[htc1Idx];
      svg += `<path d="M ${tleMidX} ${tleTopY2} L ${tleMidX} ${yH1b + qr} Q ${tleMidX} ${yH1b} ${tleMidX - qr} ${yH1b} L ${boxRight + 8} ${yH1b}" fill="none" stroke="${fph_c}" stroke-width="1.5"/>`;
      svg += `${arrowLeft(yH1b)} fill="${fph_c}"/>`;
    }
  }

  // ── Cold BFW upstream of ECO1 ──
  if (tleColdBfwUpstreamEco1 && hasECO1) {
    const srcBoxX = hasTtle ? ttleBoxX : stleBoxX;
    const srcCX = srcBoxX + ptleBoxW / 2;
    const srcTopY = ptleBoxY;
    const srcBotY = ptleBoxY + ptleBoxH;
    const yE1b = yMap[eco1Idx];
    const qr2 = 5;
    if (bothECO) {
      svg += `<line x1="${srcCX}" y1="${srcBotY + 18}" x2="${srcCX}" y2="${srcBotY + 1}" stroke="${eco_c}" stroke-width="1.5" marker-end="url(#arrECO)"/>`;
      svg += `<text x="${srcCX}" y="${srcBotY + 28}" text-anchor="middle" font-size="7" fill="${eco_c}">Boiler feed</text>`;
      svg += `<text x="${srcCX}" y="${srcBotY + 37}" text-anchor="middle" font-size="7" fill="${eco_c}">water</text>`;
      _hOccupy(_hOccR, yE1b, boxRight, srcCX);
      svg += `<path d="M ${srcCX} ${srcTopY} L ${srcCX} ${yE1b + qr2} Q ${srcCX} ${yE1b} ${srcCX - qr2} ${yE1b} L ${boxRight + 1} ${yE1b}" fill="none" stroke="${eco_c}" stroke-width="1.5" marker-end="url(#arrECO)"/>`;
    } else {
      const arrowLen2 = 18;
      svg += `<line x1="${srcCX}" y1="${srcTopY - arrowLen2}" x2="${srcCX}" y2="${srcTopY - 1}" stroke="${eco_c}" stroke-width="1.5" marker-end="url(#arrECO)"/>`;
      svg += `<text x="${srcCX}" y="${srcTopY - arrowLen2 - 8}" text-anchor="middle" font-size="7" fill="${eco_c}">Boiler feed</text>`;
      svg += `<text x="${srcCX}" y="${srcTopY - arrowLen2 - 1}" text-anchor="middle" font-size="7" fill="${eco_c}">water in</text>`;
      const hY2 = fuelStubClearY ? fuelStubClearY : srcBotY + 20;
      requestLane('L', yE1b, hY2, lx => {
        svg += `<path d="M ${srcCX} ${srcBotY} L ${srcCX} ${hY2 - qr2} Q ${srcCX} ${hY2} ${srcCX - qr2} ${hY2} L ${lx + qr2} ${hY2} Q ${lx} ${hY2} ${lx} ${hY2 - qr2} L ${lx} ${yE1b + qr2} Q ${lx} ${yE1b} ${lx + qr2} ${yE1b} L ${boxLeft} ${yE1b}" fill="none" stroke="${eco_c}" stroke-width="1.5" marker-end="url(#arrECO)"/>`;
      });
    }
  }

  // ── Resolve lanes ──
  resolveAllLanes();

  // ── Animate flow pipes ─────────────────────────────────────────────────────
  // Convert every flow <line>/<path> drawn above into moving dashes that travel
  // toward its arrowhead, keeping each line's own stroke colour (no gradient).
  // This runs BEFORE the arrow <marker> defs are appended below, so arrowheads
  // (markers) and <polygon> arrows are never dashed/animated — the dashes simply
  // flow into them. Paths are drawn source→arrow, so a negative dash-offset
  // animation already moves toward the arrow without per-line direction logic.
  //
  // IMPORTANT: this transform is generic — ANY <line>/<path> added to the SVG
  // above this point is animated automatically and inherits this rule. The only
  // opt-out is the bridgewall hatch colour (#3a4e5c). Existing stroke-dasharray
  // values (e.g. the SD↔TLE BFW/Steam pipes) are replaced, so statically dashed
  // pipes are treated as continuous lines and animated like the rest.
  {
    const uid = Math.random().toString(36).slice(2, 7);
    const cls = `cbf_${uid}`;
    const DASH = '10 7', PERIOD = 17;
    const HATCH = SVG_HATCH; // bridgewall hatch — stays static
    const styleEl = `<style>@keyframes k_${uid}{from{stroke-dashoffset:0}to{stroke-dashoffset:-${PERIOD}}}.${cls}{animation:k_${uid} 0.9s linear infinite}</style>`;
    // Inject the <style> immediately after the opening <svg …> tag.
    svg = svg.replace(/(<svg\b[^>]*>)/, `$1${styleEl}`);
    // Tag each flow line/path with the animated dash class (skip the hatch).
    svg = svg.replace(/<(line|path)\b([^>]*?)\/>/g, (m, tag, attrs) => {
      if (attrs.includes(`stroke="${HATCH}"`)) return m;
      const cleaned = attrs.replace(/\s*stroke-dasharray="[^"]*"/g, '');
      return `<${tag}${cleaned} stroke-dasharray="${DASH}" stroke-linecap="round" class="${cls}"/>`;
    });
  }

  // ── Firebox flames (rising from the radiation-zone bottom edge) ──
  // Three flames at 1/4, 2/4, 3/4 of the bottom edge, each half the box tall, pointing
  // up into the box. Realism comes from morphing the silhouette (animating the path
  // `d`) rather than scaling the whole shape — the outline licks and wavers like real
  // fire instead of pulsing as one rigid blob. Colours are blue: a cracking furnace
  // fires gaseous fuel with clean, complete combustion, so the burner flames burn blue
  // (orange/yellow would mean sooting). Four nested layers (soft halo → deep-blue body
  // → blue → pale blue-white core) give depth, and a slow drift + core brightness
  // flicker add life. Appended AFTER the flow-dash post-processor so they're never
  // turned into pipe dashes. The base point (0,0) stays pinned to the bottom edge in
  // every frame, so the flames never detach from the radiation-zone floor.
  {
    const flH     = rzH / 2;                      // flame height = half box height
    const flHW    = Math.min(rzW / 8, 11);        // outer half-width
    const flBaseY = rzY + rzH;                    // radiation-zone bottom edge
    const n2 = (v: number) => v.toFixed(2);
    // One silhouette with a fixed command structure (M + 4×C + Z) so the `d` morph
    // interpolates cleanly between frames. tipX leans the tip; lw/rw breathe the sides.
    const flamePath = (hw: number, h: number, tipX: number, tipH: number, lw: number, rw: number) => {
      const ty = -h * tipH;
      return `M 0 0 `
        + `C ${n2(-hw * lw)} ${n2(-h * 0.2)} ${n2(-hw * 0.78 * lw)} ${n2(-h * 0.62)} ${n2(tipX - hw * 0.22 * lw)} ${n2(-h * 0.85)} `
        + `C ${n2(tipX - hw * 0.06)} ${n2(-h * 0.93)} ${n2(tipX)} ${n2(ty * 0.95)} ${n2(tipX)} ${n2(ty)} `
        + `C ${n2(tipX)} ${n2(ty * 0.95)} ${n2(hw * 0.52 * rw)} ${n2(-h * 0.72)} ${n2(hw * 0.46 * rw)} ${n2(-h * 0.5)} `
        + `C ${n2(hw * 0.96 * rw)} ${n2(-h * 0.28)} ${n2(hw * 0.72 * rw)} ${n2(-h * 0.06)} 0 0 Z`;
    };
    // Frame shapes: lean-left → settle → lean-right → tall-lean, looped back to frame 0
    // for a seamless cycle. [tipXfactor, tipHeight, leftWidth, rightWidth]
    const SHAPES: [number, number, number, number][] = [
      [0.00, 1.00, 1.00, 1.00],
      [-0.16, 1.09, 1.10, 0.90],
      [0.06, 0.95, 0.94, 1.06],
      [0.20, 1.05, 0.90, 1.12],
    ];
    const morphValues = (hw: number, h: number) => {
      const fr = SHAPES.map(([tx, th, lw, rw]) => flamePath(hw, h, tx * hw, th, lw, rw));
      return [...fr, fr[0]].join(';');
    };
    const KT = '0;0.25;0.5;0.75;1';
    const KS = '0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1';
    // [widthFactor, heightFactor, fill, opacity] — drawn back-to-front (halo first)
    const LAYERS: [number, number, string, number][] = [
      [1.30, 1.10, '#38bdf8', 0.22],   // soft blue halo
      [1.00, 1.00, '#1d4ed8', 1],      // deep-blue body
      [0.70, 0.82, '#3b82f6', 1],      // blue
      [0.40, 0.60, '#bfdbfe', 1],      // pale blue-white core
    ];
    const flPhases = [{ dur: 1.5, begin: 0 }, { dur: 1.22, begin: -0.5 }, { dur: 1.74, begin: -0.95 }];
    for (let k = 0; k < 3; k++) {
      const fcx = rzX + rzW * (k + 1) / 4;
      const { dur, begin } = flPhases[k];
      // Slow horizontal drift of the whole flame (transform, not `d`, so no conflict).
      const sway = `<animateTransform attributeName="transform" type="translate" additive="sum" calcMode="spline" values="0 0;0.7 0;-0.5 0;0 0" keyTimes="0;0.35;0.7;1" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" dur="${(dur * 1.6).toFixed(2)}s" begin="${begin}s" repeatCount="indefinite"/>`;
      let layers = '';
      LAYERS.forEach(([wf, hf, fill, op], li) => {
        const hw = flHW * wf, h = flH * hf;
        const opAttr = op < 1 ? ` opacity="${op}"` : '';
        const dAnim = `<animate attributeName="d" values="${morphValues(hw, h)}" keyTimes="${KT}" keySplines="${KS}" calcMode="spline" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>`;
        // Core layer also flickers brightness, on a faster cycle, for a hot shimmer.
        const flick = li === LAYERS.length - 1
          ? `<animate attributeName="opacity" values="0.78;1;0.88;1;0.78" keyTimes="${KT}" keySplines="${KS}" calcMode="spline" dur="${(dur * 0.55).toFixed(2)}s" begin="${begin}s" repeatCount="indefinite"/>`
          : '';
        layers += `<path d="${flamePath(hw, h, 0, 1, 1, 1)}" fill="${fill}"${opAttr}>${dAnim}${flick}</path>`;
      });
      svg += `<g transform="translate(${fcx} ${flBaseY})">${sway}${layers}</g>`;
    }
  }

  // ── Steam Drum water (half full, gently waving) + rising bubbles ──
  // Drawn AFTER the flow-dash post-processor so the wavy surface and bubbles are
  // never turned into travelling pipe-dashes. The drum shows a half-full body of
  // BFW: a translucent gradient from the mid-height waterline down to the rounded
  // floor, a light surface line that ripples via a `d` morph (mild travelling
  // waves, same technique as the flames), and a few bubbles that rise from the
  // floor and pop at the surface. Everything is clipped to the drum rect so it
  // respects the rounded corners and never spills past the walls.
  {
    const n2 = (v: number) => v.toFixed(2);
    const wuid   = Math.random().toString(36).slice(2, 7);
    const wLeft  = sdX, wRight = sdX + sdW;
    const wTop   = sdY + sdH / 2;             // waterline at half height
    const wBot   = sdY + sdH;
    const amp    = Math.min(2, sdH * 0.06) * 0.75;   // mild wave amplitude (reduced to 3/4)
    const waveW  = 16;                          // wavelength
    const steps  = Math.max(16, Math.round(sdW / 3));
    const k      = (2 * Math.PI) / waveW;
    // Top-edge sample points for a given travelling-wave phase.
    const topPts = (ph: number) => {
      const pts: string[] = [];
      for (let s = 0; s <= steps; s++) {
        const x = wLeft + (sdW * s) / steps;
        const y = wTop - amp * Math.sin(k * (x - wLeft) + ph);
        pts.push(`${n2(x)} ${n2(y)}`);
      }
      return pts;
    };
    const fillD = (ph: number) => `M ${topPts(ph).join(' L ')} L ${n2(wRight)} ${n2(wBot)} L ${n2(wLeft)} ${n2(wBot)} Z`;
    const lineD = (ph: number) => `M ${topPts(ph).join(' L ')}`;
    const FRAMES = 8;
    const phases: number[] = [];
    for (let i = 0; i <= FRAMES; i++) phases.push((2 * Math.PI * i) / FRAMES);
    const fillVals = phases.map(fillD).join(';');
    const lineVals = phases.map(lineD).join(';');
    const WAVE_DUR = 4.5;

    let water = `<defs>`;
    water += `<clipPath id="sdwClip_${wuid}"><rect x="${sdX}" y="${sdY}" width="${sdW}" height="${sdH}" rx="5"/></clipPath>`;
    water += `<linearGradient id="sdwGrad_${wuid}" x1="0" y1="0" x2="0" y2="1">`;
    water += `<stop offset="0" stop-color="${eco_c}" stop-opacity="0.50"/>`;
    water += `<stop offset="1" stop-color="${eco_c}" stop-opacity="0.80"/>`;
    water += `</linearGradient></defs>`;
    water += `<g clip-path="url(#sdwClip_${wuid})">`;
    // Water body.
    water += `<path d="${fillD(0)}" fill="url(#sdwGrad_${wuid})"><animate attributeName="d" values="${fillVals}" dur="${WAVE_DUR}s" calcMode="linear" repeatCount="indefinite"/></path>`;
    // Surface highlight line.
    water += `<path d="${lineD(0)}" fill="none" stroke="#bfeeff" stroke-width="0.8" stroke-opacity="0.8" stroke-linecap="round"><animate attributeName="d" values="${lineVals}" dur="${WAVE_DUR}s" calcMode="linear" repeatCount="indefinite"/></path>`;
    // Rising steam bubbles — born at the floor, they climb past the waterline and
    // up to the top edge where they pop, signalling steam leaving the drum. Coloured
    // to match the steam line (purple fill + border). Staggered, wobbling, growing.
    const BUBBLES = Math.max(4, Math.round(sdW / 22));
    for (let b = 0; b < BUBBLES; b++) {
      const bx     = wLeft + (sdW * (b + 0.5)) / BUBBLES;
      const r      = 0.9 + (b % 3) * 0.5;
      const dur    = 2.4 + (b % 4) * 0.7;
      const begin  = -(b * 0.6);
      const yStart = wBot - 2;
      const yEnd   = sdY + 1;                 // rise to the top edge of the drum
      const wob    = b % 2 ? 2 : -2;
      water += `<circle cx="${n2(bx)}" cy="${n2(yStart)}" r="${n2(r)}" fill="${stm_c}" fill-opacity="0.55" stroke="${stm_c}" stroke-width="0.6">`
        + `<animate attributeName="cy" values="${n2(yStart)};${n2(yEnd)}" dur="${dur}s" begin="${begin}s" calcMode="linear" repeatCount="indefinite"/>`
        + `<animate attributeName="cx" values="${n2(bx)};${n2(bx + wob)};${n2(bx)}" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" dur="${(dur / 2).toFixed(2)}s" begin="${begin}s" repeatCount="indefinite"/>`
        + `<animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.12;0.82;1" dur="${dur}s" begin="${begin}s" calcMode="linear" repeatCount="indefinite"/>`
        + `<animate attributeName="r" values="${n2(r * 0.4)};${n2(r * 1.4)}" dur="${dur}s" begin="${begin}s" calcMode="linear" repeatCount="indefinite"/>`
        + `</circle>`;
    }
    water += `</g>`;
    svg += water;
  }

  // ── Arrow marker defs ──
  svg += `<defs>
    <marker id="arrFPH"    markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${fph_c}"/></marker>
    <marker id="arrFPH2"   markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 Z" fill="${fph_c}"/></marker>
    <marker id="arrHTC"    markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${htc_c}"/></marker>
    <marker id="arrAPH"    markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${aph_c}"/></marker>
    <marker id="arrECO"    markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${eco_c}"/></marker>
    <marker id="arrECO2"   markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 Z" fill="${eco_c}"/></marker>
    <marker id="arrFluGas" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${bank_c}"/></marker>
    <marker id="arrCG"     markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${SVG_STREAM_CRACKED_GAS}"/></marker>
    <marker id="arrFuel"   markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${fuel_c}"/></marker>
    <marker id="arrSTM"    markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${stm_c}"/></marker>
    <marker id="arrSTM2"   markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 Z" fill="${stm_c}"/></marker>
  </defs>`;

  svg += `</svg>`;
  return svg;
}
