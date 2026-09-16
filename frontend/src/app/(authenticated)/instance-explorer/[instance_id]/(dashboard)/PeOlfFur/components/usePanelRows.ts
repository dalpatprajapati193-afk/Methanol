'use client';
import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { fmsStateAtom } from '../store/FmsAtoms';
import { fuelStateAtom } from '../store/FuelAtoms';
import { serializeFmsState } from '../constants/ExportUtils';
import type { SvRow } from './SvPanel';

type SectionMatch = string | string[] | ((section: string) => boolean);

function toPredicate(match: SectionMatch): (section: string) => boolean {
  if (typeof match === 'function') return match;
  if (Array.isArray(match)) {
    const set = new Set(match);
    return (s: string) => set.has(s);
  }
  return (s: string) => s === match;
}

/**
 * Single source of truth for State Variable panels.
 *
 * Derives panel rows from the SAME `serializeFmsState()` the dev-export uses,
 * filtered to the page's section(s). This guarantees that every panel variable
 * exists in the export sheet, and every export variable for that section appears
 * in the panel — they can never drift apart.
 *
 * @param match  section name, list of names, or predicate over the export `section` field
 */
export function usePanelRows(match: SectionMatch): SvRow[] {
  const fms = useAtomValue(fmsStateAtom);
  const fuel = useAtomValue(fuelStateAtom);

  return useMemo(() => {
    const pred = toPredicate(match);
    const { fmsRows } = serializeFmsState(fms, fuel);
    return fmsRows
      .filter(r => pred(r.section))
      .map(r => ({ key: r.variable, value: r.value }));
    // `match` may be an inline array/fn; callers pass stable section strings,
    // and the heavy work is keyed on fms/fuel which only change on edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fms, fuel, typeof match === 'function' ? match : JSON.stringify(match)]);
}
