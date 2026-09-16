'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  readInputSheet, readInputBaseline, saveInputEdits,
  confirmInputSnapshot, revertInputSheet, downloadInputWorkbook, uploadInputWorkbook,
} from '../../actions/InputSheetActions';
import { runPackagesStream } from '../../actions/PipelineActions';
import { useAtom } from 'jotai';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import styles from '../../Style.module.css';
import { TEXT } from '../../theme/TextTypes';
import {
  inputSheetDataAtom, inputSheetLoadingAtom, inputSheetErrorAtom,
  activeTabAtom, dirtyEditsAtom, saveMsgAtom,
  pageAtom, searchAtom, pkgFilterAtom, inputSheetBaselineAtom,
  type InputSheetPayload, type CellValue,
} from '../../store/InputSheetAtoms';
import { payloadHash } from '../../constants/InputSheetStatus';
import { confirmVisual } from '../../constants/ModulesStatus';
import InputSheetTable from './InputSheetTable';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

interface Edit { sheet: string; row: number; col: number; value: CellValue }

// Map the live Build_Instance_Configs output to a coarse [floor, ceil] progress
// band + label (same approach as the Package Selection confirm bar).
function phaseFor(log: string): { floor: number; ceil: number; label: string } {
  if (/Instance configs built|ALL DONE/.test(log)) return { floor: 100, ceil: 100, label: 'Done' };
  if (/Building instance_configs|Build_Instance_Configs|run_tags|instance_configs\.xlsx/.test(log)) {
    return { floor: 25, ceil: 96, label: 'Building instance configs…' };
  }
  return { floor: 5, ceil: 25, label: 'Starting…' };
}

