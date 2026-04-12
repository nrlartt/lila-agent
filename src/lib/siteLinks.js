/**
 * Public URLs for nav/footer. Priority: `VITE_*` in `.env` → defaults in `src/config/defaultSiteLinks.json`.
 * Edit the JSON file or set env after publishing your repo.
 */
import defaults from "../config/defaultSiteLinks.json";

export function getSiteLinks() {
  const githubUrl = (import.meta.env.VITE_GITHUB_URL || defaults.github || "").trim();
  const docsOverride = (import.meta.env.VITE_DOCS_URL || "").trim();
  const docsUrl =
    docsOverride ||
    (githubUrl ? `${githubUrl.replace(/\/$/, "")}/blob/main/docs/README.md` : "");
  const xUrl = (import.meta.env.VITE_X_URL || defaults.x || "").trim();
  return { githubUrl, docsUrl, xUrl };
}
