import type { Bot } from "grammy";

export const BOT_COMMANDS = [
  { command: "start", description: "Welcome and quick start" },
  { command: "help", description: "List all commands" },
  { command: "wallet", description: "Connect trading wallet (DM only)" },
  { command: "disconnect", description: "Clear wallet session" },
  { command: "approve", description: "Approve USDC for Zap" },
  { command: "balance", description: "Balances for a token" },
  { command: "quote", description: "Preview buy or sell" },
  { command: "buy", description: "Buy tokens with USDC" },
  { command: "sell", description: "Sell tokens for USDC" },
] as const;

export async function registerBotCommands(bot: Bot): Promise<void> {
  await bot.api.setMyCommands([...BOT_COMMANDS]);
}
