import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchTokenHoneypot, type HoneypotStatus } from "../api";

type Map = Record<string, HoneypotStatus>;

const FeedHoneypotContext = createContext<Map>({});

export function FeedHoneypotProvider({
  addresses,
  children,
}: {
  addresses: string[];
  children: ReactNode;
}) {
  const [statuses, setStatuses] = useState<Map>({});
  const key = useMemo(
    () => addresses.slice(0, 24).join(","),
    [addresses],
  );

  useEffect(() => {
    let cancelled = false;
    const list = addresses.slice(0, 24);

    (async () => {
      for (const addr of list) {
        if (cancelled) return;
        try {
          const h = await fetchTokenHoneypot(addr);
          if (!cancelled && h) {
            setStatuses((prev) => ({ ...prev, [addr.toLowerCase()]: h.status }));
          }
        } catch {
          /* skip */
        }
        await new Promise((r) => setTimeout(r, 120));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, addresses]);

  return (
    <FeedHoneypotContext.Provider value={statuses}>{children}</FeedHoneypotContext.Provider>
  );
}

export function useFeedHoneypotStatus(address: string): HoneypotStatus | undefined {
  const map = useContext(FeedHoneypotContext);
  return map[address.toLowerCase()];
}
