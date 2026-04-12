import { Link } from "react-router-dom";
import { getSiteLinks } from "../lib/siteLinks.js";
import "../docs.css";

const toc = [
  { id: "overview", label: "Overview" },
  { id: "agent-protocol", label: "Agent protocol" },
  { id: "architecture", label: "Architecture" },
  { id: "api", label: "API reference" },
  { id: "environment", label: "Environment" },
  { id: "deployment", label: "Deployment" },
  { id: "mcp", label: "OpenClaw & MCP" },
  { id: "resources", label: "Stellar & x402" },
];

export default function DocsPage() {
  const { siteUrl, githubUrl } = getSiteLinks();
  const skillHref = siteUrl ? `${siteUrl.replace(/\/$/, "")}/skill.md` : "/skill.md";

  return (
    <div className="docs-page">
      <header className="docs-page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          <Link to="/">← Home</Link>
          <Link to="/terminal">Terminal</Link>
        </div>
        <span className="docs-page-header-title">Documentation</span>
      </header>

      <div className="docs-page-layout">
        <nav className="docs-toc" aria-label="Table of contents">
          <div className="docs-toc-title">On this page</div>
          <ul>
            {toc.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="docs-content">
          <h1>LILA technical documentation</h1>
          <p className="docs-note">
            Operator reference for the neural terminal, REST API, x402 on Stellar, and MCP integration. Product
            marketing copy lives on the{" "}
            <Link to="/">home page</Link>.
            {githubUrl ? (
              <>
                {" "}
                Source:{" "}
                <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
                .
              </>
            ) : null}
            {siteUrl ? (
              <>
                {" "}
                Live:{" "}
                <a href={siteUrl}>{siteUrl.replace(/^https?:\/\//, "")}</a>
              </>
            ) : null}
          </p>

          <h2 id="overview">Overview</h2>
          <p>
            LILA is a full-stack app: React SPA (landing <code>/</code>, terminal <code>/terminal</code>, this hub{" "}
            <code>/docs</code>) and an Express server for <code>/api/*</code>. Premium AI routes use x402 (HTTP 402 +
            Soroban + USDC) when <code>STELLAR_PAY_TO</code> is configured. Remote LLM inference can use OpenClaw
            gateway, Groq, or OpenAI. See <code>LLM_PROVIDER</code> in Environment.
          </p>

          <h2 id="agent-protocol">Agent protocol</h2>
          <p>
            AI runtimes (OpenClaw, Cursor, Claude Code, or any MCP host) should follow the canonical{" "}
            <strong>skill.md</strong> contract: when to call <code>lila_services</code>, <code>lila_health</code>, and{" "}
            <code>lila_query</code>, how to map user intent to <code>service</code> + <code>input</code>, and safety
            rules (no fabricated on-chain data, respect x402 costs).
          </p>
          <p>
            <strong>Read and follow:</strong>{" "}
            <a href={skillHref} target="_blank" rel="noopener noreferrer">
              {skillHref}
            </a>
            . The same file is served at <code>/skill.md</code> from the static root after build. The optional Cursor /
            OpenClaw skill in <code>skills/lila-openclaw/SKILL.md</code> points to this URL.
          </p>

          <h2 id="architecture">Architecture</h2>
          <p>
            Browser → HTTPS → Express (Helmet, CORS, rate limit on premium) → x402 middleware on{" "}
            <code>POST /api/premium/*</code> → LLM layer (<code>server/llm.js</code>) → Stellar / facilitator for
            settlement.
          </p>

          <h2 id="api">API reference</h2>
          <p>
            Base URL is your deployment origin (production: same host as the SPA, e.g.{" "}
            <code>https://lilagent.xyz</code>).
          </p>

          <h3>Public</h3>
          <ul>
            <li>
              <code>GET /api/services</code>: metadata, prices, <code>x402Server</code>, <code>llmReady</code>
            </li>
            <li>
              <code>GET /api/health</code>: liveness
            </li>
          </ul>

          <h3>Premium (x402 when configured)</h3>
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Body</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>POST</td>
                <td>/api/premium/chat</td>
                <td>{`{ "message": string }`}</td>
              </tr>
              <tr>
                <td>POST</td>
                <td>/api/premium/analyze</td>
                <td>{`{ "query": string }`}</td>
              </tr>
              <tr>
                <td>POST</td>
                <td>/api/premium/code</td>
                <td>{`{ "prompt": string }`}</td>
              </tr>
              <tr>
                <td>POST</td>
                <td>/api/premium/research</td>
                <td>{`{ "topic": string }`}</td>
              </tr>
            </tbody>
          </table>

          <h3>Agent (optional)</h3>
          <p>
            <code>POST /api/agent/query</code> with <code>{`{ "service", "input" }`}</code>. The server pays premium
            routes using <code>STELLAR_AGENT_SECRET</code> when x402 and agent wallet are configured. Intended for
            trusted backends and MCP bridges; add your own edge auth if you expose it publicly.
          </p>

          <h2 id="environment">Environment</h2>
          <p>
            Load <code>.env</code> at the repo root. Key groups: Stellar / x402, <code>PORT</code>,{" "}
            <code>CORS_ORIGIN</code>, <code>LILA_PUBLIC_URL</code> / <code>LILA_BASE_URL</code> for agents, inference
            keys, <code>LLM_PROVIDER</code>, and <code>VITE_*</code> for the client build.
          </p>
          <p>
            See the repository <code>.env.example</code> and <code>docs/environment.md</code> for the full table.
          </p>

          <h2 id="deployment">Deployment</h2>
          <p>
            <code>npm run build</code> then <code>npm start</code> (Express serves <code>dist/</code> in production).
            Terminate TLS at your reverse proxy; set <code>CORS_ORIGIN</code> to your public origin; use{" "}
            <code>ENABLE_HSTS=true</code> only with correct HTTPS. SPA fallback for client routes (including{" "}
            <code>/docs</code>) is handled in <code>server/index.js</code>.
          </p>

          <h2 id="mcp">OpenClaw & MCP</h2>
          <p>
            Run <code>npm run mcp</code> for a stdio MCP server. Tools: <code>lila_services</code>,{" "}
            <code>lila_health</code>, <code>lila_query</code> (calls <code>POST /api/agent/query</code>). Set{" "}
            <code>LILA_BASE_URL</code> to your public API (e.g. <code>https://lilagent.xyz</code>) in OpenClaw{" "}
            <code>mcp.servers</code> config. See <code>config/openclaw-lila.mcp.example.json</code> and{" "}
            <a href="https://docs.openclaw.ai/cli/mcp" target="_blank" rel="noopener noreferrer">
              OpenClaw MCP CLI
            </a>
            .
          </p>

          <h2 id="resources">Stellar & x402</h2>
          <p>
            Protocol overview:{" "}
            <a href="https://developers.stellar.org/docs/build/agentic-payments/x402" target="_blank" rel="noopener noreferrer">
              x402 on Stellar
            </a>
            . Facilitator:{" "}
            <a href="https://www.x402.org/facilitator/supported" target="_blank" rel="noopener noreferrer">
              supported networks
            </a>
            . Extended link list in the repo <code>docs/stellar-agentic-resources.md</code>.
          </p>
        </article>
      </div>
    </div>
  );
}
