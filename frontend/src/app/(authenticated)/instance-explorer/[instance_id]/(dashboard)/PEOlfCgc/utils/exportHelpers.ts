/**
 * exportHelpers.ts
 *
 * Shared browser-side helpers for the CGC export/persistence buttons, so
 * "download config JSON", "trigger a file download", and "blob -> base64"
 * exist in exactly one place instead of being copy-pasted between
 * CgcConfigClient.tsx and useEffExport.ts.
 */

import type { CgcConfig } from '../types/config';

export function safeFileName(config: CgcConfig): string {
  return (config.plant.plant_name || 'cgc').replace(/[^a-z0-9_-]/gi, '_');
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadConfigJson(config: CgcConfig): void {
  const blob = new Blob(
    [JSON.stringify({ system_configuration: config }, null, 2)],
    { type: 'application/json' },
  );
  triggerDownload(blob, `${safeFileName(config)}_config.json`);
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
