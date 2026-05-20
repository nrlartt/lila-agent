/** Per-wallet cost basis (weighted average) stored locally. Amounts are integer strings (raw units). */

export type PortfolioPosition = {
  token: string;
  ticker: string;
  name: string;
  image: string;
  tokenQty: string;
  costUsdc: string;
  realizedPnlUsdc: string;
  updatedAt: number;
};

export type TradeFill = {
  token: string;
  ticker: string;
  name: string;
  image: string;
  side: "buy" | "sell";
  usdcRaw: string;
  tokenRaw: string;
};

type PortfolioStore = Record<string, PortfolioPosition>;

function storageKey(wallet: string): string {
  return `alt_portfolio_${wallet.toLowerCase()}`;
}

function readStore(wallet: string): PortfolioStore {
  try {
    const raw = localStorage.getItem(storageKey(wallet));
    if (!raw) return {};
    return JSON.parse(raw) as PortfolioStore;
  } catch {
    return {};
  }
}

function writeStore(wallet: string, store: PortfolioStore): void {
  localStorage.setItem(storageKey(wallet), JSON.stringify(store));
}

export function getPortfolio(wallet: string): PortfolioPosition[] {
  const store = readStore(wallet);
  return Object.values(store).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getPosition(wallet: string, token: string): PortfolioPosition | null {
  return readStore(wallet)[token.toLowerCase()] ?? null;
}

export function applyTradeFill(wallet: string, fill: TradeFill): PortfolioPosition | null {
  const addr = fill.token.toLowerCase();
  const store = readStore(wallet);
  const prev = store[addr];
  const usdc = BigInt(fill.usdcRaw);
  const tok = BigInt(fill.tokenRaw);
  if (usdc <= 0n || tok <= 0n) return prev ?? null;

  const now = Math.floor(Date.now() / 1000);

  if (fill.side === "buy") {
    const costUsdc = (prev ? BigInt(prev.costUsdc) : 0n) + usdc;
    const tokenQty = (prev ? BigInt(prev.tokenQty) : 0n) + tok;
    const next: PortfolioPosition = {
      token: addr,
      ticker: fill.ticker,
      name: fill.name,
      image: fill.image,
      tokenQty: tokenQty.toString(),
      costUsdc: costUsdc.toString(),
      realizedPnlUsdc: prev?.realizedPnlUsdc ?? "0",
      updatedAt: now,
    };
    store[addr] = next;
    writeStore(wallet, store);
    return next;
  }

  if (!prev) return null;
  const prevQty = BigInt(prev.tokenQty);
  const prevCost = BigInt(prev.costUsdc);
  const realized = BigInt(prev.realizedPnlUsdc);
  if (prevQty === 0n) return prev;

  const sellQty = tok > prevQty ? prevQty : tok;
  const costRemoved = (prevCost * sellQty) / prevQty;
  const proceeds = usdc;
  const newRealized = realized + (proceeds - costRemoved);
  const newQty = prevQty - sellQty;
  const newCost = prevCost - costRemoved;

  if (newQty <= 0n) {
    delete store[addr];
    writeStore(wallet, store);
    return {
      ...prev,
      tokenQty: "0",
      costUsdc: "0",
      realizedPnlUsdc: newRealized.toString(),
      updatedAt: now,
    };
  }

  const next: PortfolioPosition = {
    ...prev,
    tokenQty: newQty.toString(),
    costUsdc: newCost.toString(),
    realizedPnlUsdc: newRealized.toString(),
    updatedAt: now,
  };
  store[addr] = next;
  writeStore(wallet, store);
  return next;
}

export function avgCostPerToken(position: PortfolioPosition): number {
  const qty = BigInt(position.tokenQty);
  const cost = BigInt(position.costUsdc);
  if (qty === 0n) return 0;
  return Number(cost) / 1e6 / (Number(qty) / 1e18);
}

export function positionValueUsd(position: PortfolioPosition, priceUsd: number): number {
  const qty = Number(position.tokenQty) / 1e18;
  return qty * priceUsd;
}

export function costBasisUsd(position: PortfolioPosition): number {
  return Number(position.costUsdc) / 1e6;
}

export function unrealizedPnlUsd(position: PortfolioPosition, priceUsd: number): number {
  return positionValueUsd(position, priceUsd) - costBasisUsd(position);
}

export function unrealizedPnlPct(position: PortfolioPosition, priceUsd: number): number | null {
  const cost = costBasisUsd(position);
  if (cost <= 0) return null;
  return (unrealizedPnlUsd(position, priceUsd) / cost) * 100;
}

export function realizedPnlTotal(position: PortfolioPosition): number {
  return Number(position.realizedPnlUsdc) / 1e6;
}
