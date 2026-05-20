import {
  type AutoBotConfig,
  normalizeAutoBotConfig,
} from "./autoBotTypes";

const PREFIX = "alt_auto_bot_cfg_v2_";

export function loadAutoBotConfig(tokenAddress: string): AutoBotConfig | null {
  try {
    const raw = localStorage.getItem(PREFIX + tokenAddress.toLowerCase());
    if (!raw) return null;
    return normalizeAutoBotConfig(JSON.parse(raw) as Partial<AutoBotConfig>);
  } catch {
    return null;
  }
}

export function saveAutoBotConfig(tokenAddress: string, config: AutoBotConfig): void {
  localStorage.setItem(
    PREFIX + tokenAddress.toLowerCase(),
    JSON.stringify(config),
  );
}
