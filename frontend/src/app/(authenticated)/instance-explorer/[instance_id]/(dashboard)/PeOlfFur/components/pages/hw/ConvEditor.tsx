'use client';
import { useState, type ReactNode } from 'react';
import { useAtom } from 'jotai';
import { ConvFields, TleFields, convTabAtom, CONV_TAB_TITLES } from '../../../store/FmsAtoms';
import { CB_BANKS, CB_DRAFT_TYPES, CB_DRAFT_MAX, bankDisplayCode } from '../../../constants/Components';
import TleEditor from './TleEditor';
import ConvBankSvg from './ConvBankSvg';
import SegYesNo from './SegYesNo';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import styles from '../../../Style.module.css';
import { TEXT, TABLE, SEGMENT, FIELD, BUTTON, MODAL } from '../../../theme/Index';
import { entryStatus, saveTextCls, type SaveStatus } from '../../../constants/SaveState';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

interface Props {
  fields: ConvFields;
  /** Confirmed / draft snapshots of THIS template's conv fields — drive the
   *  per-entry save-state indicator. null when the template is new (not yet in the
   *  snapshot): with snapshotsActive its entries then read as unsaved edits. */
  confirmedFields?: ConvFields | null;
  draftFields?: ConvFields | null;
  /** True when a confirmed/draft snapshot exists at all (globally). Gates the
   *  indicator so a brand-new setup shows no markers, but a NEW template inside an
   *  existing setup marks all its entries as unsaved. */
  snapshotsActive?: boolean;
  tleFields: TleFields;
  onChange: (f: ConvFields) => void;
  onTleChange: (f: TleFields) => void;
  satDsgValue: 0 | 1 | null;
  activeFeeds: { key: string }[];
  mixedFeedOp: 0 | 1;
  /** Rendered inside the sticky header above the pill tabs so it stays pinned too. */
  furnaceBar?: ReactNode;
}

// ── Bank-type model (derived from CB_BANKS so labels/codes stay the single source) ──
// A "type" is a coil family the user picks once (APH) or twice (FPH/ECO/HPSSH/HTC).
// The instance suffix 1/2 is NOT chosen by the user — it is derived from top→bottom
// position by renumber() below. CB_BANKS order is preserved (top-zone families first).
interface BankType { prefix: string; label: string; zone: 'top' | 'bot'; max: number }
const CB_TYPES: BankType[] = (() => {
  const map = new Map<string, BankType>();
  for (const b of CB_BANKS) {
    const prefix = b.code.replace(/[12]$/, '');
    const existing = map.get(prefix);
    if (existing) existing.max += 1;
    else map.set(prefix, { prefix, label: b.label.replace(/ [12]$/, ''), zone: b.zone, max: 1 });
  }
  return Array.from(map.values());
})();

function prefixOf(code: string): string { return code.replace(/[12]$/, ''); }
function zoneOfCode(code: string): 'top' | 'bot' | null {
  if (!code) return null;
  return CB_BANKS.find(x => x.code === code)?.zone ?? null;
}

// Renumber paired families top→bottom so the upper instance is always "1", the
// lower "2" (single-instance families and APH keep the bare prefix, e.g. 'ECO1' for
// a lone ECO, 'APH' for the air preheater).
function renumber(banks: string[]): string[] {
  const counters: Record<string, number> = {};
  return banks.map(code => {
    if (!code) return code;
    const p = prefixOf(code);
    const type = CB_TYPES.find(t => t.prefix === p);
    if (!type || type.max === 1) return p;          // APH stays 'APH'
    counters[p] = (counters[p] || 0) + 1;
    return p + counters[p];
  });
}

// Canonical layout enforced after EVERY mutation: APH first, then upper-zone banks,
// then lower-zone banks, then blanks — each group keeping its existing relative order
// (so manual drag ordering within a zone is preserved) — then renumbered. This single
// pass implements the auto-snap rules: an upper code floats up to the last-upper slot,
// a lower code stays put (blanks are already pinned to the bottom), APH pins to the top.
function canonical(banks: string[]): string[] {
  const aph    = banks.filter(c => c === 'APH');
  const uppers = banks.filter(c => c && c !== 'APH' && zoneOfCode(c) === 'top');
  const lowers = banks.filter(c => c && zoneOfCode(c) === 'bot');
  const blanks = banks.filter(c => !c);
  return renumber([...aph, ...uppers, ...lowers, ...blanks]);
}

