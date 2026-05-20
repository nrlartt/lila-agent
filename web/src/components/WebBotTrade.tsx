import type { HoneypotCheck, Token } from "../api";
import { TradeSwapForm } from "./TradeSwapForm";

type Props = {
  token: Token;
  honeypot?: HoneypotCheck | null;
  initialSide?: "buy" | "sell";
  initialAmount?: string;
  onTxSuccess?: () => void;
};

export function WebBotTrade(props: Props) {
  return <TradeSwapForm {...props} variant="bot" />;
}
