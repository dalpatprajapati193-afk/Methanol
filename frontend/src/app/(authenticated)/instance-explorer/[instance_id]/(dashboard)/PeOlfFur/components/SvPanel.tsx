'use client';
import { useState } from 'react';
import { clsx } from 'clsx';
import styles from '../Style.module.css';

export interface SvRow { key: string; value: string | number | null; }

interface Props {
  rows: SvRow[];
  title?: string;
}

export default function SvPanel({ rows, title = 'State Variables' }: Props) {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(192);

  function onResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    function onMove(ev: MouseEvent) {
      const w = Math.max(120, Math.min(480, startW + ev.clientX - startX));
      setWidth(w);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <>
      {/* Sidebar */}
      <div
        className={clsx(
          'flex-shrink-0 bg-surface border-r border-border flex flex-col overflow-hidden transition-[width] duration-200',
          open ? '' : 'w-0'
        )}
        style={{ width: open ? width : 0 }}
      >
        <div className="flex-shrink-0 overflow-hidden" style={{ width }}>
          <div className="px-3 py-2 border-b border-border">
            <h2 className={clsx(styles.mono, 'text-[8px] font-semibold uppercase tracking-[.12em] text-text-secondary')}>{title}</h2>
          </div>
          <div className="flex-1 overflow-y-auto h-full pb-8" style={{ maxHeight: 'calc(100vh - 80px)' }}>
            {rows.map((r, i) => {
              const v = r.value;
              const isEmpty = v === 'EMPTY' || v === '—' || v === null || v === '';
              const isZero  = v === 0 || v === '0';
              const cls = isEmpty ? 'vn' : isZero ? 'v0' : 'v1';
              const display = v === null ? '—' : String(v);
              const disp = display.length > 10 ? display.slice(0, 9) + '…' : display;
              return (
                <div key={i} className="flex items-center justify-between px-2 py-0.5 border-b border-border/50">
                  <span
                    className={clsx(styles.mono, 'text-[8px] text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap pr-1 flex-1')}
                    title={r.key}
                  >{r.key}</span>
                  <span
                    className={clsx(
                      styles.mono,
                      'text-[7px] font-medium text-center rounded flex-shrink-0',
                      cls === 'v1' ? 'bg-accent-green/15 text-accent-green' : cls === 'v0' ? 'bg-accent-red/15 text-accent-red' : 'bg-surface-hover text-text-secondary'
                    )}
                    style={{ padding: '1px 3px', maxWidth: 72 }}
                    title={display}
                  >{disp}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Resizer */}
      {open && (
        <div
          onMouseDown={onResizeMouseDown}
          className="w-1.5 flex-shrink-0 bg-border hover:bg-accent-blue cursor-col-resize transition-colors"
        />
      )}

      {/* Toggle tab button — floats on the right edge of the sidebar */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Toggle state variables"
        className={clsx(
          'flex-shrink-0 flex items-center justify-center',
          'w-4 self-stretch bg-surface-hover border-r border-border',
          'hover:bg-surface transition cursor-pointer',
          open ? '' : ''
        )}
      >
        <svg
          viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5"
          width="8" height="8"
          className={clsx('transition-transform', open ? '' : 'rotate-180')}
        >
          <path d="M5 1L2 4l3 3"/>
        </svg>
      </button>
    </>
  );
}
