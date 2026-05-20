import { type Address, parseAbiItem } from "viem";
import { ADDRESSES } from "../constants.js";
import { getPublicClient } from "../chain.js";
import {
  getMeta,
  insertTrade,
  listTokensForEnrich,
  patchTokenLifecycle,
  setMeta,
  upsertLaunch,
} from "./db.js";
import { enrichToken } from "./enrich.js";
import { startActivityPoller, setActivityBroadcast } from "./activity.js";
import { shouldRefreshCatalog, syncCatalogFromApi } from "./catalog.js";

/** Alchemy free tier allows max 10 blocks per eth_getLogs; override via INDEXER_BLOCK_CHUNK. */
const CHUNK = BigInt(process.env.INDEXER_BLOCK_CHUNK ?? "10");
const RPC_PAUSE_MS = Number(process.env.INDEXER_RPC_PAUSE_MS ?? 2500);
const MAX_RPC_RETRIES = 6;
const ENRICH_BATCH = Number(process.env.INDEXER_ENRICH_BATCH ?? 15);

/** First block to scan for TokenLaunched (alt.fun Bonding era on HyperEVM). */
const DEFAULT_LAUNCH_START = 34_800_000n;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimited(err: unknown): boolean {
  const msg = (err as Error).message?.toLowerCase() ?? "";
  return msg.includes("rate limit") || msg.includes("exceeds defined limit");
}

async function withRpcRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let delay = RPC_PAUSE_MS;
  for (let attempt = 1; attempt <= MAX_RPC_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimited(err) || attempt === MAX_RPC_RETRIES) throw err;
      console.warn(`${label}: rate limited, retry ${attempt}/${MAX_RPC_RETRIES} in ${delay}ms`);
      await sleep(delay);
      delay = Math.min(delay * 2, 60_000);
    }
  }
  throw new Error(`${label}: unreachable`);
}

const blockTsCache = new Map<string, number>();

async function blockTimestamp(blockNumber: bigint): Promise<number> {
  const key = blockNumber.toString();
  const cached = blockTsCache.get(key);
  if (cached != null) return cached;
  const block = await withRpcRetry(`getBlock ${key}`, () =>
    getPublicClient().getBlock({ blockNumber }),
  );
  const ts = Number(block.timestamp);
  blockTsCache.set(key, ts);
  return ts;
}

const tokenLaunchedEvent = parseAbiItem(
  "event TokenLaunched(address indexed token, address indexed creator, address indexed ltAddress, string name, string ticker, uint256 k)",
);
const tradeEvent = parseAbiItem(
  "event Trade(address indexed token, address indexed trader, bool indexed isBuy, uint256 ltAmount, uint256 tokenAmount, uint256 newCurveSupply, uint256 newLtReserve)",
);
const graduatingEvent = parseAbiItem(
  "event TokenGraduating(address indexed token, uint256 tokensForLP, uint256 ltFromPair, uint256 lpBurned, uint256 unsoldBurned)",
);
const graduatedEvent = parseAbiItem(
  "event TokenGraduated(address indexed token, address indexed pairAddress, uint256 liquidity, uint256 tokensInLP, uint256 lpBurned, uint256 unsoldBurned)",
);

type BroadcastFn = (event: string, data: unknown) => void;

let broadcast: BroadcastFn = () => {};

export function setIndexerBroadcast(fn: BroadcastFn) {
  broadcast = fn;
}

function launchStartBlock(): bigint {
  const env = process.env.INDEXER_START_BLOCK?.trim();
  if (env) return BigInt(env);
  const saved = getMeta("launch_scan_from");
  if (saved) return BigInt(saved);
  return DEFAULT_LAUNCH_START;
}

async function processLaunchedLogs(fromBlock: bigint, toBlock: bigint) {
  const client = getPublicClient();
  const logs = await withRpcRetry(`getLogs launches ${fromBlock}-${toBlock}`, () =>
    client.getLogs({
      address: ADDRESSES.bonding,
      event: tokenLaunchedEvent,
      fromBlock,
      toBlock,
    }),
  );

  const blocks = [...new Set(logs.map((l) => l.blockNumber))];
  for (const bn of blocks) {
    await blockTimestamp(bn);
  }

  for (const log of logs) {
    const ts = blockTsCache.get(log.blockNumber.toString()) ?? (await blockTimestamp(log.blockNumber));
    const args = log.args;
    if (
      !args.token ||
      !args.creator ||
      !args.ltAddress ||
      args.k == null ||
      !args.name ||
      !args.ticker
    ) {
      continue;
    }

    upsertLaunch({
      address: args.token.toLowerCase(),
      creator: args.creator.toLowerCase(),
      lt_address: args.ltAddress.toLowerCase(),
      name: args.name,
      ticker: args.ticker,
      lifecycle: "curve",
      k: args.k.toString(),
      launched_block: Number(log.blockNumber),
      launched_tx: log.transactionHash,
      launched_at: ts,
    });

    broadcast("token_launched", { address: args.token.toLowerCase() });
  }

  return logs.length;
}

