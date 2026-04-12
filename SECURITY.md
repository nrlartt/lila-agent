# Security Policy

## Supported versions

We address security issues in the current `main` branch and the latest release tag. Use the latest commit for production deployments when possible.

## Reporting a vulnerability

**Please do not** open a public GitHub issue for undisclosed security vulnerabilities.

Instead, report privately:

1. Open a **GitHub Security Advisory** (repository **Security** tab → **Report a vulnerability**), or  
2. Email maintainers with a clear subject line (e.g. `[SECURITY] LILA`) and include:
   - Description of the issue and impact  
   - Steps to reproduce  
   - Affected versions or commit hashes if known  

We aim to acknowledge reports within a few business days and coordinate disclosure after a fix is available.

## Operational security

### Secrets and environment

- Never commit `.env`, private keys (`STELLAR_AGENT_SECRET`), or API tokens (`OPENCLAW_GATEWAY_TOKEN`, optional HTTP inference keys, etc.).
- Use separate keys for testnet vs mainnet; rotate keys if they are exposed.
- Restrict file permissions on servers that hold `.env` (e.g. `chmod 600`).

### Production deployment

- Terminate **HTTPS** at a reverse proxy (nginx, Caddy, cloud load balancer) and only then enable **HSTS** by setting `ENABLE_HSTS=true` in the server environment (see `.env.example`).
- Set **`CORS_ORIGIN`** to your real frontend origin(s), comma-separated, instead of relying on the default permissive behavior.
- Keep `NODE_ENV=production` for the Node process so static assets and SPA routing behave correctly.
- Review rate limits on `/api/premium/*` in `server/rateLimit.js` for your traffic profile.

### Application headers

The Express app uses [Helmet](https://helmetjs.github.io/) with `Content-Security-Policy` disabled by default so the built SPA and third-party wallet flows keep working. Tightening CSP for your host is recommended for high-assurance deployments.

### Dependencies

Run `npm audit` regularly and upgrade dependencies for patched releases. The project pins major versions where practical; review lockfile updates in PRs.

## Scope

This policy covers the LILA application code in this repository. Third-party services (Stellar network, x402 facilitator, configured inference gateways, Freighter) are governed by their own terms and security practices.
