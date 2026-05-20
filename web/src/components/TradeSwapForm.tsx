import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useReadContract,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatUnits, maxUint256, parseUnits, zeroAddress } from "viem";
import { erc20Abi, zapAbi } from "../abis";
import { REFERRER, USDC, ZAP } from "../wagmi";
import type { HoneypotCheck, Token } from "../api";
import { useErc20Balance } from "../hooks/useErc20Balance";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  formatTokenAmountInput,
  SELL_PERCENT_PRESETS,
  sellAmountFromBalance,
} from "../lib/tradeAmount";
import { formatPercent, formatTokenFromRaw, formatUsd } from "../lib/format";
import {
  applySlippageMin,
  getSlippageBps,
  setSlippageBps,
  SLIPPAGE_PRESETS,
} from "../lib/slippage";
import { recordTx } from "../lib/tokenStorage";
import {
  applyTradeFill,
  avgCostPerToken,
  getPosition,
  unrealizedPnlPct,
  unrealizedPnlUsd,
} from "../lib/portfolio";
import { HoneypotBadge } from "./HoneypotBadge";
import { formatTradeSimError } from "../lib/tradeSimError";
import { useUsdcBalance } from "../hooks/useUsdcBalance";

const PRESETS_BUY = ["20", "50", "100", "250"];
const MIN_BUY_USDC = 20;

type Props = {
  token: Token;
  honeypot?: HoneypotCheck | null;
  variant?: "bot" | "panel";
  initialSide?: "buy" | "sell";
  initialAmount?: string;
  onTxSuccess?: () => void;
};

