export const WELCOME_MESSAGE = `Welcome to Lila Bot 🤖

Trade alt.fun tokens on HyperEVM via the official Zap contract. Buys include referral attribution for the bot operator.

Private chat only for /wallet — never share keys in groups.

Web dashboard: https://lilagent.xyz/bot

Docs: https://docs.alt.fun/integrations`;

export const HELP_MESSAGE = `Lila Bot commands

/start — welcome
/help — this message
/wallet <key> — connect hot wallet (DM only)
/disconnect — clear session
/approve — approve USDC for Zap
/balance <token> — wallet + token balances
/quote buy|sell <token> <amount> — preview
/buy <token> <usdc> — buy with USDC
/sell <token> <amount|50%|max> — sell tokens

Dashboard: https://lilagent.xyz/bot`;

export const GROUP_CHAT_HINT =
  "For security, connect your wallet and trade in a private chat with Lila Bot.";

export const WALLET_WARNING =
  "⚠️ Your private key is stored on the server for this session. Use a dedicated hot wallet with limited funds.";

export function WALLET_CONNECTED(address: string): string {
  return `Wallet connected for Lila Bot.\nAddress: ${address}\n\nRun /approve once, then /buy or /sell.`;
}