async function processTradeLogs(fromBlock: bigint, toBlock: bigint) {
  const client = getPublicClient();
  const logs = await client.getLogs({
    address: ADDRESSES.bonding,
    event: tradeEvent,
    fromBlock,
    toBlock,
  });

  for (const log of logs) {
    const ts = await blockTimestamp(log.blockNumber);
    const args = log.args;
    if (
      !args.token ||
      !args.trader ||
      args.ltAmount == null ||
      args.tokenAmount == null ||
      args.newCurveSupply == null ||
      args.newLtReserve == null
    ) {
      continue;
    }

    insertTrade({
      token_address: args.token.toLowerCase(),
      trader: args.trader.toLowerCase(),
      is_buy: args.isBuy ? 1 : 0,
      lt_amount: args.ltAmount.toString(),
      token_amount: args.tokenAmount.toString(),
      curve_supply: args.newCurveSupply.toString(),
      lt_reserve: args.newLtReserve.toString(),
      block_number: Number(log.blockNumber),
      tx_hash: log.transactionHash,
      created_at: ts,
    });

    broadcast("trade", {
      token: args.token.toLowerCase(),
      isBuy: args.isBuy,
      at: ts,
    });
  }
}

async function processGraduatingLogs(fromBlock: bigint, toBlock: bigint) {
  const client = getPublicClient();
  const logs = await client.getLogs({
    address: ADDRESSES.bonding,
    event: graduatingEvent,
    fromBlock,
    toBlock,
  });

  for (const log of logs) {
    const token = log.args.token;
    if (!token) continue;
    patchTokenLifecycle(token.toLowerCase(), "graduating");
    broadcast("token_graduating", { address: token.toLowerCase() });
  }
}

async function processGraduatedLogs(fromBlock: bigint, toBlock: bigint) {
  const client = getPublicClient();
  const logs = await client.getLogs({
    address: ADDRESSES.bonding,
    event: graduatedEvent,
    fromBlock,
    toBlock,
  });

  for (const log of logs) {
    const { token, pairAddress } = log.args;
    if (!token || !pairAddress) continue;
    patchTokenLifecycle(token.toLowerCase(), "graduated", {
      graduated_pair: pairAddress.toLowerCase(),
    });
    broadcast("token_graduated", { address: token.toLowerCase() });
  }
}

async function scanRange(
  from: bigint,
  to: bigint,
  handler: (from: bigint, to: bigint) => Promise<void>,
  metaKey: string,
) {
  let cursor = from;
  while (cursor <= to) {
    const end = cursor + CHUNK - 1n > to ? to : cursor + CHUNK - 1n;
    try {
      await handler(cursor, end);
      setMeta(metaKey, end.toString());
    } catch (err) {
      console.warn(`Scan ${metaKey} ${cursor}-${end} failed:`, (err as Error).message);
      await sleep(RPC_PAUSE_MS * 3);
      break;
    }
    cursor = end + 1n;
    await sleep(RPC_PAUSE_MS);
  }
}

/** Full historical TokenLaunched scan — builds complete token registry. */
export async function backfillAllLaunches() {
  if (getMeta("launch_backfill_complete") === "true") {
    console.log("Launch backfill already complete");
    return;
  }

  const client = getPublicClient();
  let latest: bigint;
  try {
    latest = await client.getBlockNumber();
  } catch (err) {
    console.warn("Launch backfill skipped:", (err as Error).message);
    return;
  }

  const start = launchStartBlock();
  if (!getMeta("launch_scan_from")) setMeta("launch_scan_from", start.toString());

  const resume = getMeta("launch_scan_block");
  let from = resume != null ? BigInt(resume) + 1n : start;

  console.log(`Full launch scan ${from} → ${latest} (all alt.fun tokens)`);

  let totalLaunches = 0;
  while (from <= latest) {
    const to = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n;
    try {
      const n = await processLaunchedLogs(from, to);
      totalLaunches += n;
      setMeta("launch_scan_block", to.toString());
      if (n > 0) console.log(`  blocks ${from}-${to}: +${n} launches`);
    } catch (err) {
      console.warn(`Launch chunk ${from}-${to}:`, (err as Error).message);
      await sleep(RPC_PAUSE_MS * 4);
      break;
    }
    from = to + 1n;
    await sleep(RPC_PAUSE_MS);
  }

  if (from > latest) {
    setMeta("launch_backfill_complete", "true");
    console.log(`Launch backfill complete (${totalLaunches} events this run)`);
  }
}

