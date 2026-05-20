import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import type { HoneypotCheck, Token } from "../api";
import { fetchToken } from "../api";
import {
  loadAutoBotConfig,
  saveAutoBotConfig,
} from "../lib/autoBotConfigStorage";
import {
  evaluateAutoBot,
  nextRuntimeAfterTick,
  nextRuntimeAfterTrade,
} from "../lib/autoBotEngine";
import {
  type AutoBotConfig,
  type AutoBotRuntime,
  type BotLogEntry,
  createRuntime,
  DEFAULT_AUTO_BOT_CONFIG,
} from "../lib/autoBotTypes";
import {
  executeZapBuySigned,
  executeZapSellSigned,
  readTokenBalanceSigned,
  readUsdcBalanceSigned,
} from "../lib/executeZapSigned";
import { AGENT_NAME } from "../lib/brand";
import { strategyModeLabel } from "../lib/strategySummary";
import { applyTradeFill } from "../lib/portfolio";
import { recordTx } from "../lib/tokenStorage";
import type { TradingWalletSession } from "./useTradingWallet";

const MIN_BUY_USDC = 20;

function logId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveBuyUsdcHuman(
  config: AutoBotConfig,
  privateKey: `0x${string}`,
): Promise<string> {
  if (config.buySizing === "fixed") return config.buyUsdc;
  const bal = await readUsdcBalanceSigned(privateKey);
  const total = Number(formatUnits(bal, 6));
  const slice = (total * config.buyBalancePercent) / 100;
  const amount = Math.max(MIN_BUY_USDC, slice);
  return amount.toFixed(2);
}

