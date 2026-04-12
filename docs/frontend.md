# Frontend

## Stack

- **React 18** + **Vite** (dev/build tooling)
- **react-router-dom** — `BrowserRouter` with two routes
- Global styles: `src/styles.css` (terminal), `src/home.css` (landing)

## Routes

| Path | Component | Notes |
|------|-----------|--------|
| `/` | `HomePage` | Landing, hero, FAQ, links to terminal |
| `/terminal` | `TerminalPage` | Thin nav + `Terminal` |

## Terminal

- `src/components/Terminal.jsx` — command loop, boot lines, `fetch("/api/services")` on boot.
- Wallet: `src/lib/wallet.js` (Freighter).
- Paid calls: `src/lib/x402UserClient.js` + `@x402/fetch`.

## Development

- `npm run dev` runs API + Vite dev server; Vite proxies `/api` to the backend (see `vite.config.js`).

## Production

- No separate CDN required; Node serves `dist/` as static files.
