import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import {
  fetchToken,
  fetchTokens,
  subscribeEvents,
} from "../api";
import { AGENT_NAME } from "../lib/brand";
import {
  bumpPositionPeak,
  createLaunchRuntime,
  evaluateLaunchBuy,
  evaluateLaunchSell,
  type LaunchPosition,
  type LaunchSniperConfig,
  type LaunchSniperRuntime,
  DEFAULT_LAUNCH_SNIPER_CONFIG,
} from "../lib/launchSniperTypes";
import {
  loadLaunchPositions,
  loadLaunchSniperConfig,
  saveLaunchPositions,
  saveLaunchSniperConfig,
} from "../lib/launchSniperStorage";
import {
  executeZapBuySigned,
  executeZapSellSigned,
  readTokenBalanceSigned,
  readUsdcBalanceSigned,
} from "../lib/executeZapSigned";
import type { BotLogEntry } from "../lib/autoBotTypes";
import { applyTradeFill } from "../lib/portfolio";
import { recordTx } from "../lib/tokenStorage";
import type { TradingWalletSession } from "./useTradingWallet";

const MIN_BUY_USDC = 20;

function logId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveBuyUsdc(
  config: LaunchSniperConfig,
  privateKey: `0x${string}`,
): Promise<string> {
  if (config.buySizing === "fixed") return config.buyUsdc;
  const bal = await readUsdcBalanceSigned(privateKey);
  const total = Number(formatUnits(bal, 6));
  const slice = (total * config.buyBalancePercent) / 100;
  return Math.max(MIN_BUY_USDC, slice).toFixed(2);
}

