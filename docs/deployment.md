# Deployment

## Production domain (`lilagent.xyz`)

The public deployment is **`https://lilagent.xyz`**.

- **Browser:** SPA and API on the **same origin**. Leave **`VITE_API_ORIGIN`** unset so the terminal uses relative `/api/*` URLs.
- **CORS:** set **`CORS_ORIGIN=https://lilagent.xyz`** (and `www` only if you use it; add both comma-separated if needed).
- **Agents (OpenClaw MCP, scripts):** set **`LILA_BASE_URL`** / **`LILA_PUBLIC_URL`** to **`https://lilagent.xyz`** (no trailing slash). See [OpenClaw & MCP](openclaw-mcp.md).
- **TLS:** terminate HTTPS at your reverse proxy; then set **`ENABLE_HSTS=true`** only when end-to-end HTTPS is correct.

## Build

```bash
npm ci
npm run build
```

Output: `dist/` (static assets + `index.html`).

## Run

```bash
npm start
```

Uses `cross-env` (`NODE_ENV=production`) on Windows; the server serves `dist/` and API on `PORT`.

## Reverse proxy

- Terminate **TLS** at nginx, Caddy, or your cloud load balancer.
- Proxy `/` to the Node process (or same host + port).
- Set **`CORS_ORIGIN`** to your public site origin(s) if the browser calls the API from another hostname.
- Optionally set **`ENABLE_HSTS=true`** only when HTTPS is correctly configured end-to-end.

## Process management

Use systemd, PM2, Docker, or platform-native runners. Ensure:

- `NODE_ENV=production`
- `.env` present only on the host (not in the image if possible)
- Logs rotated; no secrets in logs

## SPA routing

All non-file routes must return `index.html` for client-side routing. The Express app already does this in production (`app.get("*", ...)`).

## Health checks

Point your orchestrator at `GET /api/health` for readiness.
