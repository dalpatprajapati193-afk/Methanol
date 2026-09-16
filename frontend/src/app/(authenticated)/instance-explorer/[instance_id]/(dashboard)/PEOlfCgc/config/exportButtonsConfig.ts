/**
 * exportButtonsConfig.ts
 *
 * Single source of truth for which header-bar action buttons are shown in
 * the CGC UI. Flip a flag to hide a button everywhere it appears — no
 * scattered conditionals per component.
 *
 * To add a new configurable button in the future: add a field to
 * `ExportButtonsConfig`, default it below, and read the same flag wherever
 * that button is rendered (currently all in CgcConfigClient.tsx's header).
 */

export interface ExportButtonsConfig {
  showConfigs: boolean;
  showReset: boolean;
  showSaveDraft: boolean;
  showImportJson: boolean;
  showJsonDownload: boolean;
  showSaveDatabase: boolean;
  showExcelDownload: boolean;
}

export const EXPORT_BUTTONS_CONFIG: ExportButtonsConfig = {
  showConfigs: false,
  showReset: false,
  showSaveDraft: true,
  showImportJson: false,
  showJsonDownload: false,
  showSaveDatabase: true,
  showExcelDownload: false,
};
