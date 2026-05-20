import { Link } from "react-router-dom";
import type { HoneypotCheck, Token } from "../api";
import { TradeSwapForm } from "./TradeSwapForm";

type Props = { token: Token; honeypot?: HoneypotCheck | null };

export function TradePanel({ token, honeypot }: Props) {
  return (
    <aside className="glass-panel trade-panel">
      <div className="panel-head panel-head--split">
        <h2>Trade</h2>
        <div className="panel-head__actions">
          <Link to={`/bot?token=${token.address}`} className="panel-head__bot-link">
            Open in Bot
          </Link>
          <span className={`badge badge--${token.lifecycle}`} style={{ fontSize: "0.6rem" }}>
            {token.lifecycle}
          </span>
        </div>
      </div>
      <div className="panel-body">
        <TradeSwapForm
          key={token.address}
          token={token}
          honeypot={honeypot}
          variant="panel"
        />
      </div>
    </aside>
  );
}
