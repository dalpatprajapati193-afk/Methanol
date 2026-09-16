'use client';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useAtom } from 'jotai';
import { RadFields, RadCell, radEmptyCell, radTabAtom, RAD_TAB_TITLES } from '../../../store/FmsAtoms';
import { rzTotalPasses, rzAutoPrefill } from '../../../constants/HwGroupLogic';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import styles from '../../../Style.module.css';
import { TEXT, TABLE, SEGMENT, FIELD, BUTTON } from '../../../theme/Index';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

interface Props {
  fields: RadFields;
  onChange: (fields: RadFields) => void;
  defaultMassFlowUom?: string;
  /** Rendered inside the sticky header above the pill tabs so it stays pinned too. */
  furnaceBar?: ReactNode;
  /** Optional banner (e.g. duplicate-template warning) rendered just below the sticky header. */
  notice?: ReactNode;
}

const BURNER_TYPES = ['Conventional', 'Low NOx', 'Ultra Low NOx'];
const MF_UOMS = ['kg/s','kg/h','t/h','t/s','lb/h','lb/s','MMlb/h'];

// ── Pure helpers ─────────────────────────────────────────────────────
// rzTotalPasses / rzAutoPrefill are shared with the basic-info autofill — see HwGroupLogic.

function rzValidOrientations(tp: number): string[] {
  const n = parseInt(String(tp)) || 0;
  const opts: string[] = [];
  if (n % 8 === 0 && n > 0) {
    opts.push('8-4-2-1-A','8-4-2-A-1','8-2-1-A','8-2-A-1','8-1-A','8-A-1');
  }
  if (n % 4 === 0 && n > 0) {
    opts.push('4-2-1-A','4-2-A-1','4-1-A','4-A-1');
  }
  if (n % 2 === 0 && n > 0) { opts.push('2-1-A','2-A-1'); }
  if (n > 0) opts.push('1');
  return opts;
}

function rzCellAllFilled(cell: RadCell): boolean {
  const hearthOn = cell.hearthExists === true;
  const wallOn   = cell.wallExists   === true;
  if (!hearthOn && !wallOn) return false;
  if (hearthOn) { const hb = parseInt(cell.hearthBurnerCount); if (isNaN(hb) || hb < 1) return false; }
  if (wallOn)   { const wb = parseInt(cell.wallBurnerCount);   if (isNaN(wb) || wb < 1) return false; }
  const ppc = parseInt(cell.passesPerCell), tp = parseInt(cell.tubesPerPass);
  return !isNaN(ppc) && ppc > 0 && ppc % 2 === 0 && !isNaN(tp) && tp > 0;
}

function rzCellSVGReady(cell: RadCell): boolean {
  const tp = parseInt(cell.tubesPerPass);
  return !isNaN(tp) && tp > 0 && !!(cell.tubeOrientation && rzValidOrientations(tp).includes(cell.tubeOrientation));
}

// Tube/pass geometry alone — deliberately ignores burner data so the Pass & Tube
// Details tab (pass→group table, auto-prefill) is independent of the Burner
// Configuration tab. A cell is "tube-ready" once passes/cell is a positive even
// number and tubes/pass is positive.
function rzCellTubeFilled(cell: RadCell): boolean {
  const ppc = parseInt(cell.passesPerCell), tp = parseInt(cell.tubesPerPass);
  return !isNaN(ppc) && ppc > 0 && ppc % 2 === 0 && !isNaN(tp) && tp > 0;
}

function rzAllCellsTubeFilled(f: RadFields): boolean {
  const nc = parseInt(f.numCells) || 0;
  if (!f.cells || f.cells.length < nc) return false;
  return f.cells.slice(0, nc).every(c => rzCellTubeFilled(c));
}

// When "all cells identical" is active, Cell 1 is the single source of truth: mirror
// its FULL config, its pass groups, and its per-pass names onto every other cell so the
// exporter (which reads raw f.cells / f.passMap) sees real, complete data for each cell.
// Pure — returns the same object untouched when not in identical mode.
function rzApplyIdentical(f: RadFields): RadFields {
  const nc = parseInt(f.numCells) || 0;
  if (f.identicalCells !== true || nc <= 1) return f;
  const c0 = f.cells[0];
  if (!c0) return f;
  const cells = f.cells.map((c, i) => i === 0 ? c0 : JSON.parse(JSON.stringify(c0)) as RadCell);
  const ppc = parseInt(c0.passesPerCell) || 0;
  if (ppc <= 0) return { ...f, cells };
  const total = ppc * nc;
  const passMap = Array.from({ length: total }, (_, p) => {
    const src = f.passMap[p % ppc];                       // Cell 1's row for this position
    return src ? { cell: Math.floor(p / ppc), group: src.group } : null;
  }) as RadFields['passMap'];
  const passNames: Record<number, string> = {};
  for (let c = 0; c < nc; c++) {
    for (let j = 0; j < ppc; j++) {
      const nm = f.passNames?.[j];
      if (nm !== undefined) passNames[c * ppc + j] = nm;
    }
  }
  return { ...f, cells, passMap, passNames };
}

// ── SVG cell diagram (ported from v411 rzBuildCellSVG) ───────────────

