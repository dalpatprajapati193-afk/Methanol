'use client';
import { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { fuelStateAtom } from '../../store/FuelAtoms';
import { useFuelSave } from '../../constants/SaveState';
import { FUEL_MASTER_COMPONENTS } from '../../constants/Components';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import styles from '../../Style.module.css';
import { TEXT, TABLE, FIELD } from '../../theme/Index';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

// Fuel Components — right-hand column of the merged "Components" tab in the
// Feed & Fuel Management System page. Markup mirrors the Feed column so the two
// segments are visually identical. Variable population is unchanged; this is a
// structural relocation only.
export default function FuelComponentsSection() {
  const [fuel, setFuel] = useAtom(fuelStateAtom);
  const save = useFuelSave();
  const [countInput, setCountInput] = useState(fuel.fuelCount > 0 ? String(fuel.fuelCount) : '');
  const [headerInput, setHeaderInput] = useState(String(fuel.fuelHeaderCount));
  const [countErr, setCountErr] = useState('');

  const [dragSrcIdx, setDragSrcIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // V411 buildFuelCompPage: mark visited + auto-populate first 4 components on
  // first view (fuelCount===0). The former page set fuelConfirmed/pctFuel via a
  // Confirm button; with the button gone, viewing the section is the confirm.
  useEffect(() => {
    setFuel(prev => {
      const patch: Partial<typeof prev> = { visitedFuel: true, fuelConfirmed: true, pctFuel: 100 };
      if (prev.fuelCount === 0) {
        const defaultComps = Array.from(FUEL_MASTER_COMPONENTS).slice(0, 4);
        patch.fuelCount = 4;
        patch.fuelComponents = defaultComps;
      }
      return { ...prev, ...patch };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync countInput when fuelCount changes externally (e.g. auto-populate)
  useEffect(() => {
    if (fuel.fuelCount > 0 && countInput === '') setCountInput(String(fuel.fuelCount));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuel.fuelCount]);

  const MAX = FUEL_MASTER_COMPONENTS.length;

  function applyCount(val: string) {
    const n = parseInt(val);
    if (isNaN(n) || n < 1 || n > MAX) {
      setCountErr(`Enter 1–${MAX}`);
      return;
    }
    setCountErr('');
    setFuel(prev => {
      const comps = [...prev.fuelComponents];
      while (comps.length < n) comps.push(FUEL_MASTER_COMPONENTS[comps.length] || '');
      comps.length = n;
      return { ...prev, fuelCount: n, fuelComponents: comps, visitedFuel: true };
    });
  }

  function updateComponent(idx: number, val: string) {
    setFuel(prev => {
      const comps = [...prev.fuelComponents];
      comps[idx] = val;
      return { ...prev, fuelComponents: comps, fuelConfirmed: false };
    });
  }

  function dragStart(idx: number) { setDragSrcIdx(idx); }
  function dragOver(e: React.DragEvent, idx: number) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIdx(idx);
  }
  function dragLeave() { setDragOverIdx(null); }
  function drop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    if (dragSrcIdx === null || dragSrcIdx === targetIdx) { setDragSrcIdx(null); setDragOverIdx(null); return; }
    setFuel(prev => {
      const comps = [...prev.fuelComponents];
      const [moved] = comps.splice(dragSrcIdx, 1);
      comps.splice(targetIdx, 0, moved);
      return { ...prev, fuelComponents: comps, fuelConfirmed: false };
    });
    setDragSrcIdx(null); setDragOverIdx(null);
  }
  function dragEnd() { setDragSrcIdx(null); setDragOverIdx(null); }

  return (
    <div className="flex flex-col overflow-hidden min-h-0 flex-1">
      {/* Topbar */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 px-4 py-2 bg-surface border-b border-border">
        <div>
          <div className={TEXT.sectionHeader}>Fuel Components Configuration</div>
        </div>
        <div className="flex items-center gap-4">
          <div className={clsx(styles.mono, 'flex items-center gap-2 text-[10px] text-text-secondary')}>
            <span>Fuel headers combining:</span>
            <input
              type="number" min={1} step={1}
              className={cn(styles.mono, styles.numInput, FIELD.input, 'w-14 px-2 py-1 text-xs font-medium text-center')}
              value={headerInput}
              onChange={e => { setHeaderInput(e.target.value); setFuel(prev => ({ ...prev, fuelHeaderCount: parseInt(e.target.value)||1 })); }}
              onBlur={() => { if (!parseInt(headerInput)) setHeaderInput('1'); }}
              onKeyDown={e => { if (e.key==='Enter') (e.target as HTMLInputElement).blur(); }}
            />
          </div>
          <div className={clsx(styles.mono, 'flex items-center gap-2 text-[10px] text-text-secondary')}>
            <span>Components in fuel:</span>
            <input
              type="number" min={1} max={MAX}
              className={cn(styles.mono, styles.numInput, FIELD.input, 'w-14 px-2 py-1 text-xs font-medium text-center', countErr && 'border-accent-red')}
              value={countInput}
              onChange={e => setCountInput(e.target.value)}
              onBlur={() => applyCount(countInput)}
              onKeyDown={e => { if (e.key==='Enter') applyCount(countInput); }}
            />
            <span className={clsx(styles.mono, 'text-[8px] text-text-secondary')}>max {MAX}</span>
          </div>
          {countErr && <span className={clsx(styles.mono, 'text-[9px] text-accent-red')}>{countErr}</span>}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {/* No `overflow-hidden` on this wrapper: the header is sticky to the
            outer scroll container above, and `overflow-hidden` would make this
            wrapper itself a scroll-container ancestor, breaking that stickiness. */}
        <div className={cn(TABLE.wrap, 'rounded-[4px]')}>
        <table className="w-full border-collapse">
          <thead>
            <tr className={TABLE.header}>
              <th className={clsx(styles.mono, 'text-[11px] font-semibold text-text-secondary px-3 py-2 text-center sticky top-0 z-10 w-40')}>Fuel Component Number</th>
              <th className={clsx(styles.mono, 'text-[11px] font-semibold text-text-secondary px-3 py-2 text-center sticky top-0 z-10')}>Fuel Component Name</th>
            </tr>
          </thead>
          <tbody className={TABLE.divide}>
            {fuel.fuelComponents.map((comp, idx) => (
              <tr
                key={idx}
                draggable
                onDragStart={() => dragStart(idx)}
                onDragOver={e => dragOver(e, idx)}
                onDragLeave={dragLeave}
                onDrop={e => drop(e, idx)}
                onDragEnd={dragEnd}
                className={cn(
                  TABLE.row,
                  dragOverIdx === idx && dragSrcIdx !== idx && 'bg-accent-blue/10 outline outline-1 outline-accent-blue',
                  dragSrcIdx === idx && 'opacity-40'
                )}
              >
                <td className={clsx(styles.mono, 'px-3 py-2 text-[10px] text-text-secondary')}>
                  <span className={clsx(styles.dragHandle, 'mr-2 cursor-grab')} title="Drag to reorder">⠿</span>
                  Component {idx + 1}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={comp}
                    onChange={e => updateComponent(idx, e.target.value)}
                    className={cn(styles.mono, styles.fiSel, FIELD.input, 'w-full px-2 py-1.5 text-[11px]',
                      save(fuel.fuelComponents[idx], f => f.fuelComponents[idx]))}
                  >
                    <option value="">— select —</option>
                    {FUEL_MASTER_COMPONENTS.map(c => {
                      const usedElsewhere = fuel.fuelComponents.some((v2, j) => j !== idx && v2 === c);
                      return (
                        <option key={c} value={c} disabled={usedElsewhere && c !== comp}>{c}</option>
                      );
                    })}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
