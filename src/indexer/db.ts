import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

export type Lifecycle = "curve" | "graduating" | "graduated";

export type TokenCategory =
  | "all"
  | "new"
  | "curve"
  | "graduating"
  | "graduated"
  | "trending"
  | "volume"
  | "grad_ready"
  | "active";

export type TokenRow = {
  address: string;
  creator: string;
  lt_address: string;
  pair: string;
  name: string;
  ticker: string;
  description: string;
  image: string;
  url0: string;
  url1: string;
  url2: string;
  lifecycle: Lifecycle;
  k: string;
  launched_block: number;
  launched_tx: string;
  launched_at: number;
  graduated_pair: string | null;
  reserve_token: string | null;
  reserve_lt: string | null;
  lt_buffer_usdc: string | null;
  exchange_rate: string | null;
  can_graduate: number;
  trade_count: number;
  volume_lt: string;
  volume_usd_total: number;
  volume_usd_24h: number;
  mcap_usd: number;
  price_usd: number;
  change_24h: number | null;
  last_trade_at: number;
  last_buy_at: number;
  is_hidden: number;
  curve_filled_pct: number;
  curve_raised_usd: number;
  updated_at: number;
};

export type TokenMarketStats = {
  address: string;
  volume_usd_24h: number;
  volume_usd_total: number;
  mcap_usd: number;
  price_usd: number;
  change_24h: number | null;
  last_trade_at: number;
  curve_filled_pct?: number;
  curve_raised_usd?: number;
};

export type TradeRow = {
  id: number;
  token_address: string;
  trader: string;
  is_buy: number;
  lt_amount: string;
  token_amount: string;
  curve_supply: string;
  lt_reserve: string;
  block_number: number;
  tx_hash: string;
  created_at: number;
};

