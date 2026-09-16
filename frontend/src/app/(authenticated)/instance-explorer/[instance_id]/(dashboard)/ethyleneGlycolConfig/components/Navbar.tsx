import styles from "./EgChrome.module.css";

const NAV_LINKS = ["Plant Configurations", "KPI Configurations"];

export default function Navbar() {
  return (
    <nav className="h-16 shrink-0 bg-surface border-b border-border flex items-center justify-between px-6">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className={styles.logoBox}>I</div>
        <span className={styles.brand}>Ingenero360AI</span>
      </div>

      {/* Nav links — inert (entry flow out of scope) */}
      <div className="flex items-center gap-1">
        {NAV_LINKS.map((label) => (
          <button
            key={label}
            type="button"
            aria-disabled
            className="px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-accent-blue hover:bg-accent-blue-light transition-colors cursor-default"
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
