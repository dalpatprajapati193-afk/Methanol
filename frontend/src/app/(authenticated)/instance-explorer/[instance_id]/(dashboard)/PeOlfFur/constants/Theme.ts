// Persistence key for the light/dark choice. Shared by TopBar's toggle (writes it)
// and page.tsx's pre-hydration restore script (reads it) so a refresh keeps the theme.
export const THEME_KEY = 'furnace-theme';
