# Contributing to LILA

Thanks for your interest in improving this project.

## Development setup

1. Fork the repository and clone your fork.
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure Stellar testnet keys as documented in [README.md](README.md).
4. Run the full stack in development:

   ```bash
   npm run dev
   ```

   This starts the API (default `http://localhost:3001`) and the frontend dev server (default `http://localhost:5173`).

5. Before opening a pull request, run a production build:

   ```bash
   npm run build
   ```

6. If you change API behavior, env vars, or deployment steps, update the matching file under **`docs/`**.

## Pull requests

- Keep changes focused on a single concern when possible.
- Do not commit `.env`, secrets, or `dist/` output.
- Update documentation if you change environment variables, API behavior, or deployment steps.

## Code style

- Match existing formatting and naming in the files you touch.
- Prefer clear, minimal comments where behavior is non-obvious.

## Security

If you find a security issue, please follow [SECURITY.md](SECURITY.md) instead of opening a public issue with exploit details.
