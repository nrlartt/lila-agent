import { TokenFeed } from "../components/TokenFeed";
import { PriceTickerBar } from "../components/PriceTickerBar";

export function HomePage() {
  return (
    <div className="market-page">
      <PriceTickerBar />
      <TokenFeed />
    </div>
  );
}