export function cbIsComplete(f: ConvFields): boolean {
  if (!f.draft || !f.numBanks || f.banks.length !== parseInt(f.numBanks)) return false;
  if (!f.banks.every(b => b !== '')) return false;
  return f.banks.includes('HTC1');
}

export default function ConvEditor({ fields, confirmedFields = null, draftFields = null, snapshotsActive = false, tleFields, onChange, onTleChange, satDsgValue, activeFeeds, mixedFeedOp, furnaceBar }: Props) {
  const maxBanks = fields.draft ? CB_DRAFT_MAX[fields.draft] || 9 : 0;
  const numBanks = parseInt(fields.numBanks) || 0;

  // Per-entry save-state: compare each control's live value to the snapshots. Active
  // whenever ANY snapshot exists, so a new template (fields absent from the snapshot)
  // reads as all-unsaved rather than showing no markers.
  const cmpActive = snapshotsActive;
  const statusOf = (cur: unknown, pick: (f: ConvFields) => unknown): SaveStatus =>
    entryStatus(
      cur,
      confirmedFields ? pick(confirmedFields) : undefined,
      draftFields ? pick(draftFields) : undefined,
      cmpActive,
    );

  // Pill-tab state — Convection Section vs Transfer Line Exchangers. Lifted to a shared
  // atom so WizardNav's Back/Next can step through it too.
  const [tab, setTab] = useAtom(convTabAtom);

  // Drag-reorder state (zone-constrained — mirrors the component reorder UX)
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  // "Which banks to keep" dialog, shown when reducing the count drops real banks
  const [keepDialog, setKeepDialog] = useState<{ targetCount: number; current: string[]; selected: Set<number> } | null>(null);

  function setDraft(d: string) {
    if (d === fields.draft) return;
    const max = CB_DRAFT_MAX[d] || 9;
    let banks = [...fields.banks];
    // Strip APH FIRST (Natural/Induced have no air preheater) so the trim below only
    // ever drops the intended bank, never a configured coil in its place.
    if (d === 'Natural' || d === 'Induced') banks = banks.filter(b => b !== 'APH');

    const nRaw = parseInt(fields.numBanks);
    if (isNaN(nRaw)) { onChange({ ...fields, draft: d, banks: canonical(banks) }); return; }
    const n = Math.min(nRaw, max);

    banks = canonical(banks);                       // filled partitioned, blanks at end
    if (banks.length > n) {
      const filled = banks.filter(b => b);
      banks = filled.length > n ? filled.slice(0, n) : filled;
    }
    while (banks.length < n) banks.push('');
    banks = canonical(banks);

    const bothHpssh = banks.includes('HPSSH1') && banks.includes('HPSSH2');
    onChange({ ...fields, draft: d, numBanks: String(n), banks, attemperator: bothHpssh ? fields.attemperator : 0 });
  }

  function setNumBanks(val: string) {
    const max = CB_DRAFT_MAX[fields.draft] || 0;
    const n = parseInt(val);
    // Out-of-range: keep the raw value, don't resize (v411 cbSetNumBanks behaviour)
    if (isNaN(n) || n < 3 || n > max) { onChange({ ...fields, numBanks: val }); return; }

    if (n < fields.banks.length) {
      const filled = fields.banks.filter(b => b);
      if (filled.length > n) {
        // Reducing drops real banks — ask which to keep (exactly n)
        setKeepDialog({ targetCount: n, current: filled, selected: new Set() });
        return;
      }
      // Only blanks need dropping — keep all filled, pad to n
      const banks = canonical(filled);
      while (banks.length < n) banks.push('');
      onChange({ ...fields, numBanks: String(n), banks });
      return;
    }

    // Increase — append blank bank(s) at the bottom
    const banks = [...fields.banks];
    while (banks.length < n) banks.push('');
    onChange({ ...fields, numBanks: String(n), banks: canonical(banks) });
  }

  function confirmKeep() {
    if (!keepDialog) return;
    const { targetCount, current, selected } = keepDialog;
    if (selected.size !== targetCount) return;
    const kept = current.filter((_, i) => selected.has(i));
    onChange({ ...fields, numBanks: String(targetCount), banks: canonical(kept) });
    setKeepDialog(null);
  }

  // Assign a coil family to a bank. The exact 1/2 suffix is irrelevant here — canonical()
  // repositions and renumbers so the array invariant holds afterwards.
  function setBank(idx: number, prefix: string) {
    const banks = [...fields.banks];
    if (!prefix) banks[idx] = '';
    else {
      const type = CB_TYPES.find(t => t.prefix === prefix)!;
      banks[idx] = type.max === 1 ? prefix : prefix + '1';
    }
    const next = canonical(banks);
    const hasFPH1 = next.includes('FPH1'), hasFPH2 = next.includes('FPH2');
    const hasHPSSH1 = next.includes('HPSSH1'), hasHPSSH2 = next.includes('HPSSH2');
    onChange({
      ...fields, banks: next,
      attemperator: hasHPSSH1 && hasHPSSH2 ? fields.attemperator : 0,
      fphSeries: hasFPH1 && hasFPH2 ? fields.fphSeries : 1,
    });
  }

  function setAlias(code: string, val: string) {
    // Only store a REAL alias. A blank name, or one equal to the bank code, means
    // "no custom name" — so remove the key rather than storing `code: code`. That
    // keeps bankAliases at its baseline shape when a name is reverted/cleared, so the
    // per-page SAVE (which diffs the whole object) clears in step with the field's own
    // fade (which already treats `alias ?? code` as no-alias). Leaving a redundant
    // `code: code` entry would keep SAVE stuck "dirty" after a revert.
    const v = val.trim();
    const bankAliases = { ...(fields.bankAliases || {}) };
    // "No custom name" = blank, or matches the code's default label (canonical code OR
    // its display form, e.g. a solo "FPH"). In those cases drop the key so it doesn't
    // count as an edit.
    if (!v || v === code || v === bankDisplayCode(code, fields.banks)) delete bankAliases[code];
    else bankAliases[code] = v;
    onChange({ ...fields, bankAliases });
  }

  // Dropdown lists each coil family once; it drops out when used to its max (APH once,
  // others twice), and APH is hidden for Natural/Induced. Zone-position gating is gone —
  // canonical() keeps the upper/lower split, so it is no longer needed.
  function getTypeOptions(idx: number): BankType[] {
    const counts: Record<string, number> = {};
    fields.banks.forEach((c, i) => { if (i !== idx && c) { const p = prefixOf(c); counts[p] = (counts[p] || 0) + 1; } });
    const selPrefix = fields.banks[idx] ? prefixOf(fields.banks[idx]) : '';
    return CB_TYPES.filter(t => {
      if (t.prefix === selPrefix) return true;
      if ((counts[t.prefix] || 0) >= t.max) return false;
      if (t.prefix === 'APH' && (fields.draft === 'Natural' || fields.draft === 'Induced')) return false;
      return true;
    });
  }

  // ── Drag reorder (within a zone only) ──
  function onDragStartRow(idx: number) { setDragSrc(idx); }
  function onDragOverRow(e: React.DragEvent, idx: number) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(idx); }
  function onDragLeaveRow() { setDragOver(null); }
  function onDragEndRow() { setDragSrc(null); setDragOver(null); }
  function onDropRow(e: React.DragEvent, target: number) {
    e.preventDefault();
    const src = dragSrc;
    setDragSrc(null); setDragOver(null);
    if (src === null || src === target) return;
    const sc = fields.banks[src], tc = fields.banks[target];
    // Only real banks, not APH, and only within the same zone (no crossing the boundary)
    if (!sc || sc === 'APH' || !tc) return;
    if (zoneOfCode(sc) !== zoneOfCode(tc)) return;
    const banks = [...fields.banks];
    const [moved] = banks.splice(src, 1);
    banks.splice(target, 0, moved);
    onChange({ ...fields, banks: canonical(banks) });
  }

  const hasFPH1 = fields.banks.includes('FPH1'), hasFPH2 = fields.banks.includes('FPH2');
  const hasFPHBoth = hasFPH1 && hasFPH2;
  const hasHPSSH1 = fields.banks.includes('HPSSH1'), hasHPSSH2 = fields.banks.includes('HPSSH2');
  const hasAtmpBoth = hasHPSSH1 && hasHPSSH2;

  // Parallel-FPH lock. Parallel is disallowed (forced to series) only when there's no
  // dilution steam AND either: (1) a single active feed header, or (2) multiple feeds but
  // no mixed-feed operation declared in the feed selector. With DSG present, or multi-feed
  // WITH mixed-feed operation, parallel is allowed.
  const nActiveFeeds = activeFeeds.length;
  const dsgNo = satDsgValue === 0;
  const parallelLocked = dsgNo && (nActiveFeeds <= 1 || mixedFeedOp !== 1);

  const allBanksFilled = numBanks >= 3 && fields.banks.length === numBanks && fields.banks.every(b => b !== '');
  const htc1Missing = allBanksFilled && !fields.banks.includes('HTC1');

  // TLE tab stays locked until the convection banks (incl. HTC 1) are complete —
  // same gate as the old inline TleEditor overlay, now lifted to the tab. If the
  // user breaks the conv config while on the TLE tab, fall back to Convection.
  const tleLocked = !cbIsComplete(fields);
  const effectiveTab: 'conv' | 'tle' = tab === 'tle' && tleLocked ? 'conv' : tab;

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky header — the furnace-assignment bar and the pill tabs are pinned together
          as ONE block to the top of the scroll area (the editor's overflow-y-auto
          container) while the section content scrolls beneath it. The scroll container
          carries no top padding, so this band sits flush at the scrollport top (pt-4
          supplies its own spacing) and its opaque bg-background covers everything that
          scrolls beneath — no gap for content to peek through. -mx-4 makes it full-bleed. */}
      <div className="sticky top-0 z-20 -mx-4 px-4 pt-4 pb-2 bg-background">
        {furnaceBar}
        <div className="flex justify-center">
        <div className={SEGMENT.group}>
          <button
            onClick={() => setTab('conv')}
            className={cn(styles.mono, SEGMENT.item,
              'min-w-[200px] px-6 py-2 text-[11px]',
              effectiveTab === 'conv' ? SEGMENT.active : SEGMENT.inactive)}
          >
            {CONV_TAB_TITLES.conv}
          </button>
          <button
            onClick={() => { if (!tleLocked) setTab('tle'); }}
            disabled={tleLocked}
            title={tleLocked ? 'Assign all banks (incl. HTC 1) to unlock' : undefined}
            className={cn(styles.mono, SEGMENT.item,
              'min-w-[200px] px-6 py-2 text-[11px] inline-flex items-center justify-center gap-1.5',
              effectiveTab === 'tle' ? SEGMENT.active
                : tleLocked ? 'text-text-secondary opacity-50 cursor-not-allowed'
                : SEGMENT.inactive)}
          >
            {tleLocked && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            )}
            {CONV_TAB_TITLES.tle}
          </button>
        </div>
        </div>
      </div>

      {/* ── CONVECTION SECTION tab ──────────────────────────────────────────── */}
      {effectiveTab === 'conv' && (
      <>
      {/* LEFT: a bordered table — Draft type & Number of banks as the top two rows,
          then the bank-assignment table (Bank Number / Bank Type / Bank Name), then the
          Attemperator / FPH-series questions as the final rows. RIGHT: the SVG diagram,
          kept to the right of the table (no wrap). */}
      <div className="flex items-start gap-4">
          {/* LEFT — setup + bank table */}
          <div className={cn(TABLE.wrap, 'rounded-md flex-shrink-0 w-[460px]')}>
            <table className="w-full border-collapse">
              <tbody className={TABLE.divide}>
                {/* Top row 1 — Draft type */}
                <tr className={TABLE.row}>
                  <td colSpan={3} className="px-3.5 py-2.5">
                    <div className="flex items-center justify-between gap-4">
                      <span className={cn(TEXT.tableRowLabel, 'text-text-primary')}>Draft type</span>
                      <select
                        value={fields.draft}
                        onChange={e => setDraft(e.target.value)}
                        className={cn(TEXT.tableCell, FIELD.input, styles.fiSel, 'w-52 py-1.5',
                          !fields.draft && 'text-text-secondary',
                          saveTextCls(statusOf(fields.draft, f => f.draft)))}
                      >
                        <option value="">— Select draft —</option>
                        {CB_DRAFT_TYPES.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>

                {/* Top row 2 — Number of banks */}
                {fields.draft && (
                  <tr className={TABLE.row}>
                    <td colSpan={3} className="px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-4">
                        <span className={cn(TEXT.tableRowLabel, 'text-text-primary')}>
                          Number of banks <span className={TEXT.annotation}>(min 3, max {maxBanks})</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min={3} max={maxBanks}
                            value={fields.numBanks}
                            onChange={e => setNumBanks(e.target.value)}
                            className={cn(TEXT.tableCell, FIELD.input, styles.numInput, 'w-20 py-1.5 text-center',
                              saveTextCls(statusOf(fields.numBanks, f => f.numBanks)))}
                          />
                          <span className={TEXT.annotation}>banks</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Bank-assignment table header + rows */}
                {numBanks >= 3 && (
                  <tr className={TABLE.header}>
                    <th className={cn(TEXT.tableHeader, 'px-3 py-2 text-center w-24')}>Bank Number</th>
                    <th className={cn(TEXT.tableHeader, 'px-3 py-2 text-left')}>Bank Type</th>
                    <th className={cn(TEXT.tableHeader, 'px-3 py-2 text-left w-28')}>Bank Name</th>
                  </tr>
                )}

                {numBanks >= 3 && htc1Missing && (
                  <tr>
                    <td colSpan={3} className="px-3.5 py-2">
                      <div className={cn(TEXT.caption, 'px-3 py-2 text-accent-orange bg-accent-orange/15 border border-accent-orange rounded leading-relaxed')}>
                        ⚠ HTC 1 is required — template is not complete until HTC 1 is assigned.
                      </div>
                    </td>
                  </tr>
                )}

                {numBanks >= 3 && Array.from({ length: numBanks }, (_, i) => {
                  const sel = fields.banks[i] || '';
                  const selPrefix = sel ? prefixOf(sel) : '';
                  const opts = getTypeOptions(i);
                  const isAph = sel === 'APH';
                  const canDrag = !!sel && !isAph;
                  return (
                    <tr key={i}
                        draggable={canDrag}
                        onDragStart={canDrag ? () => onDragStartRow(i) : undefined}
                        onDragOver={e => onDragOverRow(e, i)}
                        onDragLeave={onDragLeaveRow}
                        onDrop={e => onDropRow(e, i)}
                        onDragEnd={onDragEndRow}
                        className={cn(TABLE.row,
                          dragOver === i && dragSrc !== i && 'outline outline-1 outline-accent-blue bg-accent-blue/10',
                          dragSrc === i && 'opacity-40')}>
                      {/* Bank Number (+ drag handle) */}
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={clsx(styles.dragHandle, 'text-[10px]', canDrag ? 'cursor-grab text-text-secondary' : 'opacity-0')}
                                title={canDrag ? 'Drag to reorder' : isAph ? 'APH is fixed at the top' : ''}>⠿</span>
                          <span className={cn(TEXT.annotation)}>{i + 1}</span>
                        </div>
                      </td>
                      {/* Bank Type */}
                      <td className="px-2 py-2">
                        <select
                          value={selPrefix}
                          onChange={e => setBank(i, e.target.value)}
                          className={cn(TEXT.tableCell, FIELD.input, styles.fiSel, 'w-full py-1.5',
                            !sel && 'text-text-secondary',
                            saveTextCls(statusOf(fields.banks[i], f => f.banks[i])))}
                        >
                          <option value="">— Select —</option>
                          {opts.map(t => (
                            <option key={t.prefix} value={t.prefix}>{t.label}</option>
                          ))}
                        </select>
                      </td>
                      {/* Bank Name (alias) */}
                      <td className="px-2 py-2">
                        {sel ? (
                          <input
                            key={sel + '|' + bankDisplayCode(sel, fields.banks)}
                            type="text"
                            defaultValue={fields.bankAliases?.[sel] || bankDisplayCode(sel, fields.banks)}
                            placeholder={bankDisplayCode(sel, fields.banks)}
                            title={`Custom name for ${sel} (shown in the diagram and variables)`}
                            onBlur={e => setAlias(sel, e.target.value)}
                            onFocus={e => e.target.select()}
                            className={cn(TEXT.annotation, 'w-full bg-transparent border-0 border-b border-accent-yellow rounded-none px-1 py-0.5 text-accent-yellow text-center outline-none focus:border-accent-blue focus:text-text-primary',
                              saveTextCls(statusOf(fields.bankAliases?.[sel] ?? sel, f => f.bankAliases?.[sel] ?? sel)))}
                          />
                        ) : (
                          <span className={cn(TEXT.annotation, 'block text-center text-text-secondary')}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Attemperator / FPH-series questions — final rows of the same table.
                    Only shown when the relevant paired banks exist; state for the hidden
                    ones is still kept (setBank forces attemperator=0 / fphSeries=1). */}
                {numBanks >= 3 && hasAtmpBoth && (
                  <tr className={TABLE.row}>
                    <td colSpan={3} className="px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-4">
                        <span className={cn(TEXT.tableRowLabel, 'text-text-primary')}>Attemperator installed?</span>
                        <SegYesNo value={fields.attemperator}
                          activeCls={saveTextCls(statusOf(fields.attemperator, f => f.attemperator))}
                          onYes={() => onChange({ ...fields, attemperator: 1 })}
                          onNo={() => onChange({ ...fields, attemperator: 0 })} />
                      </div>
                    </td>
                  </tr>
                )}
                {numBanks >= 3 && hasFPHBoth && (
                  <tr className={TABLE.row}>
                    <td colSpan={3} className="px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-4">
                        <span className={cn(TEXT.tableRowLabel, 'text-text-primary')}>FPH 1 and FPH 2 in series?</span>
                        <SegYesNo value={fields.fphSeries} locked={parallelLocked}
                          activeCls={saveTextCls(statusOf(fields.fphSeries, f => f.fphSeries))}
                          onYes={() => onChange({ ...fields, fphSeries: 1 })}
                          onNo={() => onChange({ ...fields, fphSeries: 0 })} />
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* RIGHT — SVG engineering diagram, kept to the right of the table */}
          {numBanks >= 3 && (
            <div className="flex-shrink-0">
              <ConvBankSvg fields={fields} tleFields={tleFields} numBanks={numBanks} satDsgValue={satDsgValue} />
            </div>
          )}
        </div>
      </>
      )}

      {/* ── TRANSFER LINE EXCHANGERS tab — tables first, shared SVG below ────── */}
      {effectiveTab === 'tle' && (
        <div className="flex flex-col gap-4">
          {/* Tab gates access (locked until conv is complete), so the editor itself
              never needs its own disabled overlay here. */}
          <TleEditor fields={tleFields} onChange={onTleChange} convFields={fields} disabled={false} />

          {/* Shared engineering diagram — same component/props as the Convection tab,
              so any TLE edit (cold fluid / orientation) updates both views. */}
          {numBanks >= 3 && (
            <div className="flex justify-center border-t border-border pt-4">
              <ConvBankSvg fields={fields} tleFields={tleFields} numBanks={numBanks} satDsgValue={satDsgValue} />
            </div>
          )}
        </div>
      )}

      {/* Reduce-count "which banks to keep" dialog */}
      {keepDialog && (() => {
        const { targetCount, current, selected } = keepDialog;
        const canConfirm = selected.size === targetCount;
        return (
          <div className={cn(MODAL.overlay, 'fixed z-[99999]')}>
            <div className={cn(MODAL.panel, 'p-6 min-w-[380px] max-w-[500px] max-h-[80vh] gap-3')}>
              <div className={cn(TEXT.cardTitle, 'uppercase')}>Select banks to keep</div>
              <div className={cn(TEXT.caption, 'leading-relaxed')}>
                Reducing to <b className="text-text-primary">{targetCount}</b> bank(s). Select exactly <b className="text-accent-blue">{targetCount}</b> bank(s) to keep, then confirm.
              </div>
              <div className="overflow-y-auto flex flex-col gap-1 max-h-80 pr-1">
                {current.map((code, i) => {
                  const checked = selected.has(i);
                  return (
                    <label key={i} className={cn(TEXT.tableCell, 'flex items-center gap-2.5 px-2.5 py-1.5 rounded border cursor-pointer select-none',
                      checked ? 'border-accent-blue bg-accent-blue/10' : 'border-border bg-surface-hover')}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const s = new Set(selected);
                          if (s.has(i)) s.delete(i);
                          else { if (s.size >= targetCount) return; s.add(i); }
                          setKeepDialog({ ...keepDialog, selected: s });
                        }}
                      />
                      {fields.bankAliases?.[code] || bankDisplayCode(code, fields.banks)}
                    </label>
                  );
                })}
              </div>
              <div className={cn(TEXT.annotation, canConfirm && 'text-accent-green')}>{selected.size} / {targetCount} selected</div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setKeepDialog(null)}
                        className={cn(TEXT.button, BUTTON.ghost)}>Cancel</button>
                <button onClick={confirmKeep} disabled={!canConfirm}
                        className={cn(TEXT.button, 'px-3 py-1.5 rounded border transition',
                          canConfirm ? 'bg-accent-blue border-accent-blue text-white' : 'bg-surface border-border text-text-secondary opacity-50 cursor-not-allowed')}>Keep {targetCount}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