// Pull a concise, human-readable reason out of the streamed build log. Prefers the
// pipeline's own "✖ …" / "Error …" / "…Error: …" lines over the raw Python
// traceback, so the failure banner shows the cause rather than a stack frame.
function extractError(log: string): string {
  const lines = log.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const prefer = lines.filter(l =>
    /^✖/.test(l) || /(^|\s)(Error|missing required|failed)/i.test(l) || /Error:/.test(l));
  // The most specific message is usually the last matching one before the traceback tail.
  const pick = [...prefer].reverse().find(l => !/^Traceback/i.test(l) && !/^File "/.test(l));
  return (pick || lines[lines.length - 1] || 'Build failed with no output.').replace(/^✖\s*/, '');
}

export default function InputSheetPage() {
  // instance_id from the route → per-instance input-sheet reads/writes.
  const routeInstance = useParams()?.instance_id;
  const instanceId = Number(Array.isArray(routeInstance) ? routeInstance[0] : routeInstance) || null;
  const [data, setData] = useAtom(inputSheetDataAtom);
  const [loading, setLoading] = useAtom(inputSheetLoadingAtom);
  const [error, setError] = useAtom(inputSheetErrorAtom);
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const [dirty, setDirty] = useAtom(dirtyEditsAtom);
  const [saveMsg, setSaveMsg] = useAtom(saveMsgAtom);
  const [baseline, setBaseline] = useAtom(inputSheetBaselineAtom);
  const [, setPage] = useAtom(pageAtom);
  const [, setSearch] = useAtom(searchAtom);
  const [, setPkgFilter] = useAtom(pkgFilterAtom);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Confirm / build progress state ──
  const [running, setRunning] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('Starting…');
  const [done, setDone] = useState<null | 'ok' | 'fail'>(null);
  const [log, setLog] = useState('');
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });

  // Live vs recorded → blue / green / yellow. The Input Sheet is never
  // "incomplete", so `complete` is always true (orange never shows).
  const currentHash = payloadHash(data, dirty);
  const visual = confirmVisual(baseline, currentHash, true);
  const subtext =
    visual.state === 'green' ? 'Input sheet confirmed'
      : visual.state === 'yellow' ? 'Unconfirmed changes — Confirm to record'
        : 'Not yet confirmed';

  // Load the DRAFT workbook (the work-in-progress copy the browser shows);
  // returns the payload so callers can hash it for the baseline. Clears dirty
  // edits (the loaded sheet is the new in-memory truth). Pass { keepTab } to
  // preserve the current tab (e.g. after a Save) instead of jumping to the first.
  async function load(opts?: { keepTab?: boolean }): Promise<InputSheetPayload | null> {
    setLoading(true); setError(null);
    try {
      const payload: InputSheetPayload = await readInputSheet(instanceId);
      setData(payload);
      if (!opts?.keepTab) setActiveTab(payload.tabs[0]?.id ?? 'details');
      setDirty(new Map());
      return payload;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      return null;
    } finally {
      setLoading(false);
    }
  }

  // Seed the Confirm baseline from the canonical (confirmed) copy: blue when
  // nothing has been generated, else green/yellow depending on whether the draft
  // still matches it.
  async function seedBaseline() {
    try {
      const { payload } = await readInputBaseline(instanceId);
      setBaseline(payload ? { hash: payloadHash(payload) } : null);
    } catch {
      setBaseline(null);
    }
  }

  // Refetch on every mount, and (re)seed the baseline. The draft is the server's
  // source of truth and may have been regenerated by a KPI/Package Confirm while
  // this page was unmounted — `data` lives in a global atom that survives
  // navigation, so a stale in-memory copy would otherwise linger until a hard
  // browser refresh. Skip the refetch only when there are unsaved in-memory edits
  // (a reload clears them); keep the current tab when we already have data.
  useEffect(() => {
    (async () => {
      if (dirty.size === 0) await load({ keepTab: !!data });
      await seedBaseline();
    })(); /* eslint-disable-line react-hooks/exhaustive-deps */
  }, []);

  // Block tab close / refresh while a build is in progress.
  useEffect(() => {
    if (!running) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [running]);

  // Drag the processing dialog by its header.
  function startDrag(e: React.MouseEvent) {
    const origin = { x: e.clientX - dragPos.x, y: e.clientY - dragPos.y };
    const move = (ev: MouseEvent) => setDragPos({ x: ev.clientX - origin.x, y: ev.clientY - origin.y });
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  // Flatten the in-memory dirty map into the Edit[] the API expects.
  function editsFromDirty(): Edit[] {
    const edits: Edit[] = [];
    for (const [k, value] of dirty) {
      const [sheet, row, col] = k.split('!');
      edits.push({ sheet, row: Number(row), col: Number(col), value });
    }
    return edits;
  }

  // Persist the current dirty edits to the DRAFT (canonical untouched). Returns
  // false and surfaces a message on failure.
  async function saveDraft(): Promise<boolean> {
    try {
      await saveInputEdits(instanceId, editsFromDirty());
      return true;
    } catch (e) {
      setSaveMsg(`Save failed: ${e instanceof Error ? e.message : 'error'}`);
      return false;
    }
  }

  // Save button: write the current edits to the draft, then reload the draft (so
  // the saved values become the in-memory truth and the dirty overlay clears).
  // Stays yellow — a saved draft still differs from the confirmed copy.
  async function onSave() {
    if (!dirty.size || busy) return;
    setSaving(true); setSaveMsg(null);
    try {
      if (!(await saveDraft())) return;
      await load({ keepTab: true });
      setSaveMsg('Draft saved.');
      setTimeout(() => setSaveMsg(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  // Build instance_configs.xlsx (streaming progress), then reload the sheet and
  // pin the baseline so it turns green. The canonical copy is already written by
  // the Confirm step before this runs, so this only builds + refreshes state.
  async function buildInstanceConfigs(): Promise<boolean> {
    setRunning(true); setDone(null); setLog(''); setProgress(0);
    setPhase('Starting…'); setDragPos({ x: 0, y: 0 }); setShowProgress(true);
    try {
      const stream = await runPackagesStream(instanceId, {});
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let exitCode: number | null = null;
      for (;;) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const m = buffer.match(/__DONE__(\d+)\s*$/);
        if (m) { exitCode = Number(m[1]); buffer = buffer.replace(/__DONE__\d+\s*$/, ''); }
        setLog(buffer);
        const { floor, ceil, label } = phaseFor(buffer);
        setPhase(label);
        setProgress((prev) => {
          if (ceil >= 100) return 100;
          const base = Math.max(prev, floor);
          return Math.min(ceil, base + (ceil - base) * 0.18);
        });
      }

      if (exitCode !== 0) { setDone('fail'); return false; }

      // Reload the sheet (draft == canonical after the Confirm write) and pin the
      // baseline to it → green.
      const p = await load();
      if (p) setBaseline({ hash: payloadHash(p) });
      setProgress(100); setPhase('Done'); setDone('ok');
      return true;
    } catch (err) {
      setLog((l) => l + `\n✖ ${err instanceof Error ? err.message : 'Build failed'}\n`);
      setDone('fail');
      return false;
    } finally {
      setRunning(false);
    }
  }

  // Confirm: write the current edits to the canonical copy (which also brings the
  // draft into line), then build instance_configs and pin the baseline → green.
  async function onConfirm() {
    if (running || !data || visual.state === 'green') return;
    setSaveMsg(null);
    try {
      await saveInputEdits(instanceId, editsFromDirty());
      await confirmInputSnapshot(instanceId);
    } catch (e) {
      setSaveMsg(`Confirm failed: ${e instanceof Error ? e.message : 'error'}`);
      return;
    }
    await buildInstanceConfigs();
  }

  // Revert: discard draft edits — reset the draft to the canonical (confirmed)
  // copy and reload it into the browser.
  async function onRevert() {
    if (reverting || running) return;
    setReverting(true); setSaveMsg(null);
    try {
      const { payload } = await revertInputSheet(instanceId);
      setData(payload);
      setActiveTab(payload.tabs[0]?.id ?? 'details');
      setDirty(new Map());
      setBaseline({ hash: payloadHash(payload) });
      setSaveMsg('Reverted to the last confirmed version.');
      setTimeout(() => setSaveMsg(null), 4000);
    } catch (e) {
      setSaveMsg(e instanceof Error ? `Revert failed: ${e.message}` : 'Revert failed');
    } finally {
      setReverting(false);
    }
  }

  // Download the current DRAFT workbook (both sheets in one .xlsx) as-is from disk.
  async function download() {
    if (dirty.size && !window.confirm(
      `You have ${dirty.size} unsaved edit${dirty.size === 1 ? '' : 's'} that aren't in the draft yet. ` +
      `The download reflects your last saved draft. Save first, or download the saved draft anyway?`,
    )) return;
    setDownloading(true); setSaveMsg(null);
    try {
      const { base64, filename } = await downloadInputWorkbook(instanceId);
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const name = filename || 'input_data_from_user.xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setSaveMsg(e instanceof Error ? `Download failed: ${e.message}` : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  // Upload a workbook → replaces BOTH the canonical and the draft copies, then
  // reloads and pins the baseline → green. Does NOT build instance_configs
  // (upload is data-only; a later edit + Confirm rebuilds them).
  async function upload(file: File) {
    setUploading(true); setSaveMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await uploadInputWorkbook(instanceId, fd);
      const p = await load();
      if (p) setBaseline({ hash: payloadHash(p) });
      setSaveMsg(`Uploaded ${file.name}.`);
      setTimeout(() => setSaveMsg(null), 4000);
    } catch (e) {
      setSaveMsg(e instanceof Error ? `Upload failed: ${e.message}` : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (dirty.size && !window.confirm(
      `Uploading will replace the current sheet and discard your ${dirty.size} unsaved ` +
      `edit${dirty.size === 1 ? '' : 's'}. Continue?`,
    )) return;
    upload(file);
  }

  function switchTab(id: string) {
    setActiveTab(id);
    setPage(1); setSearch(''); setPkgFilter('');
  }

  const tab = data?.tabs.find(t => t.id === activeTab) ?? data?.tabs[0];
  const dirtyCount = dirty.size;
  const busy = running || uploading || reverting || saving;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background p-6 gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className={cn(TEXT.pageTitle, 'tracking-wide')}>Input Sheet</div>
        </div>
        <div className="flex items-center gap-3">
          {saveMsg && (
            <span className={cn(TEXT.annotation, /failed/i.test(saveMsg) ? 'text-accent-red' : 'text-accent-green')}>{saveMsg}</span>
          )}
          {dirtyCount > 0 && (
            <span className={cn(TEXT.annotation, 'text-accent-orange')}>{dirtyCount} unsaved</span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={onPickFile}
            className="hidden"
          />
          <button
            onClick={onSave}
            disabled={!dirtyCount || !!error || loading || busy}
            title={dirtyCount ? 'Save your edits to the draft' : 'No unsaved edits'}
            className={cn(
              TEXT.breadcrumb, 'px-4 py-1.5 rounded border transition',
              !dirtyCount || !!error || loading || busy
                ? 'border-border text-text-secondary opacity-50 cursor-not-allowed'
                : 'border-accent-blue text-accent-blue hover:brightness-110 cursor-pointer',
            )}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={download}
            disabled={downloading || !!error || loading || busy}
            className={cn(
              TEXT.breadcrumb, 'px-4 py-1.5 rounded border transition',
              downloading || !!error || loading || busy
                ? 'border-border text-text-secondary opacity-50 cursor-not-allowed'
                : 'border-border text-text-secondary hover:border-accent-blue hover:text-text-primary cursor-pointer',
            )}
          >
            {downloading ? 'Downloading…' : 'Download'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className={cn(
              TEXT.breadcrumb, 'px-4 py-1.5 rounded border transition',
              busy
                ? 'border-border text-text-secondary opacity-50 cursor-not-allowed'
                : 'border-border text-text-secondary hover:border-accent-blue hover:text-text-primary cursor-pointer',
            )}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>

      {/* Centered capsule tabs */}
      <div className="flex justify-center pt-6 pb-2">
        <div className="inline-flex items-center gap-1 p-1 bg-surface border border-border rounded-full">
          {(data?.tabs ?? [{ id: 'details', label: 'Tag Details' }, { id: 'config', label: 'Tag Configuration' }]).map(t => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={cn(
                TEXT.breadcrumb,
                'min-w-[160px] px-6 py-2 text-center rounded-full transition',
                activeTab === t.id
                  ? 'bg-accent-blue text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      {loading && <CenterMsg>Loading workbook…</CenterMsg>}
      {error && !loading && (
        <CenterMsg>
          <span className="text-accent-red">{error}</span>
          <button onClick={() => { void load(); }} className={cn(TEXT.breadcrumb, 'mt-3 px-4 py-1.5 border border-border rounded text-text-secondary hover:border-accent-blue hover:text-text-primary transition')}>Retry</button>
        </CenterMsg>
      )}
      {!loading && !error && tab && (
        <InputSheetTable tab={tab} />
      )}

      {/* Confirm / Revert bar — blue/green/yellow like the Configuration Modules
          and KPI/Package Confirm. Confirm writes the draft to the canonical copy
          and builds instance_configs; green means the draft matches the confirmed
          copy (not clickable). Revert (shown only when yellow) resets the draft to
          the confirmed copy. */}
      <div className="flex items-center justify-center gap-3 pt-2 border-t border-border">
        <button
          onClick={onConfirm}
          disabled={!data || !!error || loading || running || visual.state === 'green'}
          title={visual.state === 'green'
            ? 'The live input sheet is already recorded'
            : 'Save the input sheet and build instance_configs'}
          style={{ background: visual.bg, color: visual.fg }}
          className={cn(
            TEXT.button,
            'flex flex-col items-center justify-center min-w-[260px] min-h-[54px] px-6 rounded-full font-semibold transition shadow-md',
            visual.state === 'green'
              ? 'cursor-default'
              : !data || !!error || loading || running
                ? 'opacity-60 cursor-not-allowed'
                : 'cursor-pointer hover:brightness-110',
          )}
        >
          <span>{running ? 'Processing…' : 'Confirm'}</span>
          <span className={cn(TEXT.annotation, 'font-normal opacity-90 mt-0.5')} style={{ color: visual.fg }}>{subtext}</span>
        </button>

        {visual.state === 'yellow' && (
          <button
            onClick={onRevert}
            disabled={reverting || running}
            title="Revert to the last confirmed version"
            style={{ background: 'var(--color-accent-green)', color: '#ffffff' }}
            className={cn(
              TEXT.button,
              'flex flex-col items-center justify-center min-w-[260px] min-h-[54px] px-6 rounded-full font-semibold transition shadow-md',
              reverting || running ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:brightness-110',
            )}
          >
            <span>{reverting ? 'Reverting…' : 'Revert'}</span>
            <span className={cn(TEXT.annotation, 'font-normal opacity-90 mt-0.5')} style={{ color: '#ffffff' }}>Restore the last confirmed version</span>
          </button>
        )}
      </div>

      {/* Progress modal (Build instance_configs) */}
      {showProgress && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-overlay p-6">
          <div
            className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
            style={{ transform: `translate(${dragPos.x}px, ${dragPos.y}px)` }}
          >
            <div
              onMouseDown={startDrag}
              className="flex items-center justify-between px-5 py-3 border-b border-border cursor-move select-none"
            >
              <div className={cn(TEXT.sectionHeader, 'tracking-wide')}>
                {running ? 'Confirming input sheet…' : done === 'ok' ? '✔ Confirmed' : '✖ Failed'}
              </div>
              {!running && (
                <button
                  onClick={() => setShowProgress(false)}
                  className={cn(TEXT.annotation, 'px-3 py-1 border border-border rounded text-text-secondary hover:border-accent-blue hover:text-text-primary transition')}
                >
                  Close
                </button>
              )}
            </div>

            <div className="px-5 pt-4 pb-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className={cn(TEXT.annotation, 'text-text-secondary')}>
                  {done === 'fail' ? 'Stopped' : phase}
                </span>
                <span className={cn(TEXT.annotation, 'font-semibold', done === 'fail' ? 'text-accent-red' : 'text-accent-blue')}>
                  {Math.round(progress)}%
                </span>
              </div>
              <div className={styles.procTrack}>
                <div
                  className={clsx(styles.procFill, !running && styles.procDone)}
                  style={{
                    width: `${done === 'fail' ? Math.max(progress, 6) : progress}%`,
                    background: done === 'fail' ? 'var(--color-accent-red)' : undefined,
                  }}
                />
              </div>
              {running && (
                <div className={cn(TEXT.annotation, 'text-text-secondary mt-2')}>
                  Please wait — do not close or leave this page until the build completes.
                </div>
              )}

              {/* Failure cause — the pipeline's own reason, pulled from the log. */}
              {done === 'fail' && log.trim() && (
                <div className={cn(TEXT.annotation, 'mt-3 px-3 py-2 rounded border border-accent-red/40 bg-accent-red/10 text-accent-red')}>
                  {extractError(log)}
                </div>
              )}

              {/* Full build output — live tail while running, kept after it ends so
                  the user can read the whole trace on success or failure. */}
              {log.trim() && (
                <pre
                  ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
                  className={clsx(styles.mono, 'mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-background px-3 py-2 text-[11px] leading-relaxed text-text-secondary')}
                >
                  {log}
                </pre>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-3">
              {done === 'ok' && (
                <span className={cn(TEXT.annotation, 'text-accent-green')}>Input sheet confirmed.</span>
              )}
              {done === 'fail' && (
                <button
                  onClick={() => setShowProgress(false)}
                  className={cn(TEXT.annotation, 'px-4 py-1.5 border border-border rounded text-text-secondary hover:border-accent-blue hover:text-text-primary transition')}
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CenterMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className={clsx('flex-1 flex flex-col items-center justify-center text-text-secondary', 'text-[12px]')}>
      {children}
    </div>
  );
}
