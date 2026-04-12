/**
 * API paths for static hosting (e.g. GitHub Pages): set VITE_API_ORIGIN to your Express origin.
 */
export function apiUrl(path) {
  const origin = (import.meta.env.VITE_API_ORIGIN || "").trim().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!origin) return p;
  return `${origin}${p}`;
}
