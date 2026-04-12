/**
 * Public URLs for nav/footer. Priority: `VITE_*` in `.env` → defaults in `src/config/defaultSiteLinks.json`.
 * Edit the JSON file or set env after publishing your repo.
 */
import defaults from "../config/defaultSiteLinks.json";

export function getSiteLinks() {
  const siteUrl = (import.meta.env.VITE_SITE_URL || defaults.siteUrl || "").trim();
  const githubUrl = (import.meta.env.VITE_GITHUB_URL || defaults.github || "").trim();
  const docsOverride = (import.meta.env.VITE_DOCS_URL || "").trim();
  /** In-app docs at `/docs` unless `VITE_DOCS_URL` points to an external URL. */
  const docsUrl = docsOverride || "/docs";
  const xUrl = (import.meta.env.VITE_X_URL || defaults.x || "").trim();
  return { siteUrl, githubUrl, docsUrl, xUrl };
}

/** True when Docs menu should open in a new tab (external URL). */
export function isExternalDocsUrl(docsUrl) {
  return /^https?:\/\//i.test(docsUrl || "");
}
