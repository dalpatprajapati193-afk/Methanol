export const SHOW_BLUEPRINT = false;
export const SHOW_CONNECTIVITY = false;

// Controls whether the EFF_output.xlsx export button is shown on the Model Config page.
export const SHOW_EFF_OUTPUT_EXPORT = false;

export const SYSTEM_NAME = "Reforming_Section" as const;

export function formatSystemName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const SYSTEM_DISPLAY_NAME = formatSystemName(SYSTEM_NAME);

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function maxOutlierStartDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return formatLocalDate(d);
}

export function validateOutlierStartDate(value: string): string | null {
  if (!value) return null;
  if (value > maxOutlierStartDate()) return "Start date must be at least one year in the past.";
  return null;
}
