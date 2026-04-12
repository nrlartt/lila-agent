import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import UnicornStudioHero, { DEFAULT_UNICORN_PROJECT } from "../components/UnicornStudioHero.jsx";
import { getSiteLinks, isExternalDocsUrl } from "../lib/siteLinks.js";
import "../home.css";

const UNICORN_PROJECT =
  typeof import.meta.env.VITE_UNICORNSTUDIO_PROJECT_ID === "string" &&
  import.meta.env.VITE_UNICORNSTUDIO_PROJECT_ID.trim() !== ""
    ? import.meta.env.VITE_UNICORNSTUDIO_PROJECT_ID.trim()
    : DEFAULT_UNICORN_PROJECT;

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" />
    </svg>
  );
}

function IconGitHub() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function HomePage() {
  const progressRef = useRef(null);
  const { siteUrl, docsUrl, githubUrl, xUrl } = getSiteLinks();
  const docsExternal = isExternalDocsUrl(docsUrl);
  /** Hero is above the fold: IO can miss first paint — start hidden, then add in-view after layout (LAB-style kinetic). */
  const [heroReveal, setHeroReveal] = useState(false);

  useLayoutEffect(() => {
    let cancelled = false;
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        if (!cancelled) setHeroReveal(true);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const scrollPx = el.scrollTop;
      const winHeightPx = el.scrollHeight - el.clientHeight;
      const progress = winHeightPx > 0 ? scrollPx / winHeightPx : 0;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const opts = { root: null, rootMargin: "0px 0px -2% 0px", threshold: [0, 0.08, 0.15] };
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("in-view");
      });
    }, opts);

    document.querySelectorAll(".reveal-on-scroll, .kinetic-heading").forEach((el) => {
      if (el.id === "home-heading") return;
      revealObserver.observe(el);
    });

    const magneticCards = document.querySelectorAll(".magnetic-card");
    const cleaners = [];
    magneticCards.forEach((card) => {
      const onMove = (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        card.style.transform = `translate3d(${x * 0.03}px, ${y * 0.03}px, 0)`;
      };
      const onLeave = () => {
        card.style.transform = "";
      };
      card.addEventListener("mousemove", onMove);
      card.addEventListener("mouseleave", onLeave);
      cleaners.push(() => {
        card.removeEventListener("mousemove", onMove);
        card.removeEventListener("mouseleave", onLeave);
      });
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      revealObserver.disconnect();
      cleaners.forEach((fn) => fn());
    };
  }, []);

  return (
    <div className="home-page">
      <div ref={progressRef} className="home-scroll-progress" aria-hidden />
      <div className="home-bg-streaks" aria-hidden />
      <div className="home-bg-crt" aria-hidden />
      <div className="home-bg-radial" aria-hidden />

      <nav className="home-nav" aria-label="Primary">
        <div className="home-nav-inner">
          <a href="#home" className="home-brand">
            <span className="home-brand-dot" aria-hidden />
            <span className="home-brand-text">LILA // SYSTEM</span>
          </a>
          <div className="home-nav-center">
            <div className="home-nav-links">
              <a href="#capabilities">Capabilities</a>
              <a href="#flow">Flow</a>
              <a href="#faq">FAQ</a>
            </div>
            {docsUrl ? (
              docsExternal ? (
                <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="home-nav-docs">
                  Docs
                </a>
              ) : (
                <Link to={docsUrl} className="home-nav-docs">
                  Docs
                </Link>
              )
            ) : null}
            {(githubUrl || xUrl) && (
              <div className="home-nav-social" aria-label="Social links">
                {githubUrl ? (
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="home-nav-icon-link"
                    aria-label="GitHub repository"
                  >
                    <IconGitHub />
                  </a>
                ) : null}
                {xUrl ? (
                  <a href={xUrl} target="_blank" rel="noopener noreferrer" className="home-nav-icon-link" aria-label="X (Twitter)">
                    <IconX />
                  </a>
                ) : null}
              </div>
            )}
          </div>
          <Link to="/terminal" className="home-nav-cta">
            Open_Terminal
          </Link>
        </div>
      </nav>

      <main className="home-main">
        <section id="home" className="home-hero" aria-labelledby="home-heading">
          <UnicornStudioHero projectId={UNICORN_PROJECT} />
          <div className="home-hero-visual" aria-hidden />
          <div className="home-hero-scan" aria-hidden />
          <div className="home-hero-scan-2" aria-hidden />
          <div className="home-hero-content animate-hero-rise">
            <div className="home-eyebrow">
              <span>SYS.ONLINE</span>
              <span className="home-eyebrow-line" />
            </div>
            <h1 id="home-heading" className={`kinetic-heading${heroReveal ? " in-view" : ""}`}>
              Pay-per-request AI
              <br />
              <span className="home-gradient-text">on Stellar, settled in USDC.</span>
            </h1>
            <p className="home-hero-lead">
              LILA runs chat, analysis, code, and research behind HTTP APIs. Connect Freighter, approve x402
              micropayments, and keep keys in your wallet — not in the browser bundle.
            </p>
            <div className="home-cta-row">
              <Link to="/terminal" className="home-btn-primary">
                <span>Enter terminal</span>
                <IconArrow />
              </Link>
              <a href="#capabilities" className="home-btn-secondary">
                <span>Explore capabilities</span>
                <IconGrid />
              </a>
            </div>
          </div>
          <div
            className={`home-hero-aside reveal-on-scroll${heroReveal ? " in-view" : ""}`}
            style={{ "--reveal-delay": "0ms" }}
          >
            <p>Integration surface</p>
            <div className="home-tech-tags">
              <span>[ x402 ]</span>
              <span>[ STELLAR ]</span>
              <span>[ USDC ]</span>
            </div>
          </div>
        </section>

        <section id="capabilities" className="home-section" aria-labelledby="cap-heading">
          <div className="home-section-inner">
            <div className="home-section-head reveal-on-scroll" style={{ "--reveal-delay": "0ms" }}>
              <div>
                <p className="home-kicker">01 // Capabilities</p>
                <h2 id="cap-heading">What LILA does</h2>
              </div>
              <p>Production-shaped primitives: payments, wallet, and grounded responses.</p>
            </div>

            <div className="home-grid-3">
              <article
                className="home-card magnetic-card reveal-on-scroll"
                data-magnetic
                style={{ "--reveal-delay": "80ms" }}
              >
                <div className="home-card-scan" aria-hidden>
                  <div className="home-card-scan-inner" />
                </div>
                <div>
                  <div className="home-card-icon" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  </div>
                  <h3>x402 micropayments</h3>
                  <p>
                    HTTP 402 challenges, user-signed settlement, and per-request pricing in USDC — aligned with
                    the x402 flow on Stellar.
                  </p>
                </div>
                <p className="home-card-meta">Per-call billing</p>
              </article>

              <article
                className="home-card magnetic-card reveal-on-scroll"
                data-magnetic
                style={{ "--reveal-delay": "160ms" }}
              >
                <div className="home-card-scan" aria-hidden>
                  <div className="home-card-scan-inner" />
                </div>
                <div>
                  <div className="home-card-icon" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </div>
                  <h3>Stellar + Freighter</h3>
                  <p>
                    Connect with Freighter, check balances, and pay from your own wallet. Testnet-friendly; paths
                    exist for mainnet-ready flows.
                  </p>
                </div>
                <p className="home-card-meta">Wallet-native</p>
              </article>

              <article
                className="home-card magnetic-card reveal-on-scroll"
                data-magnetic
                style={{ "--reveal-delay": "240ms" }}
              >
                <div className="home-card-scan" aria-hidden>
                  <div className="home-card-scan-inner" />
                </div>
                <div>
                  <div className="home-card-icon" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 3v18h18M7 16l4-4 4 4 4-8" />
                    </svg>
                  </div>
                  <h3>Grounded analysis</h3>
                  <p>
                    When a market symbol is present, analysis can pull live public quotes — no fabricated tickers or
                    stale demo numbers.
                  </p>
                </div>
                <p className="home-card-meta">Quote-aware</p>
              </article>
            </div>
          </div>
        </section>

        <section id="flow" className="home-section" aria-labelledby="flow-heading" style={{ background: "rgba(10,10,10,0.35)" }}>
          <div className="home-section-inner">
            <div className="home-section-head reveal-on-scroll" style={{ "--reveal-delay": "0ms" }}>
              <div>
                <p className="home-kicker">02 // Flow</p>
                <h2 id="flow-heading">From request to receipt</h2>
              </div>
              <p>Same path your operators run in the terminal.</p>
            </div>
            <div className="home-flow reveal-on-scroll" style={{ "--reveal-delay": "60ms" }}>
              <div className="home-flow-step">
                <span>01</span>
                <p>Call a paid endpoint; server returns 402 + payment requirements.</p>
              </div>
              <div className="home-flow-step">
                <span>02</span>
                <p>Freighter signs the x402 payload; USDC moves on Stellar.</p>
              </div>
              <div className="home-flow-step">
                <span>03</span>
                <p>Retry with proof header; response streams back to the client.</p>
              </div>
              <div className="home-flow-step">
                <span>04</span>
                <p>Telemetry and receipts stay traceable per session.</p>
              </div>
              <div className="home-flow-step wide">
                <span>05</span>
                <p>Optional: rate limits and server-side inference routing stay behind your API.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="home-section" aria-labelledby="proof-heading">
          <div className="home-section-inner">
            <div className="home-section-head reveal-on-scroll" style={{ "--reveal-delay": "0ms" }}>
              <div>
                <p className="home-kicker">03 // Signals</p>
                <h2 id="proof-heading">Operational signals</h2>
              </div>
              <p>Qualitative targets — tune in production with your own SLOs.</p>
            </div>
            <div className="home-stats reveal-on-scroll" style={{ "--reveal-delay": "80ms" }}>
              <div className="home-stat">
                <label>Settlement</label>
                <strong>Stellar</strong>
              </div>
              <div className="home-stat">
                <label>Stable asset</label>
                <strong>USDC</strong>
              </div>
              <div className="home-stat">
                <label>Auth model</label>
                <strong>x402</strong>
              </div>
              <div className="home-stat">
                <label>Client keys</label>
                <strong>User wallet</strong>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="home-section" aria-labelledby="faq-heading" style={{ background: "rgba(10,10,10,0.35)" }}>
          <div className="home-section-inner">
            <div className="home-section-head reveal-on-scroll" style={{ "--reveal-delay": "0ms" }}>
              <div>
                <p className="home-kicker">04 // FAQ</p>
                <h2 id="faq-heading">Common questions</h2>
              </div>
              <p>Payments, deployment, privacy, and how to get unstuck.</p>
            </div>

            <div className="home-faq-columns reveal-on-scroll" style={{ "--reveal-delay": "60ms" }}>
              <dl className="home-faq-dl">
                <div className="home-faq-item">
                  <dt>Do I need a wallet?</dt>
                  <dd>
                    Yes — for paid commands you need the Freighter extension (or a compatible Stellar wallet flow your
                    deployment supports). You sign x402 payment payloads from your own address; the app never holds your
                    secret keys.
                  </dd>
                </div>
                <div className="home-faq-item">
                  <dt>What is x402 in one sentence?</dt>
                  <dd>
                    The server can respond with HTTP 402 and payment requirements; your wallet authorizes USDC movement
                    on Stellar; you retry the request with proof so the API can return the result.
                  </dd>
                </div>
                <div className="home-faq-item">
                  <dt>Testnet or mainnet?</dt>
                  <dd>
                    Typical setups use testnet for development. For production, set network, asset, and facilitator
                    settings in your server environment and fund operational wallets accordingly.
                  </dd>
                </div>
                <div className="home-faq-item">
                  <dt>Where does inference run?</dt>
                  <dd>
                    On the server you control. The public site only talks to your API; credentials for any neural
                    gateway or HTTP backend stay out of the browser bundle.
                  </dd>
                </div>
                <div className="home-faq-item">
                  <dt>What if a payment fails or times out?</dt>
                  <dd>
                    Check USDC balance and XLM for fees, network match (testnet vs mainnet), and that Freighter is on
                    the correct network. Retry the command; the terminal shows server messages when the API rejects a
                    request.
                  </dd>
                </div>
                <div className="home-faq-item">
                  <dt>Are listed prices exact?</dt>
                  <dd>
                    Service prices are configured on the server (e.g. per command tier). On-chain fees and facilitator
                    behavior are separate; treat explorer receipts as the source of truth for settlement.
                  </dd>
                </div>
              </dl>
              <dl className="home-faq-dl">
                <div className="home-faq-item">
                  <dt>Is this financial or legal advice?</dt>
                  <dd>
                    No. Outputs are informational. Verify anything material on official explorers, issuers, and your own
                    compliance requirements before acting.
                  </dd>
                </div>
                <div className="home-faq-item">
                  <dt>What data leaves my browser?</dt>
                  <dd>
                    Commands you type, API calls to your backend, and wallet interactions required for payments. Do not
                    paste secrets into the terminal. Follow your deployment’s privacy policy for logs and retention.
                  </dd>
                </div>
                <div className="home-faq-item">
                  <dt>How do I run the terminal on its own page?</dt>
                  <dd>
                    Open the <Link to="/terminal">/terminal</Link> route — full-height console without the marketing
                    sections.
                  </dd>
                </div>
                <div className="home-faq-item">
                  <dt>Why is the landing page separate from the terminal?</dt>
                  <dd>
                    So operators can bookmark a dedicated console URL and keep onboarding content on the home route
                    without scrolling past a long shell.
                  </dd>
                </div>
                <div className="home-faq-item">
                  <dt>Can I self-host the API?</dt>
                  <dd>
                    Yes — build the client, run the Node server with your env file, put HTTPS in front, and set CORS to
                    your site origin in production. See the repository README for deploy steps.
                  </dd>
                </div>
                <div className="home-faq-item">
                  <dt>Where do I report a security issue?</dt>
                  <dd>
                    Use the process in <strong>SECURITY.md</strong> in the repo (private report, not a public issue with
                    exploit details).
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <footer className="home-footer" id="contact">
          <div className="home-footer-inner">
            <div>
              <div className="home-footer-brand">
                <span className="home-brand-dot" aria-hidden />
                <span className="home-brand-text">LILA // SYSTEM</span>
              </div>
              <p className="home-footer-meta">
                Neural terminal · x402 · Stellar
                {siteUrl ? (
                  <>
                    {" · "}
                    <a href={siteUrl} className="home-footer-domain">
                      lilagent.xyz
                    </a>
                  </>
                ) : null}
              </p>
            </div>
            <div className="home-footer-links">
              <Link to="/terminal">Terminal</Link>
              <a href="#capabilities">Capabilities</a>
              {docsUrl ? (
                docsExternal ? (
                  <a href={docsUrl} target="_blank" rel="noopener noreferrer">
                    Docs
                  </a>
                ) : (
                  <Link to={docsUrl}>Docs</Link>
                )
              ) : null}
              {githubUrl ? (
                <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              ) : null}
              {xUrl ? (
                <a href={xUrl} target="_blank" rel="noopener noreferrer">
                  X
                </a>
              ) : null}
              <a href="mailto:hello@lilagent.xyz" className="home-nav-cta" style={{ display: "inline-block" }}>
                Contact
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