export type TokenQuery = {
  category?: TokenCategory;
  lifecycle?: Lifecycle;
  search?: string;
  limit?: number;
  offset?: number;
};

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dir = process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "altfun.db");
    db = new Database(file);
    db.pragma("journal_mode = WAL");
    migrate(db);
  }
  return db;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tokens (
      address TEXT PRIMARY KEY,
      creator TEXT NOT NULL,
      lt_address TEXT NOT NULL,
      pair TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      ticker TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      url0 TEXT NOT NULL DEFAULT '',
      url1 TEXT NOT NULL DEFAULT '',
      url2 TEXT NOT NULL DEFAULT '',
      lifecycle TEXT NOT NULL DEFAULT 'curve',
      k TEXT NOT NULL DEFAULT '0',
      launched_block INTEGER NOT NULL,
      launched_tx TEXT NOT NULL,
      launched_at INTEGER NOT NULL,
      graduated_pair TEXT,
      reserve_token TEXT,
      reserve_lt TEXT,
      lt_buffer_usdc TEXT,
      exchange_rate TEXT,
      can_graduate INTEGER NOT NULL DEFAULT 0,
      trade_count INTEGER NOT NULL DEFAULT 0,
      volume_lt TEXT NOT NULL DEFAULT '0',
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tokens_launched ON tokens(launched_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tokens_lifecycle ON tokens(lifecycle);
    CREATE INDEX IF NOT EXISTS idx_tokens_trade_count ON tokens(trade_count DESC);
    CREATE INDEX IF NOT EXISTS idx_tokens_volume ON tokens(CAST(volume_lt AS INTEGER) DESC);

    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_address TEXT NOT NULL,
      trader TEXT NOT NULL,
      is_buy INTEGER NOT NULL,
      lt_amount TEXT NOT NULL,
      token_amount TEXT NOT NULL,
      curve_supply TEXT NOT NULL,
      lt_reserve TEXT NOT NULL,
      block_number INTEGER NOT NULL,
      tx_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(tx_hash, token_address, trader, is_buy, lt_amount, token_amount)
    );

    CREATE INDEX IF NOT EXISTS idx_trades_token ON trades(token_address, id DESC);
    CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_trades_token_time ON trades(token_address, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_trades_token_buy ON trades(token_address, is_buy, created_at DESC);
  `);
  ensureTokenColumns(database);
}

function ensureTokenColumns(database: Database.Database) {
  const existing = new Set(
    (database.prepare("PRAGMA table_info(tokens)").all() as { name: string }[]).map(
      (r) => r.name,
    ),
  );
  const columns: [string, string][] = [
    ["volume_usd_total", "REAL NOT NULL DEFAULT 0"],
    ["volume_usd_24h", "REAL NOT NULL DEFAULT 0"],
    ["mcap_usd", "REAL NOT NULL DEFAULT 0"],
    ["price_usd", "REAL NOT NULL DEFAULT 0"],
    ["change_24h", "REAL"],
    ["last_trade_at", "INTEGER NOT NULL DEFAULT 0"],
    ["last_buy_at", "INTEGER NOT NULL DEFAULT 0"],
    ["is_hidden", "INTEGER NOT NULL DEFAULT 0"],
    ["curve_filled_pct", "REAL NOT NULL DEFAULT 0"],
    ["curve_raised_usd", "REAL NOT NULL DEFAULT 0"],
  ];
  for (const [name, def] of columns) {
    if (!existing.has(name)) {
      database.exec(`ALTER TABLE tokens ADD COLUMN ${name} ${def}`);
    }
  }
  database.exec(
    `CREATE INDEX IF NOT EXISTS idx_tokens_vol24 ON tokens(volume_usd_24h DESC)`,
  );
  database.exec(
    `CREATE INDEX IF NOT EXISTS idx_tokens_vol_total ON tokens(volume_usd_total DESC)`,
  );
  database.exec(
    `CREATE INDEX IF NOT EXISTS idx_tokens_last_buy ON tokens(last_buy_at DESC)`,
  );

  const hasLastBuy = (
    database.prepare("PRAGMA table_info(tokens)").all() as { name: string }[]
  ).some((r) => r.name === "last_buy_at");
  if (hasLastBuy) {
    backfillLastBuyAt(database);
  }
}

/** Set last_buy_at from indexed trades (on-chain bonding buys). */
function backfillLastBuyAt(database: Database.Database) {
  const done = getMeta("last_buy_at_backfill");
  if (done === "1") return;

  database.exec(`
    UPDATE tokens SET last_buy_at = COALESCE((
      SELECT MAX(created_at) FROM trades
      WHERE trades.token_address = tokens.address AND trades.is_buy = 1
    ), 0)
  `);
  setMeta("last_buy_at_backfill", "1");
}

export function getMeta(key: string): string | undefined {
  const row = getDb()
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value;
}

export function setMeta(key: string, value: string) {
  getDb()
    .prepare(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}

export type TokenUpsertInput = {
  address: string;
  creator: string;
  lt_address: string;
  pair?: string;
  name: string;
  ticker: string;
  description?: string;
  image?: string;
  url0?: string;
  url1?: string;
  url2?: string;
  lifecycle: Lifecycle;
  k: string;
  launched_block: number;
  launched_tx: string;
  launched_at: number;
  graduated_pair?: string | null;
  reserve_token?: string | null;
  reserve_lt?: string | null;
  lt_buffer_usdc?: string | null;
  exchange_rate?: string | null;
  can_graduate?: number;
};

/** Insert or update token metadata from launch event without wiping trade stats. */
export function upsertLaunch(row: TokenUpsertInput) {
  const now = Math.floor(Date.now() / 1000);
  getDb()
    .prepare(
      `INSERT INTO tokens (
        address, creator, lt_address, pair, name, ticker, description, image,
        url0, url1, url2, lifecycle, k, launched_block, launched_tx, launched_at,
        graduated_pair, reserve_token, reserve_lt, lt_buffer_usdc, exchange_rate,
        can_graduate, trade_count, volume_lt, updated_at
      ) VALUES (
        @address, @creator, @lt_address, @pair, @name, @ticker, @description, @image,
        @url0, @url1, @url2, @lifecycle, @k, @launched_block, @launched_tx, @launched_at,
        @graduated_pair, @reserve_token, @reserve_lt, @lt_buffer_usdc, @exchange_rate,
        @can_graduate, 0, '0', @updated_at
      )
      ON CONFLICT(address) DO UPDATE SET
        creator = excluded.creator,
        lt_address = excluded.lt_address,
        pair = COALESCE(NULLIF(excluded.pair, ''), tokens.pair),
        name = excluded.name,
        ticker = excluded.ticker,
        lifecycle = excluded.lifecycle,
        k = excluded.k,
        launched_block = CASE
          WHEN excluded.launched_block > 0 AND tokens.launched_block > 0
            THEN MIN(tokens.launched_block, excluded.launched_block)
          WHEN excluded.launched_block > 0 THEN excluded.launched_block
          ELSE tokens.launched_block
        END,
        launched_tx = CASE
          WHEN excluded.launched_tx != '' THEN excluded.launched_tx
          ELSE tokens.launched_tx
        END,
        launched_at = CASE
          WHEN excluded.launched_at > 0 AND tokens.launched_at > 0
            THEN MIN(tokens.launched_at, excluded.launched_at)
          WHEN excluded.launched_at > 0 THEN excluded.launched_at
          ELSE tokens.launched_at
        END,
        updated_at = excluded.updated_at`,
    )
    .run({
      pair: "",
      description: "",
      image: "",
      url0: "",
      url1: "",
      url2: "",
      graduated_pair: null,
      reserve_token: null,
      reserve_lt: null,
      lt_buffer_usdc: null,
      exchange_rate: null,
      can_graduate: 0,
      updated_at: now,
      ...row,
    });
}

export function upsertTokenMarketStats(stats: TokenMarketStats) {
  const now = Math.floor(Date.now() / 1000);
  getDb()
    .prepare(
      `UPDATE tokens SET
        volume_usd_24h = @volume_usd_24h,
        volume_usd_total = @volume_usd_total,
        mcap_usd = @mcap_usd,
        price_usd = @price_usd,
        change_24h = @change_24h,
        last_trade_at = @last_trade_at,
        curve_filled_pct = COALESCE(@curve_filled_pct, curve_filled_pct),
        curve_raised_usd = COALESCE(@curve_raised_usd, curve_raised_usd),
        updated_at = @updated_at
       WHERE address = @address`,
    )
    .run({
      ...stats,
      address: stats.address.toLowerCase(),
      updated_at: now,
    });
}

export function upsertTokenEnrichment(row: Partial<TokenUpsertInput> & { address: string }) {
  const now = Math.floor(Date.now() / 1000);
  const existing = getToken(row.address);
  if (!existing) return;

  getDb()
    .prepare(
      `UPDATE tokens SET
        description = COALESCE(@description, description),
        image = COALESCE(@image, image),
        url0 = COALESCE(@url0, url0),
        url1 = COALESCE(@url1, url1),
        url2 = COALESCE(@url2, url2),
        pair = COALESCE(NULLIF(@pair, ''), pair),
        lifecycle = COALESCE(@lifecycle, lifecycle),
        graduated_pair = COALESCE(@graduated_pair, graduated_pair),
        reserve_token = @reserve_token,
        reserve_lt = @reserve_lt,
        lt_buffer_usdc = @lt_buffer_usdc,
        exchange_rate = @exchange_rate,
        can_graduate = COALESCE(@can_graduate, can_graduate),
        updated_at = @updated_at
       WHERE address = @address`,
    )
    .run({
      description: row.description ?? existing.description,
      image: row.image ?? existing.image,
      url0: row.url0 ?? existing.url0,
      url1: row.url1 ?? existing.url1,
      url2: row.url2 ?? existing.url2,
      pair: row.pair ?? existing.pair,
      lifecycle: row.lifecycle ?? existing.lifecycle,
      graduated_pair: row.graduated_pair ?? existing.graduated_pair,
      reserve_token: row.reserve_token ?? existing.reserve_token,
      reserve_lt: row.reserve_lt ?? existing.reserve_lt,
      lt_buffer_usdc: row.lt_buffer_usdc ?? existing.lt_buffer_usdc,
      exchange_rate: row.exchange_rate ?? existing.exchange_rate,
      can_graduate: row.can_graduate ?? existing.can_graduate,
      updated_at: now,
      address: row.address.toLowerCase(),
    });
}

/** Bump activity timestamps from alt.fun global tape or live indexer. */
export function touchTokenTrade(address: string, isBuy: boolean, createdAt: number) {
  const now = Math.floor(Date.now() / 1000);
  getDb()
    .prepare(
      `UPDATE tokens SET
        last_trade_at = MAX(last_trade_at, @created_at),
        last_buy_at = CASE
          WHEN @is_buy = 1 THEN MAX(last_buy_at, @created_at)
          ELSE last_buy_at
        END,
        updated_at = @now
       WHERE address = @address`,
    )
    .run({
      address: address.toLowerCase(),
      created_at: createdAt,
      is_buy: isBuy ? 1 : 0,
      now,
    });
}

export function insertTrade(trade: Omit<TradeRow, "id">) {
  try {
    getDb()
      .prepare(
        `INSERT INTO trades (token_address, trader, is_buy, lt_amount, token_amount, curve_supply, lt_reserve, block_number, tx_hash, created_at)
         VALUES (@token_address, @trader, @is_buy, @lt_amount, @token_amount, @curve_supply, @lt_reserve, @block_number, @tx_hash, @created_at)`,
      )
      .run(trade);

    getDb()
      .prepare(
        `UPDATE tokens SET
          trade_count = trade_count + 1,
          volume_lt = CAST((CAST(volume_lt AS INTEGER) + CAST(@lt_amount AS INTEGER)) AS TEXT),
          reserve_token = @curve_supply,
          reserve_lt = @lt_reserve,
          last_trade_at = MAX(last_trade_at, @created_at),
          last_buy_at = CASE
            WHEN @is_buy = 1 THEN MAX(last_buy_at, @created_at)
            ELSE last_buy_at
          END,
          updated_at = @created_at
         WHERE address = @token_address`,
      )
      .run(trade);
  } catch {
    // duplicate
  }
}

function buildWhere(query: TokenQuery): { sql: string; params: Record<string, unknown> } {
  const clauses: string[] = ["is_hidden = 0"];
  const params: Record<string, unknown> = {};
  const now = Math.floor(Date.now() / 1000);
  const dayAgo = now - 86_400;

  const category = query.category ?? "all";
  switch (category) {
    case "new":
      clauses.push("launched_at >= @dayAgo");
      params.dayAgo = dayAgo;
      break;
    case "curve":
    case "graduating":
    case "graduated":
      clauses.push("lifecycle = @lifecycle");
      params.lifecycle = category;
      break;
    case "grad_ready":
      clauses.push("can_graduate = 1 AND lifecycle = 'curve'");
      break;
    case "active":
      clauses.push(
        "(volume_usd_24h > 0 OR trade_count > 0 OR last_trade_at >= @dayAgo)",
      );
      params.dayAgo = dayAgo;
      break;
    case "trending":
      clauses.push("volume_usd_24h > 0");
      break;
    case "volume":
      clauses.push("(volume_usd_24h > 0 OR volume_usd_total > 0)");
      break;
    case "all":
    default:
      break;
  }

  if (query.lifecycle && category === "all") {
    clauses.push("lifecycle = @lifecycleFilter");
    params.lifecycleFilter = query.lifecycle;
  }

  if (query.search?.trim()) {
    clauses.push(
      "(LOWER(name) LIKE @q OR LOWER(ticker) LIKE @q OR LOWER(address) LIKE @q)",
    );
    params.q = `%${query.search.trim().toLowerCase()}%`;
  }

  return { sql: clauses.join(" AND "), params };
}

function orderBy(category: TokenCategory): string {
  switch (category) {
    case "all":
      return "last_trade_at DESC, last_buy_at DESC, launched_at DESC";
    case "trending":
    case "volume":
      return "volume_usd_24h DESC, volume_usd_total DESC, last_trade_at DESC";
    case "new":
      return "launched_at DESC";
    case "active":
      return "volume_usd_24h DESC, last_trade_at DESC, volume_usd_total DESC";
    default:
      return "volume_usd_24h DESC, volume_usd_total DESC, launched_at DESC";
  }
}

export function countTokens(query: TokenQuery = {}): number {
  const { sql, params } = buildWhere(query);
  const row = getDb()
    .prepare(`SELECT COUNT(*) as c FROM tokens WHERE ${sql}`)
    .get(params) as { c: number };
  return row.c;
}

export function queryTokens(query: TokenQuery = {}): TokenRow[] {
  const limit = Math.min(query.limit ?? 50, 200);
  const offset = query.offset ?? 0;
  const category = query.category ?? "all";

  const { sql, params } = buildWhere(query);
  return getDb()
    .prepare(
      `SELECT * FROM tokens WHERE ${sql} ORDER BY ${orderBy(category)} LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit, offset }) as TokenRow[];
}