function rzBuildCellSVGString(cell: RadCell): string {
  const T      = parseInt(cell.tubesPerPass) || 1;
  const orient = cell.tubeOrientation || '1';
  const fromTop= (cell.flowEntry || 'top') === 'top';
  const bends  = cell.cellBends || [];

  const hasAdiaMid   = orient.includes('-A-');
  const hasAdiaEnd   = !hasAdiaMid && orient.endsWith('-A');
  const hasAdiabatic = hasAdiaMid || hasAdiaEnd;
  const cellOrient   = hasAdiaEnd ? orient.slice(0,-2) : hasAdiaMid ? orient.split('-A-')[0] : orient;
  const stages  = cellOrient.split('-').map(Number);
  const first   = stages[0];
  const nLevels = stages.length - 1;
  const nGroups = Math.round(T / first);

  const A=19, C=7, B=7, Y1:number=50, Y2:number=310, INSUL_W=10, Ybuf=8, SW=2.2;
  const Ytop = Y1+INSUL_W+Ybuf, Ybot = Y2-INSUL_W-Ybuf;
  const X0=20, DIAG=13, HATCH=7;
  const maxStagger = Math.floor((Ybot-Ytop)/2);

  let extraBot=0, extraTop=0;
  let curDir = fromTop ? 1 : -1;
  let curXs  = Array.from({length:first},(_,i)=>X0+i*A);
  let rEdge  = curXs[curXs.length-1];
  function gridRight(n:number){const xs=Array.from({length:n},(_,i)=>rEdge+A+i*A);rEdge=xs[xs.length-1];return xs;}
  function nodeXsOf(xs:number[],factor:number,nOut:number){return Array.from({length:nOut},(_,j)=>{const g=xs.slice(j*factor,j*factor+factor);return g.reduce((s,x)=>s+x,0)/g.length;});}
  const turnY=(i:number,dir:number)=>{ const off=Math.min(i*C,maxStagger); return dir===1?Ybot-off:Ytop+off; };
  const outsideTurnY=(i:number,dir:number,wallRef:number,nOut:number)=>{ const nodeY2=wallRef+dir*(DIAG+B);const depthIdx=(nOut-1)-i;return nodeY2+dir*(B+depthIdx*C); };

  type Cmd={kind:string;x?:number;y1?:number;y2?:number;x1?:number;x2?:number;y?:number;pass?:number;dir?:number;seq?:number};
  const cmds:Cmd[]=[];
  const entryWallY = fromTop ? Y1 : Y2;
  let curYs = curXs.map(()=>entryWallY);
  let curPass=0, curSeq=0;
  const vert=(x:number,y1:number,y2:number)=>cmds.push({kind:'vert',x,y1,y2,pass:curPass,dir:curDir,seq:curSeq});
  const horiz=(x1:number,x2:number,y:number)=>cmds.push({kind:'horiz',x1,x2,y,pass:curPass,dir:curDir,seq:curSeq});
  const diag=(x1:number,y1:number,x2:number,y2:number)=>cmds.push({kind:'diag',x1,y1,x2,y2,pass:curPass,dir:curDir,seq:curSeq});
  const nodeCmd=(x:number,y:number)=>cmds.push({kind:'node',x,y});

  for(let lv=0;lv<nLevels;lv++){
    const nb=bends[lv]||0, nIn=stages[lv], nOut=stages[lv+1];
    const factor=nIn/nOut, nXs=nodeXsOf(curXs,factor,nOut);
    if(nb===0){
      let coStart=lv,coEnd=lv;
      while(coStart>0&&(bends[coStart-1]||0)===0)coStart--;
      while(coEnd+1<nLevels&&(bends[coEnd+1]||0)===0)coEnd++;
      const coCount=coEnd-coStart+2, coIdx=lv-coStart+1;
      const nodeY2=curDir===1?Y1+coIdx/coCount*(Y2-Y1):Y2-coIdx/coCount*(Y2-Y1);
      curXs.forEach((x,i)=>{ const diagStartY2=nodeY2-curDir*DIAG; vert(x,curYs[i],diagStartY2); });
      curSeq++;
      curXs.forEach((x,i)=>{ const gi=Math.floor(i/factor); diag(x,nodeY2-curDir*DIAG,nXs[gi],nodeY2); });
      curSeq++;
      nXs.forEach(nx=>nodeCmd(nx,nodeY2));
      curXs=nXs.slice(); curYs=nXs.map(()=>nodeY2);
    } else {
      for(let r=0;r<nb-1;r++){
        const n=curXs.length;
        curXs.forEach((x,i)=>vert(x,curYs[i],turnY(i,curDir)));
        curSeq++;
        const nextXs=gridRight(n);
        curXs.forEach((x,i)=>{const ty=turnY(i,curDir);horiz(x,nextXs[n-1-i],ty);});
        curSeq++;
        const newYs:number[]=new Array(n);
        curXs.forEach((x,i)=>{newYs[n-1-i]=turnY(i,curDir);});
        curXs=nextXs; curYs=newYs; curDir=-curDir; curPass++;
      }
      const nXsFinal=nodeXsOf(curXs,factor,nOut);
      const wallRef=curDir===1?Y2:Y1;
      const nodeY2=wallRef+curDir*(DIAG+B);
      const outerTurnY2=outsideTurnY(0,curDir,wallRef,nOut);
      if(curDir===1)extraBot=Math.max(extraBot,outerTurnY2-Y2);
      else extraTop=Math.max(extraTop,Y1-outerTurnY2);
      curXs.forEach((x,i)=>{ const gi=Math.floor(i/factor); vert(x,curYs[i],wallRef); });
      curSeq++;
      curXs.forEach((x,i)=>{ const gi=Math.floor(i/factor); diag(x,wallRef,nXsFinal[gi],nodeY2); });
      curSeq++;
      nXsFinal.forEach(nx=>nodeCmd(nx,nodeY2));
      const nextXs=gridRight(nOut);
      nXsFinal.forEach((nx,i)=>{const ty=outsideTurnY(i,curDir,wallRef,nOut);vert(nx,nodeY2,ty);});
      curSeq++;
      nXsFinal.forEach((nx,i)=>{const ty=outsideTurnY(i,curDir,wallRef,nOut);horiz(nx,nextXs[nOut-1-i],ty);});
      curSeq++;
      const newYs2:number[]=new Array(nOut);
      nXsFinal.forEach((nx,i)=>{newYs2[nOut-1-i]=outsideTurnY(i,curDir,wallRef,nOut);});
      curXs=nextXs; curYs=newYs2; curDir=-curDir; curPass++;
    }
  }
  const nbExit=bends[nLevels]||0;
  for(let r=0;r<nbExit;r++){
    const n=curXs.length;
    curXs.forEach((x,i)=>vert(x,curYs[i],turnY(i,curDir)));curSeq++;
    const nextXs=gridRight(n);
    curXs.forEach((x,i)=>horiz(x,nextXs[n-1-i],turnY(i,curDir)));curSeq++;
    const newYs:number[]=new Array(n);
    curXs.forEach((x,i)=>{newYs[n-1-i]=turnY(i,curDir);});
    curXs=nextXs; curYs=newYs; curDir=-curDir; curPass++;
  }
  const exitWallY=curDir>0?Y2:Y1;
  curXs.forEach((x,i)=>vert(x,curYs[i],exitWallY)); curSeq++;
  const exitDir=curDir, exitXs=curXs.slice();

  const OUTSIDE_PAD=B;
  const insulTop=INSUL_W+(extraTop>0?extraTop+OUTSIDE_PAD:0);
  const insulBot=INSUL_W+(extraBot>0?extraBot+OUTSIDE_PAD:0);

  const RAMP=[[0x3B,0x8B,0xD4],[0x22,0xD3,0xEE],[0xF5,0x9E,0x0B],[0xEF,0x44,0x44]];
  function rampColour(t:number){
    const t2=Math.max(0,Math.min(1,t));
    const s=Math.min(Math.floor(t2*(RAMP.length-1)),RAMP.length-2);
    const f2=t2*(RAMP.length-1)-s; const a=RAMP[s],bv=RAMP[s+1];
    const r=Math.round(a[0]+(bv[0]-a[0])*f2),g=Math.round(a[1]+(bv[1]-a[1])*f2),bl=Math.round(a[2]+(bv[2]-a[2])*f2);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bl.toString(16).padStart(2,'0')}`;
  }
  const _uid=Math.random().toString(36).slice(2,7);
  const _cls=`rzf_${_uid}`;
  const DASH='10 7', PERIOD=17;
  const _animCSS=`<style>@keyframes k_${_uid}{from{stroke-dashoffset:0}to{stroke-dashoffset:-${PERIOD}}}.${_cls}{animation:k_${_uid} 0.9s linear infinite}</style>`;
  const _gradDefs:string[]=[];
  let _animIdx=0;
  function buildLine(x1:number,y1:number,x2:number,y2:number,dir:number,seq:number,t0:number,t1:number):string{
    const c0=rampColour(t0),c1=rampColour(t1);
    const isVert=Math.abs(x2-x1)<1;
    let gx1=x1,gy1=y1,gx2=x2,gy2=y2;
    if(isVert){gx1=x1;gx2=x2;gy1=dir>0?Math.min(y1,y2):Math.max(y1,y2);gy2=dir>0?Math.max(y1,y2):Math.min(y1,y2);}
    else{gy1=y1;gy2=y2;gx1=Math.min(x1,x2);gx2=Math.max(x1,x2);}
    const gid=`rzg${_gradDefs.length}`;
    _gradDefs.push(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${gx1.toFixed(1)}" y1="${gy1.toFixed(1)}" x2="${gx2.toFixed(1)}" y2="${gy2.toFixed(1)}"><stop offset="0%" stop-color="${c0}"/><stop offset="100%" stop-color="${c1}"/></linearGradient>`);
    let lx1=x1,ly1=y1,lx2=x2,ly2=y2;
    if(isVert){ly1=dir>0?Math.min(y1,y2):Math.max(y1,y2);ly2=dir>0?Math.max(y1,y2):Math.min(y1,y2);}
    const delay=((_animIdx++*0.11)%0.9).toFixed(2);
    return `<line x1="${lx1.toFixed(1)}" y1="${ly1.toFixed(1)}" x2="${lx2.toFixed(1)}" y2="${ly2.toFixed(1)}" stroke="url(#${gid})" stroke-width="${SW}" stroke-linecap="round" stroke-dasharray="${DASH}" class="${_cls}" style="animation-delay:-${delay}s"/>`;
  }

  const _seqLens=new Map<number,number>();
  cmds.forEach(c=>{
    if(c.kind==='node')return;
    const s=c.seq!;
    if(!_seqLens.has(s)){
      let len=0;
      if(c.kind==='vert')len=Math.abs(c.y2!-c.y1!);
      if(c.kind==='horiz')len=Math.abs(c.x2!-c.x1!);
      if(c.kind==='diag')len=Math.sqrt((c.x2!-c.x1!)**2+(c.y2!-c.y1!)**2);
      _seqLens.set(s,len);
    }
  });
  const cellMaxSeq=cmds.reduce((m,c)=>Math.max(m,c.seq||0),0);
  const ADIA_H=2*INSUL_W+B+DIAG+28;
  const adiaTop=exitDir>0?(Y2+insulBot):(Y1-insulTop-ADIA_H);
  const adiaBot=exitDir>0?(Y2+insulBot+ADIA_H):(Y1-insulTop);
  const adiaEntryY=exitDir>0?Y2:Y1, adiaExitY=exitDir>0?adiaBot:adiaTop;
  const nAdiaIn=exitXs.length;
  let nAdiaOut=exitXs.length;
  if(hasAdiaMid){const parts=orient.split('-A-');const after=parts[1].split('-').map(Number);nAdiaOut=after[0];}
  const adiaFactor=nAdiaIn/nAdiaOut;
  if(hasAdiabatic){
    if(!hasAdiaMid){_seqLens.set(cellMaxSeq+1,Math.abs(adiaExitY-adiaEntryY));}
    else{
      const aIT=exitDir>0?adiaTop+INSUL_W:adiaTop,aIB=exitDir>0?adiaBot:adiaBot-INSUL_W;
      const aNY=(aIT+aIB)/2,dSY=aNY-exitDir*DIAG;
      _seqLens.set(cellMaxSeq+1,Math.abs(dSY-adiaEntryY));
      _seqLens.set(cellMaxSeq+2,Math.sqrt((exitXs[0]-aNY)**2+(dSY-aNY)**2));
      _seqLens.set(cellMaxSeq+3,Math.abs(adiaExitY-aNY));
    }
  }
  const _sortedSeqs=[..._seqLens.keys()].sort((a,b)=>a-b);
  const _cumLen=new Map<number,number>(); let _runLen=0;
  _sortedSeqs.forEach(s=>{_cumLen.set(s,_runLen);_runLen+=_seqLens.get(s)!;});
  const _totalLen=_runLen||1;
  const seqT0=(s:number)=>(_cumLen.get(s)||0)/_totalLen;
  const seqT1=(s:number)=>((_cumLen.get(s)||0)+(_seqLens.get(s)||0))/_totalLen;

  const reqW=(nGroups-1)*(rEdge+A-X0)+rEdge+A;
  const groupStep=rEdge+A-X0;
  const wallL=X0-1.5*A, wallR=reqW-A+1.5*A, wallT=Y1, wallB=Y2, wallW=wallR-wallL;
  const IF='#1c2a3c',IS='#3a4e66',HC='#2c3e50';

  let walls='';
  const topBandY=wallT-(insulTop-INSUL_W);
  walls+=`<rect x="${wallL.toFixed(1)}" y="${topBandY.toFixed(1)}" width="${wallW.toFixed(1)}" height="${insulTop.toFixed(1)}" fill="${IF}" stroke="${IS}" stroke-width="0.5"/>`;
  for(let hx=wallL;hx<wallR+insulTop;hx+=HATCH)walls+=`<line x1="${Math.max(hx,wallL).toFixed(1)}" y1="${topBandY.toFixed(1)}" x2="${Math.max(hx-insulTop,wallL).toFixed(1)}" y2="${(topBandY+insulTop).toFixed(1)}" stroke="${HC}" stroke-width="0.6"/>`;
  walls+=`<rect x="${wallL.toFixed(1)}" y="${(wallB-INSUL_W).toFixed(1)}" width="${wallW.toFixed(1)}" height="${(insulBot+INSUL_W).toFixed(1)}" fill="${IF}" stroke="${IS}" stroke-width="0.5"/>`;
  for(let hx=wallL;hx<wallR+insulBot+INSUL_W;hx+=HATCH)walls+=`<line x1="${Math.max(hx,wallL).toFixed(1)}" y1="${(wallB-INSUL_W).toFixed(1)}" x2="${Math.max(hx-(insulBot+INSUL_W),wallL).toFixed(1)}" y2="${(wallB+insulBot).toFixed(1)}" stroke="${HC}" stroke-width="0.6"/>`;
  const leftBandT=topBandY, leftBandB=wallB+insulBot, leftBandH=leftBandB-leftBandT;
  walls+=`<rect x="${wallL.toFixed(1)}" y="${leftBandT.toFixed(1)}" width="${INSUL_W}" height="${leftBandH.toFixed(1)}" fill="${IF}" stroke="${IS}" stroke-width="0.5"/>`;
  for(let hy=leftBandT;hy<leftBandB+wallW;hy+=HATCH)walls+=`<line x1="${wallL}" y1="${Math.max(hy,leftBandT).toFixed(1)}" x2="${(wallL+INSUL_W)}" y2="${Math.max(hy-INSUL_W,leftBandT).toFixed(1)}" stroke="${HC}" stroke-width="0.6"/>`;
  walls+=`<rect x="${(wallR-INSUL_W).toFixed(1)}" y="${leftBandT.toFixed(1)}" width="${INSUL_W}" height="${leftBandH.toFixed(1)}" fill="${IF}" stroke="${IS}" stroke-width="0.5"/>`;
  for(let hy=leftBandT;hy<leftBandB+wallW;hy+=HATCH)walls+=`<line x1="${(wallR-INSUL_W).toFixed(1)}" y1="${Math.max(hy,leftBandT).toFixed(1)}" x2="${wallR.toFixed(1)}" y2="${Math.max(hy-INSUL_W,leftBandT).toFixed(1)}" stroke="${HC}" stroke-width="0.6"/>`;
  const outerT=topBandY,outerB=wallB+insulBot;
  if(exitDir>0){
    walls+=`<line x1="${wallL.toFixed(1)}" y1="${outerT.toFixed(1)}" x2="${wallR.toFixed(1)}" y2="${outerT.toFixed(1)}" stroke="${IS}" stroke-width="1"/>`;
    walls+=`<line x1="${wallL.toFixed(1)}" y1="${outerT.toFixed(1)}" x2="${wallL.toFixed(1)}" y2="${outerB.toFixed(1)}" stroke="${IS}" stroke-width="1"/>`;
    walls+=`<line x1="${wallR.toFixed(1)}" y1="${outerT.toFixed(1)}" x2="${wallR.toFixed(1)}" y2="${outerB.toFixed(1)}" stroke="${IS}" stroke-width="1"/>`;
  } else {
    walls+=`<line x1="${wallL.toFixed(1)}" y1="${outerB.toFixed(1)}" x2="${wallR.toFixed(1)}" y2="${outerB.toFixed(1)}" stroke="${IS}" stroke-width="1"/>`;
    walls+=`<line x1="${wallL.toFixed(1)}" y1="${outerT.toFixed(1)}" x2="${wallL.toFixed(1)}" y2="${outerB.toFixed(1)}" stroke="${IS}" stroke-width="1"/>`;
    walls+=`<line x1="${wallR.toFixed(1)}" y1="${outerT.toFixed(1)}" x2="${wallR.toFixed(1)}" y2="${outerB.toFixed(1)}" stroke="${IS}" stroke-width="1"/>`;
  }
  walls+=`<line x1="${(wallL+INSUL_W).toFixed(1)}" y1="${Y1+INSUL_W}" x2="${(wallR-INSUL_W).toFixed(1)}" y2="${Y1+INSUL_W}" stroke="#3a4e66" stroke-width="0.6" stroke-dasharray="3 4"/>`;
  walls+=`<line x1="${(wallL+INSUL_W).toFixed(1)}" y1="${Y2-INSUL_W}" x2="${(wallR-INSUL_W).toFixed(1)}" y2="${Y2-INSUL_W}" stroke="#3a4e66" stroke-width="0.6" stroke-dasharray="3 4"/>`;
  walls+=`<line x1="${(wallL+INSUL_W).toFixed(1)}" y1="${Ytop}" x2="${(wallR-INSUL_W).toFixed(1)}" y2="${Ytop}" stroke="#243244" stroke-width="0.5" stroke-dasharray="2 6"/>`;
  walls+=`<line x1="${(wallL+INSUL_W).toFixed(1)}" y1="${Ybot}" x2="${(wallR-INSUL_W).toFixed(1)}" y2="${Ybot}" stroke="#243244" stroke-width="0.5" stroke-dasharray="2 6"/>`;
  walls+=`<text x="${(wallL+INSUL_W+3).toFixed(1)}" y="${Y1-3}" font-family="IBM Plex Mono,monospace" font-size="9" fill="#3a4e66">Y₁</text>`;
  walls+=`<text x="${(wallL+INSUL_W+3).toFixed(1)}" y="${Y2+12}" font-family="IBM Plex Mono,monospace" font-size="9" fill="#3a4e66">Y₂</text>`;

  for(let g=0;g<nGroups;g++){
    const xOff=g*groupStep;
    Array.from({length:first},(_,i)=>X0+i*A).forEach(x=>{
      const x2=x+xOff;
      if(fromTop)walls+=`<line x1="${x2.toFixed(1)}" y1="${Y1}" x2="${x2.toFixed(1)}" y2="${(Y1-INSUL_W).toFixed(1)}" stroke="#3B8BD4" stroke-width="${SW}" stroke-linecap="round" opacity="0.5"/>`;
      else walls+=`<line x1="${x2.toFixed(1)}" y1="${Y2}" x2="${x2.toFixed(1)}" y2="${(Y2+INSUL_W).toFixed(1)}" stroke="#3B8BD4" stroke-width="${SW}" stroke-linecap="round" opacity="0.5"/>`;
    });
  }

  const feedType=cell.feedType||'control_valve';
  const SYM_ZONE=32,SYM_BODY=24,SYM_HW=A*0.32,SYM_TW=A*0.14,SYM_TH=SYM_BODY*0.22;
  const SYM_SC='#b2d8d8',SYM_SF='#0d1520',SYM_SW2=1.3;
  function drawSym(cx:number,bodTop:number,bodBot:number):string{
    const midY=(bodTop+bodBot)/2,tTop=midY-SYM_TH/2,tBot=midY+SYM_TH/2;
    if(feedType==='control_valve'){
      return `<polygon points="${cx.toFixed(1)},${midY.toFixed(1)} ${(cx-SYM_HW).toFixed(1)},${bodTop.toFixed(1)} ${(cx+SYM_HW).toFixed(1)},${bodTop.toFixed(1)}" fill="${SYM_SF}" stroke="${SYM_SC}" stroke-width="${SYM_SW2}" stroke-linejoin="round"/>`
           + `<polygon points="${cx.toFixed(1)},${midY.toFixed(1)} ${(cx-SYM_HW).toFixed(1)},${bodBot.toFixed(1)} ${(cx+SYM_HW).toFixed(1)},${bodBot.toFixed(1)}" fill="${SYM_SF}" stroke="${SYM_SC}" stroke-width="${SYM_SW2}" stroke-linejoin="round"/>`;
    }
    return `<polygon points="${(cx-SYM_HW).toFixed(1)},${bodTop.toFixed(1)} ${(cx+SYM_HW).toFixed(1)},${bodTop.toFixed(1)} ${(cx+SYM_TW).toFixed(1)},${tTop.toFixed(1)} ${(cx+SYM_TW).toFixed(1)},${tBot.toFixed(1)} ${(cx+SYM_HW).toFixed(1)},${bodBot.toFixed(1)} ${(cx-SYM_HW).toFixed(1)},${bodBot.toFixed(1)} ${(cx-SYM_TW).toFixed(1)},${tBot.toFixed(1)} ${(cx-SYM_TW).toFixed(1)},${tTop.toFixed(1)}" fill="${SYM_SF}" stroke="${SYM_SC}" stroke-width="${SYM_SW2}" stroke-linejoin="round"/>`;
  }
  let symSVG='';
  for(let g=0;g<nGroups;g++){
    const xOff=g*groupStep;
    Array.from({length:first},(_,i)=>X0+i*A).forEach(x=>{
      const cx=x+xOff;
      if(fromTop){const base=topBandY,bodBot=base-(SYM_ZONE-SYM_BODY)/2,bodTop=bodBot-SYM_BODY;symSVG+=drawSym(cx,bodTop,bodBot);}
      else{const base=wallB+insulBot,bodTop=base+(SYM_ZONE-SYM_BODY)/2,bodBot=bodTop+SYM_BODY;symSVG+=drawSym(cx,bodTop,bodBot);}
    });
  }

  const ADIA_CLR='#2ea55e',ADIA_FILL='#0d1f17';
  let adia='';
  adia+=`<rect x="${wallL.toFixed(1)}" y="${adiaTop.toFixed(1)}" width="${wallW.toFixed(1)}" height="${ADIA_H}" fill="${ADIA_FILL}" stroke="none"/>`;
  const a1x=wallL,a1y=adiaTop,a2x=wallR,a2y=adiaBot;
  if(exitDir>0){
    adia+=`<line x1="${a1x.toFixed(1)}" y1="${a2y.toFixed(1)}" x2="${a2x.toFixed(1)}" y2="${a2y.toFixed(1)}" stroke="${ADIA_CLR}" stroke-width="0.8"/>`;
    adia+=`<line x1="${a1x.toFixed(1)}" y1="${a1y.toFixed(1)}" x2="${a1x.toFixed(1)}" y2="${a2y.toFixed(1)}" stroke="${ADIA_CLR}" stroke-width="0.8"/>`;
    adia+=`<line x1="${a2x.toFixed(1)}" y1="${a1y.toFixed(1)}" x2="${a2x.toFixed(1)}" y2="${a2y.toFixed(1)}" stroke="${ADIA_CLR}" stroke-width="0.8"/>`;
  } else {
    adia+=`<line x1="${a1x.toFixed(1)}" y1="${a1y.toFixed(1)}" x2="${a2x.toFixed(1)}" y2="${a1y.toFixed(1)}" stroke="${ADIA_CLR}" stroke-width="0.8"/>`;
    adia+=`<line x1="${a1x.toFixed(1)}" y1="${a1y.toFixed(1)}" x2="${a1x.toFixed(1)}" y2="${a2y.toFixed(1)}" stroke="${ADIA_CLR}" stroke-width="0.8"/>`;
    adia+=`<line x1="${a2x.toFixed(1)}" y1="${a1y.toFixed(1)}" x2="${a2x.toFixed(1)}" y2="${a2y.toFixed(1)}" stroke="${ADIA_CLR}" stroke-width="0.8"/>`;
  }

  let tubesSVG='';
  function collectGroup(xOff:number){
    const segs:Array<{x1:number,y1:number,x2:number,y2:number,dir:number,seq:number}>=[];
    cmds.forEach(c=>{
      if(c.kind==='vert')segs.push({x1:c.x!+xOff,y1:c.y1!,x2:c.x!+xOff,y2:c.y2!,dir:c.dir!,seq:c.seq!});
      if(c.kind==='horiz')segs.push({x1:c.x1!+xOff,y1:c.y!,x2:c.x2!+xOff,y2:c.y!,dir:c.dir!,seq:c.seq!});
      if(c.kind==='diag')segs.push({x1:c.x1!+xOff,y1:c.y1!,x2:c.x2!+xOff,y2:c.y2!,dir:c.dir!,seq:c.seq!});
    });
    const gExitXs=exitXs.map(x=>x+xOff);
    if(hasAdiabatic){
      if(!hasAdiaMid){
        gExitXs.forEach(x=>segs.push({x1:x,y1:adiaEntryY,x2:x,y2:adiaExitY,dir:exitDir,seq:cellMaxSeq+1}));
      } else {
        const aNXs=Array.from({length:nAdiaOut},(_,j)=>{const grp=gExitXs.slice(j*adiaFactor,j*adiaFactor+adiaFactor);return grp.reduce((s,x)=>s+x,0)/grp.length;});
        const aIT=exitDir>0?adiaTop+INSUL_W:adiaTop,aIB=exitDir>0?adiaBot:adiaBot-INSUL_W;
        const aNY=(aIT+aIB)/2,dSY2=aNY-exitDir*DIAG;
        gExitXs.forEach((x,i)=>{const nx=aNXs[Math.floor(i/adiaFactor)];segs.push({x1:x,y1:adiaEntryY,x2:x,y2:dSY2,dir:exitDir,seq:cellMaxSeq+1});segs.push({x1:x,y1:dSY2,x2:nx,y2:aNY,dir:exitDir,seq:cellMaxSeq+2});});
        aNXs.forEach(nx=>segs.push({x1:nx,y1:aNY,x2:nx,y2:adiaExitY,dir:exitDir,seq:cellMaxSeq+3}));
      }
    }
    segs.forEach(seg=>{ tubesSVG+=buildLine(seg.x1,seg.y1,seg.x2,seg.y2,seg.dir,seg.seq,seqT0(seg.seq),seqT1(seg.seq)); });
  }
  for(let g=0;g<nGroups;g++)collectGroup(g*groupStep);

  let cellCircles='';
  for(let g=0;g<nGroups;g++){
    const xOff=g*groupStep;
    cmds.forEach(c=>{if(c.kind==='node')cellCircles+=`<circle cx="${(c.x!+xOff).toFixed(1)}" cy="${c.y!.toFixed(1)}" r="5" fill="#f59e0b"/>`;});
  }
  let adiaCircles='';
  if(hasAdiaMid){
    for(let g=0;g<nGroups;g++){
      const xOff=g*groupStep;
      const gExitXs=exitXs.map(x=>x+xOff);
      const aNXs=Array.from({length:nAdiaOut},(_,j)=>{const grp=gExitXs.slice(j*adiaFactor,j*adiaFactor+adiaFactor);return grp.reduce((s,x)=>s+x,0)/grp.length;});
      const aIT=exitDir>0?adiaTop+INSUL_W:adiaTop,aIB=exitDir>0?adiaBot:adiaBot-INSUL_W;
      const aNY=(aIT+aIB)/2;
      aNXs.forEach(nx=>{adiaCircles+=`<circle cx="${nx.toFixed(1)}" cy="${aNY.toFixed(1)}" r="5" fill="#f59e0b"/>`;});
    }
  }

  const radLblX=wallL-4,radMidY=(Y1+Y2)/2;
  const adiaLbl2X=wallL-4,adiaMidY2=(adiaTop+adiaBot)/2;
  const radZoneLbl=`<text x="${radLblX.toFixed(1)}" y="${radMidY.toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="9" fill="#3a4e66" transform="rotate(-90,${radLblX.toFixed(1)},${radMidY.toFixed(1)})">Radiation Zone</text>`;
  const adiaZoneLbl=hasAdiabatic?`<text x="${adiaLbl2X.toFixed(1)}" y="${adiaMidY2.toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="9" fill="#2ea55e" transform="rotate(-90,${adiaLbl2X.toFixed(1)},${adiaMidY2.toFixed(1)})">Adiabatic</text>`:'';

  const defsBlock=_gradDefs.length?`<defs>${_gradDefs.join('')}</defs>`:'';
  const content=defsBlock+_animCSS+walls+adia+radZoneLbl+adiaZoneLbl+tubesSVG+cellCircles+adiaCircles+symSVG;

  const SYM_ZONE2=32,SVG_PAD=14;
  const symContentTop=fromTop?(outerT-SYM_ZONE2):(exitDir<0?adiaTop:outerT);
  const symContentBot=!fromTop?(outerB+SYM_ZONE2):(exitDir>0?adiaBot:outerB);
  const contentTop=Math.min(symContentTop,exitDir<0?adiaTop:outerT);
  const contentBot=Math.max(symContentBot,exitDir>0?adiaBot:outerB);
  const svgXMin=wallL-22-SVG_PAD,svgYMin=contentTop-SVG_PAD;
  const svgTotalW=(wallR+SVG_PAD)-svgXMin,svgTotalH=(contentBot+SVG_PAD)-svgYMin;
  const MAX_W = 1400;
  const svgTag = `<svg viewBox="${svgXMin.toFixed(1)} ${svgYMin.toFixed(1)} ${svgTotalW.toFixed(1)} ${svgTotalH.toFixed(1)}" width="${svgTotalW.toFixed(0)}" height="${svgTotalH.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" style="background:#0d1520;border-radius:6px;display:block;">${content}</svg>`;
  if (svgTotalW > MAX_W) return `<div style="overflow-x:auto;width:${MAX_W}px;background:#0d1520;border-radius:6px;">${svgTag}</div>`;
  return svgTag;
}

