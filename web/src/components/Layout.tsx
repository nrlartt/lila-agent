import { Link, useLocation } from "react-router-dom";
import { BOT_NAME, SITE_DOMAIN, SITE_NAME } from "../lib/brand";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="app-shell">
      <div className="ambient ambient--a" aria-hidden />
      <div className="ambient ambient--b" aria-hidden />
      <div className="grid-overlay" aria-hidden />

      <main className="main">
        <div key={pathname} className="page-view">
          {children}
        </div>
      </main>

      <footer className="site-footer">
        <span>
          {SITE_NAME} · {SITE_DOMAIN} · powered by alt.fun Zap · HyperEVM
        </span>
        <Link to="/">Agent</Link>
        <Link to="/bot">{BOT_NAME}</Link>
        <a
          href="https://docs.alt.fun/integrations"
          target="_blank"
          rel="noreferrer"
        >
          Docs
        </a>
      </footer>
    </div>
  );
}
