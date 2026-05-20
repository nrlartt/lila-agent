export const HYPER_EVM_CHAIN_ID = 999;

export const ADDRESSES = {
  zap: "0x693F12E9E6B35b34458793546065E8b08e0299d6" as const,
  bonding: "0xb68811BcC0e4FcD825aA49F9453b065ddF752FcB" as const,
  usdc: "0xb88339CB7199b77E23DB6E890353E22632Ba630f" as const,
} as const;

/** Contract floor ($10). UI floors per alt.fun docs. */
export const MIN_USDC_CONTRACT = 10n;
export const MIN_USDC_BUY_UI = 20n;
export const MIN_USDC_SELL_UI = 12n;

export const USDC_DECIMALS = 6;
export const TOKEN_DECIMALS = 18;

export const EXPLORER_TX_URL = "https://hyperevmscan.io/tx/";
