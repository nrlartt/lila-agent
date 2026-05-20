import { getMeta, setMeta } from "./db.js";
import { type ApiToken, importApiToken } from "./altfun-api.js";

const API_BASE = process.env.ALTFUN_API_URL?.trim() || "https://api.alt.fun";
const PAGE_SIZE = 100;
const PAGE_DELAY_MS = Number(process.env.CATALOG_PAGE_DELAY_MS ?? 150);

type ApiResponse = {
  status: string;
  data: ApiToken[];
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Pull full token list from alt.fun official API (no RPC limits). */
export async function syncCatalogFromApi(): Promise<number> {
  let offset = 0;
  let imported = 0;
  let page = 0;

  console.log("Catalog sync: fetching all tokens from api.alt.fun…");

  while (true) {
    const url = `${API_BASE}/api/v1/tokens?limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`Catalog API ${res.status}: ${url}`);
    }

    const json = (await res.json()) as ApiResponse;
    if (json.status !== "success" || !Array.isArray(json.data)) {
      throw new Error("Catalog API returned unexpected payload");
    }

    if (json.data.length === 0) break;

    for (const token of json.data) {
      importApiToken(token);
      imported++;
    }

    page++;
    offset += json.data.length;

    if (page % 10 === 0) {
      console.log(`  catalog: ${imported} tokens (${offset} fetched)`);
    }

    if (json.data.length < PAGE_SIZE) break;
    await sleep(PAGE_DELAY_MS);
  }

  setMeta("catalog_sync_at", String(Math.floor(Date.now() / 1000)));
  setMeta("catalog_sync_count", String(imported));
  console.log(`Catalog sync complete: ${imported} tokens`);
  return imported;
}

export function shouldRefreshCatalog(): boolean {
  const last = getMeta("catalog_sync_at");
  if (!last) return true;
  const age = Math.floor(Date.now() / 1000) - Number(last);
  return age > Number(process.env.CATALOG_REFRESH_SEC ?? 120);
}