/** Trades + graduation events (incremental). */
export async function backfillEvents() {
  const client = getPublicClient();
  let latest: bigint;
  try {
    latest = await client.getBlockNumber();
  } catch (err) {
    console.warn("Events backfill skipped:", (err as Error).message);
    return;
  }

  const start = launchStartBlock();
  const resume = getMeta("last_events_block");
  let from = resume != null ? BigInt(resume) + 1n : start;

  console.log(`Events sync ${from} → ${latest}`);

  while (from <= latest) {
    const to = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n;
    try {
      await processTradeLogs(from, to);
      await sleep(RPC_PAUSE_MS);
      await processGraduatingLogs(from, to);
      await sleep(RPC_PAUSE_MS);
      await processGraduatedLogs(from, to);
      setMeta("last_events_block", to.toString());
    } catch (err) {
      console.warn(`Events chunk ${from}-${to}:`, (err as Error).message);
      break;
    }
    from = to + 1n;
    await sleep(RPC_PAUSE_MS);
  }
}

export async function enrichBatch() {
  const tokens = listTokensForEnrich(ENRICH_BATCH, 0);
  for (const t of tokens) {
    try {
      await enrichToken(t.address as Address);
      await sleep(200);
    } catch {
      // skip single token
    }
  }
}

let enrichOffset = 0;

async function enrichCycle() {
  const batch = listTokensForEnrich(ENRICH_BATCH, enrichOffset);
  if (batch.length === 0) {
    enrichOffset = 0;
    return;
  }
  for (const t of batch) {
    try {
      await enrichToken(t.address as Address);
      await sleep(150);
    } catch {
      // skip
    }
  }
  enrichOffset += batch.length;
}

export async function startLiveIndexer() {
  setActivityBroadcast(broadcast);

  try {
    await syncCatalogFromApi();
  } catch (err) {
    console.warn("Catalog sync failed (will retry):", (err as Error).message);
  }

  await backfillAllLaunches();
  await backfillEvents();

  const client = getPublicClient();

  client.watchEvent({
    address: ADDRESSES.bonding,
    event: tokenLaunchedEvent,
    onLogs: async (logs) => {
      for (const log of logs) {
        await processLaunchedLogs(log.blockNumber, log.blockNumber);
        setMeta("launch_scan_block", log.blockNumber.toString());
        try {
          const token = log.args.token;
          if (token) await enrichToken(token);
        } catch {
          // enrich later
        }
      }
    },
  });

  client.watchEvent({
    address: ADDRESSES.bonding,
    event: tradeEvent,
    onLogs: async (logs) => {
      for (const log of logs) {
        await processTradeLogs(log.blockNumber, log.blockNumber);
        setMeta("last_events_block", log.blockNumber.toString());
      }
    },
  });

  client.watchEvent({
    address: ADDRESSES.bonding,
    event: graduatingEvent,
    onLogs: async (logs) => {
      for (const log of logs) {
        await processGraduatingLogs(log.blockNumber, log.blockNumber);
        setMeta("last_events_block", log.blockNumber.toString());
      }
    },
  });

  client.watchEvent({
    address: ADDRESSES.bonding,
    event: graduatedEvent,
    onLogs: async (logs) => {
      for (const log of logs) {
        await processGraduatedLogs(log.blockNumber, log.blockNumber);
        setMeta("last_events_block", log.blockNumber.toString());
      }
    },
  });

  setInterval(() => enrichCycle().catch(() => {}), 45_000);

  setInterval(async () => {
    if (shouldRefreshCatalog()) {
      try {
        await syncCatalogFromApi();
      } catch (err) {
        console.warn("Catalog refresh failed:", (err as Error).message);
      }
    }
  }, 60_000);

  // Continue historical on-chain scans in background (trades, launches)
  setInterval(async () => {
    if (getMeta("launch_backfill_complete") !== "true") {
      await backfillAllLaunches();
    }
    await backfillEvents();
  }, 180_000);

  startActivityPoller();

  console.log("Indexer: full registry + live events + enrichment + activity");
}
