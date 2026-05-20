import { Link, useLocation } from "react-router-dom";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { formatUnits } from "viem";
import { hyperEvm } from "../wagmi";
import { shortAddress } from "../lib/format";
import { useUsdcBalance } from "../hooks/useUsdcBalance";
import { LilaAvatar } from "./LilaAvatar";
import { BOT_NAME, SITE_NAME, SITE_TAGLINE } from "../lib/brand";

export function Header() {
  const { pathname } = useLocation();
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const wrongChain = isConnected && chainId !== hyperEvm.id;
  const { balance: usdcBalance } = useUsdcBalance();
  const usdcLabel =
    isConnected && usdcBalance > 0n
      ? `${Number(formatUnits(usdcBalance, 6)).toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC`
      : null;

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="brand">
          <span className="brand__mark">
            <LilaAvatar size="sm" />
          </span>
          <span>
            <p className="brand__title">{SITE_NAME}</p>
            <p className="brand__sub">{SITE_TAGLINE}</p>
          </span>
        </Link>

        <nav className="nav-pills">
          <Link to="/" className={pathname === "/" ? "active" : ""}>
            Agent
          </Link>
          <Link to="/bot" className={pathname.startsWith("/bot") ? "active" : ""}>
            {BOT_NAME}
          </Link>
          <Link to="/portfolio" className={pathname.startsWith("/portfolio") ? "active" : ""}>
            Portfolio
          </Link>
          <a href="https://alt.fun" target="_blank" rel="noreferrer">
            alt.fun
          </a>
          <a
            href="https://docs.alt.fun/integrations"
            target="_blank"
            rel="noreferrer"
          >
            Docs
          </a>
        </nav>

        <div className="header-actions">
          {wrongChain && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => switchChain({ chainId: hyperEvm.id })}
            >
              Wrong network
            </button>
          )}

          {!isConnected ? (
            <button
              type="button"
              className="btn btn--primary"
              disabled={isPending}
              onClick={() => connect({ connector: connectors[0] })}
            >
              {isPending ? "Connecting…" : "Connect wallet"}
            </button>
          ) : (
            <>
              {usdcLabel && <span className="wallet-pill wallet-pill--usdc">{usdcLabel}</span>}
              <span className="wallet-pill">{shortAddress(address!)}</span>
              <button type="button" className="btn btn--ghost" onClick={() => disconnect()}>
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
