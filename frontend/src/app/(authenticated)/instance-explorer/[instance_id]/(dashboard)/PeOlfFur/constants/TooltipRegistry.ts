// ── Tooltip registry — code-owned defaults for every <InfoTip> in the app ──
//
// The EDITABLE source of tooltip copy is the Excel file
//   src/app/furnaceProductApp/Tooltips.xlsx
// (columns: Tooltip_ID | Location | Title | Tooltip_Text | Status). The app
// reads it on open (readTooltips → tooltipsAtom) and every <InfoTip id="...">
// looks its copy up there — so tooltip WORDING is changed by editing the Excel,
// no code change.
//
// ADDING a tooltip is a code change (this is by design):
//   1. Drop <InfoTip id="my.new-id" /> next to the UI element.
//   2. Register the same id below with its default copy + a human-readable
//      Location (so whoever edits the Excel knows which control it belongs to).
// On the next app open, readTooltips appends any registered id missing from the
// Excel — existing rows (user edits) are never touched.
//
// SHOW / HIDE a tooltip from the Excel (no code change):
//   • Status = "Active"   (case-insensitive) → the i icon + box show.
//   • Status = "Inactive" (case-insensitive) → the i icon + box are removed.
//   Blank Tooltip_Text also hides it (empty text = nothing to show).
//
// RENAME the control from the Excel (no code change): where a field is rendered
// with <InfoLabel> (not a plain <InfoTip>), the Title cell IS the on-screen
// label — edit Title and the field's name changes too (and it stays the tooltip
// heading). The rename applies even when the icon is hidden.

export interface TooltipEntry {
  /** Where the tooltip appears — informational, mirrors the Excel column. */
  location: string;
  /** The field's name. Doubles as (a) the bold first line inside the tooltip
   *  box and (b) the UI label itself via <InfoLabel> — editing the Title cell
   *  renames the control on screen. */
  title?: string;
  /** Body copy. */
  text: string;
  /** Whether the i icon + box show — false when Status=Inactive or text blank.
   *  The `title` above is still supplied so <InfoLabel> can rename the field
   *  even while its icon is hidden. */
  active: boolean;
}

/** id → entry map the UI consumes (tooltipsAtom). */
export type TooltipMap = Record<string, TooltipEntry>;

/** One row of the Tooltips sheet in Tooltips.xlsx. */
export interface TooltipRow {
  Tooltip_ID: string;
  Location: string;
  Title: string;
  Tooltip_Text: string;
  /** "Active" (case-insensitive) shows the tooltip; "Inactive" removes it. */
  Status: string;
}

/** Column order of the Tooltips sheet. */
export const TOOLTIP_COLUMNS = ["Tooltip_ID", "Location", "Title", "Tooltip_Text", "Status"] as const;

/**
 * Every tooltip the code renders, with its default copy. Missing ids are
 * appended to Tooltips.xlsx on app open (self-heal); the Excel then wins.
 */
