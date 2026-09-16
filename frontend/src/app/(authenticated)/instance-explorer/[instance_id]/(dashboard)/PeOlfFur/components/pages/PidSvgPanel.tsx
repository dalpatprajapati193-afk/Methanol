'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { PidVars } from '../../store/FmsAtoms';
import { strokeCol, feedFromId } from '../../constants/PidLogic';
import {
  computePidLayout, vdrop, buildSpillPaths, PidLayout, VIEW_X, VIEW_W,
  SP_OFF, SP3_OFF, MN3_OFF, XRCY_OFF, LANE_X0, END_HALF, BASE_Z, END_Z, CONTENT_L,
} from '../../constants/PidLayout';
import styles from '../../Style.module.css';
import { clsx } from 'clsx';

type Val = 0 | 1 | null;

// ── Recolor / visibility layer ───────────────────────────────────────────────────
// These mutate the rendered SVG by id after each render. Every helper early-returns on
// a missing element (lanes the layout dropped). Only ACTIVE (=== 1) elements are shown
// and coloured; anything else is hidden outright — there is no grey/unresolved state.
function _show(el: SVGElement, on: boolean) { el.style.display = on ? '' : 'none'; }

function _ss(el: SVGElement | null, id: string, val: Val, dash?: boolean) {
  if (!el) return;
  if (val !== 1) { _show(el, false); el.removeAttribute('data-flow-active'); return; }
  _show(el, true);
  el.setAttribute('stroke', strokeCol(id, 1));
  el.setAttribute('stroke-width', '1.8');
  if (el.getAttribute('marker-end')) el.setAttribute('marker-end', `url(#m${_markerKey(id)})`);
  if (dash) el.setAttribute('stroke-dasharray', '4 2'); else el.removeAttribute('stroke-dasharray');
  el.setAttribute('data-flow-active', '1');
}

function _markerKey(id: string): string {
  const f = feedFromId(id);
  const MAP: Record<string, string> = { eth:'Eth', pro:'Pro', but:'But', nap:'Nap', gfr:'Gfr', gtf:'Gtf' };
  return f ? (MAP[f] || 'G') : 'G';
}

function _op(el: SVGElement | null, val: Val) {
  if (el) _show(el, val === 1);
}

function _mn(el: SVGElement | null, id: string, val: Val) {
  if (!el) return;
  if (val !== 1) { _show(el, false); return; }
  _show(el, true);
  el.setAttribute('fill', strokeCol(id, 1));
  el.setAttribute('opacity', '1');
}

function _sn(el: SVGElement | null, id: string, val: Val) {
  if (!el) return;
  if (val !== 1) { _show(el, false); return; }
  _show(el, true);
  el.setAttribute('stroke', strokeCol(id, 1));
  el.setAttribute('opacity', '1');
}

function cx(v: PidVars, rc: string, t: string): Val {
  const rv = v['rcy_'+rc] as Val, rt = v[`rcy_${rc}_to_${t}`] as Val;
  return rv===1&&rt===1?1:rv===0||rt===0?0:null;
}

function trunkVal(...vals: Val[]): Val {
  if (vals.some(x=>x===1)) return 1;
  if (vals.every(x=>x===0)) return 0;
  return null;
}

