const REPO = "https://github.com/timothy0987/trade-easy";

/** Minimal shared footer: doc + source links, one line. */
export function SiteFooter() {
  return (
    <footer className="w-full max-w-5xl z-10 mt-16 pt-6 border-t border-[var(--color-border)] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[var(--color-ink-3)]">
      <span className="font-semibold text-[var(--color-ink-2)]">Private Trading Vault</span>
      <span aria-hidden="true">·</span>
      <a href="/architecture.html" target="_blank" rel="noreferrer" className="hover:text-[var(--color-hz-navy)] hover:underline">
        How it works
      </a>
      <span aria-hidden="true">·</span>
      <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-[var(--color-hz-navy)] hover:underline">
        Source
      </a>
      <span aria-hidden="true">·</span>
      <span>Horizen Testnet</span>
    </footer>
  );
}