export function useLaunchSniper(
  tradingSession: TradingWalletSession | null,
  walletAddress: string | undefined,
) {
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [config, setConfigState] = useState<LaunchSniperConfig>(
    DEFAULT_LAUNCH_SNIPER_CONFIG,
  );
  const [runtime, setRuntime] = useState<LaunchSniperRuntime | null>(null);
  const [positions, setPositions] = useState<LaunchPosition[]>([]);
  const [logs, setLogs] = useState<BotLogEntry[]>([]);

  const runningRef = useRef(false);
  const busyRef = useRef(false);
  const configRef = useRef(config);
  const runtimeRef = useRef(runtime);
  const positionsRef = useRef(positions);
  const sessionRef = useRef(tradingSession);
  const seenRef = useRef(new Set<string>());
  const queueRef = useRef(new Set<string>());

  configRef.current = config;
  runtimeRef.current = runtime;
  positionsRef.current = positions;
  sessionRef.current = tradingSession;
  runningRef.current = running;
  busyRef.current = busy;

  useEffect(() => {
    if (!walletAddress) {
      setConfigState(DEFAULT_LAUNCH_SNIPER_CONFIG);
      setPositions([]);
      return;
    }
    setConfigState(
      loadLaunchSniperConfig(walletAddress) ?? DEFAULT_LAUNCH_SNIPER_CONFIG,
    );
    setPositions(loadLaunchPositions(walletAddress));
  }, [walletAddress]);

  const persistPositions = useCallback(
    (next: LaunchPosition[]) => {
      positionsRef.current = next;
      setPositions(next);
      if (walletAddress) saveLaunchPositions(walletAddress, next);
    },
    [walletAddress],
  );

  const setConfig = useCallback(
    (next: LaunchSniperConfig) => {
      setConfigState(next);
      if (walletAddress) saveLaunchSniperConfig(walletAddress, next);
    },
    [walletAddress],
  );

  const pushLog = useCallback((entry: Omit<BotLogEntry, "id">) => {
    setLogs((prev) => [{ ...entry, id: logId() }, ...prev].slice(0, 150));
  }, []);

  const trySnipe = useCallback(
    async (address: string, source: string) => {
      const session = sessionRef.current;
      const rt = runtimeRef.current;
      if (!session || !rt || !runningRef.current || busyRef.current) return;

      const key = address.toLowerCase();
      if (seenRef.current.has(key) || queueRef.current.has(key)) return;
      queueRef.current.add(key);

      try {
        const data = await fetchToken(address);
        const token = data.token;
        const honeypot = data.honeypot;
        const now = Math.floor(Date.now() / 1000);
        const cfg = configRef.current;
        const open = positionsRef.current.filter((p) => !p.closed).length;

        const evalResult = evaluateLaunchBuy(
          cfg,
          token,
          honeypot,
          now,
          rt,
          open,
          seenRef.current.has(key),
        );

        seenRef.current.add(key);

        if (!evalResult.ok) {
          if (source === "live") {
            pushLog({
              at: now,
              level: "info",
              title: `Skip $${token.ticker}`,
              message: evalResult.reason,
            });
          }
          return;
        }

        pushLog({
          at: now,
          level: "signal",
          title: `Snipe $${token.ticker}`,
          message: evalResult.reason,
          action: "buy",
        });

        busyRef.current = true;
        setBusy(true);

        const usdcHuman = await resolveBuyUsdc(cfg, session.privateKey);
        const result = await executeZapBuySigned({
          privateKey: session.privateKey,
          token: token.address as `0x${string}`,
          usdcHuman,
        });

        const pos: LaunchPosition = {
          address: token.address,
          ticker: token.ticker,
          name: token.name,
          image: token.image,
          entryPrice: token.priceUsd,
          entryAt: now,
          peakPrice: token.priceUsd,
          buyTxHash: result.hash,
          sellCount: 0,
          closed: false,
        };

        const nextRt: LaunchSniperRuntime = {
          ...rt,
          sessionBuys: rt.sessionBuys + 1,
          lastSnipeAt: now,
        };
        runtimeRef.current = nextRt;
        setRuntime(nextRt);

        persistPositions([pos, ...positionsRef.current]);

        recordTx({
          hash: result.hash,
          token: token.address,
          ticker: token.ticker,
          side: "buy",
          amount: usdcHuman,
          at: now,
          usdcRaw: result.usdcRaw.toString(),
          tokenRaw: result.tokenRaw.toString(),
        });
        applyTradeFill(session.address, {
          token: token.address,
          ticker: token.ticker,
          name: token.name,
          image: token.image,
          side: "buy",
          usdcRaw: result.usdcRaw.toString(),
          tokenRaw: result.tokenRaw.toString(),
        });

        pushLog({
          at: now,
          level: "trade",
          title: `${AGENT_NAME} sniped $${token.ticker}`,
          message: `Bought ${usdcHuman} USDC · ${source}`,
          action: "buy",
          txHash: result.hash,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Snipe failed";
        pushLog({
          at: Math.floor(Date.now() / 1000),
          level: "error",
          title: "Snipe failed",
          message: msg.split("\n")[0],
        });
      } finally {
        queueRef.current.delete(key);
        busyRef.current = false;
        setBusy(false);
      }
    },
    [persistPositions, pushLog],
  );

  const monitorPositions = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || !runningRef.current || busyRef.current) return;

    const cfg = configRef.current;
    const open = positionsRef.current.filter((p) => !p.closed);
    if (open.length === 0) return;

    for (const pos of open) {
      if (busyRef.current) break;
      try {
        const data = await fetchToken(pos.address);
        const token = data.token;
        const honeypot = data.honeypot;
        const now = Math.floor(Date.now() / 1000);
        const price = token.priceUsd;

        const updated = bumpPositionPeak(pos, price);
        if (updated.peakPrice !== pos.peakPrice) {
          persistPositions(
            positionsRef.current.map((p) =>
              p.address === pos.address ? updated : p,
            ),
          );
        }

        const bal = await readTokenBalanceSigned(
          session.privateKey,
          pos.address as `0x${string}`,
        );
        const hasBalance = bal > 0n;

        if (!hasBalance) {
          persistPositions(
            positionsRef.current.map((p) =>
              p.address === pos.address ? { ...p, closed: true } : p,
            ),
          );
          continue;
        }

        const signal = evaluateLaunchSell(
          cfg,
          updated,
          token,
          honeypot,
          now,
          hasBalance,
        );
        if (!signal) continue;

        pushLog({
          at: now,
          level: "signal",
          title: signal.title,
          message: `$${token.ticker}: ${signal.reason}`,
          action: "sell",
        });

        busyRef.current = true;
        setBusy(true);

        const result = await executeZapSellSigned({
          privateKey: session.privateKey,
          token: pos.address as `0x${string}`,
          sellPercent: cfg.sellPercent,
        });

        const afterBal = await readTokenBalanceSigned(
          session.privateKey,
          pos.address as `0x${string}`,
        );

        persistPositions(
          positionsRef.current.map((p) => {
            if (p.address !== pos.address) return p;
            return {
              ...p,
              peakPrice: Math.max(p.peakPrice, price),
              sellCount: p.sellCount + 1,
              closed: afterBal === 0n || cfg.sellPercent >= 100,
            };
          }),
        );

        recordTx({
          hash: result.hash,
          token: pos.address,
          ticker: token.ticker,
          side: "sell",
          amount: `${cfg.sellPercent}%`,
          at: now,
          usdcRaw: result.usdcRaw.toString(),
          tokenRaw: result.tokenRaw.toString(),
        });
        applyTradeFill(session.address, {
          token: pos.address,
          ticker: token.ticker,
          name: token.name,
          image: token.image,
          side: "sell",
          usdcRaw: result.usdcRaw.toString(),
          tokenRaw: result.tokenRaw.toString(),
        });

        pushLog({
          at: now,
          level: "trade",
          title: signal.title,
          message: `Sold ${cfg.sellPercent}% of $${token.ticker}`,
          action: "sell",
          txHash: result.hash,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Sell failed";
        pushLog({
          at: Math.floor(Date.now() / 1000),
          level: "error",
          title: "Exit failed",
          message: msg.split("\n")[0],
        });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, [persistPositions, pushLog]);

  const pollNewLaunches = useCallback(async () => {
    if (!runningRef.current) return;
    try {
      const { tokens } = await fetchTokens({ category: "new", limit: 12 });
      const now = Math.floor(Date.now() / 1000);
      const cfg = configRef.current;
      for (const t of tokens) {
        if (!runningRef.current) break;
        const age = t.launchedAt > 0 ? now - t.launchedAt : 999999;
        if (age <= cfg.maxTokenAgeSec) {
          void trySnipe(t.address, "feed");
        }
      }
    } catch {
      /* ignore poll errors */
    }
    await monitorPositions();
  }, [trySnipe, monitorPositions]);

  const start = useCallback(() => {
    if (!tradingSession || !walletAddress) {
      pushLog({
        at: Math.floor(Date.now() / 1000),
        level: "error",
        title: "Cannot start",
        message: "Connect wallet and set up trading wallet first",
      });
      return;
    }
    const rt = createLaunchRuntime();
    runtimeRef.current = rt;
    setRuntime(rt);
    seenRef.current = new Set(
      positionsRef.current.map((p) => p.address.toLowerCase()),
    );
    setRunning(true);
    runningRef.current = true;
    saveLaunchSniperConfig(walletAddress, configRef.current);
    pushLog({
      at: rt.startedAt,
      level: "info",
      title: `${AGENT_NAME} launch sniper online`,
      message: `Watching new tokens · max age ${configRef.current.maxTokenAgeSec}s`,
    });
  }, [tradingSession, walletAddress, pushLog]);

  const stop = useCallback(() => {
    setRunning(false);
    runningRef.current = false;
    pushLog({
      at: Math.floor(Date.now() / 1000),
      level: "info",
      title: `${AGENT_NAME} launch sniper paused`,
      message: "No new snipes; open positions still tracked until sold",
    });
  }, [pushLog]);

  useEffect(() => {
    if (running && !tradingSession) stop();
  }, [running, tradingSession, stop]);

  useEffect(() => {
    if (!running) return;
    const pollMs = Math.max(config.pollIntervalSec, 8) * 1000;
    void pollNewLaunches();
    const id = window.setInterval(() => void pollNewLaunches(), pollMs);
    return () => window.clearInterval(id);
  }, [running, config.pollIntervalSec, pollNewLaunches]);

  useEffect(() => {
    const open = positionsRef.current.filter((p) => !p.closed).length;
    if (open === 0) return;
    void monitorPositions();
    const id = window.setInterval(() => void monitorPositions(), 12_000);
    return () => window.clearInterval(id);
  }, [positions, monitorPositions]);

  useEffect(() => {
    if (!running) return;
    const unsub = subscribeEvents((type, data) => {
      if (type !== "token_launched") return;
      const payload = data as { address?: string };
      if (payload.address) void trySnipe(payload.address, "live");
    });
    return unsub;
  }, [running, trySnipe]);

  return {
    running,
    busy,
    config,
    setConfig,
    runtime,
    positions,
    logs,
    start,
    stop,
    clearLogs: () => setLogs([]),
    clearClosedPositions: () => {
      const next = positionsRef.current.filter((p) => !p.closed);
      persistPositions(next);
    },
  };
}