// ── Sub-components ────────────────────────────────────────────────────

const inputCls = cn(TEXT.annotation, FIELD.input, 'px-2 py-1');
const selCls   = cn(TEXT.annotation, FIELD.input, 'px-2 py-1 cursor-pointer');
const numCls   = cn(inputCls, 'text-right');

// Burner existence is derived from the count (>0 exists, 0 absent). Sanitize to a
// non-negative integer (no decimals, no negatives) before it ever reaches state.
function rzSanitizeCount(raw: string): string {
  if (raw === '') return '';
  const n = Math.floor(Number(raw));
  if (isNaN(n) || n < 0) return '0';
  return String(n);
}

// "Same burner design" is forced NO when hearth & wall burner types differ, or when
// their Internal Flue Gas Recirculation values differ.
function rzBurnerDesignForcedNo(c: RadCell): boolean {
  const hOn = (parseInt(c.hearthBurnerCount) || 0) > 0;
  const wOn = (parseInt(c.wallBurnerCount)   || 0) > 0;
  if (!(hOn && wOn)) return false;
  const hType = c.hearthBurnerType || 'Conventional';
  const wType = c.wallBurnerType   || 'Conventional';
  const hFgr = (hType === 'Low NOx' || hType === 'Ultra Low NOx') ? (c.hearthFgrPercent || 0) : 0;
  const wFgr = (wType === 'Low NOx' || wType === 'Ultra Low NOx') ? (c.wallFgrPercent   || 0) : 0;
  return hType !== wType || hFgr !== wFgr;
}

