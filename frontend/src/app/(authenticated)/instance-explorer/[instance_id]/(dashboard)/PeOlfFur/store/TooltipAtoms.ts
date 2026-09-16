import { atom } from "jotai";
import type { TooltipMap } from "../constants/TooltipRegistry";

/**
 * id → tooltip copy, loaded once on app open from Tooltips.xlsx
 * (FurnaceApp.tsx → readTooltips). <InfoTip id="..."> reads this map; an id
 * with no entry (or blank text) renders nothing.
 */
export const tooltipsAtom = atom<TooltipMap>({});
