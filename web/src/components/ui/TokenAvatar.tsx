import { useState } from "react";
import { resolveTokenImage } from "../../lib/format";

type Props = {
  image: string;
  ticker: string;
  size?: "sm" | "md" | "lg";
};

const sizes = { sm: 40, md: 52, lg: 80 };

export function TokenAvatar({ image, ticker, size = "md" }: Props) {
  const px = sizes[size];
  const src = resolveTokenImage(image);
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        className={`token-avatar token-avatar--${size}`}
        src={src}
        alt={ticker}
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`token-avatar token-avatar--${size} token-avatar--fallback`}
      aria-hidden
    >
      {ticker.slice(0, 2).toUpperCase()}
    </div>
  );
}
