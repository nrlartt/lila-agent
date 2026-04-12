# Deployment

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