export function updatePidSvg(svg: SVGSVGElement, v: PidVars) {
  const $ = (id: string) => svg.getElementById(id) as SVGElement | null;

  const E = v['eth_exists'] as Val, P = v['pro_exists'] as Val, B = v['but_exists'] as Val, N = v['ff_nap'] as Val;

  _op($('bx-eth-ff'), v['ff_eth'] as Val); _op($('bx-pro-ff'), v['ff_pro'] as Val);
  _op($('bx-but-ff'), v['ff_but'] as Val); _op($('bx-nap-ff'), N);
  ['eth','pro','but'].forEach(c => _op($('rb-'+c), v['rcy_'+c] as Val));

  const oe  = v['rcy_eth']===1&&v['rcy_eth_to_eth']===1?1:v['rcy_eth']===0||v['rcy_eth_to_eth']===0?0:null as Val;
  const opr = v['rcy_pro']===1&&v['rcy_pro_to_pro']===1?1:v['rcy_pro']===0||v['rcy_pro_to_pro']===0?0:null as Val;
  const ob  = v['rcy_but']===1&&v['rcy_but_to_but']===1?1:v['rcy_but']===0||v['rcy_but_to_but']===0?0:null as Val;
  _ss($('s-eth-rcy-own'),'s-eth-rcy-own',oe,true);
  _ss($('s-pro-rcy-own'),'s-pro-rcy-own',opr,true);
  _ss($('s-but-rcy-own'),'s-but-rcy-own',ob,true);

  const erPro=cx(v,'eth','pro'), erBut=cx(v,'eth','but');
  const prEth=cx(v,'pro','eth'), prBut=cx(v,'pro','but');
  const brEth=cx(v,'but','eth'), brPro=cx(v,'but','pro');

  const ercyA = trunkVal(oe,erPro,erBut), ercyB = trunkVal(erPro,erBut);
  _ss($('s-ercy-trunk-a'),'s-ercy-trunk-a',ercyA,true); _ss($('s-ercy-trunk-b'),'s-ercy-trunk-b',ercyB,true);
  _ss($('s-ercy-pro-drop'),'s-ercy-pro-drop',erPro,true); _mn($('mn-ercy-pro'),'mn-ercy-pro',erPro);
  _ss($('s-ercy-but-jog'),'s-ercy-but-jog',erBut,true); _ss($('s-ercy-but-drop'),'s-ercy-but-drop',erBut,true); _mn($('mn-ercy-but'),'mn-ercy-but',erBut);

  const prcyA = trunkVal(opr,prEth,prBut), prcyB = trunkVal(prEth,prBut);
  _ss($('s-prcy-trunk-a'),'s-prcy-trunk-a',prcyA,true); _ss($('s-prcy-trunk-b'),'s-prcy-trunk-b',prcyB,true);
  _ss($('s-prcy-eth-drop'),'s-prcy-eth-drop',prEth,true); _mn($('mn-prcy-eth'),'mn-prcy-eth',prEth);
  _ss($('s-prcy-but-jog'),'s-prcy-but-jog',prBut,true); _ss($('s-prcy-but-drop'),'s-prcy-but-drop',prBut,true); _mn($('mn-prcy-but'),'mn-prcy-but',prBut);

  const brcyA = trunkVal(ob,brEth,brPro), brcyB = trunkVal(brEth,brPro);
  _ss($('s-brcy-trunk-a'),'s-brcy-trunk-a',brcyA,true); _ss($('s-brcy-trunk-b'),'s-brcy-trunk-b',brcyB,true);
  _ss($('s-brcy-eth-drop'),'s-brcy-eth-drop',brEth,true); _mn($('mn-brcy-eth'),'mn-brcy-eth',brEth);
  _ss($('s-brcy-pro-jog'),'s-brcy-pro-jog',brPro,true); _ss($('s-brcy-pro-drop'),'s-brcy-pro-drop',brPro,true); _mn($('mn-brcy-pro'),'mn-brcy-pro',brPro);

  _mn($('mn1-eth'),'mn1-eth',E); _mn($('mn1-pro'),'mn1-pro',P); _mn($('mn1-but'),'mn1-but',B);
  _ss($('s-eth-ff-to-mix'),'s-eth-ff-to-mix',v['ff_eth'] as Val); _ss($('s-pro-ff-to-mix'),'s-pro-ff-to-mix',v['ff_pro'] as Val); _ss($('s-but-ff-to-mix'),'s-but-ff-to-mix',v['ff_but'] as Val);
  _ss($('s-eth-fr-pipe'),'s-eth-fr-pipe',E); _ss($('s-pro-fr-pipe'),'s-pro-fr-pipe',P); _ss($('s-but-fr-pipe'),'s-but-fr-pipe',B);
  _op($('bx-eth-fr'),E); _op($('bx-pro-fr'),P); _op($('bx-but-fr'),B);
  _ss($('s-eth-fr-to-sp1'),'s-eth-fr-to-sp1',E); _ss($('s-pro-fr-to-sp1'),'s-pro-fr-to-sp1',P); _ss($('s-but-fr-to-sp1'),'s-but-fr-to-sp1',B);
  // Split circle only where the feed actually splits off to the general header.
  _sn($('sp1-eth'),'sp1-eth',v['eth_to_gen_fr'] as Val); _sn($('sp1-pro'),'sp1-pro',v['pro_to_gen_fr'] as Val); _sn($('sp1-but'),'sp1-but',v['but_to_gen_fr'] as Val);

  const egfr=v['eth_to_gen_fr'] as Val, pgfr=v['pro_to_gen_fr'] as Val, bgfr=v['but_to_gen_fr'] as Val;
  _ss($('s-eth-gfr-drop'),'s-eth-gfr-drop',egfr); _ss($('s-pro-gfr-drop'),'s-pro-gfr-drop',pgfr); _ss($('s-but-gfr-drop'),'s-but-gfr-drop',bgfr);

  _ss($('s-eth-rfr-pipe'),'s-eth-rfr-pipe',E); _ss($('s-pro-rfr-pipe'),'s-pro-rfr-pipe',P); _ss($('s-but-rfr-pipe'),'s-but-rfr-pipe',B);
  _op($('bx-eth-rfr'),E); _op($('bx-pro-rfr'),P); _op($('bx-but-rfr'),B);
  _ss($('s-eth-rfr-out'),'s-eth-rfr-out',E); _ss($('s-pro-rfr-out'),'s-pro-rfr-out',P); _ss($('s-but-rfr-out'),'s-but-rfr-out',B);
  _op($('bx-eth-tf'),E); _op($('bx-pro-tf'),P); _op($('bx-but-tf'),B);
  _ss($('s-eth-tf-to-sp2'),'s-eth-tf-to-sp2',E); _ss($('s-pro-tf-to-sp2'),'s-pro-tf-to-sp2',P); _ss($('s-but-tf-to-sp2'),'s-but-tf-to-sp2',B);
  _sn($('sp2-eth'),'sp2-eth',v['eth_to_gen_tf'] as Val); _sn($('sp2-pro'),'sp2-pro',v['pro_to_gen_tf'] as Val); _sn($('sp2-but'),'sp2-but',v['but_to_gen_tf'] as Val);

  const egtf=v['eth_to_gen_tf'] as Val, pgtf=v['pro_to_gen_tf'] as Val, bgtf=v['but_to_gen_tf'] as Val;
  _ss($('s-eth-gtf-drop'),'s-eth-gtf-drop',egtf); _ss($('s-pro-gtf-drop'),'s-pro-gtf-drop',pgtf); _ss($('s-but-gtf-drop'),'s-but-gtf-drop',bgtf);
  _ss($('s-eth-rtf-pipe'),'s-eth-rtf-pipe',E); _ss($('s-pro-rtf-pipe'),'s-pro-rtf-pipe',P); _ss($('s-but-rtf-pipe'),'s-but-rtf-pipe',B);
  _op($('bx-eth-rtf'),E); _op($('bx-pro-rtf'),P); _op($('bx-but-rtf'),B);
  _ss($('s-eth-rtf-to-sp3'),'s-eth-rtf-to-sp3',E); _ss($('s-pro-rtf-to-sp3'),'s-pro-rtf-to-sp3',P); _ss($('s-but-rtf-to-sp3'),'s-but-rtf-to-sp3',B);
  // Jumpover split/mix nodes: a feed shows a split only when it spills OUT to another
  // header, and a mix only when it RECEIVES a spill — never on mere existence.
  const orV = (a: Val, b: Val): Val => (a === 1 || b === 1) ? 1 : 0;
  const espP=v['eth_spill_pro'] as Val, espB=v['eth_spill_but'] as Val,
        pspE=v['pro_spill_eth'] as Val, pspB=v['pro_spill_but'] as Val,
        bspE=v['but_spill_eth'] as Val, bspP=v['but_spill_pro'] as Val;
  _sn($('sp3-eth'),'sp3-eth',orV(espP,espB)); _sn($('sp3-pro'),'sp3-pro',orV(pspE,pspB)); _sn($('sp3-but'),'sp3-but',orV(bspE,bspP));
  _mn($('mn3-eth'),'mn3-eth',orV(pspE,bspE)); _mn($('mn3-pro'),'mn3-pro',orV(espP,bspP)); _mn($('mn3-but'),'mn3-but',orV(espB,pspB));
  _ss($('s-eth-sp3mn3'),'s-eth-sp3mn3',E); _ss($('s-pro-sp3mn3'),'s-pro-sp3mn3',P); _ss($('s-but-sp3mn3'),'s-but-sp3mn3',B);
  _ss($('s-eth-gen-in'),'s-eth-gen-in',E); _ss($('s-pro-gen-in'),'s-pro-gen-in',P); _ss($('s-but-gen-in'),'s-but-gen-in',B);
  _op($('bx-eth-gen'),E); _op($('bx-pro-gen'),P); _op($('bx-but-gen'),B);
  _ss($('s-eth-out'),'s-eth-out',E); _ss($('s-pro-out'),'s-pro-out',P); _ss($('s-but-out'),'s-but-out',B);

  _ss($('s-gtf-leg-eth'),'s-gtf-leg-eth',egtf); _ss($('s-gtf-leg-pro'),'s-gtf-leg-pro',pgtf); _ss($('s-gtf-leg-but'),'s-gtf-leg-but',bgtf);
  _mn($('gtf-jct'),'gtf-jct',v['gen_tf_exists'] as Val); _ss($('s-gtf-trunk'),'s-gtf-trunk',v['gen_tf_exists'] as Val);
  _op($('bx-gen-tf'),v['gen_tf_exists'] as Val); _ss($('s-gtf-out'),'s-gtf-out',v['gen_tf_exists'] as Val);

  _ss($('s-gfr-leg-eth'),'s-gfr-leg-eth',egfr); _ss($('s-gfr-leg-pro'),'s-gfr-leg-pro',pgfr); _ss($('s-gfr-leg-but'),'s-gfr-leg-but',bgfr);
  _mn($('gfr-jct'),'gfr-jct',v['gen_fr_exists'] as Val); _ss($('s-gfr-trunk'),'s-gfr-trunk',v['gen_fr_exists'] as Val);
  _op($('bx-gen-fr'),v['gen_fr_exists'] as Val); _ss($('s-gfr-out'),'s-gfr-out',v['gen_fr_exists'] as Val);

  // Naphtha header is active when fresh OR recycle liquid feed is present.
  const napRcy = v['rcy_nap'] as Val;
  const napHdr: Val = (N === 1 || napRcy === 1) ? 1 : 0;
  _op($('bx-nap-ff'),N); _ss($('s-nap-flow'),'s-nap-flow',napHdr); _op($('bx-nap-gen'),napHdr); _ss($('s-nap-out'),'s-nap-out',napHdr);
  const napMix = svg.getElementById('s-nap-ff-to-mix') as SVGElement | null;
  if (napMix) {
    _show(napMix, N === 1);
    if (N === 1) { napMix.setAttribute('stroke', '#34c472'); napMix.setAttribute('data-flow-active', '1'); }
    else napMix.removeAttribute('data-flow-active');
  }
  _ss($('s-nap-rcy-own'),'s-nap-rcy-own',napRcy,true);
  const napMixNode = $('mn1-nap');
  if (napMixNode) {
    _show(napMixNode, napRcy === 1);
    if (napRcy === 1) napMixNode.setAttribute('fill', '#34c472');
  }

  _ss($('s-eth-spill-pro'),'s-eth-spill-pro',v['eth_spill_pro'] as Val);
  _ss($('s-eth-spill-but'),'s-eth-spill-but',v['eth_spill_but'] as Val);
  _ss($('s-pro-spill-eth'),'s-pro-spill-eth',v['pro_spill_eth'] as Val);
  _ss($('s-pro-spill-but'),'s-pro-spill-but',v['pro_spill_but'] as Val);
  _ss($('s-but-spill-eth'),'s-but-spill-eth',v['but_spill_eth'] as Val);
  _ss($('s-but-spill-pro'),'s-but-spill-pro',v['but_spill_pro'] as Val);

  _buildBeads(svg);
}

