"use client";

import { useEffect, useState, useRef } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAtomValue, useSetAtom } from "jotai";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo, useCallback } from "react";
import {
  topologyAtom,
  hierarchyAtom,
  loadTopologyAtom,
  reorderTopologyChainAtom,
  connectTopologyAtom,
  disconnectTopologyAtom,
  rebuildTopologyAtom,
  uploadTopologyAtom,
  setTopologyLayoutAtom,
  streamSensorsAtom,
  loadStreamSensorsAtom,
  setStreamSensorAtom,
  calcResolutionAtom,
  loadCalcResolutionAtom,
  loadSensorMappingAtom,
  flushDraftAtom,
} from "../../store/Index";
import type {
  TopologyChain,
  TopologyLink,
  StreamSensorEntry,
  CalcResolutionResponse,
} from "../../api/Index";

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));

// Service → accent token (no raw Tailwind colors per the design system).
function serviceAccent(service: string): string {
  switch (service) {
    case "flue_gas":
      return "text-accent-orange bg-accent-orange/10 border-accent-orange/20";
    case "process":
      return "text-accent-blue bg-accent-blue/10 border-accent-blue/20";
    case "steam":
      return "text-accent-green bg-accent-green/10 border-accent-green/20";
    case "bfw":
      return "text-accent-yellow bg-accent-yellow/10 border-accent-yellow/20";
    default:
      return "text-text-secondary bg-surface-subtle border-border";
  }
}

function serviceStroke(service: string): string {
  switch (service) {
    case "process":
      return "#3b82f6"; // Blue
    case "steam":
      return "#10b981"; // Green
    case "flue_gas":
      return "#f59e0b"; // Orange
    case "bfw":
      return "#eab308"; // Yellow
    default:
      return "#9ca3af"; // Gray
  }
}

function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 bg-surface-subtle border border-border rounded-full text-[11px] text-text-secondary",
        className,
      )}
    >
      {children}
    </span>
  );
}

interface UnifiedStream {
  id: string;
  service: string;
  measurements: string[];
  source: {
    nodeId: string | null;
    name: string | null;
    level: string | null;
    portName: string | null;
  };
  target: {
    nodeId: string | null;
    name: string | null;
    level: string | null;
    portName: string | null;
  };
  isChain: boolean;
  chainId?: string;
}

function parseAllStreams(data: any): UnifiedStream[] {
  const streams: UnifiedStream[] = [];

  // All streams (including chain streams and standalone links) are now in `data.links`
  if (data?.links) {
    for (const link of data.links) {
      streams.push({
        id: link.id,
        service: link.service,
        measurements: link.measurements || [],
        source: {
          nodeId: link.source.nodeId,
          name: link.source.name,
          level: link.source.level,
          portName: link.source.portName,
        },
        target: {
          nodeId: link.target.nodeId,
          name: link.target.name,
          level: link.target.level,
          portName: link.target.portName,
        },
        isChain: !!link.chainId,
        chainId: link.chainId || undefined,
      });
    }
  }

  return streams;
}

function TagInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v.trim() !== value) onCommit(v.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      placeholder="PI tag…"
      className={cn(
        "w-40 bg-surface border rounded px-2 py-1 text-[12px] text-text-primary",
        value ? "border-accent-green" : "border-border",
      )}
    />
  );
}

function CalcResolutionCard({ res }: { res: CalcResolutionResponse | null }) {
  if (!res || res.summary.portSites === 0) return null;
  const s = res.summary;
  return (
    <div className="p-3 bg-surface border border-border rounded-lg">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[13px] font-semibold text-text-primary">
          KPI input resolution
        </h3>
        <span className="text-[11px] text-text-tertiary">
          port → stream → tag
        </span>
      </div>
      <p className="text-[12.5px] text-text-secondary mt-1">
        <strong className="text-text-primary">{s.resolvedViaStream}</strong>{" "}
        inlet/outlet references resolve through{" "}
        <strong className="text-text-primary">{s.distinctBoundaries}</strong>{" "}
        boundary sensors
        {s.savedVsNaive > 0 && (
          <>
            {" "}
            — <strong className="text-accent-green">
              {s.savedVsNaive}
            </strong>{" "}
            fewer KPI inputs than mapping each side separately
          </>
        )}
        . <strong className="text-text-primary">{s.mapped}</strong>/
        {s.boundaryInputSlots} mapped.
      </p>
    </div>
  );
}

import type { NodeProps } from "@xyflow/react";

interface CustomNodeData {
  node: { id: string; name: string; level: string };
  service: string;
  streams: UnifiedStream[];
  allNodes: { id: string; name: string; level: string }[];
  equipmentPorts: Record<
    string,
    { port_name: string; service: string; direction: string }[]
  >;
  onConnect: (
    sourceNodeId: string,
    sourcePort: string,
    targetNodeId: string,
    targetPort: string,
    service: string,
  ) => void;
  onDisconnect: (stream: UnifiedStream) => void;
  pending: boolean;
  sensorData?: any;
  onSetSensor?: (s: string, m: string, t: string) => void;
  onNodeDoubleClick?: (n: any) => void;
}

