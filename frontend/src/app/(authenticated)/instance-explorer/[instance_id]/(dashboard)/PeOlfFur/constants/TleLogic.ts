import type { TleFields } from '../store/FmsAtoms';

/**
 * V418 — TLE "reference pressure tag" feature.
 *
 * Returns the set of TLE section keys that are structurally hidden (rendered
 * absent in the editor table AND exported as 0/EMPTY) because the reference
 * pressure tag sits upstream of them. Sections that don't exist at all
 * (STLE/TTLE absent) are handled separately by tleExistsMap.
 *
 * pressTagAt: 'PTLE_OUTLET' | 'STLE_OUTLET' | 'TTLE_OUTLET' | 'DOWNSTREAM' (default)
 *
 * Shared by TleEditor (UI) and ExportUtils (vars) so they can never disagree.
 */
export function tleDroppedSections(f: TleFields): Set<string> {
  const dropped = new Set<string>();
  if (!f.designData) return dropped;
  const ptAt = f.pressTagAt || 'DOWNSTREAM';

  // Case 1: PTLE only — nothing can be dropped (only PTLE exists)
  if (f.stle !== 1) return dropped;

  // Case 2: PTLE + STLE
  if (f.stle === 1 && f.ttle !== 1) {
    if (ptAt === 'PTLE_OUTLET') {
      // Tag at PTLE outlet → drop PTLE→STLE piping and STLE
      dropped.add('PTLE_STLE_PIPING');
      dropped.add('STLE');
    }
    // STLE_OUTLET or DOWNSTREAM → table shows all (PTLE, piping, STLE)
    return dropped;
  }

  // Case 3: PTLE + STLE + TTLE
  if (ptAt === 'PTLE_OUTLET') {
    // Keep only PTLE
    dropped.add('PTLE_STLE_PIPING');
    dropped.add('STLE');
    dropped.add('STLE_TTLE_PIPING');
    dropped.add('TTLE');
  } else if (ptAt === 'STLE_OUTLET') {
    // Keep PTLE, PTLE→STLE piping, STLE
    dropped.add('STLE_TTLE_PIPING');
    dropped.add('TTLE');
  }
  // TTLE_OUTLET or DOWNSTREAM → table shows all five sections
  return dropped;
}

/** Options for the press-tag dropdown, per TLE structure case. Mirrors V418 tlePressTagQuestionHTML. */
export function tlePressTagOptions(f: TleFields): { v: string; l: string }[] {
  if (f.stle !== 1) {
    return [
      { v: 'PTLE_OUTLET', l: 'PTLE Outlet' },
      { v: 'DOWNSTREAM',  l: 'Downstream' },
    ];
  }
  if (f.ttle !== 1) {
    return [
      { v: 'PTLE_OUTLET', l: 'PTLE Outlet' },
      { v: 'STLE_OUTLET', l: 'STLE Outlet' },
      { v: 'DOWNSTREAM',  l: 'Downstream' },
    ];
  }
  return [
    { v: 'PTLE_OUTLET', l: 'PTLE Outlet' },
    { v: 'STLE_OUTLET', l: 'STLE Outlet' },
    { v: 'TTLE_OUTLET', l: 'TTLE Outlet' },
    { v: 'DOWNSTREAM',  l: 'Downstream' },
  ];
}
