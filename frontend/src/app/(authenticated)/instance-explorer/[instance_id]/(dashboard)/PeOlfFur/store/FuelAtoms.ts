import { atom } from 'jotai';

export interface FuelState {
  fuelCount: number;
  fuelComponents: string[];
  fuelConfirmed: boolean;
  pctFuel: number;
  visitedFuel: boolean;
  fuelHeaderCount: number;
}

export const defaultFuelState = (): FuelState => ({
  fuelCount: 0,
  fuelComponents: [],
  fuelConfirmed: false,
  pctFuel: 0,
  visitedFuel: false,
  fuelHeaderCount: 1,
});

// In-memory only — state resets on page refresh (no localStorage persistence).
export const fuelStateAtom = atom<FuelState>(defaultFuelState());

// Confirmed / draft SNAPSHOTS of the fuel state — feed the per-entry save-state
// indicator (a control compares its value to these). Set at the same sync points
// as the FMS snapshots (auto-fill, Save, Confirm, Revert). null = no snapshot yet.
export const confirmedFuelAtom = atom<FuelState | null>(null);
export const draftFuelAtom = atom<FuelState | null>(null);