// ── Burner table cell styles (3-column: label | hearth | wall) ────────
// NOTE: these inline style objects carry only non-typography properties; the className carries the token.
const rzThLblCls = cn(TEXT.eyebrow, TABLE.header, 'text-center tracking-wide');
const rzThColCls = cn(TEXT.eyebrow, TABLE.header, 'text-center tracking-wide border-l border-border');
const rzTdLblCls = cn(TEXT.annotation, TABLE.row, 'text-left border-t border-border whitespace-nowrap');
const rzTdCellCls = cn(TABLE.row, 'border-t border-border border-l border-border text-center');
const rzDashCls = cn(TEXT.annotation, 'opacity-40');

// Just the NO/YES button pair — used standalone in merged table cells.
function Toggle({value,onChange,disabled=false}:{value:boolean|null;onChange:(v:boolean)=>void;disabled?:boolean}){
  return(
    <div className="flex">
      <button disabled={disabled} onClick={()=>!disabled&&onChange(false)}
        className={cn(TEXT.button, 'px-[10px] py-[3px] border rounded-l-[4px]', disabled&&'cursor-not-allowed opacity-55')}
        style={{
          background:value===false?'color-mix(in srgb, var(--color-accent-red) 15%, transparent)':'var(--color-surface)',
          color:value===false?'var(--color-accent-red)':'var(--color-text-secondary)',
          borderColor:value===false?'var(--color-accent-red)':'var(--color-border)',
        }}>NO</button>
      <button disabled={disabled} onClick={()=>!disabled&&onChange(true)}
        className={cn(TEXT.button, 'px-[10px] py-[3px] border border-l-0 rounded-r-[4px]', disabled&&'cursor-not-allowed opacity-55')}
        style={{
          background:value===true?'color-mix(in srgb, var(--color-accent-green) 15%, transparent)':'var(--color-surface)',
          color:value===true?'var(--color-accent-green)':'var(--color-text-secondary)',
          borderColor:value===true?'var(--color-accent-green)':'var(--color-border)',
        }}>YES</button>
    </div>
  );
}

