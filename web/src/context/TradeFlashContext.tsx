import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { subscribeEvents } from "../api";

export type TradeSide = "buy" | "sell";

type FlashEntry = { side: TradeSide; pulse: number };
type LaunchEntry = { pulse: number };

type TradeFlashContextValue = {
  getFlash: (address: string) => FlashEntry | null;
  getLaunchFlash: (address: string) => LaunchEntry | null;
  globalPulse: number;
  lastTradeSide: TradeSide | null;
  lastLaunchPulse: number;
};

const TradeFlashContext = createContext<TradeFlashContextValue | null>(null);

const TRADE_FLASH_MS = 3_500;
const LAUNCH_FLASH_MS = 5_500;

export function TradeFlashProvider({ children }: { children: ReactNode }) {
  const [flashes, setFlashes] = useState<Record<string, FlashEntry>>({});
  const [launches, setLaunches] = useState<Record<string, LaunchEntry>>({});
  const [globalPulse, setGlobalPulse] = useState(0);
  const [lastTradeSide, setLastTradeSide] = useState<TradeSide | null>(null);
  const [lastLaunchPulse, setLastLaunchPulse] = useState(0);
  const tradeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const launchTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const pulse = useCallback((token: string, isBuy: boolean) => {
    const addr = token.toLowerCase();
    const side: TradeSide = isBuy ? "buy" : "sell";

    setGlobalPulse((n) => n + 1);
    setLastTradeSide(side);

    setFlashes((prev) => ({
      ...prev,
      [addr]: { side, pulse: (prev[addr]?.pulse ?? 0) + 1 },
    }));

    const existing = tradeTimers.current.get(addr);
    if (existing) clearTimeout(existing);

    tradeTimers.current.set(
      addr,
      setTimeout(() => {
        setFlashes((prev) => {
          const next = { ...prev };
          delete next[addr];
          return next;
        });
        tradeTimers.current.delete(addr);
      }, TRADE_FLASH_MS),
    );
  }, []);

  const pulseLaunch = useCallback((token: string) => {
    const addr = token.toLowerCase();

    setLastLaunchPulse((n) => n + 1);

    setLaunches((prev) => ({
      ...prev,
      [addr]: { pulse: (prev[addr]?.pulse ?? 0) + 1 },
    }));

    setFlashes((prev) => {
      const next = { ...prev };
      delete next[addr];
      return next;
    });

    const existing = launchTimers.current.get(addr);
    if (existing) clearTimeout(existing);

    launchTimers.current.set(
      addr,
      setTimeout(() => {
        setLaunches((prev) => {
          const next = { ...prev };
          delete next[addr];
          return next;
        });
        launchTimers.current.delete(addr);
      }, LAUNCH_FLASH_MS),
    );
  }, []);

  useEffect(() => {
    return subscribeEvents((type, data) => {
      if (type === "trade") {
        const d = data as { token?: string; isBuy?: boolean };
        if (!d.token || d.isBuy === undefined) return;
        pulse(d.token, d.isBuy);
        return;
      }
      if (type === "token_launched") {
        const d = data as { address?: string };
        if (!d.address) return;
        pulseLaunch(d.address);
      }
    });
  }, [pulse, pulseLaunch]);

  useEffect(() => {
    const tradeMap = tradeTimers.current;
    const launchMap = launchTimers.current;
    return () => {
      for (const t of tradeMap.values()) clearTimeout(t);
      tradeMap.clear();
      for (const t of launchMap.values()) clearTimeout(t);
      launchMap.clear();
    };
  }, []);

  const getFlash = useCallback(
    (address: string) => flashes[address.toLowerCase()] ?? null,
    [flashes],
  );

  const getLaunchFlash = useCallback(
    (address: string) => launches[address.toLowerCase()] ?? null,
    [launches],
  );

  return (
    <TradeFlashContext.Provider
      value={{ getFlash, getLaunchFlash, globalPulse, lastTradeSide, lastLaunchPulse }}
    >
      {children}
    </TradeFlashContext.Provider>
  );
}

export function useTradeFlash(address: string): FlashEntry | null {
  const ctx = useContext(TradeFlashContext);
  if (!ctx) return null;
  return ctx.getFlash(address);
}

export function useLaunchFlash(address: string): LaunchEntry | null {
  const ctx = useContext(TradeFlashContext);
  if (!ctx) return null;
  return ctx.getLaunchFlash(address);
}

export function useTradeActivity() {
  const ctx = useContext(TradeFlashContext);
  if (!ctx) {
    return {
      globalPulse: 0,
      lastTradeSide: null as TradeSide | null,
      lastLaunchPulse: 0,
    };
  }
  return {
    globalPulse: ctx.globalPulse,
    lastTradeSide: ctx.lastTradeSide,
    lastLaunchPulse: ctx.lastLaunchPulse,
  };
}
