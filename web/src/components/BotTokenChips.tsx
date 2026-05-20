import type { Token } from "../api";
import { TokenAvatar } from "./ui/TokenAvatar";

type Props = {
  label: string;
  tokens: Token[];
  onPick: (address: string) => void;
};

export function BotTokenChips({ label, tokens, onPick }: Props) {
  if (tokens.length === 0) return null;

  return (
    <div className="bot-hot">
      <span className="bot-hot__label">{label}</span>
      <div className="bot-hot__chips">
        {tokens.map((t) => (
          <button
            key={t.address}
            type="button"
            className="bot-hot__chip"
            onClick={() => onPick(t.address)}
          >
            <TokenAvatar image={t.image} ticker={t.ticker} size="sm" />
            <span className="bot-hot__chip-name">${t.ticker}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