function YesNo({label,value,onChange,disabled=false}:{label:string;value:boolean|null;onChange:(v:boolean)=>void;disabled?:boolean}){
  return(
    <div className="flex items-center justify-between py-1">
      <span className={TEXT.annotation}>{label}</span>
      <Toggle value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// ── Main Editor ───────────────────────────────────────────────────────

export default function RadEditor({ fields, onChange, defaultMassFlowUom = 't/h', furnaceBar, notice }: Props) {
  const [collapsed, setCollapsed] = useState<Record<number,boolean>>({});
  // Pill-tab state — Pass & Tube Details vs Burner Configuration. The cell count and
  // "all cells identical?" question are common to both tabs (rendered above them).
  // Lifted to a shared atom so WizardNav's Back/Next can step through it too.
  const [tab, setTab] = useAtom(radTabAtom);

  const nc = parseInt(fields.numCells) || 0;

  function setNumCells(val: string) {
    const n = parseInt(val) || 0;
    const cells = [...fields.cells];
    while (cells.length < n) cells.push(radEmptyCell());
    cells.length = Math.max(cells.length, n);
    const trimmed = cells.slice(0, n);
    const total = trimmed.reduce((s, c) => s + (parseInt(c.passesPerCell)||0), 0);
    const passMap = Array.from({length:total},()=>null) as RadFields['passMap'];
    onChange({ ...fields, numCells: val, cells: trimmed, passMap, identicalCells: null });
  }

  function updateCell(ci: number, patch: Partial<RadCell>) {
    const cells = fields.cells.map((c, i) => {
      if (i !== ci) return c;
      const merged = { ...c, ...patch };
      // Keep "same burner design" consistent: force NO when types/FGR diverge.
      if (rzBurnerDesignForcedNo(merged)) merged.burnerDesignSame = false;
      return merged;
    });
    const total = cells.reduce((s, c) => s + (parseInt(c.passesPerCell)||0), 0);
    const passMap = Array.from({length:total},(_,i)=>fields.passMap[i]||null) as RadFields['passMap'];
    // In "all identical" mode Cell 1 stays the source of truth (rzApplyIdentical mirrors it
    // to the rest); otherwise auto-detect whether the cells happen to all match.
    const identicalCells = fields.identicalCells === true && cells.length > 1
      ? true
      : (cells.length > 1 ? cells.every(c => JSON.stringify(cellSig(c)) === JSON.stringify(cellSig(cells[0]))) : null);
    onChange(rzApplyIdentical({ ...fields, cells, passMap, identicalCells }));
  }

  function cellSig(c: RadCell) {
    return {
      hearthExists:c.hearthExists, hearthBurnerCount:c.hearthBurnerCount, hearthBurnerType:c.hearthBurnerType,
      wallExists:c.wallExists, wallBurnerCount:c.wallBurnerCount, wallBurnerType:c.wallBurnerType,
      passesPerCell:c.passesPerCell, tubesPerPass:c.tubesPerPass, tubeOrientation:c.tubeOrientation,
      flowEntry:c.flowEntry, feedType:c.feedType,
    };
  }

  // Propagate cell[0] to others when identicalCells=true
  function propagatedCell(ci: number): RadCell {
    if (fields.identicalCells && nc > 1 && ci > 0) {
      const src = fields.cells[0];
      return { ...fields.cells[ci] || radEmptyCell(), ...src };
    }
    return fields.cells[ci] || radEmptyCell();
  }

  function setIdentical(val: boolean) {
    onChange(rzApplyIdentical({ ...fields, identicalCells: val }));
  }

  function toggleCollapse(ci: number) {
    setCollapsed(prev => ({ ...prev, [ci]: !prev[ci] }));
  }

  // Pass map helpers
  const totalPasses = rzTotalPasses(fields);
  // Pass→group table & auto-prefill gate on tube geometry ONLY (burner-independent).
  const allCellsFilled = rzAllCellsTubeFilled(fields);

  // Auto-prefill pass map if all unassigned after all cells are filled
  // Auto-prefill once when all cells are filled and every passMap entry is still null
  const prevTotalPasses = useRef(-1);
  useEffect(() => {
    if (!allCellsFilled || totalPasses === 0) return;
    const synced = Array.from({ length: totalPasses }, (_, i) => fields.passMap[i] ?? null);
    // Fill ONLY the still-null slots (rzAutoPrefill self-skips assigned ones), so groups set
    // for one cell before the rest are configured don't block prefill of the others.
    if (synced.some(m => m === null)) {
      const fCopy = { ...fields, passMap: synced };
      rzAutoPrefill(fCopy);
      onChange(rzApplyIdentical({ ...fields, passMap: fCopy.passMap }));
    }
    prevTotalPasses.current = totalPasses;
  // Run when total passes count changes or cells become fully filled
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCellsFilled, totalPasses]);

  let passMap = fields.passMap;
  if (allCellsFilled) {
    // Ensure passMap has at least totalPasses entries (pad with null for display)
    passMap = Array.from({ length: totalPasses }, (_, i) => fields.passMap[i] ?? null) as RadFields['passMap'];
  }

  // Toggle a pass's group within its (now implicit) cell. Pure — returns the new passMap.
  // Keeps the v411 rule: deselect re-defaults to group 1, and group 2 auto-fills once
  // group 1 reaches ceil(ppc/2) for that cell. Cell membership is fixed by the caller.
  function applyGroupToggle(map: RadFields['passMap'], P: number, ci: number, ppcVal: number, grp: number): RadFields['passMap'] {
    const newMap = map.slice() as RadFields['passMap'];
    const pm = newMap[P];
    const curGroup = pm && pm.cell === ci ? pm.group : null;
    const newGroup = curGroup === grp ? null : grp;
    newMap[P] = { cell: ci, group: newGroup ?? 1 };
    const gppc = Math.ceil(ppcVal / 2);
    const g1Count = newMap.slice(0, totalPasses).filter(m => m && m.cell === ci && m.group === 1).length;
    if (g1Count === gppc) {
      for (let p = 0; p < totalPasses; p++) {
        const m = newMap[p];
        if (m && m.cell === ci && !m.group) newMap[p] = { cell: m.cell, group: 2 };
      }
    }
    return newMap;
  }

  const ncErr = fields.numCells !== '' && (isNaN(parseInt(fields.numCells)) || parseInt(fields.numCells) < 1);

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky header — furnace-assignment bar and the pill tabs pinned together to the
          top of the scroll area while the section content scrolls beneath. Mirrors the
          Convection/TLE editor pill band. */}
      <div className="sticky top-0 z-20 -mx-4 px-4 pt-4 pb-2 bg-background">
        {furnaceBar}
        <div className="flex justify-center">
          <div className={SEGMENT.group}>
            <button
              onClick={() => setTab('tube')}
              className={cn(styles.mono, SEGMENT.item,
                'min-w-[200px] px-6 py-2 text-[11px]',
                tab === 'tube' ? SEGMENT.active : SEGMENT.inactive)}
            >
              {RAD_TAB_TITLES.tube}
            </button>
            <button
              onClick={() => setTab('burner')}
              className={cn(styles.mono, SEGMENT.item,
                'min-w-[200px] px-6 py-2 text-[11px]',
                tab === 'burner' ? SEGMENT.active : SEGMENT.inactive)}
            >
              {RAD_TAB_TITLES.burner}
            </button>
          </div>
        </div>
      </div>

      {notice}

      {/* Step 1: num cells */}
      <div className="flex items-center gap-3 pb-3 border-b border-[var(--color-border)]">
        <span className={cn(TEXT.annotation, 'min-w-[140px]')}>Radiation cells</span>
        <input type="number" min={1} value={fields.numCells}
          onChange={e => setNumCells(e.target.value)}
          placeholder="—"
          className={clsx(numCls,'w-20',ncErr&&'border-[var(--color-accent-red)]!')}
          style={ncErr?{borderColor:'var(--color-accent-red)'}:{}}
        />
        {ncErr && <span className={cn(TEXT.annotation, 'text-accent-red')}>Must be ≥ 1</span>}
      </div>

      {/* Step 2: identical question */}
      {nc > 1 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-surface-hover border border-border rounded">
          <span className={cn(TEXT.annotation, 'flex-1')}>All cells identical?</span>
          <div className="flex">
            <button onClick={() => setIdentical(false)}
              className={cn(TEXT.button, 'px-[10px] py-[3px] border rounded-l-[4px] cursor-pointer')}
              style={{
                background:fields.identicalCells===false?'color-mix(in srgb, var(--color-accent-red) 15%, transparent)':'var(--color-surface)',
                color:fields.identicalCells===false?'var(--color-accent-red)':'var(--color-text-secondary)',
                borderColor:fields.identicalCells===false?'var(--color-accent-red)':'var(--color-border)',
              }}>NO</button>
            <button onClick={() => setIdentical(true)}
              className={cn(TEXT.button, 'px-[10px] py-[3px] border border-l-0 rounded-r-[4px] cursor-pointer')}
              style={{
                background:fields.identicalCells===true?'color-mix(in srgb, var(--color-accent-green) 15%, transparent)':'var(--color-surface)',
                color:fields.identicalCells===true?'var(--color-accent-green)':'var(--color-text-secondary)',
                borderColor:fields.identicalCells===true?'var(--color-accent-green)':'var(--color-border)',
              }}>YES</button>
          </div>
          <span className={TEXT.annotation}>
            (config only — pass table always filled manually)
          </span>
        </div>
      )}

      {/* Gate: need identicalCells answer before showing cells */}
      {nc > 1 && fields.identicalCells === null && (
        <div className={cn(TEXT.annotation, 'py-1')}>
          Answer the identical-cells question above to continue.
        </div>
      )}

      {/* Per-cell config */}
      {nc > 0 && (nc === 1 || fields.identicalCells !== null) && Array.from({length: fields.identicalCells && nc > 1 ? 1 : nc}, (_, ci) => {
        const cell = propagatedCell(ci);
        const editable = ci === 0 || !fields.identicalCells;
        const allFilled = rzCellAllFilled(cell);
        const svgReady  = rzCellSVGReady(cell);
        const isCollapsed = collapsed[ci] ?? false;
        const autoLabel = !editable ? ' (auto-filled)' : '';
        const hCount   = parseInt(cell.hearthBurnerCount) || 0;
        const wCount   = parseInt(cell.wallBurnerCount)   || 0;
        const hearthOn = hCount > 0;
        const wallOn   = wCount > 0;
        const bothOn   = hearthOn && wallOn;
        const hNox     = cell.hearthBurnerType === 'Low NOx' || cell.hearthBurnerType === 'Ultra Low NOx';
        const wNox     = cell.wallBurnerType   === 'Low NOx' || cell.wallBurnerType   === 'Ultra Low NOx';
        const showTypeRow = hearthOn || wallOn;
        const showFgrRow  = (hearthOn && hNox) || (wallOn && wNox);
        const designForcedNo = rzBurnerDesignForcedNo(cell);
        const showDesignFlow = bothOn && cell.burnerDesignSame === false && cell.separateFlowTag === false;
        const ppcErr   = cell.passesPerCell !== '' && (isNaN(parseInt(cell.passesPerCell)) || parseInt(cell.passesPerCell) <= 0 || parseInt(cell.passesPerCell) % 2 !== 0);
        const tpErr    = cell.tubesPerPass !== '' && (isNaN(parseInt(cell.tubesPerPass)) || parseInt(cell.tubesPerPass) <= 0);
        const bothZeroErr = cell.hearthBurnerCount !== '' && cell.wallBurnerCount !== '' && !hearthOn && !wallOn;
        const tp_val = parseInt(cell.tubesPerPass) || 0;
        const orientOpts = tp_val > 0 ? rzValidOrientations(tp_val) : [];
        const curOrient = orientOpts.includes(cell.tubeOrientation) ? cell.tubeOrientation : '';

        // Cell bends
        const hasAMidB = (cell.tubeOrientation||'').includes('-A-');
        const hasAEndB = !hasAMidB && (cell.tubeOrientation||'').endsWith('-A');
        const cpB = hasAEndB?(cell.tubeOrientation||'').slice(0,-2):hasAMidB?(cell.tubeOrientation||'').split('-A-')[0]:(cell.tubeOrientation||'');
        const allPartsB = (cell.tubeOrientation||'').replace(/-A-/g,'~A~').replace(/-A$/,'~A').split('-').join('~').split('~');
        const rowDefs = allPartsB.length > 1 ? allPartsB.slice(0,-1).map((from,i)=>({from,to:allPartsB[i+1],fixed:hasAMidB&&i===allPartsB.length-2})) : [];
        const editableRows = rowDefs.filter(r=>!r.fixed);

        // COT
        const cotHasAMid = (cell.tubeOrientation||'').includes('-A-');
        const cotHasAEnd = !cotHasAMid && (cell.tubeOrientation||'').endsWith('-A');
        const cotTp2 = parseInt(cell.tubesPerPass)||0;
        let cotCellExit=cotTp2, cotAdiaExit=0;
        if(cotTp2>0&&cell.tubeOrientation){
          const ccp=cotHasAEnd?(cell.tubeOrientation).slice(0,-2):cotHasAMid?(cell.tubeOrientation).split('-A-')[0]:(cell.tubeOrientation);
          const cnums=ccp.split('-').map(Number);
          cotCellExit=Math.round(cotTp2*cnums[cnums.length-1]/cnums[0]);
          if(cotHasAMid)cotAdiaExit=Math.round(cotCellExit/cnums[cnums.length-1]);
          else if(cotHasAEnd)cotAdiaExit=cotCellExit;
        }
        const cotAMV=cell.cotAfterAdiaMerge||0;
        const cotN=(cotHasAMid&&cotAMV===1)?cotAdiaExit:cotCellExit;
        const cotSensors=Array.isArray(cell.cotSensorTubes)?cell.cotSensorTubes:[];
        const cotSelCount=cotSensors.slice(0,cotN).filter(Boolean).length;

        // Pass → group table for THIS cell. Cell membership is implicit (positional): this
        // cell owns the contiguous global block [blockStart, blockStart+ppcVal).
        const ppcVal = parseInt(cell.passesPerCell) || 0;
        const blockStart = fields.cells.slice(0, ci).reduce((s, c) => s + (parseInt(c.passesPerCell) || 0), 0);
        const onGroup = (j: number, g: number) => {
          const P = blockStart + j;
          const m = applyGroupToggle(passMap, P, ci, ppcVal, g);
          onChange(rzApplyIdentical({ ...fields, passMap: m }));
        };

        return (
          <div key={ci} className="bg-surface border border-border rounded overflow-hidden" style={{marginBottom:4}}>
            {/* Cell header */}
            <div onClick={()=>toggleCollapse(ci)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 14px',cursor:'pointer',userSelect:'none',background:'var(--color-surface-hover)'}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span className={cn(TEXT.annotation, 'uppercase tracking-[.08em]', allFilled?'text-accent-green':'text-text-secondary')}>
                  {fields.cellNames?.[ci]||`Cell ${ci+1}`}
                </span>
                {autoLabel && <span className={TEXT.annotation}>{autoLabel}</span>}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <input className={cn(TEXT.annotation, 'bg-transparent border-b border-[var(--color-border)] outline-none text-[var(--color-text-secondary)] w-28')}
                  placeholder="Custom cell name…" value={fields.cellNames?.[ci]||''}
                  onClick={e=>e.stopPropagation()}
                  onChange={e=>onChange({...fields,cellNames:{...fields.cellNames,[ci]:e.target.value}})} />
                <svg viewBox="0 0 8 8" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1.5" width="10" height="10"
                  style={{transform:isCollapsed?'rotate(0deg)':'rotate(180deg)',transition:'transform .2s'}}>
                  <path d="M1 2l3 3 3-3"/>
                </svg>
              </div>
            </div>

            {!isCollapsed && (
              <div style={{padding:'0 14px 12px'}}>
                <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:8}}>

                  {/* ── BURNER CONFIGURATION tab ─────────────────────────────────── */}
                  {tab === 'burner' && (<>
                  {/* Hearth + wall burner details — three columns (row label | hearth | wall).
                       Existence is resolved from the count: >0 exists, 0 absent. */}
                  <div className={cn(TABLE.wrap, 'rounded')} style={{marginBottom:4}}>
                    <table style={{borderCollapse:'collapse',width:'100%',tableLayout:'fixed'}}>
                      <colgroup>
                        <col style={{width:'40%'}} />
                        <col style={{width:'30%'}} />
                        <col style={{width:'30%'}} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th className={cn(rzThLblCls, 'p-[6px_10px]')}></th>
                          <th className={cn(rzThColCls, 'p-[6px_10px]')}>Hearth Burner</th>
                          <th className={cn(rzThColCls, 'p-[6px_10px]')}>Wall Burner</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Count */}
                        <tr>
                          <td className={cn(rzTdLblCls, 'p-[6px_10px]')}>Count</td>
                          <td className={cn(rzTdCellCls, 'p-[6px_10px]')}>
                            <input type="number" min={0} step={1} value={cell.hearthBurnerCount} placeholder="—"
                              disabled={!editable}
                              onChange={e=>{const v=rzSanitizeCount(e.target.value);const n=parseInt(v)||0;updateCell(ci,{hearthBurnerCount:v,hearthExists:v===''?null:n>0});}}
                              className={numCls} style={{width:72}} />
                          </td>
                          <td className={cn(rzTdCellCls, 'p-[6px_10px]')}>
                            <input type="number" min={0} step={1} value={cell.wallBurnerCount} placeholder="—"
                              disabled={!editable}
                              onChange={e=>{const v=rzSanitizeCount(e.target.value);const n=parseInt(v)||0;updateCell(ci,{wallBurnerCount:v,wallExists:v===''?null:n>0});}}
                              className={numCls} style={{width:72}} />
                          </td>
                        </tr>
                        {/* Type */}
                        {showTypeRow && (
                          <tr>
                            <td className={cn(rzTdLblCls, 'p-[6px_10px]')}>Type</td>
                            <td className={cn(rzTdCellCls, 'p-[6px_10px]')}>
                              {hearthOn ? (
                                <select value={cell.hearthBurnerType||'Conventional'} disabled={!editable}
                                  onChange={e=>updateCell(ci,{hearthBurnerType:e.target.value})}
                                  className={selCls} style={{minWidth:130}}>
                                  {BURNER_TYPES.map(o=><option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : <span className={rzDashCls}>—</span>}
                            </td>
                            <td className={cn(rzTdCellCls, 'p-[6px_10px]')}>
                              {wallOn ? (
                                <select value={cell.wallBurnerType||'Conventional'} disabled={!editable}
                                  onChange={e=>updateCell(ci,{wallBurnerType:e.target.value})}
                                  className={selCls} style={{minWidth:130}}>
                                  {BURNER_TYPES.map(o=><option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : <span className={rzDashCls}>—</span>}
                            </td>
                          </tr>
                        )}
                        {/* Internal Flue Gas Recirculation */}
                        {showFgrRow && (
                          <tr>
                            <td className={cn(rzTdLblCls, 'p-[6px_10px]')}>Internal Flue Gas Recirculation</td>
                            <td className={cn(rzTdCellCls, 'p-[6px_10px]')}>
                              {hearthOn && hNox ? (
                                <input type="number" min={0} max={30} step={0.1} value={cell.hearthFgrPercent}
                                  disabled={!editable}
                                  onChange={e=>{const v=Math.min(30,parseFloat(e.target.value)||0);updateCell(ci,{hearthFgrPercent:v});}}
                                  className={numCls} style={{width:72,...(cell.hearthFgrPercent>30?{borderColor:'var(--color-accent-red)'}:{})}} />
                              ) : <span className={rzDashCls}>—</span>}
                            </td>
                            <td className={cn(rzTdCellCls, 'p-[6px_10px]')}>
                              {wallOn && wNox ? (
                                <input type="number" min={0} max={30} step={0.1} value={cell.wallFgrPercent}
                                  disabled={!editable}
                                  onChange={e=>{const v=Math.min(30,parseFloat(e.target.value)||0);updateCell(ci,{wallFgrPercent:v});}}
                                  className={numCls} style={{width:72,...(cell.wallFgrPercent>30?{borderColor:'var(--color-accent-red)'}:{})}} />
                              ) : <span className={rzDashCls}>—</span>}
                            </td>
                          </tr>
                        )}
                        {/* Same burner design? — merged across hearth & wall. Dropped from UI when
                             forced NO (types/FGR differ), but still stored false (see updateCell). */}
                        {bothOn && !designForcedNo && (
                          <tr>
                            <td className={cn(rzTdLblCls, 'p-[6px_10px]')}>Same burner design for hearth &amp; wall?</td>
                            <td colSpan={2} className={cn(rzTdCellCls, 'p-[6px_10px]')}>
                              <div style={{display:'flex',justifyContent:'center'}}>
                                <Toggle value={cell.burnerDesignSame}
                                  onChange={v=>editable&&updateCell(ci,{burnerDesignSame:v})} disabled={!editable} />
                              </div>
                            </td>
                          </tr>
                        )}
                        {/* Separate fuel flow tags? — merged across hearth & wall */}
                        {bothOn && cell.burnerDesignSame === false && (
                          <tr>
                            <td className={cn(rzTdLblCls, 'p-[6px_10px]')}>Separate fuel flow tags for wall &amp; hearth?</td>
                            <td colSpan={2} className={cn(rzTdCellCls, 'p-[6px_10px]')}>
                              <div style={{display:'flex',justifyContent:'center'}}>
                                <Toggle value={cell.separateFlowTag}
                                  onChange={v=>editable&&updateCell(ci,{separateFlowTag:v})} disabled={!editable} />
                              </div>
                            </td>
                          </tr>
                        )}
                        {/* Design Flow Rate — only when burner designs differ and tags are shared */}
                        {showDesignFlow && (
                          <tr>
                            <td className={cn(rzTdLblCls, 'p-[6px_10px]')}>Design Flow Rate</td>
                            <td className={cn(rzTdCellCls, 'p-[6px_10px]')}>
                              <div style={{display:'flex',gap:4,justifyContent:'center'}}>
                                <input type="number" min={0} step={0.01} value={cell.hearthDesignFlowRate} placeholder="—"
                                  disabled={!editable} onChange={e=>updateCell(ci,{hearthDesignFlowRate:e.target.value})}
                                  className={numCls} style={{width:72}} />
                                <select value={cell.hearthDesignFlowRateUom||defaultMassFlowUom} disabled={!editable}
                                  onChange={e=>updateCell(ci,{hearthDesignFlowRateUom:e.target.value})}
                                  className={selCls} style={{minWidth:64}}>
                                  {MF_UOMS.map(u=><option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                            </td>
                            <td className={cn(rzTdCellCls, 'p-[6px_10px]')}>
                              <div style={{display:'flex',gap:4,justifyContent:'center'}}>
                                <input type="number" min={0} step={0.01} value={cell.wallDesignFlowRate} placeholder="—"
                                  disabled={!editable} onChange={e=>updateCell(ci,{wallDesignFlowRate:e.target.value})}
                                  className={numCls} style={{width:72}} />
                                <select value={cell.wallDesignFlowRateUom||defaultMassFlowUom} disabled={!editable}
                                  onChange={e=>updateCell(ci,{wallDesignFlowRateUom:e.target.value})}
                                  className={selCls} style={{minWidth:64}}>
                                  {MF_UOMS.map(u=><option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Both absent error */}
                  {bothZeroErr && <div className={cn(TEXT.annotation, 'text-accent-red py-0.5')}>At least one burner type (hearth or wall) must exist</div>}
                  </>)}

                  {/* ── PASS & TUBE DETAILS tab ──────────────────────────────────── */}
                  {tab === 'tube' && (<>
                  {/* Geometry questionnaire + cell diagram — left: 2-column questionnaire & bends, right: SVG.
                       Panels are vertically centered so their (content-driven, unequal) heights read as
                       intentional rather than top-ragged — no height is coupled to another. */}
                  <div style={{display:'flex',gap:12,alignItems:'center',marginTop:2}}>
                    {/* LEFT — questionnaire (label | control rows; Tube orientation last) + bends */}
                    <div style={{flex:'0 0 340px',minWidth:0,display:'flex',flexDirection:'column',gap:6}}>
                      <div className={cn(TABLE.wrap, 'rounded')}>
                        <table style={{borderCollapse:'collapse',width:'100%'}}>
                          <tbody>
                            <tr>
                              <td className={cn(rzTdLblCls, 'p-[6px_10px]')} style={{borderTop:'none'}}>Pass Per Cell</td>
                              <td className={cn(rzTdCellCls, 'p-[6px_10px]')} style={{borderTop:'none'}}>
                                <input type="number" min={2} step={2} value={cell.passesPerCell} placeholder="—"
                                  disabled={!editable} onChange={e=>updateCell(ci,{passesPerCell:e.target.value})}
                                  className={numCls} style={{width:'100%',textAlign:'center',...(ppcErr?{borderColor:'var(--color-accent-red)'}:{})}} />
                              </td>
                            </tr>
                            <tr>
                              <td className={cn(rzTdLblCls, 'p-[6px_10px]')}>Tubes Per Pass</td>
                              <td className={cn(rzTdCellCls, 'p-[6px_10px]')}>
                                <input type="number" min={1} value={cell.tubesPerPass} placeholder="—"
                                  disabled={!editable} onChange={e=>{
                                    const newTp=parseInt(e.target.value)||0;
                                    const validOpts=rzValidOrientations(newTp);
                                    const newOrient=cell.tubeOrientation&&validOpts.includes(cell.tubeOrientation)?cell.tubeOrientation:'';
                                    updateCell(ci,{tubesPerPass:e.target.value,tubeOrientation:newOrient,cellBends:[]});
                                  }}
                                  className={numCls} style={{width:'100%',textAlign:'center',...(tpErr?{borderColor:'var(--color-accent-red)'}:{})}} />
                              </td>
                            </tr>
                            <tr>
                              <td className={cn(rzTdLblCls, 'p-[6px_10px]')}>Feed Inlet From</td>
                              <td className={cn(rzTdCellCls, 'p-[6px_10px]')}>
                                <select value={cell.flowEntry||'top'} disabled={!editable}
                                  onChange={e=>updateCell(ci,{flowEntry:e.target.value as 'top'|'bottom'})}
                                  className={selCls} style={{width:'100%',textAlign:'center'}}>
                                  <option value="top">Top</option>
                                  <option value="bottom">Bottom</option>
                                </select>
                              </td>
                            </tr>
                            <tr>
                              <td className={cn(rzTdLblCls, 'p-[6px_10px]')}>Feed Control Mechanism</td>
                              <td className={cn(rzTdCellCls, 'p-[6px_10px]')}>
                                <select value={cell.feedType||'control_valve'} disabled={!editable}
                                  onChange={e=>updateCell(ci,{feedType:e.target.value as 'control_valve'|'venturi'})}
                                  className={selCls} style={{width:'100%',textAlign:'center'}}>
                                  <option value="control_valve">Control valve</option>
                                  <option value="venturi">Venturi</option>
                                </select>
                              </td>
                            </tr>
                            <tr>
                              <td className={cn(rzTdLblCls, 'p-[6px_10px]')}>Tube orientation</td>
                              <td className={cn(rzTdCellCls, 'p-[6px_10px]')}>
                                {tp_val > 0 ? (
                                  <select value={curOrient} disabled={!editable}
                                    onChange={e=>{
                                      const newO=e.target.value;
                                      // rebuild bends for new orientation
                                      const allParts2=(newO).replace(/-A-/g,'~A~').replace(/-A$/,'~A').split('-').join('~').split('~');
                                      const rDefs2=allParts2.length>1?allParts2.slice(0,-1).map((f2,i)=>({from:f2,to:allParts2[i+1],fixed:newO.includes('-A-')&&i===allParts2.length-2})):[];
                                      const eRows2=rDefs2.filter(r=>!r.fixed);
                                      const newBends=eRows2.map(r=>r.to==='A'?0:1);
                                      updateCell(ci,{tubeOrientation:newO,cellBends:newBends});
                                    }}
                                    className={selCls} style={{width:'100%',...(!curOrient?{borderColor:'var(--color-accent-yellow)'}:{})}}>
                                    <option value="">— select —</option>
                                    {orientOpts.map(o=><option key={o} value={o}>{o}</option>)}
                                  </select>
                                ) : (
                                  <select disabled className={selCls} style={{width:'100%',opacity:.35}}>
                                    <option>Enter tubes/pass first</option>
                                  </select>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {ppcErr && <div className={cn(TEXT.annotation, 'text-accent-red mt-0.5')}>Must be a positive even number</div>}

                      {/* Bends Between Stages — 2-column structure (stage | bends) */}
                      {curOrient && editableRows.length > 0 && (
                        <div className={cn(TABLE.wrap, 'rounded')}>
                          <table style={{borderCollapse:'collapse',width:'100%'}}>
                            <tbody>
                              <tr>
                                <td colSpan={2} className={cn(TEXT.tableCell, TABLE.header, 'text-text-secondary')} style={{padding:'6px 12px',borderBottom:'1px solid var(--color-border)',textAlign:'center',whiteSpace:'nowrap'}}>Bends Between Stages</td>
                              </tr>
                              {rowDefs.map((rd, ri) => {
                                const lbl=`${rd.from} → ${rd.to}`;
                                const editIdx = editableRows.indexOf(rd);
                                const bendVal = (cell.cellBends||[])[editIdx]||0;
                                const isATarget = rd.to === 'A';
                                const minB = isATarget ? 0 : 1;
                                return (
                                  <tr key={ri} className={TABLE.row}>
                                    <td className={cn(TEXT.tableCell, 'text-text-secondary text-left')} style={{padding:'6px 12px',borderTop:'1px solid var(--color-border)',whiteSpace:'nowrap'}}>{lbl}</td>
                                    <td style={{padding:'6px 12px',borderTop:'1px solid var(--color-border)',borderLeft:'1px solid var(--color-border)',textAlign:'center'}}>
                                      {rd.fixed ? (
                                        <input type="number" value={0} disabled className={numCls} style={{width:52,textAlign:'center',opacity:.4}} />
                                      ) : (
                                        <input type="number" min={minB} step={1} value={Math.max(minB,bendVal)} disabled={!editable}
                                          onChange={e=>{
                                            const newBends=(cell.cellBends||[]).slice();
                                            while(newBends.length<=editIdx)newBends.push(isATarget?0:1);
                                            newBends[editIdx]=Math.max(minB,parseInt(e.target.value)||minB);
                                            updateCell(ci,{cellBends:newBends});
                                          }}
                                          className={numCls} style={{width:52,textAlign:'center'}} />
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* MIDDLE — pass → group for THIS cell (no cell column; rows = passes/cell).
                         Cell membership is implicit/positional, so the exported passMap is identical
                         to the auto-prefill's contiguous blocks. When all cells are identical, only
                         Cell 1 renders and edits mirror to every cell via rzApplyIdentical. */}
                    {allCellsFilled && ppcVal > 0 && (
                      <div style={{flex:'0 0 auto',minWidth:0,display:'flex',flexDirection:'column',gap:6}}>
                        <div className={cn(TABLE.wrap, 'rounded')}>
                          <table style={{borderCollapse:'collapse',width:'100%'}}>
                            <thead>
                              <tr>
                                <th className={cn(rzThLblCls, 'p-[6px_10px]')}>Pass</th>
                                <th className={cn(rzThColCls, 'p-[6px_10px]')}>Grp 1</th>
                                <th className={cn(rzThColCls, 'p-[6px_10px]')}>Grp 2</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Array.from({length:ppcVal},(_,j)=>{
                                const P=blockStart+j;
                                const pm=passMap[P]??null;
                                const grp=pm && pm.cell===ci ? pm.group : null;
                                return (
                                  <tr key={j} className={TABLE.row}>
                                    <td className={cn(rzTdLblCls, 'p-[4px_10px]')} style={{whiteSpace:'nowrap'}}>
                                      <span className={cn(TEXT.annotation, 'opacity-50')}>Pass </span>
                                      <input value={fields.passNames?.[P]||''} placeholder={String(P+1)} disabled={!editable}
                                        onChange={e=>onChange(rzApplyIdentical({...fields,passNames:{...fields.passNames,[P]:e.target.value}}))}
                                        className={cn(TEXT.annotation, 'text-text-primary')}
                                        style={{width:46,background:'transparent',border:'none',borderBottom:'1px solid var(--color-border)',outline:'none',padding:'1px 2px'}} />
                                    </td>
                                    {[1,2].map(g=>{
                                      const sel=grp===g;
                                      return (
                                        <td key={g} className={cn(TABLE.row, 'border-t border-border border-l border-border')} style={{textAlign:'center',padding:'4px 8px'}}>
                                          <div onClick={()=>editable&&onGroup(j,g)} style={{
                                            width:22,height:22,borderRadius:'50%',border:'1.5px solid',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:11,transition:'all .12s',
                                            background:sel?'color-mix(in srgb, var(--color-accent-green) 15%, transparent)':'var(--color-surface-hover)',
                                            borderColor:sel?'var(--color-accent-green)':'var(--color-border)',
                                            color:sel?'var(--color-accent-green)':'var(--color-text-secondary)',
                                            cursor:editable?'pointer':'not-allowed',opacity:editable?1:.5,
                                          }}>{sel?'✓':''}</div>
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

                    {/* RIGHT — cell diagram at natural scale (aspect ratio fixed, like v418): centered
                         when it fits the area, horizontal scroll when wider. Fewer tubes → smaller diagram. */}
                    {svgReady && (
                      <div style={{flex:1,minWidth:0,overflowX:'auto'}}>
                        <div style={{width:'max-content',margin:'0 auto'}} dangerouslySetInnerHTML={{__html:rzBuildCellSVGString(cell)}} />
                      </div>
                    )}
                  </div>

                  {/* COT sensor tags */}
                  {curOrient && (
                    <div className={cn(TABLE.wrap, 'rounded')} style={{marginTop:6}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 10px',background:'var(--color-surface-hover)',borderBottom:'1px solid var(--color-border)'}}>
                        <span style={{fontFamily:'ui-monospace,monospace',fontSize:9,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'.06em'}}>COT sensor tags — which tubes?</span>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <span style={{fontFamily:'ui-monospace,monospace',fontSize:8,color:cotSelCount>0?'var(--color-accent-green)':'var(--color-text-secondary)'}}>{cotSelCount} / {cotN} with sensor</span>
                          {editable && cotN>0 && <>
                            <button onClick={()=>{const s=new Array(cotN).fill(true);updateCell(ci,{cotSensorTubes:s});}} className={cn(BUTTON.ghost, 'bg-surface-hover px-2 py-0.5')} style={{fontFamily:'ui-monospace,monospace',fontSize:8}}>Select all</button>
                            <button onClick={()=>{const s=new Array(cotN).fill(false);updateCell(ci,{cotSensorTubes:s});}} className={cn(BUTTON.ghost, 'bg-surface-hover px-2 py-0.5')} style={{fontFamily:'ui-monospace,monospace',fontSize:8}}>Deselect all</button>
                          </>}
                        </div>
                      </div>
                      {cotHasAMid && (
                        <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 10px',background:'var(--color-surface-hover)',borderBottom:'1px solid var(--color-border)'}}>
                          <span style={{fontFamily:'ui-monospace,monospace',fontSize:9,color:'var(--color-text-secondary)',flex:1}}>Is COT measured after tube merging in adiabatic zone?</span>
                          <YesNo label="" value={cotAMV===1} onChange={v=>editable&&updateCell(ci,{cotAfterAdiaMerge:v?1:0})} disabled={!editable} />
                        </div>
                      )}
                      {cotN>0 ? (
                        <div style={{overflowX:'auto'}}>
                          <div className={cn(TABLE.wrap, 'rounded-md')} style={{display:'inline-block'}}>
                          <table style={{borderCollapse:'collapse',minWidth:'max-content'}}>
                            <thead><tr className={TABLE.header}>
                              {Array.from({length:cotN},(_,ti)=>(
                                <th key={ti} style={{minWidth:44,padding:'4px 6px',textAlign:'center',fontFamily:'ui-monospace,monospace',fontSize:9,fontWeight:500,color:'var(--color-text-secondary)',whiteSpace:'nowrap',borderRight:'1px solid var(--color-border)'}}>T{ti+1}</th>
                              ))}
                            </tr></thead>
                            <tbody><tr className={TABLE.row}>
                              {Array.from({length:cotN},(_,ti)=>{
                                const has=!!(cotSensors[ti]);
                                return(
                                  <td key={ti} style={{minWidth:44,padding:'4px 4px',textAlign:'center',borderRight:'1px solid var(--color-border)'}}>
                                    <button disabled={!editable}
                                      onClick={()=>{if(!editable)return;const s=[...(cell.cotSensorTubes||[])];while(s.length<=ti)s.push(false);s[ti]=!s[ti];updateCell(ci,{cotSensorTubes:s});}}
                                      style={{padding:'2px 6px',minWidth:36,fontSize:9,fontFamily:'ui-monospace,monospace',border:'1px solid',borderRadius:3,cursor:editable?'pointer':'not-allowed',opacity:editable?1:.55,
                                        background:has?'color-mix(in srgb, var(--color-accent-green) 15%, transparent)':'var(--color-surface)',color:has?'var(--color-accent-green)':'var(--color-text-secondary)',borderColor:has?'var(--color-accent-green)':'var(--color-border)'}}>
                                      {has?'YES':'NO'}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr></tbody>
                          </table>
                          </div>
                        </div>
                      ) : (
                        <div style={{padding:'8px 12px',fontFamily:'ui-monospace,monospace',fontSize:9,color:'var(--color-text-secondary)'}}>Set tube orientation to determine tube count.</div>
                      )}
                    </div>
                  )}
                  </>)}

                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Auto-fill note for identical cells */}
      {fields.identicalCells && nc > 1 && (
        <div style={{fontFamily:'ui-monospace,monospace',fontSize:8,color:'var(--color-text-secondary)',padding:'4px 8px',background:'var(--color-surface-hover)',borderRadius:4,border:'1px solid var(--color-border)'}}>
          Cells 2–{nc} are auto-filled from Cell 1. Tube config applies to all.
        </div>
      )}

    </div>
  );
}
