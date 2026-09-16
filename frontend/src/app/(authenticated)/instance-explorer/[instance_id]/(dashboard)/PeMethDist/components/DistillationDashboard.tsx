"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Settings, 
  Database,
  RefreshCw,
  Sliders,
  ChevronRight,
  CheckCircle,
  FileSpreadsheet,
  Check,
  SlidersHorizontal,
  FolderSync,
  Search,
  AlertTriangle,
  Play,
  Activity,
  TrendingUp
} from "lucide-react";
import { getDistillationConfig, saveDistillationConfig, getDistillationKpis, getDistillationLiveContributors } from "../actions/actions";

import { 
  ReactFlow, 
  Background, 
  Controls, 
  Panel,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  useReactFlow,
  ReactFlowProvider
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";


// Universal Port Component: Acts as both Start & End Point seamlessly with Directional Arrowhead
function UniversalNodePort({ id, position, style, clickSource, nodeId, onHandleClick }: any) {
  const isSelected = clickSource?.nodeId === nodeId && (clickSource?.handleId === `${id}-src` || clickSource?.handleId === `${id}-tgt`);
  
  return (
    <div 
      style={style} 
      className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-cell group z-30 pointer-events-auto"
    >
      {/* Target Handle (for receiving incoming streams) */}
      <Handle
        type="target"
        position={position}
        id={`${id}-tgt`}
        style={{ width: '100%', height: '100%', backgroundColor: 'transparent', border: 'none', position: 'absolute', inset: 0 }}
        isConnectable={true}
        onClick={(e) => { e.stopPropagation(); onHandleClick?.(`${id}-tgt`, 'target'); }}
        title="Stream Port (Click/Drag to Start or End Connection)"
      />
      {/* Source Handle (for starting outgoing streams) */}
      <Handle
        type="source"
        position={position}
        id={`${id}-src`}
        style={{ width: '100%', height: '100%', backgroundColor: 'transparent', border: 'none', position: 'absolute', inset: 0 }}
        isConnectable={true}
        onClick={(e) => { e.stopPropagation(); onHandleClick?.(`${id}-src`, 'source'); }}
        title="Stream Port (Click/Drag to Start or End Connection)"
      />

      {/* Visual Dark Slate Dot (Ammonia Reference Style) */}
      <div 
        className={`pointer-events-none w-2.5 h-2.5 rounded-full bg-slate-800 border border-white shadow-sm transition-all duration-150 group-hover:scale-150 group-hover:bg-blue-600 group-hover:ring-4 group-hover:ring-blue-400/40 ${
          isSelected ? "ring-4 ring-blue-500 animate-pulse scale-150 bg-blue-600" : ""
        }`} 
      />

      {/* Plus Cursor Overlay on Hover */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-40">
        <span className="text-white font-black text-[9px] leading-none drop-shadow">
          +
        </span>
      </div>
    </div>
  );
}

function VesselNode({ id, data }: any) {
  const { setNodes } = useReactFlow();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-emerald-400 transition-all p-3 text-xs flex flex-col justify-center min-w-[170px] min-h-[65px] text-slate-800 relative select-none">
      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shadow-sm z-10">
        ✓
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setNodes((nds) => nds.filter((n) => n.id !== id));
        }}
        className="absolute top-2 right-4 text-slate-300 hover:text-red-500 font-bold text-[10px] w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-slate-100 transition-all z-10"
        title="Remove unit"
      >
        ✕
      </button>
      <div className="font-bold text-xs text-slate-800 tracking-tight pr-5">
        {data.label}
      </div>
      <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
        STORAGE VESSEL
      </div>
      
      {/* Universal Ports (Any port can be Start or End Point) */}
      <UniversalNodePort id="p-left-1" position={Position.Left} style={{ left: '0%', top: '30%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-left-2" position={Position.Left} style={{ left: '0%', top: '70%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-right-1" position={Position.Right} style={{ left: '100%', top: '30%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-right-2" position={Position.Right} style={{ left: '100%', top: '70%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-top" position={Position.Top} style={{ left: '50%', top: '0%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-bottom" position={Position.Bottom} style={{ left: '50%', top: '100%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
    </div>
  );
}

function ColumnNode({ id, data }: any) {
  const { setNodes } = useReactFlow();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-blue-400 transition-all p-3.5 text-xs flex flex-col justify-between min-w-[185px] min-h-[75px] text-slate-800 relative select-none">
      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shadow-sm z-10">
        ✓
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setNodes((nds) => nds.filter((n) => n.id !== id));
        }}
        className="absolute top-2 right-4 text-slate-300 hover:text-red-500 font-bold text-[10px] w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-slate-100 transition-all z-10"
        title="Remove unit"
      >
        ✕
      </button>
      <div>
        <div className="font-bold text-xs text-slate-800 tracking-tight pr-5">
          {data.label}
        </div>
        <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
          DISTILLATION COLUMN
        </div>
      </div>

      {/* Universal Ports (Any port can be Start or End Point) */}
      <UniversalNodePort id="p-left-1" position={Position.Left} style={{ left: '0%', top: '25%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-left-2" position={Position.Left} style={{ left: '0%', top: '50%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-left-3" position={Position.Left} style={{ left: '0%', top: '75%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-right-1" position={Position.Right} style={{ left: '100%', top: '25%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-right-2" position={Position.Right} style={{ left: '100%', top: '50%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-right-3" position={Position.Right} style={{ left: '100%', top: '75%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-top" position={Position.Top} style={{ left: '50%', top: '0%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-bottom" position={Position.Bottom} style={{ left: '50%', top: '100%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
    </div>
  );
}

function ExchangerNode({ id, data }: any) {
  const { setNodes } = useReactFlow();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-amber-400 transition-all p-3 text-xs flex flex-col justify-center min-w-[170px] min-h-[65px] text-slate-800 relative select-none">
      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shadow-sm z-10">
        ✓
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setNodes((nds) => nds.filter((n) => n.id !== id));
        }}
        className="absolute top-2 right-4 text-slate-300 hover:text-red-500 font-bold text-[10px] w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-slate-100 transition-all z-10"
        title="Remove unit"
      >
        ✕
      </button>
      <div className="font-bold text-xs text-slate-800 tracking-tight pr-5">
        {data.label}
      </div>
      <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
        HEAT EXCHANGER
      </div>
      
      {/* Universal Ports (Any port can be Start or End Point) */}
      <UniversalNodePort id="p-left-1" position={Position.Left} style={{ left: '0%', top: '30%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-left-2" position={Position.Left} style={{ left: '0%', top: '70%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-right-1" position={Position.Right} style={{ left: '100%', top: '30%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-right-2" position={Position.Right} style={{ left: '100%', top: '70%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-top" position={Position.Top} style={{ left: '50%', top: '0%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-bottom" position={Position.Bottom} style={{ left: '50%', top: '100%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
    </div>
  );
}

function CondenserNode({ id, data }: any) {
  const { setNodes } = useReactFlow();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-blue-400 transition-all p-3 text-xs flex flex-col justify-center min-w-[170px] min-h-[65px] text-slate-800 relative select-none">
      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shadow-sm z-10">
        ✓
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setNodes((nds) => nds.filter((n) => n.id !== id));
        }}
        className="absolute top-2 right-4 text-slate-300 hover:text-red-500 font-bold text-[10px] w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-slate-100 transition-all z-10"
        title="Remove unit"
      >
        ✕
      </button>
      <div className="font-bold text-xs text-slate-800 tracking-tight pr-5">
        {data.label}
      </div>
      <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
        CONDENSER UNIT
      </div>
      
      {/* Universal Ports (Any port can be Start or End Point) */}
      <UniversalNodePort id="p-left-1" position={Position.Left} style={{ left: '0%', top: '30%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-left-2" position={Position.Left} style={{ left: '0%', top: '70%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-right-1" position={Position.Right} style={{ left: '100%', top: '30%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-right-2" position={Position.Right} style={{ left: '100%', top: '70%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-top" position={Position.Top} style={{ left: '50%', top: '0%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-bottom" position={Position.Bottom} style={{ left: '50%', top: '100%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
    </div>
  );
}

function ReboilerNode({ id, data }: any) {
  const { setNodes } = useReactFlow();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-amber-400 transition-all p-3 text-xs flex flex-col justify-center min-w-[170px] min-h-[65px] text-slate-800 relative select-none">
      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shadow-sm z-10">
        ✓
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setNodes((nds) => nds.filter((n) => n.id !== id));
        }}
        className="absolute top-2 right-4 text-slate-300 hover:text-red-500 font-bold text-[10px] w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-slate-100 transition-all z-10"
        title="Remove unit"
      >
        ✕
      </button>
      <div className="font-bold text-xs text-slate-800 tracking-tight pr-5">
        {data.label}
      </div>
      <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
        REBOILER UNIT
      </div>
      
      {/* Universal Ports (Any port can be Start or End Point) */}
      <UniversalNodePort id="p-left-1" position={Position.Left} style={{ left: '0%', top: '30%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-left-2" position={Position.Left} style={{ left: '0%', top: '70%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-right-1" position={Position.Right} style={{ left: '100%', top: '30%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-right-2" position={Position.Right} style={{ left: '100%', top: '70%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-top" position={Position.Top} style={{ left: '50%', top: '0%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-bottom" position={Position.Bottom} style={{ left: '50%', top: '100%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
    </div>
  );
}

function DosingNode({ id, data }: any) {
  const { setNodes } = useReactFlow();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-purple-400 transition-all p-3 text-xs flex flex-col justify-center min-w-[170px] min-h-[65px] text-slate-800 relative select-none">
      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shadow-sm z-10">
        ✓
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setNodes((nds) => nds.filter((n) => n.id !== id));
        }}
        className="absolute top-2 right-4 text-slate-300 hover:text-red-500 font-bold text-[10px] w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-slate-100 transition-all z-10"
        title="Remove unit"
      >
        ✕
      </button>
      <div className="font-bold text-xs text-slate-800 tracking-tight pr-5">
        {data.label}
      </div>
      <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
        DOSING UNIT
      </div>
      
      {/* Universal Ports (Any port can be Start or End Point) */}
      <UniversalNodePort id="p-left-1" position={Position.Left} style={{ left: '0%', top: '30%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-left-2" position={Position.Left} style={{ left: '0%', top: '70%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-right-1" position={Position.Right} style={{ left: '100%', top: '30%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-right-2" position={Position.Right} style={{ left: '100%', top: '70%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-top" position={Position.Top} style={{ left: '50%', top: '0%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
      <UniversalNodePort id="p-bottom" position={Position.Bottom} style={{ left: '50%', top: '100%' }} clickSource={data.clickSource} nodeId={id} onHandleClick={(hId: string, t: any) => data.onHandleClick?.(hId, t)} />
    </div>
  );
}

function SourceNode({ data }: any) {
  return (
    <div className="rounded-full border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-emerald-400 transition-all px-3 py-1.5 text-xs flex items-center justify-between min-w-[150px] text-slate-800 relative select-none">
      <div className="flex items-center gap-1.5 pr-3">
        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
        <div>
          <div className="font-bold text-[11px] text-slate-800 leading-tight">{data.label}</div>
          <div className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">STREAM SOURCE</div>
        </div>
      </div>
      <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">
        ✓
      </div>
      
      <Handle 
        type="source" position={Position.Right} id="right-out" 
        className="w-6 h-6 bg-transparent border-none flex items-center justify-center cursor-cell z-20 group"
        onClick={(e) => { e.stopPropagation(); data.onHandleClick?.("right-out", "source"); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); data.onHandleClick?.("right-out", "source"); }}
      >
        <div className={`pointer-events-none w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm transition-all group-hover:scale-150 ${
          (data.clickSource?.nodeId === "feed-source" && data.clickSource?.handleId === "right-out") ? "ring-4 ring-offset-1 ring-emerald-500 animate-pulse scale-125" : ""
        }`} />
      </Handle>
      <Handle 
        type="source" position={Position.Left} id="left-out" 
        className="w-6 h-6 bg-transparent border-none flex items-center justify-center cursor-cell z-20 group"
        onClick={(e) => { e.stopPropagation(); data.onHandleClick?.("left-out", "source"); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); data.onHandleClick?.("left-out", "source"); }}
      >
        <div className={`pointer-events-none w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm transition-all group-hover:scale-150 ${
          (data.clickSource?.nodeId === "feed-source" && data.clickSource?.handleId === "left-out") ? "ring-4 ring-offset-1 ring-emerald-500 animate-pulse scale-125" : ""
        }`} />
      </Handle>
      <Handle 
        type="source" position={Position.Top} id="top-out" 
        className="w-6 h-6 bg-transparent border-none flex items-center justify-center cursor-cell z-20 group"
        onClick={(e) => { e.stopPropagation(); data.onHandleClick?.("top-out", "source"); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); data.onHandleClick?.("top-out", "source"); }}
      >
        <div className={`pointer-events-none w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm transition-all group-hover:scale-150 ${
          (data.clickSource?.nodeId === "feed-source" && data.clickSource?.handleId === "top-out") ? "ring-4 ring-offset-1 ring-emerald-500 animate-pulse scale-125" : ""
        }`} />
      </Handle>
      <Handle 
        type="source" position={Position.Bottom} id="bottom-out" 
        className="w-6 h-6 bg-transparent border-none flex items-center justify-center cursor-cell z-20 group"
        onClick={(e) => { e.stopPropagation(); data.onHandleClick?.("bottom-out", "source"); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); data.onHandleClick?.("bottom-out", "source"); }}
      >
        <div className={`pointer-events-none w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm transition-all group-hover:scale-150 ${
          (data.clickSource?.nodeId === "feed-source" && data.clickSource?.handleId === "bottom-out") ? "ring-4 ring-offset-1 ring-emerald-500 animate-pulse scale-125" : ""
        }`} />
      </Handle>
    </div>
  );
}

function SinkNode({ id, data }: any) {
  return (
    <div className="rounded-full border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-amber-400 transition-all px-3 py-1.5 text-xs flex items-center justify-between min-w-[150px] text-slate-800 relative select-none">
      <Handle 
        type="target" position={Position.Left} id="left-in" 
        className="w-6 h-6 bg-transparent border-none flex items-center justify-center cursor-cell z-20 group"
        onClick={(e) => { e.stopPropagation(); data.onHandleClick?.("left-in", "target"); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); data.onHandleClick?.("left-in", "target"); }}
      >
        <div className={`pointer-events-none w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm transition-all group-hover:scale-150 ${
          (data.clickSource?.nodeId === id && data.clickSource?.handleId === "left-in") ? "ring-4 ring-offset-1 ring-blue-500 animate-pulse scale-125" : ""
        }`} />
      </Handle>
      <Handle 
        type="target" position={Position.Right} id="right-in" 
        className="w-6 h-6 bg-transparent border-none flex items-center justify-center cursor-cell z-20 group"
        onClick={(e) => { e.stopPropagation(); data.onHandleClick?.("right-in", "target"); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); data.onHandleClick?.("right-in", "target"); }}
      >
        <div className={`pointer-events-none w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm transition-all group-hover:scale-150 ${
          (data.clickSource?.nodeId === id && data.clickSource?.handleId === "right-in") ? "ring-4 ring-offset-1 ring-blue-500 animate-pulse scale-125" : ""
        }`} />
      </Handle>
      <Handle 
        type="target" position={Position.Top} id="top-in" 
        className="w-6 h-6 bg-transparent border-none flex items-center justify-center cursor-cell z-20 group"
        onClick={(e) => { e.stopPropagation(); data.onHandleClick?.("top-in", "target"); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); data.onHandleClick?.("top-in", "target"); }}
      >
        <div className={`pointer-events-none w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm transition-all group-hover:scale-150 ${
          (data.clickSource?.nodeId === id && data.clickSource?.handleId === "top-in") ? "ring-4 ring-offset-1 ring-blue-500 animate-pulse scale-125" : ""
        }`} />
      </Handle>
      <Handle 
        type="target" position={Position.Bottom} id="bottom-in" 
        className="w-6 h-6 bg-transparent border-none flex items-center justify-center cursor-cell z-20 group"
        onClick={(e) => { e.stopPropagation(); data.onHandleClick?.("bottom-in", "target"); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); data.onHandleClick?.("bottom-in", "target"); }}
      >
        <div className={`pointer-events-none w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm transition-all group-hover:scale-150 ${
          (data.clickSource?.nodeId === id && data.clickSource?.handleId === "bottom-in") ? "ring-4 ring-offset-1 ring-blue-500 animate-pulse scale-125" : ""
        }`} />
      </Handle>

      <div className="flex items-center gap-1.5 pl-3">
        <div>
          <div className="font-bold text-[11px] text-slate-800 leading-tight">{data.label}</div>
          <div className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">PRODUCT SINK</div>
        </div>
      </div>
      <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">
        ✓
      </div>
    </div>
  );
}interface DistillationDashboardProps {
  id: string;
  instanceName: string;
}

export function DistillationDashboard({ id, instanceName }: DistillationDashboardProps) {
  const [mainMode, setMainMode] = useState<"efficiency" | "config">("efficiency");
  const [contributorsData, setContributorsData] = useState<any[]>([]);
  const [contribLoading, setContribLoading] = useState<boolean>(false);
  const [selectedTrendTag, setSelectedTrendTag] = useState<string>("");

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [paletteOpen, setPaletteOpen] = useState<boolean>(true);
  const [guideOpen, setGuideOpen] = useState<boolean>(false);
  const [clickSource, setClickSource] = useState<{ nodeId: string; handleId: string; type: "source" | "target" } | null>(null);

  const loadContributors = async () => {
    try {
      setContribLoading(true);
      const res = await getDistillationLiveContributors(id);
      if (res && res.contributors) {
        setContributorsData(res.contributors);
        if (res.contributors.length > 0 && !selectedTrendTag) {
          setSelectedTrendTag(res.contributors[0].tag);
        }
      }
    } catch (e) {
      console.error("Failed to load live contributors:", e);
    } finally {
      setContribLoading(false);
    }
  };

  useEffect(() => {
    loadContributors();
  }, [id, mainMode]);
  
  // Helper to color process streams
  const getStrokeColor = (source: string, sourceHandle: string | null, target: string | null) => {
    let strokeColor = "#10b981"; // Process stream
    const s = source.toLowerCase();
    const t = (target || "").toLowerCase();
    const sh = (sourceHandle || "").toLowerCase();
    
    if (s.includes("condenser") || t.includes("condenser") || sh.includes("overhead")) {
      strokeColor = "#3b82f6"; // Blue for cooling/condensate
    } else if (s.includes("reboiler") || t.includes("reboiler") || sh.includes("bottoms")) {
      strokeColor = "#ef4444"; // Red for steam
    } else if (s.includes("caustic") || s.includes("recycle") || s.includes("vessel")) {
      strokeColor = "#8b5cf6"; // Purple for chemicals
    }
    return strokeColor;
  };

  const onHandleClick = (nodeId: string, handleId: string, type: "source" | "target") => {
    if (!clickSource) {
      setClickSource({ nodeId, handleId, type });
    } else {
      if (clickSource.nodeId === nodeId && clickSource.handleId === handleId) {
        setClickSource(null);
        return;
      }
      if (clickSource.nodeId === nodeId) {
        setClickSource({ nodeId, handleId, type });
        return;
      }

      let srcNode = clickSource.nodeId;
      let srcHandle = clickSource.handleId;
      let tgtNode = nodeId;
      let tgtHandle = handleId;

      if (clickSource.type === "target" && type === "source") {
        srcNode = nodeId;
        srcHandle = handleId;
        tgtNode = clickSource.nodeId;
        tgtHandle = clickSource.handleId;
      }

      const strokeColor = getStrokeColor(srcNode, srcHandle, tgtNode);
      const newEdge = {
        id: `e-${srcNode}-${tgtNode}-${Date.now()}`,
        source: srcNode,
        sourceHandle: srcHandle,
        target: tgtNode,
        targetHandle: tgtHandle,
        type: "smoothstep",
        animated: true,
        style: { stroke: strokeColor, strokeWidth: 1.5, strokeDasharray: "4,4" },
        markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: strokeColor }
      };
      setEdges(eds => addEdge(newEdge, eds));
      setClickSource(null);
    }
  };
  
  // React Flow state and wrappers
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);

  const nodeTypes = useMemo(() => ({
    column: ColumnNode,
    exchanger: ExchangerNode,
    condenser: CondenserNode,
    reboiler: ReboilerNode,
    dosing: DosingNode,
    source: SourceNode,
    sink: SinkNode,
    vessel: VesselNode
  }), []);

  // Helper to generate the default visual layout if not stored in the database
  const generateDefaultLayout = (topping: any, refining: any, recovery: any) => {
    const defaultNodes: any[] = [
      {
        id: "feed-source",
        type: "source",
        position: { x: 40, y: 220 },
        data: { label: "Crude Feed Stream" }
      },
      {
        id: "preheater-1",
        type: "exchanger",
        position: { x: 180, y: 220 },
        data: { 
          label: "Feed Preheater (E-1501)",
          flowType: topping.feedPreheaterFlowType,
          onChangeFlowType: (val: string) => setToppingColumn(prev => ({ ...prev, feedPreheaterFlowType: val }))
        }
      },
      {
        id: "topping-column",
        type: "column",
        position: { x: 380, y: 150 },
        data: { 
          label: "Topping Column", 
          isTopping: true,
          causticDosing: topping.causticDosing,
          recycleWater: topping.recycleWaterInFeed
        }
      },
      {
        id: "topping-reboiler",
        type: "reboiler",
        position: { x: 380, y: 400 },
        data: { 
          label: "Topping Reboiler",
          heatSource: topping.reboilerHeatSource,
          flowType: topping.reboilerFlowType,
          onChangeHeatSource: (val: string) => setToppingColumn(prev => ({ ...prev, reboilerHeatSource: val })),
          onChangeFlowType: (val: string) => setToppingColumn(prev => ({ ...prev, reboilerFlowType: val }))
        }
      },
      {
        id: "refining-column",
        type: "column",
        position: { x: 740, y: 150 },
        data: { label: "Refining Column", isTopping: false, sideDraw: refining.sideDraw }
      },
      {
        id: "refining-reboiler",
        type: "reboiler",
        position: { x: 740, y: 400 },
        data: { 
          label: "Refining Reboiler",
          heatSource: refining.reboilerHeatSource,
          flowType: refining.reboilerFlowType,
          onChangeHeatSource: (val: string) => setRefiningColumn(prev => ({ ...prev, reboilerHeatSource: val })),
          onChangeFlowType: (val: string) => setRefiningColumn(prev => ({ ...prev, reboilerFlowType: val }))
        }
      },
      {
        id: "product-cooler",
        type: "exchanger",
        position: { x: 990, y: 220 },
        data: { 
          label: "Product Cooler",
          flowType: refining.productCoolerFlowType,
          onChangeFlowType: (val: string) => setRefiningColumn(prev => ({ ...prev, productCoolerFlowType: val }))
        }
      },
      {
        id: "product-sink",
        type: "sink",
        position: { x: 1200, y: 220 },
        data: { label: "Refining Product" }
      }
    ];

    // Condensers
    for (let i = 0; i < topping.condensers.count; i++) {
      defaultNodes.push({
        id: `topping-condenser-${i + 1}`,
        type: "condenser",
        position: { x: 380 + (i * 200), y: 10 },
        data: {
          label: `Topping Condenser ${i + 1}`,
          utilityType: topping.condensers.utilities[i] || "Air Cooled",
          flowType: topping.condensers.flowTypes[i] || "Counter Flow",
          onChangeUtilityType: (val: string) => setToppingColumn(prev => {
            const utils = [...prev.condensers.utilities];
            utils[i] = val;
            return { ...prev, condensers: { ...prev.condensers, utilities: utils } };
          }),
          onChangeFlowType: (val: string) => setToppingColumn(prev => {
            const flows = [...prev.condensers.flowTypes];
            flows[i] = val;
            return { ...prev, condensers: { ...prev.condensers, flowTypes: flows } };
          })
        }
      });
    }

    for (let i = 0; i < refining.condensers.count; i++) {
      defaultNodes.push({
        id: `refining-condenser-${i + 1}`,
        type: "condenser",
        position: { x: 740 + (i * 200), y: 10 },
        data: {
          label: `Refining Condenser ${i + 1}`,
          utilityType: refining.condensers.utilities[i] || "Air Cooled",
          flowType: refining.condensers.flowTypes[i] || "Counter Flow",
          onChangeUtilityType: (val: string) => setRefiningColumn(prev => {
            const utils = [...prev.condensers.utilities];
            utils[i] = val;
            return { ...prev, condensers: { ...prev.condensers, utilities: utils } };
          }),
          onChangeFlowType: (val: string) => setRefiningColumn(prev => {
            const flows = [...prev.condensers.flowTypes];
            flows[i] = val;
            return { ...prev, condensers: { ...prev.condensers, flowTypes: flows } };
          })
        }
      });
    }

    // Dosing Vessels
    if (topping.causticDosing) {
      defaultNodes.push({
        id: "caustic-dosing",
        type: "vessel",
        position: { x: 580, y: 120 },
        data: { label: "Caustic Vessel (V-1502)" }
      });
    }
    if (topping.recycleWaterInFeed) {
      defaultNodes.push({
        id: "recycle-water",
        type: "vessel",
        position: { x: 580, y: 280 },
        data: { label: "Recycle Vessel (V-1503)" }
      });
    }

    const defaultEdges = [
      { id: "e-feed-preheater", source: "feed-source", target: "preheater-1", type: "smoothstep", animated: true, style: { stroke: "#10b981", strokeWidth: 1.5, strokeDasharray: "4,4" }, markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: "#10b981" } },
      { id: "e-preheater-topping", source: "preheater-1", target: "topping-column", type: "smoothstep", animated: true, style: { stroke: "#10b981", strokeWidth: 1.5, strokeDasharray: "4,4" }, markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: "#10b981" } },
      { id: "e-topping-refining", source: "topping-column", target: "refining-column", type: "smoothstep", animated: true, style: { stroke: "#10b981", strokeWidth: 1.5, strokeDasharray: "4,4" }, markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: "#10b981" } },
      { id: "e-topping-reboiler", source: "topping-column", sourceHandle: "bottoms", target: "topping-reboiler", type: "smoothstep", animated: true, style: { stroke: "#f97316", strokeWidth: 1.5, strokeDasharray: "4,4" }, markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: "#f97316" } },
      { id: "e-refining-reboiler", source: "refining-column", sourceHandle: "bottoms", target: "refining-reboiler", type: "smoothstep", animated: true, style: { stroke: "#f97316", strokeWidth: 1.5, strokeDasharray: "4,4" }, markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: "#f97316" } },
      { id: "e-refining-cooler", source: "refining-column", target: "product-cooler", type: "smoothstep", animated: true, style: { stroke: "#10b981", strokeWidth: 1.5, strokeDasharray: "4,4" }, markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: "#10b981" } },
      { id: "e-cooler-sink", source: "product-cooler", target: "product-sink", type: "smoothstep", animated: true, style: { stroke: "#3b82f6", strokeWidth: 1.5, strokeDasharray: "4,4" }, markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: "#3b82f6" } }
    ];

    // Topping Condensers Series Connections
  for (let i = 0; i < topping.condensers.count; i++) {
    if (i === 0) {
      defaultEdges.push({
        id: "e-topping-cond1",
        source: "topping-column",
        sourceHandle: "overhead",
        target: "topping-condenser-1",
        type: "smoothstep",
        animated: true,
        style: { stroke: "#3b82f6", strokeWidth: 1.5, strokeDasharray: "4,4" },
        markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: "#3b82f6" }
      });
    } else {
      defaultEdges.push({
        id: `e-topping-cond-series-${i}`,
        source: `topping-condenser-${i}`,
        target: `topping-condenser-${i + 1}`,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#3b82f6", strokeWidth: 1.5, strokeDasharray: "4,4" },
        markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: "#3b82f6" }
      });
    }
  }

  // Refining Condensers Series Connections
  for (let i = 0; i < refining.condensers.count; i++) {
    if (i === 0) {
      defaultEdges.push({
        id: "e-refining-cond1",
        source: "refining-column",
        sourceHandle: "overhead",
        target: "refining-condenser-1",
        type: "smoothstep",
        animated: true,
        style: { stroke: "#3b82f6", strokeWidth: 1.5, strokeDasharray: "4,4" },
        markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: "#3b82f6" }
      });
    } else {
      defaultEdges.push({
        id: `e-refining-cond-series-${i}`,
        source: `refining-condenser-${i}`,
        target: `refining-condenser-${i + 1}`,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#3b82f6", strokeWidth: 1.5, strokeDasharray: "4,4" },
        markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: "#3b82f6" }
      });
    }
  }

  return { nodes: defaultNodes, edges: defaultEdges };
  };
  const [saving, setSaving] = useState<boolean>(false);
  const [saveResult, setSaveResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [rightPanelTab, setRightPanelTab] = useState<"configure" | "issues" | "hierarchy">("issues");

  // Step 1 states (Plant Config)
  const [toppingColumn, setToppingColumn] = useState({
    feedPreheater: true,
    feedPreheaterFlowType: "Counter Flow",
    recycleWaterInFeed: true,
    condensers: {
      count: 2,
      utilities: ["Air Cooled", "Water Cooled"],
      flowTypes: ["Counter Flow", "Counter Flow"]
    },
    reboilerHeatSource: "Steam Only",
    reboilerFlowType: "Counter Flow",
    causticDosing: true
  });

  const [refiningColumn, setRefiningColumn] = useState({
    condensers: {
      count: 2,
      utilities: ["Air Cooled", "Water Cooled"],
      flowTypes: ["Counter Flow", "Counter Flow"]
    },
    reboilerHeatSource: "Steam Only",
    reboilerFlowType: "Counter Flow",
    condensateDrumRG: null,
    sideDraw: true,
    hasProductCooler: true,
    productCoolerFlowType: "Counter Flow"
  });

  const [recoveryColumn, setRecoveryColumn] = useState({
    hasRecoveryColumn: true,
    condensers: {
      count: 1,
      utilities: ["Water Cooled"],
      flowTypes: ["Counter Flow"]
    },
    reboilerHeatSource: "Steam Only",
    reboilerFlowType: "Counter Flow",
    sideDraw: {
      hasSideDraw: true,
      hasHeavyEndCooler: true,
      heavyEndCoolerUtility: "Water Cooled",
      heavyEndCoolerFlowType: "Counter Flow"
    },
    bottoms: {
      sharedCooler: true,
      sharedCoolerUtility: "Water Cooled",
      sharedCoolerFlowType: "Counter Flow",
      disposalLocation: "Effluent Treatment"
    }
  });

  const [plantLevel, setPlantLevel] = useState({
    pmaProductionAccounting: {
      sumOfRefiningAndRecovery: true,
      lossesAndByproductsTracked: false
    },
    heatIntegration: {
      rgUsedInReboiler: false
    }
  });

  // Dynamic lists from API
  const [rawTagMappings, setRawTagMappings] = useState<Record<string, any>>({});
  const [kpiList, setKpiList] = useState<any[]>([]);
  const [kpiConfig, setKpiConfig] = useState<Record<string, { type: "Calculated" | "PI Tag"; piTag?: string }>>({});

  const isMainKpi = (name: string) => {
    const normalized = name.toLowerCase();
    
    // 1. General Main KPIs
    const generalMain = [
      "separation_efficiency",
      "yield",
      "losses_and_byproduct",
      "topping column_normalised_delta_p",
      "refining column_normalised_delta_p",
      "pma_production_total",
      "energy_specific_consumption_total_reboliers",
      "energy_specific_consumption_steam_reboliers"
    ];
    if (generalMain.includes(normalized)) return true;

    // 2. Topping Column Condensers
    if (normalized.includes("topping_column_1st_condenser") || normalized.includes("topping column 1st condenser")) {
      return true;
    }
    if (toppingColumn.condensers.count === 2) {
      if (normalized.includes("topping_column_2nd_condenser") || normalized.includes("topping column 2nd condenser")) {
        return true;
      }
    }

    // 3. Refining Column Condensers
    if (normalized.includes("refining_column_1st_condenser") || normalized.includes("refining column 1st condenser")) {
      return true;
    }
    if (refiningColumn.condensers.count === 2) {
      if (normalized.includes("refining_column_2nd_condenser") || normalized.includes("refining column 2nd condenser")) {
        return true;
      }
    }

    // 4. Recovery Column Condensers
    if (recoveryColumn.hasRecoveryColumn) {
      if (normalized.includes("recovery_column_1st_condenser") || normalized.includes("recovery column condenser_duty") || normalized.includes("recovery column condenser")) {
        return true;
      }
      if (recoveryColumn.condensers.count === 2) {
        if (normalized.includes("recovery_column_2nd_condenser")) {
          return true;
        }
      }
    }

    // 5. Topping Column Reboilers
    const hasToppingSteam = toppingColumn.reboilerHeatSource.includes("Steam");
    const hasToppingGas = toppingColumn.reboilerHeatSource.includes("Gas") || toppingColumn.reboilerHeatSource.includes("RG");
    if (hasToppingSteam && (normalized.includes("reboiler_duty_topping column reboiler") || normalized.includes("topping column reboiler_duty") || normalized.includes("topping_column_reboiler_lmtd") || normalized.includes("fouling_index_topping_column_reboiler"))) {
      if (!normalized.includes("rg")) return true;
    }
    if (hasToppingGas && (normalized.includes("topping_column_reboiler_rg_lmtd") || normalized.includes("fouling_index_topping_column_reboiler_rg"))) {
      return true;
    }

    // 6. Refining Column Reboilers
    const hasRefiningSteam = refiningColumn.reboilerHeatSource.includes("Steam");
    const hasRefiningGas = refiningColumn.reboilerHeatSource.includes("Gas") || refiningColumn.reboilerHeatSource.includes("RG");
    if (hasRefiningSteam && (normalized.includes("reboiler_duty_refining column reboiler") || normalized.includes("refining column reboiler_duty") || normalized.includes("refining_column_reboiler_steam_lmtd") || normalized.includes("fouling_index_refining_column_reboiler_steam"))) {
      return true;
    }
    if (hasRefiningGas && (normalized.includes("refining_column_reboiler_rg_lmtd") || normalized.includes("fouling_index_refining_column_reboiler_rg"))) {
      return true;
    }

    // 7. Recovery Column Reboilers
    if (recoveryColumn.hasRecoveryColumn) {
      if (normalized.includes("reboiler_duty_recovery column reboiler") || normalized.includes("recovery_column_reboiler_lmtd") || normalized.includes("fouling_index_recovery_column_reboiler")) {
        return true;
      }
    }

    // 8. Preheaters & Coolers
    if (toppingColumn.feedPreheater && normalized.includes("preheater")) {
      return true;
    }
    if (refiningColumn.hasProductCooler && normalized.includes("product_cooler")) {
      return true;
    }
    if (recoveryColumn.hasRecoveryColumn && recoveryColumn.sideDraw.hasHeavyEndCooler && normalized.includes("heavy_end_cooler")) {
      return true;
    }
    if (normalized.includes("disitillation_column_cooler")) {
      return true;
    }

    return false;
  };

  const extractTagsFromFormula = (formula: string) => {
    if (!formula || typeof formula !== 'string') return [];
    const matches = formula.match(/\[([^\]]+)\]/g);
    if (!matches) return [];
    return matches.map(m => m.substring(1, m.length - 1));
  };

  // Load mock baseline if API fails
  const loadMockBaseline = () => {
    setError(null);
    setToppingColumn({
      feedPreheater: true,
      feedPreheaterFlowType: "Counter Flow",
      recycleWaterInFeed: true,
      condensers: {
        count: 2,
        utilities: ["Air Cooled", "Water Cooled"],
        flowTypes: ["Counter Flow", "Counter Flow"]
      },
      reboilerHeatSource: "Steam Only",
      reboilerFlowType: "Counter Flow",
      causticDosing: true
    });
    setRefiningColumn({
      condensers: {
        count: 2,
        utilities: ["Air Cooled", "Water Cooled"],
        flowTypes: ["Counter Flow", "Counter Flow"]
      },
      reboilerHeatSource: "Steam Only",
      reboilerFlowType: "Counter Flow",
      condensateDrumRG: null,
      sideDraw: true,
      hasProductCooler: true,
      productCoolerFlowType: "Counter Flow"
    });
    setRecoveryColumn({
      hasRecoveryColumn: true,
      condensers: {
        count: 1,
        utilities: ["Water Cooled"],
        flowTypes: ["Counter Flow"]
      },
      reboilerHeatSource: "Steam Only",
      reboilerFlowType: "Counter Flow",
      sideDraw: {
        hasSideDraw: true,
        hasHeavyEndCooler: true,
        heavyEndCoolerUtility: "Water Cooled",
        heavyEndCoolerFlowType: "Counter Flow"
      },
      bottoms: {
        sharedCooler: true,
        sharedCoolerUtility: "Water Cooled",
        sharedCoolerFlowType: "Counter Flow",
        disposalLocation: "Effluent Treatment"
      }
    });

    // Mock dynamic KPIs (Main KPIs only)
    const mockKpis = [
      { name: "Topping Column_Normalised_Delta_P", description: "Normalized delta P across Topping Column", formula: "[Topping Column_Delta_Pressure]/[CMA_flowrate_to_Topping Column]/1000", uom: "(Kg/Cm2)/(M3/Hr)" },
      { name: "Refining Column_Normalised_Delta_P", description: "Normalized delta P across Refining Column", formula: "[Refining Column_column_dp]/[CMA_Feed_From_Topping Column_To_Refining Column]/1000", uom: "(Kg/Cm2)/(M3/Hr)" },
      { name: "Separation_Efficiency", description: "Separation Efficiency of Refining Column", formula: "[Methanol_production_flow_from_Refining Column]/[CMA_Feed_From_Topping Column_To_Refining Column]*100", uom: "%" },
      { name: "Recovery Column Condenser_Duty", description: "Thermal duty of recovery condenser", formula: "[Recovery Column_Reflux_flowrate]/1000*[Recovery Column_Top_Methanol_Density]", uom: "MMKcal/hr" },
      { name: "Fouling Index Crude Preheater", description: "Crude Preheater performance fouling index", formula: "[CMA_flow_to_Crude Methanol Preheater]*[Topping Column_Feed_CMA_temperature]", uom: "—" },
      { name: "Product Cooler_Duty", description: "Refining product cooler heat duty", formula: "[Product_Cooler_CW_inlet_temp]*[Product_Cooler_CW_outlet_temp]", uom: "MMKcal/hr" }
    ];

    setKpiList(mockKpis);
    const initialConfig: Record<string, { type: "Calculated" | "PI Tag"; piTag?: string }> = {};
    mockKpis.forEach(kpi => {
      initialConfig[kpi.name] = {
        type: "Calculated",
        piTag: ""
      };
    });
    setKpiConfig(initialConfig);

    // Mock raw tag mappings
    setRawTagMappings({
      "CMA_flowrate_to_Topping Column": { piTag: "ar.ar2.syn.Outlet_CMA_flow_from_V_1403", design: "120", min: "80", max: "150", def: "117", uom: "M3/HR" },
      "Topping Column_Delta_Pressure": { piTag: "ar.ar2.dist.T1501_DP", design: "0.2", min: "0", max: "1.0", def: "0.15", uom: "Kg/Cm2" },
      "CMA_moisture_from_CMA Tank": { piTag: "ar.ar2.dist.Lims_Crude_Methanol_Moisture", design: "0.5", min: "0.1", max: "2.0", def: "0.3", uom: "%" },
      "Refining Column_top_temperature": { piTag: "ar.ar2.dist.T1502_Top_Temp", design: "65", min: "50", max: "90", def: "64.8", uom: "°C" },
      "Refining Column_bottom_temperature": { piTag: "ar.ar2.dist.T1502_Bottom_Temp", design: "80", min: "70", max: "110", def: "82.1", uom: "°C" },
      "Recovery Column_PMA_flow": { piTag: "ar.ar2.dist.T1503_Pma_Flow", design: "15", min: "5", max: "30", def: "14.2", uom: "TPH" },
      "Recovery Column_Reflux_flowrate": { piTag: "ar.ar2.dist.T1503_Reflux_Flow", design: "10", min: "2", max: "20", def: "9.8", uom: "M3/HR" },
      "Heavy End Cooler_Outlet_Temp": { piTag: "ar.ar2.dist.E1514_Outlet_Temp", design: "40", min: "20", max: "60", def: "42.5", uom: "°C" }
    });
  };

  // Load config and KPIs on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        // 1. Fetch Config
        const res: any = await getDistillationConfig(id);
        let loadedNodes: any[] = [];
        let loadedEdges: any[] = [];
        
        if (res) {
          if (res.distillation) {
            const dist = res.distillation;
            if (dist.toppingColumn) setToppingColumn(prev => ({ ...prev, ...dist.toppingColumn }));
            if (dist.refiningColumn) setRefiningColumn(prev => ({ ...prev, ...dist.refiningColumn }));
            if (dist.recoveryColumn) setRecoveryColumn(prev => ({ ...prev, ...dist.recoveryColumn }));
            if (dist.plantLevel) setPlantLevel(prev => ({ ...prev, ...dist.plantLevel }));
          }
          const dist = res.distillation || {};
          const layout = dist.canvas_layout || res.canvas_layout;
          if (layout && Array.isArray(layout.nodes)) {
            loadedNodes = layout.nodes;
            loadedEdges = layout.edges || [];
          }
          
          if (res.rawTagMappings && Object.keys(res.rawTagMappings).length > 0) {
            setRawTagMappings(res.rawTagMappings);
          } else {
            console.warn("Empty rawTagMappings returned from API, using offline fallback");
            loadMockBaseline();
            return;
          }
        } else {
          loadMockBaseline();
          return;
        }

        if (loadedNodes.length > 0) {
          setNodes(loadedNodes);
          setEdges(loadedEdges);
        } else {
          const fallback = generateDefaultLayout(
            res?.distillation?.toppingColumn || toppingColumn,
            res?.distillation?.refiningColumn || refiningColumn,
            res?.distillation?.recoveryColumn || recoveryColumn
          );
          setNodes(fallback.nodes);
          setEdges(fallback.edges);
        }

        // 2. Fetch KPIs
        const kpisData = await getDistillationKpis();
        if (kpisData && Array.isArray(kpisData)) {
          setKpiList(kpisData);
          const initialConfig: Record<string, { type: "Calculated" | "PI Tag"; piTag?: string }> = {};
          kpisData.forEach(kpi => {
            initialConfig[kpi.name] = {
              type: "Calculated",
              piTag: res.rawTagMappings[kpi.name]?.piTag || ""
            };
          });
          setKpiConfig(initialConfig);
        }
      } catch (err: any) {
        console.error("Failed to load configuration from API:", err);
        setError("Could not connect to FastAPI server. Displaying offline baseline configuration.");
        loadMockBaseline();
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Reactively sync canvas nodes present back to the config states (if a node is removed, disable it!)
  useEffect(() => {
    if (nodes.length === 0) return;
    
    const hasPreheater = nodes.some((n: any) => n.id === "preheater-1" || (n.type === "exchanger" && n.data?.label?.includes("Preheater")));
    const hasProductCooler = nodes.some((n: any) => n.id === "product-cooler" || (n.type === "exchanger" && n.data?.label?.includes("Cooler")));
    const hasCaustic = nodes.some((n: any) => n.id === "caustic-dosing" || n.id === "caustic-vessel" || (n.type === "vessel" && n.data?.label?.includes("Caustic")));
    const hasRecycle = nodes.some((n: any) => n.id === "recycle-water" || n.id === "recycle-vessel" || (n.type === "vessel" && n.data?.label?.includes("Recycle")));
    
    const toppingCondenserCount = nodes.filter((n: any) => n.type === "condenser" && n.data?.label?.includes("Topping")).length;
    const refiningCondenserCount = nodes.filter((n: any) => n.type === "condenser" && n.data?.label?.includes("Refining")).length;

    setToppingColumn(prev => {
      if (prev.feedPreheater !== hasPreheater || prev.causticDosing !== hasCaustic || prev.recycleWaterInFeed !== hasRecycle || prev.condensers.count !== toppingCondenserCount) {
        return {
          ...prev,
          feedPreheater: hasPreheater,
          causticDosing: hasCaustic,
          recycleWaterInFeed: hasRecycle,
          condensers: { ...prev.condensers, count: toppingCondenserCount }
        };
      }
      return prev;
    });

    setRefiningColumn(prev => {
      if (prev.hasProductCooler !== hasProductCooler || prev.condensers.count !== refiningCondenserCount) {
        return {
          ...prev,
          hasProductCooler,
          condensers: { ...prev.condensers, count: refiningCondenserCount }
        };
      }
      return prev;
    });
  }, [nodes]);

  // Sync state values and callbacks back to nodes array (re-binding handlers)
  useEffect(() => {
    setNodes(nds => nds.map(node => {
      const type = node.type;
      const label = node.data?.label || "";
      
      if (node.id === "preheater-1") {
        return {
          ...node,
          data: {
            ...node.data,
            flowType: toppingColumn.feedPreheaterFlowType,
            onChangeFlowType: (val: string) => setToppingColumn(prev => ({ ...prev, feedPreheaterFlowType: val }))
          }
        };
      }
      if (node.id === "topping-column") {
        return {
          ...node,
          data: {
            ...node.data,
            causticDosing: toppingColumn.causticDosing,
            recycleWater: toppingColumn.recycleWaterInFeed
          }
        };
      }
      if (node.id === "topping-reboiler") {
        return {
          ...node,
          data: {
            ...node.data,
            heatSource: toppingColumn.reboilerHeatSource,
            flowType: toppingColumn.reboilerFlowType,
            onChangeHeatSource: (val: string) => setToppingColumn(prev => ({ ...prev, reboilerHeatSource: val })),
            onChangeFlowType: (val: string) => setToppingColumn(prev => ({ ...prev, reboilerFlowType: val }))
          }
        };
      }
      if (node.id === "refining-column") {
        return {
          ...node,
          data: {
            ...node.data,
            sideDraw: refiningColumn.sideDraw
          }
        };
      }
      if (node.id === "refining-reboiler") {
        return {
          ...node,
          data: {
            ...node.data,
            heatSource: refiningColumn.reboilerHeatSource,
            flowType: refiningColumn.reboilerFlowType,
            onChangeHeatSource: (val: string) => setRefiningColumn(prev => ({ ...prev, reboilerHeatSource: val })),
            onChangeFlowType: (val: string) => setRefiningColumn(prev => ({ ...prev, reboilerFlowType: val }))
          }
        };
      }
      if (node.id === "product-cooler") {
        return {
          ...node,
          data: {
            ...node.data,
            flowType: refiningColumn.productCoolerFlowType,
            onChangeFlowType: (val: string) => setRefiningColumn(prev => ({ ...prev, productCoolerFlowType: val }))
          }
        };
      }
      
      // Dynamic Topping Condensers
      if (node.id.startsWith("topping-condenser-")) {
        const idxStr = node.id.replace("topping-condenser-", "");
        const i = parseInt(idxStr, 10) - 1;
        return {
          ...node,
          data: {
            ...node.data,
            utilityType: toppingColumn.condensers.utilities[i] || "Air Cooled",
            flowType: toppingColumn.condensers.flowTypes[i] || "Counter Flow",
            onChangeUtilityType: (val: string) => setToppingColumn(prev => {
              const utils = [...prev.condensers.utilities];
              utils[i] = val;
              return { ...prev, condensers: { ...prev.condensers, utilities: utils } };
            }),
            onChangeFlowType: (val: string) => setToppingColumn(prev => {
              const flows = [...prev.condensers.flowTypes];
              flows[i] = val;
              return { ...prev, condensers: { ...prev.condensers, flowTypes: flows } };
            })
          }
        };
      }
      
      // Dynamic Refining Condensers
      if (node.id.startsWith("refining-condenser-")) {
        const idxStr = node.id.replace("refining-condenser-", "");
        const i = parseInt(idxStr, 10) - 1;
        return {
          ...node,
          data: {
            ...node.data,
            utilityType: refiningColumn.condensers.utilities[i] || "Air Cooled",
            flowType: refiningColumn.condensers.flowTypes[i] || "Counter Flow",
            onChangeUtilityType: (val: string) => setRefiningColumn(prev => {
              const utils = [...prev.condensers.utilities];
              utils[i] = val;
              return { ...prev, condensers: { ...prev.condensers, utilities: utils } };
            }),
            onChangeFlowType: (val: string) => setRefiningColumn(prev => {
              const flows = [...prev.condensers.flowTypes];
              flows[i] = val;
              return { ...prev, condensers: { ...prev.condensers, flowTypes: flows } };
            })
          }
        };
      }

      return node;
    }));
  }, [toppingColumn, refiningColumn, recoveryColumn]);

  // Filter required parameters based on Step 1 configuration and Step 2 selections
  const getRequiredTags = () => {
    const requiredTags = new Set<string>();
    
    // Add tags based on calculated vs PI Tag choice
    activeKpis.forEach(kpi => {
      const config = kpiConfig[kpi.name] || { type: "Calculated" };
      if (config.type === "Calculated") {
        const extracted = extractTagsFromFormula(kpi.formula || "");
        extracted.forEach(tag => {
          if (rawTagMappings[tag]) {
            requiredTags.add(tag);
          }
        });
      } else {
        // Mapped as PI Tag directly, so map the KPI tag path itself
        requiredTags.add(kpi.name);
      }
    });

    const allTags = Array.from(requiredTags);

    return allTags.filter(tag => {
      // Exclude recovery column tags if recovery column is disabled
      if (!recoveryColumn.hasRecoveryColumn && (tag.toLowerCase().includes("recovery column") || tag.toLowerCase().includes("heavy_end") || tag.toLowerCase().includes("heavy end"))) {
        return false;
      }
      // Exclude preheater tags if preheater is disabled
      if (!toppingColumn.feedPreheater && tag.toLowerCase().includes("preheater")) {
        return false;
      }
      // Exclude product cooler tags if disabled
      if (!refiningColumn.hasProductCooler && (tag.toLowerCase().includes("product_cooler") || tag.toLowerCase().includes("product cooler"))) {
        return false;
      }
      return true;
    });
  };

  // Filter KPIs dynamically based on Step 1 configuration (Main KPIs only)
  const getActiveKpis = () => {
    return kpiList.filter(kpi => {
      if (!isMainKpi(kpi.name)) {
        return false;
      }
      const name = kpi.name.toLowerCase();
      // Recovery
      if (!recoveryColumn.hasRecoveryColumn && (name.includes("recovery column") || name.includes("recovery_column"))) {
        return false;
      }
      // Preheater
      if (!toppingColumn.feedPreheater && name.includes("preheater")) {
        return false;
      }
      // Product Cooler
      if (!refiningColumn.hasProductCooler && (name.includes("product_cooler") || name.includes("product cooler"))) {
        return false;
      }
      return true;
    });
  };

  const activeKpis = getActiveKpis();
  const activeTags = getRequiredTags();

  // Search filter for DCS tag mappings
  const filteredTags = activeTags.filter(tagKey => 
    tagKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (rawTagMappings[tagKey]?.piTag || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleKpiConfigChange = (kpiName: string, field: "type" | "piTag", value: string) => {
    setKpiConfig(prev => {
      const updated = {
        ...prev,
        [kpiName]: { ...prev[kpiName], [field]: value }
      };
      
      // Sync PI tag path back into rawTagMappings so backend can save/export it
      if (field === "piTag" || (field === "type" && value === "PI Tag")) {
        const pathVal = field === "piTag" ? value : (prev[kpiName]?.piTag || "");
        setRawTagMappings(tags => ({
          ...tags,
          [kpiName]: {
            ...(tags[kpiName] || { design: "", min: "", max: "", def: "", uom: "" }),
            piTag: pathVal
          }
        }));
      }
      return updated;
    });
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      // Strip out circular references or local functions from canvas layout nodes
      const cleanNodes = nodes.map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: {
          label: n.data?.label || "",
          isTopping: n.data?.isTopping,
          causticDosing: n.data?.causticDosing,
          recycleWater: n.data?.recycleWater,
          sideDraw: n.data?.sideDraw,
          flowType: n.data?.flowType,
          utilityType: n.data?.utilityType,
          heatSource: n.data?.heatSource
        }
      }));
      
      const payloadDist = {
        toppingColumn,
        refiningColumn,
        recoveryColumn,
        plantLevel,
        canvas_layout: { nodes: cleanNodes, edges }
      };
      const res = await saveDistillationConfig(id, payloadDist, rawTagMappings);
      setSaveResult(res);
      setCurrentStep(4);
    } catch (err: any) {
      alert("Failed to save configuration: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <RefreshCw size={36} className="animate-spin text-accent-blue" />
        <span className="text-sm text-text-secondary">Loading Methanol Plant configuration...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Top Header with Mode Switcher */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Methanol Distillation Unit</h1>
          <p className="text-sm text-text-secondary">Capability ID: PeMethDist · Instance ID: {id} ({instanceName})</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-background rounded-lg p-1 border border-border">
            <button
              onClick={() => setMainMode("efficiency")}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                mainMode === "efficiency"
                  ? "bg-accent-blue text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Activity size={14} /> Process Efficiency
            </button>
            <button
              onClick={() => setMainMode("config")}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                mainMode === "config"
                  ? "bg-accent-blue text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <SlidersHorizontal size={14} /> Setup & Configuration
            </button>
          </div>
        </div>
      </div>

      {/* Connection Warning Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-xs text-yellow-600 dark:text-yellow-400">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="rounded bg-yellow-500/20 px-2 py-1 hover:bg-yellow-500/30 font-semibold"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* MAIN VIEW: PROCESS EFFICIENCY (Live Results & Contributors Table) */}
      {mainMode === "efficiency" ? (
        <div className="flex flex-col gap-6">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h2 className="text-base font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
              PROCESS EFFICIENCY
            </h2>
            <button
              onClick={loadContributors}
              disabled={contribLoading}
              className="flex items-center gap-1.5 text-xs font-semibold text-accent-blue bg-accent-blue/10 hover:bg-accent-blue/20 px-3 py-1.5 rounded-lg transition-all"
            >
              <RefreshCw size={14} className={contribLoading ? "animate-spin" : ""} /> Refresh Data
            </button>
          </div>

          {/* CONTRIBUTORS CARD (Matching Reference Screenshot) */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
            <div className="bg-sky-50/80 border-b border-sky-100 p-4 flex items-center justify-between">
              <h3 className="text-xs font-bold text-sky-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-4 bg-sky-600 rounded-full"></span>
                CONTRIBUTORS
              </h3>
            </div>

            <div className="p-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-xs">
                <thead className="bg-background text-text-secondary uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">TAG</th>
                    <th className="px-4 py-3 text-center">CONTRIBUTOR TYPE</th>
                    <th className="px-4 py-3 text-right">DESIGN</th>
                    <th className="px-4 py-3 text-right">ACTUAL</th>
                    <th className="px-4 py-3 text-right">OPTIMUM</th>
                    <th className="px-4 py-3 text-right">CONTRIBUTION (%)</th>
                    <th className="px-4 py-3 text-center">STATE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 bg-surface">
                  {contribLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                        <RefreshCw size={18} className="animate-spin inline-block mr-2 text-accent-blue" /> Loading live contributor data from database...
                      </td>
                    </tr>
                  ) : contributorsData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                        No contributor data stored in database. Switch to <strong>Setup & Configuration</strong> to complete onboarding and run benchmarking models.
                      </td>
                    </tr>
                  ) : (
                    contributorsData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-surface-hover transition-colors">
                        <td className="px-4 py-3 font-bold text-text-primary text-xs tracking-wide">
                          {item.tag}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                            {item.contributorType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-text-secondary">
                          {item.design}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-text-primary">
                          {item.actual}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                          {item.optimum !== null && item.optimum !== undefined && item.optimum !== "-" ? item.optimum : item.actual}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-bold ${
                          item.state === "red" || item.contribution < 0 ? "text-red-600" : "text-emerald-600"
                        }`}>
                          {item.contribution > 0 ? `+${item.contribution}%` : `${item.contribution}%`}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center">
                            <span
                              className={`inline-block w-4.5 h-4.5 rounded-full shadow-md ${
                                item.state === "red" 
                                  ? "bg-red-600 ring-4 ring-red-200" 
                                  : "bg-emerald-500 ring-4 ring-emerald-200"
                              }`}
                              title={item.state === "red" ? "Underperforming / Bad State (RED)" : "Optimal / Good State (GREEN)"}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* KEY TREND CARD */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
            <div className="bg-sky-50/80 border-b border-sky-100 p-4 flex items-center justify-between">
              <h3 className="text-xs font-bold text-sky-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-4 bg-sky-600 rounded-full"></span>
                KEY TREND
              </h3>
            </div>

            <div className="p-4 flex flex-col gap-4">
              <div className="w-72">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary block mb-1">Select Parameter Trend</label>
                <select
                  value={selectedTrendTag}
                  onChange={(e) => setSelectedTrendTag(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-accent-blue"
                >
                  {contributorsData.map((c, i) => (
                    <option key={i} value={c.tag}>{c.tag}</option>
                  ))}
                </select>
              </div>

              <div className="h-48 border border-border/60 rounded-xl bg-background p-4 flex flex-col items-center justify-center text-text-secondary text-xs">
                <Activity size={24} className="text-accent-blue mb-2 animate-pulse" />
                <span>Live Trend History Graph for <strong>{selectedTrendTag || "Selected Parameter"}</strong></span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Configuration Stepper Mode */
        <div className="flex flex-col gap-6">
          {/* Stepper Wizard Indicator */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex justify-between items-center max-w-3xl mx-auto">
          {[
            { step: 1, label: "Plant Configuration" },
            { step: 2, label: `Mandatory KPIs (${activeKpis.length})` },
            { step: 3, label: `DCS Tag Mapping (${activeTags.length})` },
            { step: 4, label: "Review & Submit" }
          ].map((item, idx) => (
            <React.Fragment key={idx}>
              <button 
                onClick={() => currentStep > item.step && setCurrentStep(item.step)}
                disabled={currentStep <= item.step}
                className="flex items-center gap-2 text-left disabled:cursor-not-allowed group focus:outline-none"
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition-all ${
                  currentStep === item.step 
                    ? "border-accent-blue bg-accent-blue text-white" 
                    : currentStep > item.step 
                      ? "border-accent-green bg-accent-green/10 text-accent-green" 
                      : "border-border bg-background text-text-secondary"
                }`}>
                  {currentStep > item.step ? <Check size={14} /> : item.step}
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className={`text-xs font-bold ${currentStep === item.step ? "text-text-primary" : "text-text-secondary"}`}>
                    {item.label}
                  </span>
                </div>
              </button>
              {idx < 3 && <ChevronRight size={16} className="text-text-secondary hidden sm:block" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Wizard Content Steps */}
      <div className="min-h-[450px]">
        
        {/* STEP 1: PLANT CONFIG FORM */}
        {currentStep === 1 && (
        <div className="flex flex-col gap-5">
          {/* Header Bar matching Ammonia Flowsheet */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Process Flowsheet</h2>
              <p className="text-xs text-slate-500 max-w-3xl mt-0.5 leading-relaxed">
                Assemble the plant as a train of streams — drag connections between ports, configure each unit in the side panel. The equipment hierarchy derives live from this drawing.
              </p>
            </div>
            
            {/* Top Action Pills & Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Ready • 1 notes
              </div>
              
              <button 
                onClick={() => {
                  const fallback = generateDefaultLayout(toppingColumn, refiningColumn, recoveryColumn);
                  setNodes(fallback.nodes);
                  setEdges(fallback.edges);
                }}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-sm transition-all"
              >
                Arrange
              </button>

              <button 
                onClick={() => {
                  const fallback = generateDefaultLayout(toppingColumn, refiningColumn, recoveryColumn);
                  setNodes(fallback.nodes);
                  setEdges(fallback.edges);
                }}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-sm transition-all"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Canvas & Side Panels Wrapper */}
          <div className="flex flex-col lg:flex-row gap-4 min-h-[580px]" ref={reactFlowWrapper}>
            
            {/* Handle & Cursor Style Overrides (Ammonia Dark Slate Dots & Generous Magnetic Snap Radius) */}
            <style>{`
              .react-flow__handle {
                cursor: cell !important;
                width: 28px !important;
                height: 28px !important;
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
              }
              .react-flow__handle:hover {
                z-index: 50 !important;
              }
              .drawing-connection, .drawing-connection * { cursor: cell !important; }
              ${clickSource ? '.react-flow__pane, .react-flow__pane * { cursor: cell !important; }' : ''}
            `}</style>

            {/* Collapsible Left Palette (Matching Ammonia Reference) */}
            <div 
              className={`transition-all duration-300 ease-in-out border border-slate-200 rounded-2xl bg-white flex flex-col relative select-none shadow-sm ${
                paletteOpen ? "w-full lg:w-[220px] opacity-100 p-4 shrink-0" : "w-0 opacity-0 border-none p-0 overflow-hidden"
              }`}
            >
              {paletteOpen && (
                <button 
                  onClick={() => setPaletteOpen(false)}
                  className="absolute top-4 right-3 text-slate-400 hover:text-blue-600 p-1 rounded-lg hover:bg-slate-100 transition-colors z-10"
                  title="Hide Palette"
                >
                  <ChevronRight size={16} className="rotate-180" />
                </button>
              )}
              
              <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase border-b border-slate-100 pb-2.5">PALETTE</div>
              
              <div className="flex flex-col gap-4 overflow-y-auto pr-1 mt-3 max-h-[500px]">
                {/* EQUIPMENT Category */}
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">EQUIPMENT</div>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { type: 'column', label: 'Topping Column', color: 'bg-blue-500' },
                      { type: 'column', label: 'Refining Column', color: 'bg-blue-500' },
                      { type: 'exchanger', label: 'Feed Preheater (E-1501)', display: 'Feed Preheater', color: 'bg-amber-500' },
                      { type: 'exchanger', label: 'Product Cooler', display: 'Product Cooler', color: 'bg-amber-500' },
                      { type: 'condenser', label: 'Topping Condenser 1', display: 'Topping Condenser', color: 'bg-blue-500' },
                      { type: 'condenser', label: 'Refining Condenser 1', display: 'Refining Condenser', color: 'bg-blue-500' },
                      { type: 'reboiler', label: 'Reboiler', color: 'bg-red-500' },
                      { type: 'vessel', label: 'Storage Vessel (V-1502)', display: 'Storage Vessel', color: 'bg-slate-500' }
                    ].map((item, i) => (
                      <div
                        key={i}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/reactflow', JSON.stringify({ type: item.type, label: item.label }));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-blue-400 hover:shadow-sm cursor-grab transition-all text-xs font-semibold text-slate-700 group"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${item.color}`}></span>
                          <span>{item.display || item.label}</span>
                        </div>
                        <span className="text-slate-300 group-hover:text-blue-500 font-bold text-sm">+</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* STREAMS & FEEDS Category */}
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-1">STREAMS & FEEDS</div>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { type: 'source', label: 'Crude Feed Stream', color: 'bg-emerald-500' },
                      { type: 'vessel', label: 'Caustic Vessel (V-1502)', display: 'Caustic Dosing', color: 'bg-purple-500' },
                      { type: 'vessel', label: 'Recycle Vessel (V-1503)', display: 'Recycle Water', color: 'bg-purple-500' },
                      { type: 'sink', label: 'Product Sink', display: 'Product Outlet', color: 'bg-amber-500' }
                    ].map((item, i) => (
                      <div
                        key={i}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/reactflow', JSON.stringify({ type: item.type, label: item.label }));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-emerald-400 hover:shadow-sm cursor-grab transition-all text-xs font-semibold text-slate-700 group"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${item.color}`}></span>
                          <span>{item.display || item.label}</span>
                        </div>
                        <span className="text-slate-300 group-hover:text-emerald-500 font-bold text-sm">+</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Reopen Strip when collapsed */}
            {!paletteOpen && (
              <button 
                onClick={() => setPaletteOpen(true)}
                className="flex flex-col items-center justify-center w-8 bg-white border border-slate-200 rounded-2xl hover:border-blue-400 text-slate-400 hover:text-blue-600 transition-all cursor-pointer shadow-sm group py-6 shrink-0"
                title="Show Palette"
              >
                <ChevronRight size={18} className="group-hover:scale-125 transition-transform" />
                <span className="text-[9px] font-bold uppercase tracking-wider mt-4 select-none [writing-mode:vertical-lr]">PALETTE</span>
              </button>
            )}

            {/* Main Flowsheet Canvas */}
            <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/40 min-h-[580px] relative overflow-hidden shadow-sm">
              <ReactFlowProvider>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  isValidConnection={() => true}
                  onEdgeDoubleClick={(event, edge) => setEdges((eds) => eds.filter((e) => e.id !== edge.id))}
                  onConnectStart={() => document.body.classList.add('drawing-connection')}
                  onConnectEnd={() => document.body.classList.remove('drawing-connection')}
                  onPaneClick={() => setClickSource(null)}
                  onConnect={(params) => {
                    const strokeColor = getStrokeColor(params.source || "", params.sourceHandle || "", params.target || "");
                    const newEdge = {
                      ...params,
                      id: `e-${params.source}-${params.target}-${Date.now()}`,
                      type: "smoothstep",
                      animated: true,
                      style: { stroke: strokeColor, strokeWidth: 1.5, strokeDasharray: "4,4" },
                      markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: strokeColor }
                    };
                    setEdges((eds) => addEdge(newEdge, eds));
                  }}
                  connectionLineType={"smoothstep" as any}
                  connectionLineStyle={{ stroke: "#3b82f6", strokeWidth: 1.5, strokeDasharray: "4,4" }}
                  defaultEdgeOptions={{ type: "smoothstep", animated: true, style: { strokeWidth: 1.5, strokeDasharray: "4,4" } }}
                  onInit={setReactFlowInstance}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const rawData = e.dataTransfer.getData('application/reactflow');
                    if (!rawData || !reactFlowInstance) return;
                    const { type, label } = JSON.parse(rawData);
                    
                    const position = reactFlowInstance.screenToFlowPosition({
                      x: e.clientX,
                      y: e.clientY,
                    });

                    const id = `${type}-${Date.now()}`;
                    let nodeData: any = { label };
                    
                    if (type === "column") {
                      nodeData = {
                        label,
                        isTopping: label.includes("Topping"),
                        causticDosing: label.includes("Topping") ? toppingColumn.causticDosing : false,
                        recycleWater: label.includes("Topping") ? toppingColumn.recycleWaterInFeed : false,
                        sideDraw: label.includes("Refining") ? refiningColumn.sideDraw : false
                      };
                    } else if (type === "exchanger") {
                      nodeData = {
                        label,
                        flowType: label.includes("Preheater") ? toppingColumn.feedPreheaterFlowType : refiningColumn.productCoolerFlowType
                      };
                    } else if (type === "condenser") {
                      const isTopping = label.includes("Topping");
                      nodeData = {
                        label,
                        utilityType: isTopping ? (toppingColumn.condensers.utilities[0] || "Air Cooled") : (refiningColumn.condensers.utilities[0] || "Air Cooled"),
                        flowType: isTopping ? (toppingColumn.condensers.flowTypes[0] || "Counter Flow") : (refiningColumn.condensers.flowTypes[0] || "Counter Flow")
                      };
                    } else if (type === "reboiler") {
                      const isTopping = label.includes("Topping");
                      nodeData = {
                        label,
                        heatSource: isTopping ? toppingColumn.reboilerHeatSource : refiningColumn.reboilerHeatSource,
                        flowType: isTopping ? toppingColumn.reboilerFlowType : refiningColumn.reboilerFlowType
                      };
                    }

                    const newNode = {
                      id,
                      type,
                      position,
                      data: nodeData
                    };

                    setNodes((nds) => nds.concat(newNode));
                  }}
                  onNodeDoubleClick={(e, node) => {
                    setCurrentStep(2);
                    const label = (node.data?.label || "").toLowerCase();
                    const type = (node.type || "").toLowerCase();
                    
                    let keyword = "";
                    if (label.includes("preheater")) keyword = "preheater";
                    else if (label.includes("cooler")) keyword = "cooler";
                    else if (type === "condenser") {
                      if (label.includes("topping")) keyword = "topping_column_1st_condenser";
                      else if (label.includes("refining")) keyword = "refining_column_1st_condenser";
                      else keyword = "recovery_column_1st_condenser";
                    }
                    else if (type === "reboiler") {
                      if (label.includes("topping")) keyword = "topping_column_reboiler";
                      else if (label.includes("refining")) keyword = "refining_column_reboiler";
                      else keyword = "recovery_column_reboiler";
                    }
                    else if (label.includes("topping")) keyword = "topping_column";
                    else if (label.includes("refining")) keyword = "refining_column";
                    else if (label.includes("recovery")) keyword = "recovery_column";
                    else if (label.includes("dosing")) keyword = "separation";

                    const match = activeKpis.find(k => k.name.toLowerCase().includes(keyword));
                    const targetKpiId = match ? match.name.replace(/[\s_]+/g, "-").toLowerCase() : "";

                    if (targetKpiId) {
                      setTimeout(() => {
                        const el = document.getElementById(`kpi-row-${targetKpiId}`);
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", block: "center" });
                          el.classList.add("bg-accent-blue/10");
                          setTimeout(() => el.classList.remove("bg-accent-blue/10"), 2000);
                        }
                      }, 300);
                    }
                  }}
                  nodeTypes={nodeTypes}
                  fitView
                >
                  <Background color="#cbd5e1" gap={16} size={1} />
                  <Controls />

                </ReactFlow>
              </ReactFlowProvider>
            </div>

            {/* Right Inspection Panel (Matching Ammonia Reference) */}
            <div className="w-full lg:w-[260px] border border-slate-200 rounded-2xl bg-white p-4 flex flex-col gap-4 shrink-0 shadow-sm">
              {/* Tab Navigation: Configure | Issues (1) | Hierarchy */}
              <div className="flex items-center border-b border-slate-100 pb-2">
                {[
                  { id: "configure", label: "Configure" },
                  { id: "issues", label: "Issues (1)" },
                  { id: "hierarchy", label: "Hierarchy" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setRightPanelTab(tab.id as any)}
                    className={`flex-1 py-1.5 text-xs font-semibold text-center border-b-2 transition-all ${
                      rightPanelTab === tab.id 
                        ? "border-blue-600 text-blue-600" 
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Issues Tab Content */}
              {rightPanelTab === "issues" && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs text-slate-600 leading-relaxed">
                    <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] block mb-1">NOTE</span>
                    Distillation Column A: process inlet <span className="font-semibold text-slate-800">'Crude Feed Stream'</span> is connected — stream is treated as active feed stream.
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-500" />
                    <span>All {nodes.length} equipment units verified</span>
                  </div>
                </div>
              )}

              {/* Configure Tab Content */}
              {rightPanelTab === "configure" && (
                <div className="flex flex-col gap-3 text-xs text-slate-600">
                  <div className="font-bold text-slate-800">Unit Properties</div>
                  <p className="text-[11px] text-slate-400">Select any equipment block on the canvas to configure parameters live.</p>
                </div>
              )}

              {/* Hierarchy Tab Content */}
              {rightPanelTab === "hierarchy" && (
                <div className="flex flex-col gap-2 text-xs">
                  <div className="font-bold text-slate-800 mb-1">Plant Hierarchy</div>
                  {nodes.map(n => (
                    <div key={n.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-slate-100 bg-slate-50 text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span className="font-semibold truncate">{n.data?.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              onClick={() => setCurrentStep(2)}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-sm"
            >
              Continue to KPIs <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

{currentStep === 2 && (
          <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-border bg-surface p-6 flex flex-col gap-4">
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                <CheckCircle size={18} className="text-accent-blue" />
                Step 2: Dynamic Mandatory KPI List & Calculation Config ({activeKpis.length} Active)
              </h2>
              <p className="text-xs text-text-secondary">Identify whether each mandatory KPI is directly measured via a DCS PI Tag or calculated as an Inferred parameter.</p>
              
              <div className="overflow-x-auto border border-border rounded-lg mt-2">
                <table className="min-w-full divide-y divide-border text-xs table-fixed">
                  <colgroup>
                    <col className="w-[35%]" />
                    <col className="w-[20%]" />
                    <col className="w-[35%]" />
                    <col className="w-[10%]" />
                  </colgroup>
                  <thead>
                    <tr className="text-left text-text-secondary font-semibold bg-background">
                      <th className="px-4 py-3">KPI Name / Description</th>
                      <th className="px-4 py-3">Type of KPI</th>
                      <th className="px-4 py-3">Formula Expression / Mapped PI Tag</th>
                      <th className="px-4 py-3 text-center">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-text-primary bg-surface">
                    {activeKpis.map((kpi, idx) => {
                      const config = kpiConfig[kpi.name] || { type: "Calculated", piTag: "" };
                      return (
                        <tr key={idx} id={`kpi-row-${kpi.name.replace(/[\s_]+/g, '-').toLowerCase()}`} className="hover:bg-surface-hover transition-colors duration-500">
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-text-primary">{kpi.name.replace(/_/g, ' ')}</div>
                            <div className="text-[10px] text-text-secondary line-clamp-2 mt-0.5" title={kpi.description}>
                              {kpi.description}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={config.type}
                              onChange={e => handleKpiConfigChange(kpi.name, "type", e.target.value as any)}
                              className="rounded border border-border bg-background px-2.5 py-1.5 text-xs text-text-primary font-medium w-full max-w-[150px]"
                            >
                              <option value="Calculated">Calculated</option>
                              <option value="PI Tag">PI Tag</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            {config.type === "Calculated" ? (
                              <div className="font-mono text-[10px] text-accent-blue bg-accent-blue/5 border border-accent-blue/10 px-2.5 py-1.5 rounded break-all max-h-[80px] overflow-y-auto" title={kpi.formula}>
                                {kpi.formula}
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={config.piTag || ""}
                                onChange={e => handleKpiConfigChange(kpi.name, "piTag", e.target.value)}
                                placeholder="Enter DCS Tag path (e.g. AR.DCS.FC1502.PV)"
                                className="w-full rounded border border-border bg-background px-3 py-1.5 font-mono text-[10px] text-text-primary outline-none focus:border-accent-blue"
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-text-secondary text-center">
                            {kpi.uom || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between gap-3 mt-4 border-t border-border pt-4">
                <button 
                  onClick={() => setCurrentStep(1)}
                  className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-hover"
                >
                  Back
                </button>
                <button 
                  onClick={() => setCurrentStep(3)}
                  className="rounded-lg bg-accent-blue px-5 py-2 text-xs font-semibold text-white hover:opacity-90 flex items-center gap-1"
                >
                  Go to Tag Mappings <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: DCS TAG MAPPING TABLE */}
        {currentStep === 3 && (
          <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-border bg-surface p-6 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                    <Database size={18} className="text-accent-blue" />
                    Step 3: Mapped OPC-UA / DCS Tags and Boundaries ({filteredTags.length} showing)
                  </h2>
                  <p className="text-xs text-text-secondary mt-0.5">Map actual process parameters and set statistical min/max ranges for raw inputs.</p>
                </div>
                
                {/* Search & Counter panel */}
                <div className="flex items-center gap-3">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
                    <input 
                      type="text"
                      placeholder="Search tags..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background pl-9 pr-4 py-2 text-xs text-text-primary outline-none focus:border-accent-blue"
                    />
                  </div>
                  <div className="rounded border border-border px-3 py-2 text-xs text-text-secondary font-semibold bg-background shrink-0">
                    {activeTags.length} active tags
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto max-h-[500px] border border-border rounded-lg mt-2">
                <table className="min-w-full divide-y divide-border text-xs">
                  <thead>
                    <tr className="text-left text-text-secondary font-semibold bg-background sticky top-0">
                      <th className="px-3 py-2.5">Parameter / Short Tag</th>
                      <th className="px-3 py-2.5">DCS PI Tag Path</th>
                      <th className="px-3 py-2.5 w-20 text-center">Design</th>
                      <th className="px-3 py-2.5 w-20 text-center">Min Limit</th>
                      <th className="px-3 py-2.5 w-20 text-center">Max Limit</th>
                      <th className="px-3 py-2.5 w-20 text-center">Default</th>
                      <th className="px-3 py-2.5 w-20 text-center">UOM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-text-primary bg-surface">
                    {filteredTags.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-xs text-text-secondary">
                          No active tags match the search query or configuration.
                        </td>
                      </tr>
                    ) : (
                      filteredTags.map(tagKey => {
                        const mapping = rawTagMappings[tagKey] || {};
                        return (
                          <tr key={tagKey} className="hover:bg-surface-hover">
                            <td className="px-3 py-2 font-semibold text-text-primary max-w-[200px] truncate" title={tagKey}>
                              {tagKey.replace(/_/g, ' ')}
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text" 
                                value={mapping.piTag || ""}
                                onChange={e => setRawTagMappings(prev => ({
                                  ...prev,
                                  [tagKey]: { ...prev[tagKey], piTag: e.target.value }
                                }))}
                                placeholder="e.g. AR.DCS.FC101.PV"
                                className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-[10px] text-text-primary outline-none focus:border-accent-blue"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text" 
                                value={mapping.design || ""}
                                onChange={e => setRawTagMappings(prev => ({
                                  ...prev,
                                  [tagKey]: { ...prev[tagKey], design: e.target.value }
                                }))}
                                className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-text-primary text-center outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text" 
                                value={mapping.min || ""}
                                onChange={e => setRawTagMappings(prev => ({
                                  ...prev,
                                  [tagKey]: { ...prev[tagKey], min: e.target.value }
                                }))}
                                className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-text-primary text-center outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text" 
                                value={mapping.max || ""}
                                onChange={e => setRawTagMappings(prev => ({
                                  ...prev,
                                  [tagKey]: { ...prev[tagKey], max: e.target.value }
                                }))}
                                className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-text-primary text-center outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text" 
                                value={mapping.def || ""}
                                onChange={e => setRawTagMappings(prev => ({
                                  ...prev,
                                  [tagKey]: { ...prev[tagKey], def: e.target.value }
                                }))}
                                className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-text-primary text-center outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text" 
                                value={mapping.uom || ""}
                                onChange={e => setRawTagMappings(prev => ({
                                  ...prev,
                                  [tagKey]: { ...prev[tagKey], uom: e.target.value }
                                }))}
                                className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-text-primary text-center outline-none"
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between gap-3 mt-4 border-t border-border pt-4">
                <button 
                  onClick={() => setCurrentStep(2)}
                  className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-hover"
                >
                  Back
                </button>
                <button 
                  onClick={() => setCurrentStep(4)}
                  className="rounded-lg bg-accent-blue px-5 py-2 text-xs font-semibold text-white hover:opacity-90 flex items-center gap-1"
                >
                  Continue to Review <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW & CONFIRMATION */}
        {currentStep === 4 && (
          <div className="flex flex-col gap-6">
            {!saveResult ? (
              <div className="rounded-xl border border-border bg-surface p-6 flex flex-col gap-6">
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-accent-blue" />
                  Step 4: Review and Submit Configuration
                </h2>
                <p className="text-xs text-text-secondary -mt-2">
                  Please review the filled information below before submitting. Click <strong>Submit Configuration</strong> to save the configuration directly to the database.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Plant Design Specs */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-xs font-bold text-accent-blue uppercase tracking-wider">Plant Specifications</h3>
                    
                    {/* Topping Column Card */}
                    <div className="rounded-lg border border-border bg-background p-4 flex flex-col gap-2">
                      <h4 className="text-xs font-bold text-text-primary">Topping Column</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-text-secondary">Feed Preheater</span>
                          <span className="font-semibold">{toppingColumn.feedPreheater ? `Yes (${toppingColumn.feedPreheaterFlowType})` : "No"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-text-secondary">Recycle Water in Feed</span>
                          <span className="font-semibold">{toppingColumn.recycleWaterInFeed ? "Yes" : "No"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-text-secondary">Caustic Dosing</span>
                          <span className="font-semibold">{toppingColumn.causticDosing ? "Yes" : "No"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-text-secondary">Reboiler</span>
                          <span className="font-semibold">{toppingColumn.reboilerHeatSource} ({toppingColumn.reboilerFlowType})</span>
                        </div>
                        <div className="flex flex-col col-span-2 border-t border-border/50 pt-2 mt-1">
                          <span className="text-[10px] text-text-secondary">Condensers</span>
                          <span className="font-semibold">{toppingColumn.condensers.count} Condenser(s) ({toppingColumn.condensers.utilities.join(", ")})</span>
                        </div>
                      </div>
                    </div>

                    {/* Refining Column Card */}
                    <div className="rounded-lg border border-border bg-background p-4 flex flex-col gap-2">
                      <h4 className="text-xs font-bold text-text-primary">Refining Column</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-text-secondary">Side Draw Output</span>
                          <span className="font-semibold">{refiningColumn.sideDraw ? "Yes" : "No"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-text-secondary">Product Cooler</span>
                          <span className="font-semibold">{refiningColumn.hasProductCooler ? `Yes (${refiningColumn.productCoolerFlowType})` : "No"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-text-secondary">Reboiler</span>
                          <span className="font-semibold">{refiningColumn.reboilerHeatSource} ({refiningColumn.reboilerFlowType})</span>
                        </div>
                        <div className="flex flex-col col-span-2 border-t border-border/50 pt-2 mt-1">
                          <span className="text-[10px] text-text-secondary">Condensers</span>
                          <span className="font-semibold">{refiningColumn.condensers.count} Condenser(s) ({refiningColumn.condensers.utilities.join(", ")})</span>
                        </div>
                      </div>
                    </div>

                    {/* Recovery Column Card */}
                    <div className="rounded-lg border border-border bg-background p-4 flex flex-col gap-2">
                      <h4 className="text-xs font-bold text-text-primary">Recovery Column</h4>
                      {recoveryColumn.hasRecoveryColumn ? (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-text-secondary">Side Draw Output</span>
                            <span className="font-semibold">{recoveryColumn.sideDraw.hasSideDraw ? "Yes" : "No"}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-text-secondary">Heavy End Cooler</span>
                            <span className="font-semibold">
                              {recoveryColumn.sideDraw.hasHeavyEndCooler && recoveryColumn.sideDraw.hasSideDraw
                                ? `Yes (${recoveryColumn.sideDraw.heavyEndCoolerUtility})`
                                : "No"}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-text-secondary">Shared Bottoms Cooler</span>
                            <span className="font-semibold">{recoveryColumn.bottoms.sharedCooler ? `Yes (${recoveryColumn.bottoms.sharedCoolerUtility})` : "No"}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-text-secondary">Reboiler</span>
                            <span className="font-semibold">{recoveryColumn.reboilerHeatSource} ({recoveryColumn.reboilerFlowType})</span>
                          </div>
                          <div className="flex flex-col col-span-2 border-t border-border/50 pt-2 mt-1">
                            <span className="text-[10px] text-text-secondary">Condensers</span>
                            <span className="font-semibold">{recoveryColumn.condensers.count} Condenser(s) ({recoveryColumn.condensers.utilities.join(", ")})</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-text-secondary">Disabled</div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: KPIs & Tag Mappings summary */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-xs font-bold text-accent-blue uppercase tracking-wider">KPIs & Mappings</h3>
                    
                    <div className="rounded-lg border border-border bg-background p-4 flex flex-col gap-4">
                      {/* Active KPIs list */}
                      <div>
                        <h4 className="text-xs font-bold text-text-primary mb-2">Active KPIs Summary</h4>
                        <div className="flex flex-wrap gap-2">
                          <div className="rounded border border-border bg-surface px-2.5 py-1 text-[11px] text-text-primary">
                            Total Active: <strong className="text-accent-blue">{activeKpis.length}</strong>
                          </div>
                          <div className="rounded border border-border bg-surface px-2.5 py-1 text-[11px] text-text-primary">
                            Calculated: <strong className="text-accent-blue">{activeKpis.filter(k => kpiConfig[k.name]?.type === "Calculated").length}</strong>
                          </div>
                          <div className="rounded border border-border bg-surface px-2.5 py-1 text-[11px] text-text-primary">
                            Direct Measured: <strong className="text-accent-blue">{activeKpis.filter(k => kpiConfig[k.name]?.type === "PI Tag").length}</strong>
                          </div>
                        </div>
                      </div>

                      {/* DCS Tags summary (Mapped ones only) */}
                      <div className="border-t border-border/50 pt-3">
                        <h4 className="text-xs font-bold text-text-primary mb-2">Mapped DCS PI Tags ({activeTags.filter(t => rawTagMappings[t]?.piTag).length} Mapped)</h4>
                        <div className="max-h-[220px] overflow-y-auto border border-border/50 rounded divide-y divide-border/30 bg-surface">
                          {activeTags.filter(t => rawTagMappings[t]?.piTag).length === 0 ? (
                            <div className="text-[11px] text-text-secondary p-3 text-center">No DCS tags mapped yet.</div>
                          ) : (
                            activeTags.filter(t => rawTagMappings[t]?.piTag).map(t => (
                              <div key={t} className="p-2 flex justify-between gap-4 text-[11px] hover:bg-surface-hover">
                                <span className="font-semibold text-text-primary max-w-[180px] truncate" title={t}>{t.replace(/_/g, ' ')}</span>
                                <span className="font-mono text-text-secondary text-[10px] truncate max-w-[200px]" title={rawTagMappings[t]?.piTag}>{rawTagMappings[t]?.piTag}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between gap-3 mt-4 border-t border-border pt-4">
                  <button 
                    onClick={() => setCurrentStep(3)}
                    disabled={saving}
                    className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-hover disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleSaveConfig}
                    disabled={saving}
                    className="rounded-lg bg-accent-blue px-6 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />} Submit Configuration
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-surface p-6 flex flex-col items-center justify-center text-center gap-5 py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-green/10 text-accent-green">
                  <CheckCircle size={36} />
                </div>
                <div className="flex flex-col gap-1 max-w-md">
                  <h2 className="text-lg font-bold text-text-primary">Configuration Submitted Successfully!</h2>
                  <p className="text-xs text-text-secondary">
                    All plant configurations, dynamic KPIs, and user-defined DCS tag mappings have been verified and saved to the database. The live calculation pipelines are now active and ready.
                  </p>
                </div>

                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={() => {
                      setSaveResult(null);
                      setCurrentStep(1);
                    }}
                    className="rounded-lg border border-border bg-surface px-5 py-2.5 text-xs font-semibold text-text-secondary hover:bg-surface-hover"
                  >
                    Modify Config
                  </button>
                  <button 
                    onClick={() => window.location.reload()}
                    className="rounded-lg bg-accent-blue px-5 py-2.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Finish Setup
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
        </div>
      )}
    </div>
  );
}