export function listTokensForEnrich(limit = 50, offset = 0): TokenRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM tokens ORDER BY updated_at ASC LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as TokenRow[];
}

export function getGlobalStats() {
  const now = Math.floor(Date.now() / 1000);
  const dayAgo = now - 86_400;
  const dbi = getDb();

  const totals = dbi
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN lifecycle = 'curve' THEN 1 ELSE 0 END) as curve,
        SUM(CASE WHEN lifecycle = 'graduating' THEN 1 ELSE 0 END) as graduating,
        SUM(CASE WHEN lifecycle = 'graduated' THEN 1 ELSE 0 END) as graduated,
        SUM(CASE WHEN launched_at >= ? THEN 1 ELSE 0 END) as new24h,
        SUM(CASE WHEN can_graduate = 1 THEN 1 ELSE 0 END) as gradReady,
        SUM(CASE WHEN volume_usd_24h > 0 OR trade_count > 0 OR last_trade_at >= ? THEN 1 ELSE 0 END) as active
      FROM tokens WHERE is_hidden = 0`,
    )
    .get(dayAgo, dayAgo) as Record<string, number>;

  const trades24h = dbi
    .prepare("SELECT COUNT(*) as c FROM trades WHERE created_at >= ?")
    .get(dayAgo) as { c: number };

  return {
    total: totals.total ?? 0,
    curve: totals.curve ?? 0,
    graduating: totals.graduating ?? 0,
    graduated: totals.graduated ?? 0,
    new24h: totals.new24h ?? 0,
    gradReady: totals.gradReady ?? 0,
    active: totals.active ?? 0,
    trades24h: trades24h.c,
    launchBackfillComplete: getMeta("launch_backfill_complete") === "true",
    launchScanBlock: getMeta("launch_scan_block"),
    eventsBlock: getMeta("last_events_block"),
    catalogSyncAt: getMeta("catalog_sync_at"),
    catalogSyncCount: Number(getMeta("catalog_sync_count") ?? 0),
  };
}

export function getToken(address: string): TokenRow | undefined {
  return getDb()
    .prepare("SELECT * FROM tokens WHERE LOWER(address) = LOWER(?)")
    .get(address) as TokenRow | undefined;
}

export function patchTokenLifecycle(
  address: string,
  lifecycle: Lifecycle,
  extra?: { graduated_pair?: string },
) {
  const now = Math.floor(Date.now() / 1000);
  getDb()
    .prepare(
      `UPDATE tokens SET lifecycle = @lifecycle,
        graduated_pair = COALESCE(@graduated_pair, graduated_pair),
        updated_at = @updated_at
       WHERE address = @address`,
    )
    .run({
      address: address.toLowerCase(),
      lifecycle,
      graduated_pair: extra?.graduated_pair ?? null,
      updated_at: now,
    });
}

export function getTrades(tokenAddress: string, limit = 30): TradeRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM trades WHERE token_address = ? ORDER BY id DESC LIMIT ?",
    )
    .all(tokenAddress.toLowerCase(), limit) as TradeRow[];
}

/** @deprecated use queryTokens */
export function listTokens(limit = 50, lifecycle?: Lifecycle): TokenRow[] {
  return queryTokens({ limit, lifecycle, category: lifecycle ?? "all" });
}
