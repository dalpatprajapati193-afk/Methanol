import { atom } from "jotai";
import type { TopologyStateResponse, StreamSensorsResponse, CalcResolutionResponse } from "../api/Index";
import {
  getTopologyStateAction,
  reorderTopologyChainAction,
  connectTopologyAction,
  disconnectTopologyAction,
  rebuildTopologyAction,
  uploadTopologyAction,
  setTopologyLayoutAction,
  getStreamSensorsAction,
  setStreamSensorAction,
  getCalcResolutionAction,
} from "../actions/Index";
import { instanceIdAtom, dirtyAtom } from "./DashboardAtoms";

// ── State ────────────────────────────────────────────────────────────────────

export interface TopologyUiState {
  data: TopologyStateResponse | null;
  isLoading: boolean;
  error: string | null;
}

const defaultTopologyState: TopologyUiState = {
  data: null,
  isLoading: false,
  error: null,
};

export const topologyAtom = atom<TopologyUiState>(defaultTopologyState);

// ── Write atoms ──────────────────────────────────────────────────────────────
// Each mutation returns the full fresh TopologyStateResponse, so we simply replace
// `data` — the backend is the source of truth (no optimistic local divergence).

export const loadTopologyAtom = atom(null, async (get, set) => {
  const id = get(instanceIdAtom);
  set(topologyAtom, (prev) => ({ ...prev, isLoading: true, error: null }));
  try {
    const data = await getTopologyStateAction(id);
    set(topologyAtom, { data, isLoading: false, error: null });
  } catch (e) {
    set(topologyAtom, (prev) => ({ ...prev, isLoading: false, error: (e as Error).message }));
  }
});

export const reorderTopologyChainAtom = atom(
  null,
  async (get, set, args: { chainId: string; orderedNodes: { id: string; inPort: string; outPort: string }[] }) => {
    const id = get(instanceIdAtom);
    const data = await reorderTopologyChainAction(id, args.chainId, args.orderedNodes);
    set(topologyAtom, { data, isLoading: false, error: null });
    set(dirtyAtom, true); // connectivity edit → autosave to the instance draft
  },
);

export const connectTopologyAtom = atom(
  null,
  async (get, set, args: { sourceNodeId: string; sourcePort: string; targetNodeId: string; targetPort: string; service: string; measurements: string[] }) => {
    const id = get(instanceIdAtom);
    const data = await connectTopologyAction(id, args.sourceNodeId, args.sourcePort, args.targetNodeId, args.targetPort, args.service, args.measurements);
    set(topologyAtom, { data, isLoading: false, error: null });
    set(dirtyAtom, true); // connectivity edit → autosave to the instance draft
  },
);

export const disconnectTopologyAtom = atom(null, async (get, set, streamId: string) => {
  const id = get(instanceIdAtom);
  const data = await disconnectTopologyAction(id, streamId);
  set(topologyAtom, { data, isLoading: false, error: null });
  set(dirtyAtom, true); // connectivity edit → autosave to the instance draft
});

export const rebuildTopologyAtom = atom(null, async (get, set) => {
  const id = get(instanceIdAtom);
  set(topologyAtom, (prev) => ({ ...prev, isLoading: true, error: null }));
  const data = await rebuildTopologyAction(id);
  set(topologyAtom, { data, isLoading: false, error: null });
  set(dirtyAtom, true); // connectivity edit → autosave to the instance draft
});

// Persist node positions for the connectivity canvas. Fire-and-forget (positions already
// live in React Flow during the session); the backend stores them so Save includes the layout.
export const setTopologyLayoutAtom = atom(
  null,
  async (get, set, positions: Record<string, { x: number; y: number } | null>) => {
    const id = get(instanceIdAtom);
    try {
      const data = await setTopologyLayoutAction(id, positions);
      set(topologyAtom, (prev) => ({ ...prev, data }));
      set(dirtyAtom, true); // canvas layout travels with the topology in the instance draft
    } catch {
      /* layout persistence is best-effort */
    }
  },
);

export const uploadTopologyAtom = atom(null, async (get, set, formData: FormData) => {
  const id = get(instanceIdAtom);
  set(topologyAtom, (prev) => ({ ...prev, isLoading: true, error: null }));
  try {
    const data = await uploadTopologyAction(id, formData);
    set(topologyAtom, { data, isLoading: false, error: null });
    set(dirtyAtom, true); // imported graph → autosave into this instance's draft
  } catch (e) {
    set(topologyAtom, (prev) => ({ ...prev, isLoading: false, error: (e as Error).message }));
    throw e;
  }
});

// ── Stream sensor mapping (Phase E) ──────────────────────────────────────────

export interface StreamSensorsUiState {
  data: StreamSensorsResponse | null;
  isLoading: boolean;
}

export const streamSensorsAtom = atom<StreamSensorsUiState>({ data: null, isLoading: false });

export const loadStreamSensorsAtom = atom(null, async (get, set) => {
  const id = get(instanceIdAtom);
  set(streamSensorsAtom, (prev) => ({ ...prev, isLoading: true }));
  try {
    const data = await getStreamSensorsAction(id);
    set(streamSensorsAtom, { data, isLoading: false });
  } catch {
    set(streamSensorsAtom, (prev) => ({ ...prev, isLoading: false }));
  }
});

export const setStreamSensorAtom = atom(
  null,
  async (get, set, args: { streamId: string; measurement: string; tag: string }) => {
    const id = get(instanceIdAtom);
    const data = await setStreamSensorAction(id, args.streamId, args.measurement, args.tag);
    set(streamSensorsAtom, { data, isLoading: false });
  },
);

// ── Calc → stream resolution (Phase F) ───────────────────────────────────────

export const calcResolutionAtom = atom<CalcResolutionResponse | null>(null);

export const loadCalcResolutionAtom = atom(null, async (get, set) => {
  const id = get(instanceIdAtom);
  try {
    set(calcResolutionAtom, await getCalcResolutionAction(id));
  } catch {
    /* ignore */
  }
});