export function TradeSwapForm({
  token,
  honeypot,
  variant = "bot",
  initialSide = "buy",
  initialAmount = "25",
  onTxSuccess,
}: Props) {
  const { address, isConnected } = useAccount();
  const [side, setSide] = useState<"buy" | "sell">(initialSide);
  const [amount, setAmount] = useState(initialAmount);
  const [status, setStatus] = useState("");
  const [slippageBps, setSlippageBpsState] = useState(getSlippageBps);

  const debouncedAmount = useDebouncedValue(amount, 400);
  const tokenAddr = token.address as `0x${string}`;
  const { balance: tokenBalance, refetch: refetchTokenBalance } = useErc20Balance(tokenAddr);
  const { balance: usdcBalance } = useUsdcBalance();

  const fillRef = useRef<{
    side: "buy" | "sell";
    usdcRaw: string;
    tokenRaw: string;
  } | null>(null);

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const {
    isLoading: confirming,
    isSuccess,
    isError,
  } = useWaitForTransactionReceipt({ hash });

  const { data: usdcAllowance } = useReadContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, ZAP] : undefined,
    query: { enabled: !!address },
  });

  const referrer = useMemo(() => {
    if (!address) return zeroAddress;
    return REFERRER.toLowerCase() === address.toLowerCase() ? zeroAddress : REFERRER;
  }, [address]);

  const buyUsdc = useMemo(() => {
    if (side !== "buy" || !debouncedAmount) return null;
    try {
      const v = parseUnits(debouncedAmount, 6);
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  }, [side, debouncedAmount]);

  const sellTokens = useMemo(() => {
    if (side !== "sell" || !debouncedAmount) return null;
    try {
      const v = parseUnits(debouncedAmount, 18);
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  }, [side, debouncedAmount]);

  const buySim = useSimulateContract({
    address: ZAP,
    abi: zapAbi,
    functionName: "buy",
    args: buyUsdc ? [tokenAddr, buyUsdc, 0n, referrer] : undefined,
    account: address,
    query: { enabled: Boolean(address && buyUsdc && token.lifecycle !== "graduating") },
  });

  const sellSim = useSimulateContract({
    address: ZAP,
    abi: zapAbi,
    functionName: "sell",
    args: sellTokens ? [tokenAddr, sellTokens, 0n] : undefined,
    account: address,
    query: { enabled: Boolean(address && sellTokens && token.lifecycle !== "graduating") },
  });

  const busy = isPending || confirming;
  const honeypotBlocked = honeypot?.status === "risk";
  const sim = side === "buy" ? buySim : sellSim;
  const quoteOut = sim.data?.result as bigint | undefined;
  const minOut =
    quoteOut !== undefined ? applySlippageMin(quoteOut, slippageBps) : undefined;
  const quoteError = formatTradeSimError(sim.error);

  const buyTooSmall =
    side === "buy" && buyUsdc !== null && buyUsdc < parseUnits(String(MIN_BUY_USDC), 6);

  const buyInsufficientUsdc =
    side === "buy" &&
    buyUsdc !== null &&
    usdcBalance > 0n &&
    usdcBalance < buyUsdc;

  const disabled =
    !isConnected ||
    token.lifecycle === "graduating" ||
    busy ||
    honeypotBlocked ||
    !minOut ||
    buyTooSmall;

  useEffect(() => {
    setSide(initialSide);
    setAmount(initialAmount);
    setStatus("");
    reset();
  }, [token.address, initialSide, initialAmount, reset]);

  useEffect(() => {
    if (isPending) setStatus("Confirm in wallet");
    else if (confirming) setStatus("Confirming on chain…");
  }, [isPending, confirming]);

  useEffect(() => {
    if (!hash) return;
    if (isSuccess) {
      setStatus(side === "buy" ? "Buy confirmed" : "Sell confirmed");
      refetchTokenBalance();
      const fill = fillRef.current;
      recordTx({
        hash,
        token: token.address,
        ticker: token.ticker,
        side,
        amount,
        at: Math.floor(Date.now() / 1000),
        usdcRaw: fill?.usdcRaw,
        tokenRaw: fill?.tokenRaw,
      });
      if (address && fill) {
        applyTradeFill(address, {
          token: token.address,
          ticker: token.ticker,
          name: token.name,
          image: token.image,
          side: fill.side,
          usdcRaw: fill.usdcRaw,
          tokenRaw: fill.tokenRaw,
        });
      }
      fillRef.current = null;
      onTxSuccess?.();
    } else if (isError) {
      setStatus("Transaction failed");
    }
  }, [hash, isSuccess, isError, side, amount, token, refetchTokenBalance]);

  const applySellPercent = useCallback(
    (percent: number) => {
      const raw = sellAmountFromBalance(tokenBalance, percent);
      setAmount(formatTokenAmountInput(raw));
    },
    [tokenBalance],
  );

  const onSlippage = (bps: number) => {
    setSlippageBps(bps);
    setSlippageBpsState(bps);
  };

  const needsApproval =
    side === "buy" &&
    usdcAllowance !== undefined &&
    buyUsdc !== null &&
    usdcAllowance < buyUsdc;

  const approveUsdc = () => {
    if (!address) return;
    writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [ZAP, maxUint256],
    });
    setStatus("Approve in wallet");
  };

  const submit = () => {
    if (!address || !minOut || quoteOut === undefined) return;
    if (side === "buy" && buyUsdc) {
      fillRef.current = {
        side: "buy",
        usdcRaw: buyUsdc.toString(),
        tokenRaw: quoteOut.toString(),
      };
      writeContract({
        address: ZAP,
        abi: zapAbi,
        functionName: "buy",
        args: [tokenAddr, buyUsdc, minOut, referrer],
      });
    } else if (side === "sell" && sellTokens) {
      fillRef.current = {
        side: "sell",
        usdcRaw: quoteOut.toString(),
        tokenRaw: sellTokens.toString(),
      };
      writeContract({
        address: ZAP,
        abi: zapAbi,
        functionName: "sell",
        args: [tokenAddr, sellTokens, minOut],
      });
    }
  };

  if (!isConnected) {
    return variant === "panel" ? (
      <div className="empty-state" style={{ padding: "2rem 1rem" }}>
        <p>Connect wallet to trade</p>
      </div>
    ) : null;
  }

  if (token.lifecycle === "graduating") {
    return (
      <p className="bot-trade-msg bot-trade-msg--warn">
        Graduating — liquidity seeding (~1 min). Trading paused.
      </p>
    );
  }

  const balanceLabel = formatTokenFromRaw(tokenBalance.toString(), 18);
  const sellDisabledNoBalance = side === "sell" && tokenBalance === 0n;
  const position = address ? getPosition(address, token.address) : null;
  const positionUsd =
    position && token.priceUsd > 0
      ? (Number(position.tokenQty) / 1e18) * token.priceUsd
      : null;
  const positionPnl =
    position && token.priceUsd > 0 ? unrealizedPnlUsd(position, token.priceUsd) : null;
  const positionPnlPct =
    position && token.priceUsd > 0 ? unrealizedPnlPct(position, token.priceUsd) : null;

  const quoteLabel =
    side === "buy" && quoteOut !== undefined
      ? `≈ ${formatTokenFromRaw(quoteOut.toString(), 18)} ${token.ticker}`
      : side === "sell" && quoteOut !== undefined
        ? `≈ ${formatUsd(Number(formatUnits(quoteOut, 6)))}`
        : null;

  const rootClass = variant === "bot" ? "bot-trade" : "trade-swap-form";

  return (
    <div className={rootClass}>
      {variant === "panel" && honeypot && (
        <HoneypotBadge honeypot={honeypot} showDetail={honeypot.status !== "clear"} />
      )}
      {honeypotBlocked && (
        <p className="bot-trade-msg bot-trade-msg--danger">Honeypot risk — trading off</p>
      )}

      <div className={`swap-tabs swap-tabs--${side}`}>
        <span className="swap-tabs__slider" aria-hidden />
        <button
          type="button"
          className={side === "buy" ? "active-buy" : ""}
          onClick={() => {
            setSide("buy");
            setAmount("25");
          }}
        >
          Buy
        </button>
        <button
          type="button"
          className={side === "sell" ? "active-sell" : ""}
          onClick={() => {
            setSide("sell");
            setAmount(
              tokenBalance > 0n
                ? formatTokenAmountInput(sellAmountFromBalance(tokenBalance, 50))
                : "0",
            );
          }}
        >
          Sell
        </button>
      </div>

      <div className="slippage-row">
        <span className="slippage-row__label">Slippage</span>
        <div className="slippage-row__pills">
          {SLIPPAGE_PRESETS.map((p) => (
            <button
              key={p.bps}
              type="button"
              className={slippageBps === p.bps ? "active" : ""}
              onClick={() => onSlippage(p.bps)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="input-group">
        {variant === "panel" && (
          <label>{side === "buy" ? "You pay" : "You sell"}</label>
        )}
        <div className="input-wrap">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
          <span className="unit">{side === "buy" ? "USDC" : token.ticker}</span>
        </div>
        {side === "buy" && (
          <p className="bot-trade-balance muted">
            USDC balance: {formatUsd(Number(formatUnits(usdcBalance, 6)))}
          </p>
        )}
        {(side === "sell" || position) && (
          <p className="bot-trade-balance muted">
            {side === "sell" && (
              <>
                Balance: {balanceLabel} {token.ticker}
                {positionUsd != null && positionUsd > 0 && <> · ≈ {formatUsd(positionUsd)}</>}
              </>
            )}
            {position && BigInt(position.tokenQty) > 0n && (
              <>
                {side === "sell" && <br />}
                Cost basis: avg {formatUsd(avgCostPerToken(position))}
                {positionPnl != null && (
                  <>
                    {" "}
                    · PnL{" "}
                    <span className={positionPnl >= 0 ? "up" : "down"}>
                      {formatUsd(positionPnl)}
                      {positionPnlPct != null && ` (${formatPercent(positionPnlPct)})`}
                    </span>
                  </>
                )}
              </>
            )}
          </p>
        )}
        {buyTooSmall && (
          <p className="bot-trade-msg bot-trade-msg--warn">Min buy ~{MIN_BUY_USDC} USDC</p>
        )}
        {buyInsufficientUsdc && (
          <p className="bot-trade-msg bot-trade-msg--warn">
            Not enough USDC — you have {formatUsd(Number(formatUnits(usdcBalance, 6)))}.
          </p>
        )}
        <div className="amount-presets">
          {side === "buy"
            ? PRESETS_BUY.map((p) => (
                <button key={p} type="button" onClick={() => setAmount(p)}>
                  {p}
                </button>
              ))
            : SELL_PERCENT_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={tokenBalance === 0n}
                  onClick={() => applySellPercent(p)}
                >
                  {p}%
                </button>
              ))}
        </div>
      </div>

      {quoteLabel && !quoteError && (
        <p className="trade-quote-line">
          {quoteLabel}
          {minOut !== undefined && (
            <span className="muted">
              {" "}
              · min {side === "buy"
                ? formatTokenFromRaw(minOut.toString(), 18)
                : formatUsd(Number(formatUnits(minOut, 6)))}
            </span>
          )}
        </p>
      )}
      {quoteError && sim.isError && (
        <p className="bot-trade-msg bot-trade-msg--warn">{quoteError}</p>
      )}
      {honeypot?.canSell === true && side === "sell" && !quoteError && (
        <p className="trade-quote-line muted">Sell path simulates OK</p>
      )}

      {side === "buy" && needsApproval && (
        <button
          type="button"
          className="btn"
          style={{ width: "100%" }}
          onClick={approveUsdc}
          disabled={disabled}
        >
          Approve USDC
        </button>
      )}

      <button
        type="button"
        className={["btn", side === "buy" ? "btn--buy" : "btn--sell"].join(" ")}
        style={{ width: "100%" }}
        disabled={
          disabled || (side === "buy" && needsApproval) || sellDisabledNoBalance
        }
        onClick={submit}
      >
        {busy ? "Waiting…" : side === "buy" ? "Buy" : "Sell"}
      </button>

      {(status || hash) && (
        <div
          className={[
            "bot-trade-result",
            isSuccess ? "bot-trade-result--ok" : "",
            isError ? "bot-trade-result--err" : "",
            busy ? "bot-trade-result--pending" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {status && <p className="bot-trade-result__status">{status}</p>}
          {hash && (
            <a
              className="bot-trade-result__link mono"
              href={`https://hyperevmscan.io/tx/${hash}`}
              target="_blank"
              rel="noreferrer"
            >
              {hash.slice(0, 8)}…{hash.slice(-6)} ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