// Rebuilds the flowing-bead overlay. Every active pipe (data-flow-active="1") gets a
// clone of its own geometry as round beads in the pipe's header colour, flowing toward
// its arrow. Because geometry is rendered with absolute coordinates (no group transform),
// the cloned beads land exactly on their source pipe regardless of where the lane reflowed.
function _buildBeads(svg: SVGSVGElement) {
  const layer = svg.getElementById('pid-beads');
  if (!layer) return;
  while (layer.firstChild) layer.removeChild(layer.firstChild);
  svg.querySelectorAll<SVGElement>('[data-flow-active="1"]').forEach(src => {
    const bead = src.cloneNode(false) as SVGElement;
    bead.removeAttribute('id');
    bead.removeAttribute('marker-end');
    bead.removeAttribute('data-flow-active');
    bead.setAttribute('fill', 'none');
    bead.setAttribute('stroke', src.getAttribute('stroke') || '#ffffff');
    bead.setAttribute('stroke-width', '5.5');
    bead.setAttribute('stroke-linecap', 'round');
    bead.setAttribute('stroke-dasharray', '0.1 16');
    bead.setAttribute('class', 'pid-bead');
    layer.appendChild(bead);
  });
}

// ── Parametric geometry generators ──────────────────────────────────────────────
const FONT = 'ui-monospace,monospace';

