import {
  type LaunchPosition,
  type LaunchSniperConfig,
  normalizeLaunchSniperConfig,
} from "./launchSniperTypes";

const CFG_PREFIX = "alt_launch_sniper_cfg_v1_";
const POS_PREFIX = "alt_launch_sniper_pos_v1_";

export function loadLaunchSniperConfig(wallet: string): LaunchSniperConfig | null {
  try {
    const raw = localStorage.getItem(CFG_PREFIX + wallet.toLowerCase());
    if (!raw) return null;
    return normalizeLaunchSniperConfig(JSON.parse(raw) as Partial<LaunchSniperConfig>);
  } catch {
    return null;
  }
}

export function saveLaunchSniperConfig(
  wallet: string,
  config: LaunchSniperConfig,
): void {
  localStorage.setItem(CFG_PREFIX + wallet.toLowerCase(), JSON.stringify(config));
}

export function loadLaunchPositions(wallet: string): LaunchPosition[] {
  try {
    const raw = localStorage.getItem(POS_PREFIX + wallet.toLowerCase());
    if (!raw) return [];
    return JSON.parse(raw) as LaunchPosition[];
  } catch {
    return [];
  }
}

export function saveLaunchPositions(wallet: string, positions: LaunchPosition[]): void {
  localStorage.setItem(POS_PREFIX + wallet.toLowerCase(), JSON.stringify(positions));
}