function PortNodeDot({
  node,
  port,
  direction,
  streams,
  allNodes,
  equipmentPorts,
  onConnect,
  onDisconnect,
  pending,
  sensorData,
  onSetSensor,
}: any) {
  const [selectedNode, setSelectedNode] = useState("");
  const [selectedPort, setSelectedPort] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const portId = port.port_name;

  const activeStreams = streams.filter((s: any) => {
    if (direction === "in") {
      return (
        s.target.nodeId === node.id && s.target.portName === port.port_name
      );
    } else {
      return (
        s.source.nodeId === node.id && s.source.portName === port.port_name
      );
    }
  });

  const isConnected = activeStreams.length > 0;

  const hasExistingConnection = (nId: string) => {
    return streams.some(
      (s: any) =>
        s.service === port.service &&
        ((s.source.nodeId === node.id && s.target.nodeId === nId) ||
          (s.source.nodeId === nId && s.target.nodeId === node.id)),
    );
  };

  const candidateNodes = allNodes.filter(
    (n: any) =>
      n.id !== node.id &&
      !hasExistingConnection(n.id) &&
      (equipmentPorts[n.level] || []).some(
        (p: any) =>
          p.service === port.service &&
          (direction === "in"
            ? p.direction === "out" || p.direction === "both"
            : p.direction === "in" || p.direction === "both"),
      ),
  );

  const candidatePorts = selectedNode
    ? (
        equipmentPorts[
          allNodes.find((n: any) => n.id === selectedNode)?.level || ""
        ] || []
      ).filter(
        (p: any) =>
          p.service === port.service &&
          (direction === "in"
            ? p.direction === "out" || p.direction === "both"
            : p.direction === "in" || p.direction === "both"),
      )
    : [];

  const handleConnectClick = () => {
    if (!selectedNode || !selectedPort) return;
    if (direction === "in") {
      onConnect(
        selectedNode,
        selectedPort,
        node.id,
        port.port_name,
        port.service,
      );
    } else {
      onConnect(
        node.id,
        port.port_name,
        selectedNode,
        selectedPort,
        port.service,
      );
    }
    setSelectedNode("");
    setSelectedPort("");
  };

  const dotColorClass = () => {
    switch (port.service) {
      case "process":
        return isConnected
          ? "bg-accent-blue border-accent-blue shadow-[0_0_8px_rgba(59,130,246,0.6)]"
          : "border-accent-blue/60 bg-surface hover:bg-accent-blue/20";
      case "steam":
        return isConnected
          ? "bg-accent-green border-accent-green shadow-[0_0_8px_rgba(16,185,129,0.6)]"
          : "border-accent-green/60 bg-surface hover:bg-accent-green/20";
      case "flue_gas":
        return isConnected
          ? "bg-accent-orange border-accent-orange shadow-[0_0_8px_rgba(245,158,11,0.6)]"
          : "border-accent-orange/60 bg-surface hover:bg-accent-orange/20";
      case "bfw":
        return isConnected
          ? "bg-accent-yellow border-accent-yellow shadow-[0_0_8px_rgba(234,179,8,0.6)]"
          : "border-accent-yellow/60 bg-surface hover:bg-accent-yellow/20";
      default:
        return isConnected
          ? "bg-text-secondary border-text-secondary"
          : "border-border bg-surface hover:bg-surface-hover";
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative group flex items-center justify-center"
    >
      <Handle
        type={direction === "in" ? "target" : "source"}
        position={direction === "in" ? Position.Left : Position.Right}
        id={portId}
        isConnectable={true}
        className={cn(
          "w-3 h-3 rounded-full border-2 cursor-pointer transition-all duration-200 hover:scale-125 z-30",
          "!relative !transform-none !left-auto !right-auto",
          dotColorClass(),
        )}
        onClick={() => setIsOpen((o) => !o)}
      />

      <div
        className={cn(
          "absolute flex-col gap-2.5 bg-surface border border-border rounded-xl shadow-2xl p-4 w-72 text-left z-50 pointer-events-auto transition-opacity duration-300",
          isOpen
            ? "flex opacity-100"
            : "hidden group-hover:flex opacity-0 group-hover:opacity-100",
        )}
        style={{
          left: direction === "in" ? "14px" : "auto",
          right: direction === "out" ? "14px" : "auto",
          top: "50%",
          transform: "translateY(-50%)",
        }}
      >
        <div className="flex flex-col pb-2 border-b border-border/40">
          <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
            {direction === "in" ? "Inlet Port" : "Outlet Port"}
          </span>
          <span className="text-[13px] font-bold text-text-primary font-mono mt-0.5">
            {port.port_name}
          </span>
          <span className="text-[10px] text-text-secondary mt-0.5">
            Service:{" "}
            <span className="font-semibold capitalize">{port.service}</span>
          </span>
        </div>

        <div>
          <span className="text-[10.5px] font-bold text-text-secondary">
            Connections:
          </span>
          {activeStreams.length > 0 ? (
            <div className="flex flex-col gap-2 mt-1.5 max-h-24 overflow-y-auto pr-1">
              {activeStreams.map((s: any) => {
                const remoteName =
                  direction === "in" ? s.source.name : s.target.name;
                const remotePort =
                  direction === "in" ? s.source.portName : s.target.portName;
                const isExternal =
                  direction === "in" ? !s.source.nodeId : !s.target.nodeId;

                const mappedStream = sensorData?.streams?.find(
                  (st: any) => st.streamId === s.id,
                );
                return (
                  <div
                    key={s.id}
                    className="flex flex-col gap-2 p-1.5 bg-surface-subtle border border-border/40 rounded-md text-[12px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-text-tertiary text-[10px]">
                          {direction === "in" ? "←" : "→"}
                        </span>
                        <span
                          className={cn(
                            "truncate font-medium",
                            isExternal
                              ? "text-text-tertiary italic"
                              : "text-text-primary",
                          )}
                        >
                          {isExternal
                            ? direction === "in"
                              ? "External Feed"
                              : "External Sink"
                            : remoteName}
                        </span>
                        {!isExternal && (
                          <span className="text-[9px] font-mono text-text-secondary bg-surface px-1.5 py-0.5 border border-border rounded shrink-0">
                            {remotePort}
                          </span>
                        )}
                      </div>
                      <button
                        disabled={pending}
                        onClick={() => onDisconnect(s)}
                        className="text-text-secondary hover:text-accent-red transition-colors p-0.5"
                        title="Disconnect stream"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11.5px] text-text-tertiary italic mt-1 pl-1">
              No active streams connected.
            </p>
          )}
        </div>

        <div className="pt-2 border-t border-border/40 flex flex-col gap-2">
          <span className="text-[10.5px] font-bold text-text-secondary">
            {direction === "in" ? "Link from Source:" : "Link to Target:"}
          </span>
          <div className="flex items-center gap-1.5">
            <select
              value={selectedNode}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedNode(val);
                if (val === "external") {
                  setSelectedPort("external");
                } else {
                  setSelectedPort("");
                }
              }}
              className="bg-surface border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary flex-1 focus:outline-none focus:border-accent-blue"
            >
              <option value="">
                {direction === "in" ? "Source Unit..." : "Target Unit..."}
              </option>
              {direction === "in" && (
                <option value="external">External Feed</option>
              )}
              {direction === "out" && (
                <option value="external">External Sink</option>
              )}
              {candidateNodes.map((n: any) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>

            <select
              value={selectedPort}
              onChange={(e) => setSelectedPort(e.target.value)}
              disabled={!selectedNode || selectedNode === "external"}
              className="bg-surface border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary w-24 disabled:opacity-45 focus:outline-none focus:border-accent-blue"
            >
              {selectedNode === "external" ? (
                <option value="external">External</option>
              ) : (
                <>
                  <option value="">Port...</option>
                  {candidatePorts.map((p: any) => (
                    <option key={p.port_name} value={p.port_name}>
                      {p.port_name}
                    </option>
                  ))}
                </>
              )}
            </select>

            <button
              disabled={pending || !selectedNode || !selectedPort}
              onClick={handleConnectClick}
              className="p-1 px-2.5 bg-accent-blue text-white rounded-lg text-[11px] font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-opacity"
              title="Connect Link"
            >
              Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EquipmentNode({ data }: { data: any }) {
  const {
    node,
    streams,
    allNodes,
    equipmentPorts,
    onConnect,
    onDisconnect,
    pending,
    sensorData,
    onSetSensor,
    onNodeDoubleClick,
  } = data as CustomNodeData;
  const ports = equipmentPorts[node.level] || [];
  const inPorts = ports.filter(
    (p: any) => p.direction === "in" || p.direction === "both",
  );
  const outPorts = ports.filter(
    (p: any) => p.direction === "out" || p.direction === "both",
  );

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (onNodeDoubleClick) onNodeDoubleClick(node);
      }}
      className="relative z-10 w-44 bg-surface border border-border/80 rounded-xl px-3 py-2 flex flex-col justify-center items-center text-center h-14 select-none hover:border-border hover:bg-surface-hover/30 transition-all shadow-sm"
    >
      <div className="flex flex-col">
        <span
          className="text-[12px] font-bold text-text-primary truncate max-w-[130px]"
          title={node.name}
        >
          {node.name}
        </span>
        <span className="text-[10px] text-text-secondary uppercase tracking-wider">
          {node.level}
        </span>
      </div>

      <div className="absolute left-0 top-0 bottom-0 -translate-x-1/2 flex flex-col justify-center gap-1.5 py-1 pointer-events-auto">
        {inPorts.map((port: any) => (
          <PortNodeDot
            key={port.port_name}
            node={node}
            port={port}
            direction="in"
            streams={streams}
            allNodes={allNodes}
            equipmentPorts={equipmentPorts}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            pending={pending}
            sensorData={sensorData}
            onSetSensor={onSetSensor}
          />
        ))}
      </div>

      <div className="absolute right-0 top-0 bottom-0 translate-x-1/2 flex flex-col justify-center gap-1.5 py-1 pointer-events-auto">
        {outPorts.map((port: any) => (
          <PortNodeDot
            key={port.port_name}
            node={node}
            port={port}
            direction="out"
            streams={streams}
            allNodes={allNodes}
            equipmentPorts={equipmentPorts}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            pending={pending}
            sensorData={sensorData}
            onSetSensor={onSetSensor}
          />
        ))}
      </div>

      <div className="absolute right-2 bottom-1 opacity-[0.02] text-text-primary pointer-events-none">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="2" y="2" width="20" height="20" rx="3" />
          <path d="M7 12h10M12 7v10" />
        </svg>
      </div>
    </div>
  );
}

// Grid size for the connectivity canvas — node drags snap to this, and the
// background dots are drawn at the same interval so snapping aligns to the grid.
const GRID = 20;
const snap = (v: number) => Math.round(v / GRID) * GRID;
const COL_W = 360;
const ROW_H = 160;
const ORIGIN = 40;

// Default node layout that follows the PROCESS CONNECTIVITY rather than alphabetical order.
// A node's column = its longest-path depth along the streams (external feed → downstream),
// so a chain reads left→right in flow order; nodes at the same depth stack into rows.
function computeFlowLayout(
  nodes: { id: string }[],
  streams: UnifiedStream[],
): Record<string, { x: number; y: number }> {
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const preds: Record<string, string[]> = {};
  nodes.forEach((n) => (preds[n.id] = []));
  for (const s of streams) {
    const a = s.source.nodeId;
    const b = s.target.nodeId;
    if (a && b && a !== b && idx.has(a) && idx.has(b)) preds[b].push(a);
  }
  // Longest-path depth via memoized DFS (cycle-guarded — flow graphs are DAGs in practice).
  const depth: Record<string, number> = {};
  const onStack = new Set<string>();
  const calc = (id: string): number => {
    if (depth[id] !== undefined) return depth[id];
    if (onStack.has(id)) return 0;
    onStack.add(id);
    let d = 0;
    for (const p of preds[id]) d = Math.max(d, calc(p) + 1);
    onStack.delete(id);
    return (depth[id] = d);
  };
  nodes.forEach((n) => calc(n.id));
  // Assign rows per column in stable flow order (by depth, then original index).
  const order = [...nodes].sort(
    (a, b) => depth[a.id] - depth[b.id] || (idx.get(a.id)! - idx.get(b.id)!),
  );
  const rowCount: Record<number, number> = {};
  const pos: Record<string, { x: number; y: number }> = {};
  for (const n of order) {
    const c = depth[n.id];
    const r = rowCount[c] || 0;
    rowCount[c] = r + 1;
    pos[n.id] = { x: snap(ORIGIN + c * COL_W), y: snap(ORIGIN + r * ROW_H) };
  }
  return pos;
}

function ScopeFlowNetwork({
  scope,
  nodes,
  streams,
  allNodes,
  equipmentPorts,
  onConnect,
  onDisconnect,
  pending,
  sensorData,
  onSetSensor,
  onNodeDoubleClick,
  layout,
  onMove,
}: {
  scope: string;
  nodes: { id: string; name: string; level: string }[];
  streams: UnifiedStream[];
  allNodes: { id: string; name: string; level: string }[];
  equipmentPorts: Record<
    string,
    { port_name: string; service: string; direction: string }[]
  >;
  onConnect: (
    sourceNodeId: string,
    sourcePort: string,
    targetNodeId: string,
    targetPort: string,
    service: string,
  ) => void;
  onDisconnect: (stream: UnifiedStream) => void;
  pending: boolean;
  sensorData: any;
  onSetSensor: (s: string, m: string, t: string) => void;
  onNodeDoubleClick: (n: any) => void;
  layout: Record<string, { x: number; y: number }>;
  onMove: (nodeId: string, pos: { x: number; y: number }) => void;
}) {
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<any>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<any>([]);

  const nodeTypes = useMemo(() => ({ equipment: EquipmentNode }), []);

  useEffect(() => {
    // Saved positions come from the topology state (persisted server-side, saved with
    // the topology); fall back to a deterministic grid-aligned auto-layout.
    const savedLayout = layout || {};

    // Default positions follow process-connectivity flow order (see computeFlowLayout),
    // not the alphabetical node order.
    const autoPos = computeFlowLayout(nodes, streams);

    const newRfNodes: any[] = nodes.map((n) => {
      let x = 0,
        y = 0;
      if (savedLayout[n.id]) {
        x = savedLayout[n.id].x;
        y = savedLayout[n.id].y;
      } else {
        const p = autoPos[n.id] || { x: ORIGIN, y: ORIGIN };
        x = p.x;
        y = p.y;
      }
      return {
        id: n.id,
        type: "equipment",
        position: { x: snap(x), y: snap(y) },
        data: {
          node: n,
          streams,
          allNodes,
          equipmentPorts,
          onConnect,
          onDisconnect,
          pending,
          sensorData,
          onSetSensor,
          onNodeDoubleClick,
        },
      };
    });

    const scopeStreams = streams.filter((s) => {
      return (s.source.nodeId && nodes.some(n => n.id === s.source.nodeId)) ||
             (s.target.nodeId && nodes.some(n => n.id === s.target.nodeId));
    });
    
    const extNodes: any[] = [];
    scopeStreams.forEach((s) => {
      // Check if source is external relative to THIS scope
      const sourceInScope = s.source.nodeId && nodes.some(n => n.id === s.source.nodeId);
      if (!sourceInScope) {
        const id = `ext_feed_${s.id}`;
        // Place the feed one column to the LEFT of the unit it feeds (flow order).
        const anchor = (s.target.nodeId && autoPos[s.target.nodeId]) || { x: COL_W, y: ORIGIN };
        const raw = savedLayout[id] || { x: anchor.x - COL_W, y: anchor.y };
        const pos = { x: snap(raw.x), y: snap(raw.y) };
        if (!extNodes.find((en) => en.id === id)) {
          extNodes.push({
            id,
            type: "default",
            position: pos,
            data: { label: s.source.nodeId ? `${s.source.name} (${s.source.level})` : "External Feed" },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            style: {
              width: 120,
              fontSize: 11,
              background: "#f8fafc",
              border: "1px dashed #cbd5e1",
              color: "#64748b",
            },
          });
        }
      }
      // Check if target is external relative to THIS scope
      const targetInScope = s.target.nodeId && nodes.some(n => n.id === s.target.nodeId);
      if (!targetInScope) {
        const id = `ext_sink_${s.id}`;
        // Place the sink one column to the RIGHT of the unit that feeds it (flow order).
        const anchor = (s.source.nodeId && autoPos[s.source.nodeId]) || { x: ORIGIN, y: ORIGIN };
        const raw = savedLayout[id] || { x: anchor.x + COL_W, y: anchor.y };
        const pos = { x: snap(raw.x), y: snap(raw.y) };
        if (!extNodes.find((en) => en.id === id)) {
          extNodes.push({
            id,
            type: "default",
            position: pos,
            data: { label: s.target.nodeId ? `${s.target.name} (${s.target.level})` : "External Sink" },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            style: {
              width: 120,
              fontSize: 11,
              background: "#f8fafc",
              border: "1px dashed #cbd5e1",
              color: "#64748b",
            },
          });
        }
      }
    });

    setRfNodes([...newRfNodes, ...extNodes]);
    // `layout` is intentionally read but not a dep: positions re-apply when the node set
    // changes (initial load / upload / rebuild / scope switch), not on every drag-persist.
  }, [nodes, scope, setRfNodes]);

  // Sync dependencies without recreating layout nodes
  useEffect(() => {
    setRfNodes((nds) =>
      nds.map((n) => {
        if (n.type === "equipment") {
          return {
            ...n,
            data: {
              ...n.data,
              streams,
              pending,
              allNodes,
              equipmentPorts,
              onConnect,
              onDisconnect,
            },
          };
        }
        return n;
      }),
    );
  }, [
    streams,
    pending,
    allNodes,
    equipmentPorts,
    onConnect,
    onDisconnect,
    setRfNodes,
  ]);

  useEffect(() => {
    const scopeStreams = streams.filter((s) => {
      return (s.source.nodeId && nodes.some(n => n.id === s.source.nodeId)) ||
             (s.target.nodeId && nodes.some(n => n.id === s.target.nodeId));
    });
    const newEdges = scopeStreams.map((s) => {
      const sourceInScope = s.source.nodeId && nodes.some(n => n.id === s.source.nodeId);
      const targetInScope = s.target.nodeId && nodes.some(n => n.id === s.target.nodeId);
      
      const srcId = sourceInScope ? s.source.nodeId : `ext_feed_${s.id}`;
      const tgtId = targetInScope ? s.target.nodeId : `ext_sink_${s.id}`;
      return {
        id: s.id,
        source: srcId,
        sourceHandle: sourceInScope ? s.source.portName : undefined,
        target: tgtId,
        targetHandle: targetInScope ? s.target.portName : undefined,
        type: "step",
        animated: true,
        style: { stroke: serviceStroke(s.service), strokeWidth: 2 },
      };
    });
    setRfEdges(newEdges);
  }, [streams, nodes, setRfEdges]);

  const onNodeDragStop = useCallback(
    (_: MouseEvent | TouchEvent, node: any) => {
      // React Flow has already snapped the position to the grid; persist it so it's
      // saved with the topology and survives reloads.
      onMove(node.id, { x: snap(node.position.x), y: snap(node.position.y) });
    },
    [onMove],
  );

  const onConnectFlow = useCallback(
    (params: any) => {
      if (params.source && params.target) {
        if (
          params.source.startsWith("ext_") ||
          params.target.startsWith("ext_")
        )
          return;
          
        // Infer service from the source port
        const sourceNode = allNodes.find(n => n.id === params.source);
        if (!sourceNode) return;
        const sourcePorts = equipmentPorts[sourceNode.level] || [];
        const portInfo = sourcePorts.find(p => p.port_name === params.sourceHandle);
        if (!portInfo) return;

        onConnect(
          params.source,
          params.sourceHandle,
          params.target,
          params.targetHandle,
          portInfo.service,
        );
      }
    },
    [onConnect, allNodes, equipmentPorts],
  );

  return (
    <div className="relative border border-border rounded-xl bg-surface/30 w-full h-[600px] overflow-hidden">
      <div className="absolute top-4 left-6 z-10 flex items-center gap-2">
        <h3 className="text-sm font-bold text-text-primary capitalize">
          {scope} Level Process Topology
        </h3>
        <Pill className="text-accent-blue bg-accent-blue/10 border-accent-blue/20">{scope}</Pill>
      </div>

      {nodes.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-xs text-text-tertiary italic">
            No active equipment in this network.
          </p>
        </div>
      ) : (
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnectFlow}
          nodeTypes={nodeTypes}
          snapToGrid
          snapGrid={[GRID, GRID]}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          className="bg-surface/10"
        >
          <Background gap={GRID} size={1} color="#e5e7eb" />
          <Controls className="bg-surface border-border text-text-secondary" />
        </ReactFlow>
      )}
    </div>
  );
}

export default function ConnectivityTab() {
  const { data, isLoading, error } = useAtomValue(topologyAtom);
  const hierarchy = useAtomValue(hierarchyAtom);
  const load = useSetAtom(loadTopologyAtom);
  const reorder = useSetAtom(reorderTopologyChainAtom);
  const connect = useSetAtom(connectTopologyAtom);
  const disconnect = useSetAtom(disconnectTopologyAtom);
  const rebuild = useSetAtom(rebuildTopologyAtom);
  const setLayout = useSetAtom(setTopologyLayoutAtom);
  const upload = useSetAtom(uploadTopologyAtom);
  const flushDraft = useSetAtom(flushDraftAtom);
  const loadSensors = useSetAtom(loadStreamSensorsAtom);
  const setSensor = useSetAtom(setStreamSensorAtom);
  const calcRes = useAtomValue(calcResolutionAtom);
  const loadCalcRes = useSetAtom(loadCalcResolutionAtom);
  const refreshSensorMapping = useSetAtom(loadSensorMappingAtom);
  const { data: sensorData } = useAtomValue(streamSensorsAtom);

  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedNodeInfo, setSelectedNodeInfo] = useState<any>(null);
  const [selectedScope, setSelectedScope] = useState<string>("");

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    await run(async () => {
      try {
        await upload(formData);
        setSaveMsg("Topology loaded successfully");
        setTimeout(() => setSaveMsg(null), 3000);
      } catch (err: any) {
        setSaveError(err.message || "Failed to load topology");
      }
    });
  };

  useEffect(() => {
    if (hierarchy.root) {
      load();
      loadSensors();
      loadCalcRes();
    }
  }, [hierarchy.root, load, loadSensors, loadCalcRes]);

  const run = async (fn: () => Promise<unknown>) => {
    setPending(true);
    try {
      await fn();
      await loadSensors();
      await loadCalcRes();
    } finally {
      setPending(false);
    }
  };

  const handleSetSensor = async (
    streamId: string,
    measurement: string,
    tag: string,
  ) => {
    await setSensor({ streamId, measurement, tag });
    await loadCalcRes();
    try {
      await refreshSensorMapping();
    } catch {
      /* mapping unavailable — ignore */
    }
  };

  const handleDisconnect = async (stream: UnifiedStream) => {
    setPending(true);
    await run(async () => {
      await disconnect(stream.id);
    });
    setPending(false);
  };

  const handleConnect = async (
    sourceNodeId: string,
    sourcePort: string,
    targetNodeId: string,
    targetPort: string,
    service: string,
  ) => {
    await run(async () => {
      await connect({
        sourceNodeId,
        sourcePort,
        targetNodeId,
        targetPort,
        service,
        measurements: ["temperature", "pressure", "mass_flowrate"],
      });
    });
  };

  if (!hierarchy.root) {
    return (
      <div className="py-16 text-center text-text-secondary text-sm">
        Build the hierarchy in{" "}
        <strong className="text-text-primary">System Config</strong> first —
        connectivity is derived from it.
      </div>
    );
  }

  const streams = data ? parseAllStreams(data) : [];
  const services = data
    ? Array.from(
        new Set([
          ...(data.chains || []).map((c: any) => c.service),
          ...(data.links || []).map((l: any) => l.service),
        ]),
      )
    : [];

  const allNodes = hierarchy.flatNodes.map((n) => ({
    id: n.id,
    name: n.element_name,
    level: n.level,
  }));

  // Scopes are the levels configured in the chains (from the pipeline config)
  const chainScopes = data?.chains?.map((c: any) => {
    const scopeNode = allNodes.find(n => n.id === c.scopeNodeId);
    return scopeNode?.level;
  }).filter(Boolean) as string[];
  
  const scopes = Array.from(new Set(chainScopes));
  
  // Set default scope on load
  useEffect(() => {
    if (scopes.length > 0 && (!selectedScope || !scopes.includes(selectedScope))) {
      setSelectedScope(scopes[0]);
    }
  }, [scopes, selectedScope]);

  const hasOutOfSyncStreams =
    data &&
    streams.some(
      (s) =>
        (s.source.nodeId && !allNodes.some((n) => n.id === s.source.nodeId)) ||
        (s.target.nodeId && !allNodes.some((n) => n.id === s.target.nodeId)),
    );

  return (
    <div className="max-w-full flex flex-col gap-6">
      <style>{`
        @keyframes flow {
          from {
            stroke-dashoffset: 20;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>

      <div className="flex items-start gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            Process Connectivity Diagram
          </h2>
          <p className="text-[12.5px] text-text-secondary mt-0.5 max-w-2xl">
            A graphical, port-based representation of the plant's flow systems.
            Hover over port dots to view details, disconnect active lines, or
            create new connections.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {data && (
            <span className="text-[11px] text-text-tertiary">
              {streams.length} streams
            </span>
          )}
          {saveMsg && (
            <span className="text-[11px] text-accent-green font-medium">
              {saveMsg}
            </span>
          )}
          <button
            onClick={() =>
              run(async () => {
                try {
                  await flushDraft(true); // force-save the instance draft (incl. topology)
                  setSaveMsg("Saved");
                  setTimeout(() => setSaveMsg(null), 3000);
                } catch (err: any) {
                  setSaveError(err.message || "Failed to save topology");
                }
              })
            }
            disabled={pending}
            className="inline-flex items-center justify-center w-8 h-8 border border-border rounded-[7px] bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
            title="Save connectivity to this instance's draft"
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path
                d="M1 2a1 1 0 0 1 1-1h7l2 2v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <rect
                x="3.5"
                y="1"
                width="4"
                height="3.5"
                rx="0.5"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <rect
                x="3"
                y="7"
                width="6"
                height="4"
                rx="0.5"
                stroke="currentColor"
                strokeWidth="1.3"
              />
            </svg>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".json"
          />
          <button
            onClick={handleUploadClick}
            disabled={pending}
            className="inline-flex items-center justify-center w-8 h-8 border border-border rounded-[7px] bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
            title="Upload Topology config JSON file"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </button>
          <button
            onClick={() => run(() => rebuild())}
            disabled={pending}
            className="px-3 py-1.5 border border-border rounded-md text-[12px] text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-40"
            title="Regenerate from the blueprint default (discards edits)"
          >
            Reset to default
          </button>
        </div>
      </div>

      {hasOutOfSyncStreams && (
        <div className="px-4 py-3 bg-accent-yellow/10 border border-accent-yellow/20 rounded-lg text-[12.5px] text-accent-yellow flex items-center gap-3">
          <span>
            ⚠️ Loaded connections refer to outdated equipment IDs (from a
            previous session or hierarchy rebuild).
          </span>
          <button
            onClick={() => run(() => rebuild())}
            className="ml-auto px-2.5 py-1 bg-accent-yellow/20 hover:bg-accent-yellow/30 text-accent-yellow font-bold rounded-lg transition-colors text-[11px]"
          >
            Heal & Reset Wires
          </button>
        </div>
      )}

      {(error || saveError) && (
        <div className="px-3 py-2 border border-accent-red rounded-md text-[12px] text-accent-red">
          {error || saveError}
        </div>
      )}

      {isLoading && !data && (
        <div className="py-12 text-center text-text-secondary text-sm">
          Loading flow networks…
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-6">
          {scopes.length > 0 && (
            <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider mr-2 shrink-0">
                Scopes:
              </span>
              {scopes.map((scope) => (
                <button
                  key={scope}
                  onClick={() => setSelectedScope(scope)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap",
                    selectedScope === scope
                      ? "bg-accent-blue/10 text-accent-blue font-semibold"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-hover",
                  )}
                >
                  {scope}
                </button>
              ))}
            </div>
          )}

          {selectedScope && (() => {
            // Find chains scoped to instances of the selected level
            const activeChains = (data?.chains || []).filter(c => {
              const scopeNode = allNodes.find(n => n.id === c.scopeNodeId);
              return scopeNode?.level === selectedScope;
            });
            const nodesInChains = activeChains.flatMap(c => c.nodes.map(n => n.id));

            // Include any nodes connected via standalone links to the chain nodes
            const standaloneNodes = streams
              .filter(s => !s.isChain)
              .filter(s => (s.source.nodeId && nodesInChains.includes(s.source.nodeId)) || (s.target.nodeId && nodesInChains.includes(s.target.nodeId)))
              .flatMap(s => [s.source.nodeId, s.target.nodeId].filter(Boolean));

            // Nodes to display: any elements explicitly in this scope's chains, plus their standalone link neighbors
            const nodeIdsToShow = new Set([
              ...nodesInChains,
              ...standaloneNodes
            ]);

            const nodes = allNodes.filter(n => nodeIdsToShow.has(n.id));

            return (
              <ScopeFlowNetwork
                key={selectedScope}
                scope={selectedScope}
                nodes={nodes}
                streams={streams}
                allNodes={allNodes}
                equipmentPorts={data.equipmentPorts}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                pending={pending}
                sensorData={sensorData}
                onSetSensor={handleSetSensor}
                onNodeDoubleClick={(n) => setSelectedNodeInfo(n)}
                layout={data.layout || {}}
                onMove={(id, pos) => setLayout({ [id]: pos })}
              />
            );
          })()}

          <div className="mt-6 pb-20 max-w-2xl">
            <CalcResolutionCard res={calcRes} />
          </div>
        </div>
      )}

      {selectedNodeInfo && (
        <div
          className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4"
          onClick={() => setSelectedNodeInfo(null)}
        >
          <div
            className="bg-surface border border-border rounded-xl shadow-2xl p-6 w-[550px] max-h-[85vh] flex flex-col gap-4 overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedNodeInfo(null)}
              className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary text-xl"
            >
              ✕
            </button>
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-text-primary">
                {selectedNodeInfo.name}
              </h2>
              <span className="text-xs text-text-secondary uppercase tracking-wider">
                {selectedNodeInfo.level}
              </span>
            </div>

            <div className="overflow-y-auto pr-2 flex flex-col gap-4">
              {["in", "out"].map((dir) => {
                const nodePorts =
                  data?.equipmentPorts[selectedNodeInfo.level] || [];
                const dirPorts = nodePorts.filter(
                  (p: any) => p.direction === dir || p.direction === "both",
                );

                if (dirPorts.length === 0) return null;

                return (
                  <div key={dir} className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                      {dir === "in" ? "Inlet Ports" : "Outlet Ports"}
                    </h3>
                    {dirPorts.map((port: any) => {
                      const active = streams.filter((s: any) => {
                        if (dir === "in")
                          return (
                            s.target.nodeId === selectedNodeInfo.id &&
                            s.target.portName === port.port_name
                          );
                        return (
                          s.source.nodeId === selectedNodeInfo.id &&
                          s.source.portName === port.port_name
                        );
                      });

                      return (
                        <div
                          key={port.port_name}
                          className="bg-surface-subtle border border-border rounded-lg p-3"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-mono text-[13px] font-bold text-text-primary">
                              {port.port_name}
                            </span>
                            <span className="text-[10px] text-text-tertiary uppercase">
                              {port.service}
                            </span>
                          </div>
                          {active.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {active.map((s: any) => {
                                const mapped = sensorData?.streams?.find(
                                  (st: any) => st.streamId === s.id,
                                );
                                const isExt =
                                  dir === "in"
                                    ? !s.source.nodeId
                                    : !s.target.nodeId;
                                const remoteName = isExt
                                  ? dir === "in"
                                    ? "External Feed"
                                    : "External Sink"
                                  : dir === "in"
                                    ? s.source.name
                                    : s.target.name;

                                return (
                                  <div
                                    key={s.id}
                                    className="bg-surface border border-border/60 rounded p-2 text-xs"
                                  >
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-1.5 text-text-secondary">
                                        <span>{dir === "in" ? "←" : "→"}</span>
                                        <span className="font-medium text-text-primary">
                                          {remoteName}
                                        </span>
                                      </div>
                                      <button
                                        disabled={pending}
                                        onClick={() => handleDisconnect(s)}
                                        className="text-text-secondary hover:text-accent-red transition-colors p-0.5"
                                        title="Disconnect stream"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    {mapped &&
                                      mapped.measurements.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-border/40 flex flex-wrap gap-2">
                                          {mapped.measurements.map((m: any) => (
                                            <div
                                              key={m.measurement}
                                              className="flex flex-col gap-1 w-[120px]"
                                            >
                                              <span className="text-[10px] text-text-tertiary capitalize">
                                                {m.measurement}
                                              </span>
                                              <TagInput
                                                value={m.tag}
                                                onCommit={(tag) =>
                                                  handleSetSensor(
                                                    s.id,
                                                    m.measurement,
                                                    tag,
                                                  )
                                                }
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-xs text-text-tertiary italic">
                              No active connections.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
