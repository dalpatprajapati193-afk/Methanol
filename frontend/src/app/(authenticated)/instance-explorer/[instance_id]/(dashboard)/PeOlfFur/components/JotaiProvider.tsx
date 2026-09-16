'use client';
import { Provider } from 'jotai';
import { useEffect } from 'react';
import { THEME_KEY } from '../constants/Theme';

// Restore the persisted light/dark choice on mount. This replaces the pre-hydration
// inline <script> that page.tsx used when this app was a top-level route; as a
// client-navigated nested route, React won't execute an inline script, so the
// restore runs here (a Client Component) instead. Reads the same key TopBar writes
// and toggles the `dark` class exactly as the toggle does.
function ThemeRestore() {
  useEffect(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      const d = document.documentElement;
      if (t === 'dark') d.classList.add('dark');
      else if (t === 'light') d.classList.remove('dark');
    } catch { /* localStorage unavailable -- keep default theme */ }
  }, []);
  return null;
}

function ResetGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('reset') === '1') {
      localStorage.removeItem('furnace_fms_state');
      localStorage.removeItem('furnace_fuel_state');
      const url = new URL(window.location.href);
      url.searchParams.delete('reset');
      window.location.replace(url.toString());
    }
  }, []);
  return <>{children}</>;
}

export default function JotaiProvider({ children }: { children: React.ReactNode }) {
  return <Provider><ThemeRestore /><ResetGuard>{children}</ResetGuard></Provider>;
}
