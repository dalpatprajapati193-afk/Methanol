import type { CgcConfig } from '../types/config';

export function tagIsMapped(t: CgcConfig['raw_pi_tags'][number]): boolean {
  if (t.source_type === 'unavailable') return true;
  if (t.source_type === 'constant') return t.design_value !== null && t.design_value !== undefined;
  return !!t.pi_tag;
}

// CDT engine inputs (Cap Threshold, Bfw Temperature, Floor Temperature) are
// mapped like any other raw input, under these per-stage tag names.
export function cdtTagMapped(config: CgcConfig, name: string): boolean {
  const tag = config.raw_pi_tags.find(t => t.name === name);
  return !!tag && tagIsMapped(tag);
}