export const REGISTERED_TOOLTIPS: TooltipRow[] = [
  {
    Tooltip_ID: "basicinfo.name",
    Location: 'Fleet Record → Furnace Details table → "Name" column header',
    Title: "Name",
    Tooltip_Text:
      "A label for this furnace (e.g. its tag or number). Used throughout the UI and " +
      "exported as the furnace identifier.",
    Status: "Active",
  },
  {
    Tooltip_ID: "basicinfo.licensor",
    Location: 'Fleet Record → Furnace Details table → "Licensor" column header',
    Title: "Licensor",
    Tooltip_Text:
      "The furnace technology licensor. Determines the default hardware templates " +
      "prefilled for this furnace.",
    Status: "Active",
  },
  {
    Tooltip_ID: "basicinfo.design",
    Location: 'Fleet Record → Furnace Details table → "Design" column header',
    Title: "Design",
    Tooltip_Text:
      "The coil / furnace design type. Combined with the licensor to select the " +
      "hardware configuration prefilled for this furnace.",
    Status: "Active",
  },
  {
    Tooltip_ID: "basicinfo.cells",
    Location: 'Fleet Record → Furnace Details table → "Cells" column header',
    Title: "Cells",
    Tooltip_Text: "Number of firebox cells in this furnace (a positive whole number).",
    Status: "Active",
  },
  {
    Tooltip_ID: "basicinfo.pass-per-cell",
    Location: 'Fleet Record → Furnace Details table → "Pass Per Cell" column header',
    Title: "Pass Per Cell",
    Tooltip_Text: "Number of passes in each cell. Must be a positive even number (2, 4, 6…).",
    Status: "Active",
  },
  {
    Tooltip_ID: "basicinfo.tubes-per-pass",
    Location: 'Fleet Record → Furnace Details table → "Tubes Per Pass" column header',
    Title: "Tubes Per Pass",
    Tooltip_Text: "Number of tubes in each pass (a positive whole number).",
    Status: "Active",
  },
  {
    Tooltip_ID: "basicinfo.design-runlength",
    Location: 'Fleet Record → Furnace Details table → "Design Runlength" column header',
    Title: "Design Runlength",
    Tooltip_Text:
      "Average cracking runlength in days (may be fractional). Exported per furnace as " +
      "Furnace_N_Design_Runlength and required by the Coilsim step when building " +
      "instance_configs — re-Confirm the Hub after editing so UI_Export.xlsx refreshes.",
    Status: "Active",
  },
  {
    Tooltip_ID: "uom.measured-property",
    Location: 'Fleet Record → Default UOM Manager table → "Measured Property" column header',
    Title: "Measured Property",
    Tooltip_Text:
      "The physical quantity whose default unit you are setting (e.g. Mass Flow Rate, " +
      "Temperature, Pressure). Hardware fields inherit this project-wide default.",
    Status: "Active",
  },
  {
    Tooltip_ID: "uom.unit",
    Location: 'Fleet Record → Default UOM Manager table → "UOM" column header',
    Title: "UOM",
    Tooltip_Text:
      "The default unit of measurement applied project-wide for this property. Individual " +
      "Hardware section fields can still override it.",
    Status: "Active",
  },
  {
    Tooltip_ID: "basicinfo.copy-setup-from",
    Location: 'Fleet Record → Furnace Details table → "Copy Setup From" column header',
    Title: "Copy Setup From",
    Tooltip_Text:
      "Copy another furnace's setup into this row. Identical setups are detected " +
      "automatically; choose Original to enter this furnace's values independently.",
    Status: "Active",
  },

  // ── Feed & Fuel Management System → Area Feed Header questionnaire ──
  // Accordion section headers (01–04).
  {
    Tooltip_ID: "fms.acc.fresh-recycle",
    Location: 'Feed Management → Area Feed Header → Section 01 header "Fresh & Recycle Feed Availability"',
    Title: "Fresh & Recycle Feed Availability",
    Tooltip_Text:
      "Declare which fresh feeds the complex receives and whether any streams are " +
      "internally separated and recirculated. These answers seed the rest of the P&ID.",
    Status: "Active",
  },
  {
    Tooltip_ID: "fms.acc.recycle-routing",
    Location: 'Feed Management → Area Feed Header → Section 02 header "Recycle Routing Provision"',
    Title: "Recycle Routing Provision",
    Tooltip_Text:
      "For each recycle stream, indicate the feed headers it can be routed to. A recycle " +
      "stream must be routed to at least one header.",
    Status: "Active",
  },
  {
    Tooltip_ID: "fms.acc.general-headers",
    Location: 'Feed Management → Area Feed Header → Section 03 header "Routing To General Headers"',
    Title: "Routing To General Headers",
    Tooltip_Text:
      "Indicate whether each feed header contributes to the general fresh-and-recycle " +
      "header and/or the general total-feed header.",
    Status: "Active",
  },
  {
    Tooltip_ID: "fms.acc.jumpover",
    Location: 'Feed Management → Area Feed Header → Section 04 header "Feed Header Jumpover Provision"',
    Title: "Feed Header Jumpover Provision",
    Tooltip_Text:
      "Indicate whether a feed header can jump over (spill) into another feed's header " +
      "when needed.",
    Status: "Active",
  },

  // Individual questions inside the accordion sections.
  {
    Tooltip_ID: "fms.q.fresh-feed",
    Location: 'Feed Management → Section 01 → question "Select the fresh feed the complex receives"',
    Title: "Fresh feed received",
    Tooltip_Text:
      "Turn on each fresh feed (ethane, propane, butane, naphtha/liquid) that the complex " +
      "actually receives. Feeds left off are excluded from the rest of the setup.",
    Status: "Active",
  },
  {
    Tooltip_ID: "fms.q.recirculation",
    Location: 'Feed Management → Section 01 → question "Is there internal separation and recirculation…"',
    Title: "Internal separation & recirculation",
    Tooltip_Text:
      "Turn on each stream that is internally separated and recirculated (a recycle stream). " +
      "This governs which recycle-routing questions appear below.",
    Status: "Active",
  },
  {
    Tooltip_ID: "fms.q.route-ethane-recycle",
    Location: 'Feed Management → Section 02 → question "Provision to route ethane recycle…"',
    Title: "Ethane recycle routing",
    Tooltip_Text: "Select every feed header the ethane recycle stream can be routed to.",
    Status: "Active",
  },
  {
    Tooltip_ID: "fms.q.route-propane-recycle",
    Location: 'Feed Management → Section 02 → question "Provision to route propane recycle…"',
    Title: "Propane recycle routing",
    Tooltip_Text: "Select every feed header the propane recycle stream can be routed to.",
    Status: "Active",
  },
  {
    Tooltip_ID: "fms.q.route-butane-recycle",
    Location: 'Feed Management → Section 02 → question "Provision to route butane recycle…"',
    Title: "Butane recycle routing",
    Tooltip_Text: "Select every feed header the butane recycle stream can be routed to.",
    Status: "Active",
  },
  {
    Tooltip_ID: "fms.q.gen-fresh-recycle",
    Location: 'Feed Management → Section 03 → question "…contribute to general fresh and recycle header?"',
    Title: "Contributes to general F&R header",
    Tooltip_Text:
      "Indicate which feed headers feed the shared general fresh-and-recycle header.",
    Status: "Active",
  },
  {
    Tooltip_ID: "fms.q.gen-total-feed",
    Location: 'Feed Management → Section 03 → question "…contribute to general total feed header?"',
    Title: "Contributes to general total-feed header",
    Tooltip_Text:
      "Indicate which feed headers feed the shared general total-feed header.",
    Status: "Active",
  },
  {
    Tooltip_ID: "fms.q.ethane-jumpover",
    Location: 'Feed Management → Section 04 → question "Does ethane header jumpover to"',
    Title: "Ethane header jumpover",
    Tooltip_Text:
      "Select the feed headers the ethane header can jump over (spill) into.",
    Status: "Active",
  },
  {
    Tooltip_ID: "fms.q.propane-jumpover",
    Location: 'Feed Management → Section 04 → question "Does propane header jumpover to"',
    Title: "Propane header jumpover",
    Tooltip_Text:
      "Select the feed headers the propane header can jump over (spill) into.",
    Status: "Active",
  },
  {
    Tooltip_ID: "fms.q.butane-jumpover",
    Location: 'Feed Management → Section 04 → question "Does butane header jumpover to"',
    Title: "Butane header jumpover",
    Tooltip_Text:
      "Select the feed headers the butane header can jump over (spill) into.",
    Status: "Active",
  },
];