function tx(key: string, x: number, y: number, fill: string, children: string, anchor: 'middle' | 'start' = 'middle') {
  return <text key={key} x={x} y={y} fontFamily={FONT} fontSize="10" fill={fill} textAnchor={anchor} fontWeight="500">{children}</text>;
}
function box(key: string, id: string, x: number, y: number, fill: string, stroke: string, dash = false, w = 128) {
  return <rect key={key} id={id} x={x} y={y - 13} width={w} height={26} rx={2} fill={fill} stroke={stroke} strokeWidth={0.8} strokeDasharray={dash ? '4 2' : undefined} />;
}
function pipe(key: string, id: string, x1: number, y1: number, x2: number, y2: number, sw: number, marker = false) {
  return <line key={key} id={id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f87171" strokeWidth={sw} fill="none" markerEnd={marker ? 'url(#mR)' : undefined} />;
}
function mixNode(key: string, id: string, cxv: number, cyv: number, fill = '#f87171', opacity?: number) {
  return <circle key={key} className="mix-node" id={id} cx={cxv} cy={cyv} r={5.5} fill={fill} opacity={opacity} />;
}
function splitNode(key: string, id: string, cxv: number, cyv: number) {
  return <circle key={key} className="split-node" id={id} cx={cxv} cy={cyv} r={5.5} fill="#0d1117" stroke="#f87171" strokeWidth={1.6} />;
}

type FeedKey = 'eth' | 'pro' | 'but';
interface Pal { box: string; stroke: string; text: string; furn: string; rcyBox: string; rcyStroke: string; name: string; hdr: string[]; }
const PAL: Record<FeedKey, Pal> = {
  eth: { box:'#0c1a30', stroke:'#1a3a60', text:'#4a9eff', furn:'#2a5080', rcyBox:'#0c1a30', rcyStroke:'#1a3a60', name:'Ethane',
         hdr:['ETH F+R HDR','ETH RED F+R','ETH TOTAL','ETH RED TF','Master Ethane Header'] },
  pro: { box:'#12082a', stroke:'#301860', text:'#a78bfa', furn:'#341860', rcyBox:'#14082a', rcyStroke:'#321860', name:'Propane',
         hdr:['PRO F+R HDR','PRO RED F+R','PRO TOTAL','PRO RED TF','Master Propane Header'] },
  but: { box:'#181000', stroke:'#3a2800', text:'#fbbf24', furn:'#503000', rcyBox:'#181000', rcyStroke:'#3a2800', name:'Butane',
         hdr:['BUT F+R HDR','BUT RED F+R','BUT TOTAL','BUT RED TF','Master Butane Header'] },
};

// Chain-walker: builds a feed's horizontal line from whatever process stations
// survive the horizontal collapse. Each station's incoming pipe keeps a fixed id
// (determined by the DESTINATION station), so the recolor layer still colours it
// correctly however the chain re-flows. Box x's and node x's come from the layout.
function FeedLane(feed: FeedKey, y: number, rcyY: number | null, layout: PidLayout) {
  const p = PAL[feed];
  const bx = layout.boxX, bp = layout.boxPresent;
  const off = SP_OFF[feed];
  const els: ReactNode[] = [];

  type St = { kind: 'box' | 'node'; key: string; x: number; present: boolean; pipeId: string; marker: boolean };
  const sts: St[] = [
    { kind:'box',  key:'fresh', x: bx.fresh!,             present: true,             pipeId:'',                   marker:false },
    { kind:'node', key:'mn1',   x: layout.mn1X,           present: true,             pipeId:`s-${feed}-ff-to-mix`, marker:false },
    { kind:'box',  key:'fxr',   x: bx.fxr ?? 0,           present: bp.fxr,           pipeId:`s-${feed}-fr-pipe`,   marker:true  },
    { kind:'node', key:'sp1',   x: layout.sp1X + off,     present: layout.gfrActive, pipeId:`s-${feed}-fr-to-sp1`, marker:false },
    { kind:'box',  key:'redfr', x: bx.redfr ?? 0,         present: bp.redfr,         pipeId:`s-${feed}-rfr-pipe`,  marker:true  },
    { kind:'box',  key:'total', x: bx.total ?? 0,         present: bp.total,         pipeId:`s-${feed}-rfr-out`,   marker:true  },
    { kind:'node', key:'sp2',   x: layout.sp2X + off,     present: layout.gtfActive, pipeId:`s-${feed}-tf-to-sp2`, marker:false },
    { kind:'box',  key:'redtf', x: bx.redtf ?? 0,         present: bp.redtf,         pipeId:`s-${feed}-rtf-pipe`,  marker:true  },
    { kind:'node', key:'sp3',   x: layout.sp3X + SP3_OFF, present: layout.spillOn,   pipeId:`s-${feed}-rtf-to-sp3`,marker:false },
    { kind:'node', key:'mn3',   x: layout.sp3X + MN3_OFF, present: layout.spillOn,   pipeId:`s-${feed}-sp3mn3`,    marker:false },
    { kind:'box',  key:'gen',   x: bx.gen!,               present: true,             pipeId:`s-${feed}-gen-in`,    marker:true  },
  ];
  // Only the end boxes (incoming Fresh, outgoing Master) are drawn; the intermediate
  // header boxes are suppressed (their zone is already named by the column label at the
  // bottom). A suppressed box becomes a pass-through point so the line stays continuous.
  const drawn = (k: string) => k === 'fresh' || k === 'gen';
  const live = sts.filter(s => s.present);
  for (let i = 1; i < live.length; i++) {
    const prev = live[i - 1], cur = live[i];
    const x1 = prev.kind === 'box' ? prev.x + (drawn(prev.key) ? END_HALF : 0) : prev.x;
    const x2 = cur.kind  === 'box' ? cur.x  - (drawn(cur.key) ? END_HALF : 0) : cur.x;
    els.push(pipe(cur.pipeId, cur.pipeId, x1, y, x2, y, 1.8, cur.marker && drawn(cur.key)));
  }
  // Boxes & nodes at their resolved positions.
  els.push(box(`${feed}-ffbox`, `bx-${feed}-ff`, bx.fresh! - END_HALF, y, p.box, p.stroke, false, END_HALF * 2));
  els.push(tx(`${feed}-fft`, bx.fresh!, y + 3, p.text, `Fresh ${p.name}`));
  els.push(mixNode(`${feed}-mn1`, `mn1-${feed}`, layout.mn1X, y));
  // Intermediate header boxes (F+R HDR, RED F+R, TOTAL, RED TF) are intentionally not
  // drawn — their zone is labelled by the column footer. Only the split/mix nodes that
  // sit in those columns remain, so the line still shows where flow branches.
  if (layout.gfrActive) els.push(splitNode(`${feed}-sp1`, `sp1-${feed}`, layout.sp1X + off, y));
  if (layout.gtfActive) els.push(splitNode(`${feed}-sp2`, `sp2-${feed}`, layout.sp2X + off, y));
  if (layout.spillOn) {
    els.push(splitNode(`${feed}-sp3`, `sp3-${feed}`, layout.sp3X + SP3_OFF, y));
    els.push(mixNode(`${feed}-mn3`, `mn3-${feed}`, layout.sp3X + MN3_OFF, y));
  }
  els.push(box(`${feed}-genbox`, `bx-${feed}-gen`, bx.gen! - END_HALF, y, p.box, p.stroke, false, END_HALF * 2));
  els.push(tx(`${feed}-gent`, bx.gen!, y + 3, p.text, p.hdr[4]));

  if (rcyY != null) {
    els.push(<path key={`${feed}-rcyown`} id={`s-${feed}-rcy-own`} d={`M${LANE_X0} ${rcyY} L${layout.mn1X} ${rcyY} L${layout.mn1X} ${y}`} stroke="#f87171" strokeWidth={1.4} fill="none" strokeDasharray="4 2" markerEnd="url(#mR)" />);
    els.push(box(`${feed}-rcybox`, `rb-${feed}`, bx.fresh! - END_HALF, rcyY, p.rcyBox, p.rcyStroke, false, END_HALF * 2));
    els.push(tx(`${feed}-rcyt`, bx.fresh!, rcyY + 3, p.text, `Recycle ${p.name}`));
  }
  return els;
}

const RCY_PREFIX: Record<FeedKey, string> = { eth:'ercy', pro:'prcy', but:'brcy' };
interface XTarget { feed: string; x: number; }
// Cross-recycle is only drawn when the CROSS RCY MIX column survives. Each source's two
// drops are ordered near→far by x; the "jog" (near→far trunk extension) is a SEPARATE
// element so its beads reflect the FAR target's routing only — keeping every
// independently-routed segment its own element is what prevents bead overshoot.
function CrossRecycle(layout: PidLayout) {
  if (!layout.crossOn) return null;
  const els: ReactNode[] = [];
  const rcyYof = (f: FeedKey) => f === 'eth' ? layout.ethRcyY : f === 'pro' ? layout.proRcyY : layout.butRcyY;
  const activeOf = (f: string) => f === 'eth' ? layout.ethActive : f === 'pro' ? layout.proActive : layout.butActive;
  (['eth','pro','but'] as FeedKey[]).forEach(s => {
    const rcyY = rcyYof(s);
    if (rcyY == null) return;
    const pref = RCY_PREFIX[s];
    const offs = XRCY_OFF[s];
    const tgs: XTarget[] = Object.keys(offs).map(f => ({ feed: f, x: layout.xmixX + offs[f] })).sort((a, b) => a.x - b.x);
    const [near, far] = tgs;
    const nearOn = activeOf(near.feed), farOn = activeOf(far.feed);
    if (!nearOn && !farOn) return;

    const dashLine = (key: string, id: string, x1: number, x2: number) =>
      <line key={key} id={id} x1={x1} y1={rcyY} x2={x2} y2={rcyY} stroke="#f87171" strokeWidth={1.2} fill="none" strokeDasharray="4 2" />;
    const drop = (t: XTarget) => {
      els.push(<path key={`${pref}-${t.feed}-d`} id={`s-${pref}-${t.feed}-drop`} d={vdrop(t.x, rcyY, layout.headerY(t.feed), layout.hbars)} stroke="#f87171" strokeWidth={1.2} fill="none" strokeDasharray="4 2" />);
      els.push(<circle key={`${pref}-${t.feed}-mn`} className="mix-node" id={`mn-${pref}-${t.feed}`} cx={t.x} cy={layout.headerY(t.feed)} r={5.5} fill="#f87171" />);
    };

    els.push(dashLine(`${pref}-ta`, `s-${pref}-trunk-a`, LANE_X0, layout.mn1X));
    if (nearOn) {
      els.push(dashLine(`${pref}-tb`, `s-${pref}-trunk-b`, layout.mn1X, near.x));
      drop(near);
      if (farOn) {
        els.push(dashLine(`${pref}-jog`, `s-${pref}-${far.feed}-jog`, near.x, far.x));
        drop(far);
      }
    } else {
      // Only the far feed is active → trunk runs straight to its drop (single destination).
      els.push(dashLine(`${pref}-tb`, `s-${pref}-trunk-b`, layout.mn1X, far.x));
      drop(far);
    }
  });
  return els;
}

function GenLane(layout: PidLayout, kind: 'gfr' | 'gtf') {
  const active = kind === 'gfr' ? layout.gfrActive : layout.gtfActive;
  if (!active) return null;
  const gy = kind === 'gfr' ? layout.gfrY : layout.gtfY;
  const col = kind === 'gfr' ? '#f472b6' : '#22d3ee';
  const jx = kind === 'gfr' ? layout.sp1X : layout.sp2X;   // junction = split column x
  const marker = kind === 'gfr' ? 'url(#mGfr)' : 'url(#mGtf)';
  const boxFill = kind === 'gfr' ? '#220d18' : '#061e22';
  const boxStroke = kind === 'gfr' ? '#6b1a3a' : '#0e5a66';
  const label = kind === 'gfr' ? 'General Fresh & Recycle Header' : 'General Total Feed Header';
  const genX = layout.genX;
  const els: ReactNode[] = [];
  (['eth','pro','but'] as FeedKey[]).forEach(f => {
    const act = f === 'eth' ? layout.ethActive : f === 'pro' ? layout.proActive : layout.butActive;
    if (!act) return;
    const sx = jx + SP_OFF[f];
    els.push(<path key={`${kind}-drop-${f}`} id={`s-${f}-${kind}-drop`} d={vdrop(sx, layout.headerY(f) + 6, gy - 12, layout.hbars)} stroke="#f87171" strokeWidth={1.5} fill="none" />);
    els.push(<path key={`${kind}-leg-${f}`} id={`s-${kind}-leg-${f}`} d={`M${sx} ${gy - 12} L${jx} ${gy}`} stroke={col} strokeWidth={1.5} fill="none" />);
  });
  els.push(<circle key={`${kind}-jct`} className="mix-node" id={`${kind}-jct`} cx={jx} cy={gy} r={5.5} fill={col} />);
  els.push(<line key={`${kind}-trunk`} id={`s-${kind}-trunk`} x1={jx + 5} y1={gy} x2={genX - END_HALF} y2={gy} stroke={col} strokeWidth={1.5} fill="none" markerEnd={marker} />);
  els.push(<rect key={`${kind}-box`} id={`bx-gen-${kind === 'gfr' ? 'fr' : 'tf'}`} x={genX - END_HALF} y={gy - 13} width={END_HALF * 2} height={26} rx={2} fill={boxFill} stroke={boxStroke} strokeWidth={0.8} />);
  els.push(tx(`${kind}-t`, genX, gy + 5, col, label));
  return els;
}

function Naphtha(layout: PidLayout) {
  if (!layout.napActive) return null;
  const ny = layout.napY, ry = layout.napRcyY, genX = layout.genX;
  const boxL = LANE_X0 - 2 * END_HALF;   // left edge of the incoming box
  const boxCx = LANE_X0 - END_HALF;      // its centre
  const els: ReactNode[] = [];
  if (ry != null) {
    els.push(<rect key="nap-rb" id="rb-nap" x={boxL} y={ry - 13} width={END_HALF * 2} height={26} rx={2} fill="#060e08" stroke="#0a2a18" strokeWidth={0.8} strokeDasharray="4 2" />);
    els.push(tx('nap-rt', boxCx, ry + 3, '#34d399', 'Recycle Liquid Feed'));
    els.push(<path key="nap-rcyown" id="s-nap-rcy-own" d={`M${LANE_X0} ${ry} L${layout.mn1X} ${ry} L${layout.mn1X} ${ny}`} stroke="#f87171" strokeWidth={1.4} fill="none" strokeDasharray="4 2" markerEnd="url(#mR)" />);
    els.push(<circle key="nap-mn1" className="mix-node" id="mn1-nap" cx={layout.mn1X} cy={ny} r={5.5} fill="#34c472" opacity={0} />);
  }
  els.push(<rect key="nap-ff" id="bx-nap-ff" x={boxL} y={ny - 13} width={END_HALF * 2} height={26} rx={2} fill="#060e08" stroke="#0a2a18" strokeWidth={0.8} />);
  els.push(tx('nap-fft', boxCx, ny + 3, '#34d399', 'Fresh Liquid Feed'));
  els.push(<line key="nap-ff2mix" id="s-nap-ff-to-mix" x1={LANE_X0} y1={ny} x2={layout.mn1X} y2={ny} stroke="#f87171" strokeWidth={1.8} fill="none" />);
  els.push(<line key="nap-flow" id="s-nap-flow" x1={layout.mn1X} y1={ny} x2={genX - END_HALF} y2={ny} stroke="#f87171" strokeWidth={1.8} fill="none" markerEnd="url(#mR)" />);
  els.push(<rect key="nap-gen" id="bx-nap-gen" x={genX - END_HALF} y={ny - 13} width={END_HALF * 2} height={26} rx={2} fill="#060e08" stroke="#0a2a18" strokeWidth={0.8} />);
  els.push(tx('nap-gent', genX, ny + 3, '#34d399', 'Master Naphtha Header'));
  return els;
}

function Spills(layout: PidLayout, vars: PidVars) {
  // path id "s-<a>-spill-<b>" ↔ var "<a>_spill_<b>"
  const paths = buildSpillPaths(layout, id => vars[id.slice(2).replace(/-/g, '_')] === 1);
  return Object.keys(paths).map(id =>
    <path key={id} id={id} d={paths[id]} stroke="#f87171" strokeWidth={1.2} fill="none" markerEnd="url(#mR)" />);
}

function Grid(layout: PidLayout) {
  const h = layout.height;
  const bx = layout.boxX, bp = layout.boxPresent;
  const els: ReactNode[] = [];
  // Present columns left→right with labels; node (mix/split) columns shade faintly.
  type Col = { x: number; label: string; node?: boolean };
  const cols: Col[] = [{ x: bx.fresh!, label: 'Fresh & Recycle Feed' }, { x: layout.mn1X, label: 'Own Recycle Mixing Zone', node: true }];
  if (bp.fxr)           cols.push({ x: bx.fxr!,     label: 'Fresh & Recycle Mix Header' });
  if (layout.gfrActive) cols.push({ x: layout.sp1X,  label: 'First Split Zone', node: true });
  if (bp.redfr)         cols.push({ x: bx.redfr!,   label: 'Reduced Fresh & Recycle Mix Header' });
  if (layout.crossOn)   cols.push({ x: layout.xmixX, label: 'Cross Recycle Mixing Zone', node: true });
  if (bp.total)         cols.push({ x: bx.total!,   label: 'Total Feed Header' });
  if (layout.gtfActive) cols.push({ x: layout.sp2X,  label: 'Second Split Zone', node: true });
  if (bp.redtf)         cols.push({ x: bx.redtf!,   label: 'Reduced Total Feed Header' });
  if (layout.spillOn)   cols.push({ x: layout.sp3X,  label: 'Jumpover Zone', node: true });
  cols.push({ x: layout.genX, label: 'Feed Headers To Furnace' });

  // Zone boundaries tile the content width using the SAME section widths as the layout:
  // the first & last sections are 1.5× (END_Z), every other section is BASE_Z. This keeps
  // the node zones (e.g. Own Recycle Mixing / Jumpover) at the normal width — only the
  // end sections are wider — and the faint lines never cut through the wide end boxes.
  const n = cols.length;
  const bnd: number[] = [CONTENT_L];
  for (let i = 0; i < n; i++) bnd[i + 1] = bnd[i] + ((i === 0 || i === n - 1) ? END_Z : BASE_Z);
  cols.forEach((c, i) => { if (c.node) els.push(<rect key={`sh${i}`} x={bnd[i]} y={0} width={bnd[i + 1] - bnd[i]} height={h} fill="#3a8f3a" opacity={0.05} />); });
  for (let i = 1; i < n; i++) els.push(<line key={`gl${i}`} x1={bnd[i]} y1={0} x2={bnd[i]} y2={h} stroke="#1e2a3a" strokeWidth={0.5} strokeDasharray="2 6" />);
  const cy = h - 4;
  cols.forEach((c, i) => {
    // Long labels wrap onto two balanced lines so they don't spill into neighbouring
    // zones. The last line keeps the shared bottom baseline (cy) for alignment.
    const words = c.label.split(' ');
    let lines = [c.label];
    if (c.label.length > 18 && words.length > 1) {
      let best = 1, bestDiff = Infinity;
      for (let s = 1; s < words.length; s++) {
        const diff = Math.abs(words.slice(0, s).join(' ').length - words.slice(s).join(' ').length);
        if (diff < bestDiff) { bestDiff = diff; best = s; }
      }
      lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
    }
    els.push(
      <text key={`cl${i}`} x={c.x} y={cy} fontFamily={FONT} fontSize="10" fill="#7a8a9a" textAnchor="middle" fontWeight="500">
        {lines.length === 1
          ? lines[0]
          : lines.map((ln, li) => <tspan key={li} x={c.x} dy={li === 0 ? -10.5 : 10.5}>{ln}</tspan>)}
      </text>
    );
  });
  return els;
}

interface Props { vars: PidVars; }

function applyPidTheme(svg: SVGSVGElement, isLight: boolean) {
  const PIPE_DARK = '#f87171', PIPE_LIGHT = '#b91c1c';
  const NODE_DARK = '#0d1117', NODE_LIGHT = '#1e293b';
  const BLOCK_FILL_LIGHT = '#1e293b', BLOCK_STROKE_LIGHT = '#334155';

  svg.querySelectorAll<SVGElement>('line, path, polyline').forEach(el => {
    const s = el.getAttribute('stroke');
    if (!s) return;
    if (isLight && s === PIPE_DARK)  { el.setAttribute('stroke', PIPE_LIGHT); el.dataset.pidDark = PIPE_DARK; }
    else if (!isLight && el.dataset?.pidDark) { el.setAttribute('stroke', PIPE_DARK); delete el.dataset.pidDark; }
  });

  svg.querySelectorAll<SVGElement>('circle.split-node').forEach(el => {
    el.setAttribute('fill', isLight ? NODE_LIGHT : NODE_DARK);
  });

  svg.querySelectorAll<SVGElement>('marker path').forEach(el => {
    const s = el.getAttribute('stroke');
    if (s === PIPE_DARK || s === PIPE_LIGHT) el.setAttribute('stroke', isLight ? PIPE_LIGHT : PIPE_DARK);
  });

  svg.querySelectorAll<SVGElement>('.proc-box, rect[class*="proc"]').forEach(el => {
    if (isLight) {
      el.dataset.origFill   = el.getAttribute('fill')   || '';
      el.dataset.origStroke = el.getAttribute('stroke') || '';
      el.setAttribute('fill',   BLOCK_FILL_LIGHT);
      el.setAttribute('stroke', BLOCK_STROKE_LIGHT);
    } else {
      if (el.dataset?.origFill   !== undefined) el.setAttribute('fill',   el.dataset.origFill);
      if (el.dataset?.origStroke !== undefined) el.setAttribute('stroke', el.dataset.origStroke);
    }
  });

  svg.querySelectorAll<SVGElement>('.proc-label, text[class*="proc"]').forEach(el => {
    if (isLight) {
      el.dataset.origFill = el.getAttribute('fill') || '';
      el.setAttribute('fill', '#f1f5f9');
    } else {
      if (el.dataset?.origFill !== undefined) el.setAttribute('fill', el.dataset.origFill);
    }
  });
}

export default function PidSvgPanel({ vars }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const layout = computePidLayout(vars);

  // Recolor (and re-theme) after every render. The geometry React just produced may
  // have reflowed; updatePidSvg recolours whatever exists, then applyPidTheme keeps
  // light-mode colours correct for the freshly-rendered elements.
  useEffect(() => {
    if (!svgRef.current) return;
    updatePidSvg(svgRef.current, vars);
    applyPidTheme(svgRef.current, !document.documentElement.classList.contains('dark'));
  }, [vars]);

  // Re-apply theme when the html.dark class toggles.
  useEffect(() => {
    const apply = () => {
      if (svgRef.current) applyPidTheme(svgRef.current, !document.documentElement.classList.contains('dark'));
    };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return (
    <div className={clsx(styles.pidSvgWrap, 'relative')}>
      {/* viewBox width is FIXED (full reference) so the horizontal scale never changes;
          height tracks the active lanes (shorter when feeds drop). Collapsed process
          stages make the chain narrower — it is centred (see the translate group below)
          with empty space at the left/right ends rather than zoomed in. */}
      <svg
        ref={svgRef}
        id="pid-svg"
        viewBox={`${VIEW_X} 10 ${VIEW_W} ${layout.height - 10}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display:'block', width:'100%', height:'auto' }}
      >
        <defs>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes pidBead { from { stroke-dashoffset: 0 } to { stroke-dashoffset: -16.1 } }
            .pid-bead { animation: pidBead 0.8s linear infinite }
          ` }} />
          <marker id="mR"   viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M1 1.5L7 4L1 6.5" fill="none" stroke="#f87171" strokeWidth="1.5"/></marker>
          <marker id="mG"   viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M1 1.5L7 4L1 6.5" fill="none" stroke="#34c472" strokeWidth="1.5"/></marker>
          <marker id="mX"   viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M1 1.5L7 4L1 6.5" fill="none" stroke="#4b5563" strokeWidth="1.5"/></marker>
          <marker id="mEth" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M1 1.5L7 4L1 6.5" fill="none" stroke="#60a5fa" strokeWidth="1.5"/></marker>
          <marker id="mPro" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M1 1.5L7 4L1 6.5" fill="none" stroke="#a78bfa" strokeWidth="1.5"/></marker>
          <marker id="mBut" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M1 1.5L7 4L1 6.5" fill="none" stroke="#fbbf24" strokeWidth="1.5"/></marker>
          <marker id="mNap" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M1 1.5L7 4L1 6.5" fill="none" stroke="#34c472" strokeWidth="1.5"/></marker>
          <marker id="mGfr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M1 1.5L7 4L1 6.5" fill="none" stroke="#f472b6" strokeWidth="1.5"/></marker>
          <marker id="mGtf" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M1 1.5L7 4L1 6.5" fill="none" stroke="#22d3ee" strokeWidth="1.5"/></marker>
        </defs>

        {/* Centring group — shifts the (possibly narrower) collapsed chain to the middle
            of the fixed-width viewBox. The bead layer lives INSIDE this group so the
            runtime-cloned beads inherit the same translate and stay aligned. */}
        <g transform={`translate(${layout.centerDx} 0)`}>
          {Grid(layout)}

          {layout.ethActive && FeedLane('eth', layout.ethY, layout.ethRcyY, layout)}
          {layout.proActive && FeedLane('pro', layout.proY, layout.proRcyY, layout)}
          {layout.butActive && FeedLane('but', layout.butY, layout.butRcyY, layout)}

          {GenLane(layout, 'gtf')}
          {GenLane(layout, 'gfr')}
          {Naphtha(layout)}

          {CrossRecycle(layout)}
          {Spills(layout, vars)}

          {/* Flowing-bead overlay (filled at runtime by _buildBeads) — rendered on top */}
          <g id="pid-beads" style={{ pointerEvents: 'none' }} />
        </g>
      </svg>
    </div>
  );
}