export function useAutoTrader(
  token: Token | null,
  honeypot: HoneypotCheck | null,
  tradingSession: TradingWalletSession | null,
) {
  const [running, setRunning] = useState(false);
  const [config, setConfigState] = useState<AutoBotConfig>(DEFAULT_AUTO_BOT_CONFIG);
  const [runtime, setRuntime] = useState<AutoBotRuntime | null>(null);
  const [logs, setLogs] = useState<BotLogEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const runningRef = useRef(false);
  const busyRef = useRef(false);
  const configRef = useRef(config);
  const runtimeRef = useRef(runtime);
  const tokenRef = useRef(token);
  const honeypotRef = useRef(honeypot);
  const sessionRef = useRef(tradingSession);

  configRef.current = config;
  runtimeRef.current = runtime;
  tokenRef.current = token;
  honeypotRef.current = honeypot;
  sessionRef.current = tradingSession;
  runningRef.current = running;
  busyRef.current = busy;

  const setConfig = useCallback(
    (next: AutoBotConfig) => {
      setConfigState(next);
      if (token) saveAutoBotConfig(token.address, next);
    },
    [token],
  );

  useEffect(() => {
    if (!token) {
      setConfigState(DEFAULT_AUTO_BOT_CONFIG);
      return;
    }
    const saved = loadAutoBotConfig(token.address);
    setConfigState(saved ?? DEFAULT_AUTO_BOT_CONFIG);
  }, [token?.address]);

  const pushLog = useCallback((entry: Omit<BotLogEntry, "id">) => {
    setLogs((prev) => [{ ...entry, id: logId() }, ...prev].slice(0, 120));
  }, []);

  const tick = useCallback(async () => {
    const t = tokenRef.current;
    const rt = runtimeRef.current;
    const session = sessionRef.current;
    if (!t || !rt || !session || !runningRef.current || busyRef.current) return;

    try {
      const data = await fetchToken(t.address);
      const fresh = data.token;
      const hp = data.honeypot ?? honeypotRef.current;
      const now = Math.floor(Date.now() / 1000);
      const price = fresh.priceUsd;

      const updatedRt = nextRuntimeAfterTick(rt, price);
      runtimeRef.current = updatedRt;
      setRuntime(updatedRt);

      const tokenBal = await readTokenBalanceSigned(
        session.privateKey,
        t.address as `0x${string}`,
      );

      const signal = evaluateAutoBot(configRef.current, updatedRt, {
        priceUsd: price,
        honeypotOk: !hp || hp.status !== "risk",
        lifecycle: fresh.lifecycle,
        hasTokenBalance: tokenBal > 0n,
        now,
      });

      if (!signal) return;

      pushLog({
        at: now,
        level: "signal",
        title: signal.title,
        message: signal.reason,
        action: signal.action,
      });
      busyRef.current = true;
      setBusy(true);

      const owner = session.address;
      const cfg = configRef.current;

      if (signal.action === "buy") {
        const usdcHuman = await resolveBuyUsdcHuman(cfg, session.privateKey);
        const result = await executeZapBuySigned({
          privateKey: session.privateKey,
          token: t.address as `0x${string}`,
          usdcHuman,
        });
        const after = nextRuntimeAfterTrade(updatedRt, now, "buy", price);
        runtimeRef.current = after;
        setRuntime(after);
        recordTx({
          hash: result.hash,
          token: t.address,
          ticker: t.ticker,
          side: "buy",
          amount: usdcHuman,
          at: now,
          usdcRaw: result.usdcRaw.toString(),
          tokenRaw: result.tokenRaw.toString(),
        });
        applyTradeFill(owner, {
          token: t.address,
          ticker: t.ticker,
          name: t.name,
          image: t.image,
          side: "buy",
          usdcRaw: result.usdcRaw.toString(),
          tokenRaw: result.tokenRaw.toString(),
        });
        pushLog({
          at: now,
          level: "trade",
          title: signal.title,
          message: `Filled ${usdcHuman} USDC`,
          action: "buy",
          txHash: result.hash,
        });
      } else {
        const result = await executeZapSellSigned({
          privateKey: session.privateKey,
          token: t.address as `0x${string}`,
          sellPercent: cfg.sellPercent,
        });
        const after = nextRuntimeAfterTrade(updatedRt, now, "sell", price);
        runtimeRef.current = after;
        setRuntime(after);
        recordTx({
          hash: result.hash,
          token: t.address,
          ticker: t.ticker,
          side: "sell",
          amount: `${cfg.sellPercent}%`,
          at: now,
          usdcRaw: result.usdcRaw.toString(),
          tokenRaw: result.tokenRaw.toString(),
        });
        applyTradeFill(owner, {
          token: t.address,
          ticker: t.ticker,
          name: t.name,
          image: t.image,
          side: "sell",
          usdcRaw: result.usdcRaw.toString(),
          tokenRaw: result.tokenRaw.toString(),
        });
        pushLog({
          at: now,
          level: "trade",
          title: signal.title,
          message: `Sold ${cfg.sellPercent}% of balance`,
          action: "sell",
          txHash: result.hash,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Trade failed";
      pushLog({
        at: Math.floor(Date.now() / 1000),
        level: "error",
        title: "Execution failed",
        message: msg.split("\n")[0],
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [pushLog]);

  const start = useCallback(() => {
    if (!token || !tradingSession) {
      pushLog({
        at: Math.floor(Date.now() / 1000),
        level: "error",
        title: "Cannot start",
        message: "Set up trading wallet and enable session first",
      });
      return;
    }
    const rt = createRuntime(token.priceUsd || 0);
    runtimeRef.current = rt;
    setRuntime(rt);
    setRunning(true);
    runningRef.current = true;
    saveAutoBotConfig(token.address, config);
    pushLog({
      at: rt.startedAt,
      level: "info",
      title: `${AGENT_NAME} is online`,
      message: `${strategyModeLabel(config.mode)} · baseline ${(token.priceUsd || 0).toFixed(6)} USD`,
    });
  }, [token, tradingSession, config, pushLog]);

  const stop = useCallback(() => {
    setRunning(false);
    runningRef.current = false;
    pushLog({
      at: Math.floor(Date.now() / 1000),
      level: "info",
      title: `${AGENT_NAME} paused`,
      message: "Monitoring ended",
    });
  }, [pushLog]);

  useEffect(() => {
    if (running && !tradingSession) stop();
  }, [running, tradingSession, stop]);

  useEffect(() => {
    if (!running || !token) return;

    const pollMs = Math.max(config.pollIntervalSec, 15) * 1000;
    void tick();
    const id = window.setInterval(() => void tick(), pollMs);
    return () => window.clearInterval(id);
  }, [running, token?.address, config.pollIntervalSec, tick]);

  return {
    running,
    busy,
    config,
    setConfig,
    runtime,
    logs,
    start,
    stop,
    clearLogs: () => setLogs([]),
  };
}
