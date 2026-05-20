import { Link, useLocation } from "react-router-dom";

import { BOT_NAME, SITE_DOMAIN, SITE_NAME, SITE_URL } from "../lib/brand";



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

        <div className="site-footer__inner">

          <div className="site-footer__top">

            <div className="site-footer__brand">

              <span className="site-footer__title">{SITE_NAME}</span>

              <a

                className="site-footer__domain"

                href={SITE_URL}

                target="_blank"

                rel="noreferrer"

              >

                {SITE_DOMAIN}

              </a>

            </div>

            <nav className="site-footer__nav" aria-label="Footer navigation">

              <Link to="/" className={pathname === "/" ? "active" : ""}>

                Market

              </Link>

              <Link to="/bot" className={pathname.startsWith("/bot") ? "active" : ""}>

                {BOT_NAME}

              </Link>

              <Link

                to="/portfolio"

                className={pathname.startsWith("/portfolio") ? "active" : ""}

              >

                Portfolio

              </Link>

              <a href="https://alt.fun" target="_blank" rel="noreferrer">

                alt.fun

              </a>

            </nav>

          </div>

          <p className="site-footer__meta">

            Non-custodial trading on <span>HyperEVM</span> · powered by alt.fun

          </p>

        </div>

      </footer>

    </div>

  );

}

