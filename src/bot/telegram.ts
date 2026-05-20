import { Bot } from "grammy";
import { type Address, isAddress } from "viem";
import { EXPLORER_TX_URL } from "../constants.js";
import {
  getReferrerAddress,
  getSlippageBps,
  getTelegramToken,
  validateBotEnv,
} from "../config.js";
import {
  formatTokens,
  formatUsdc,
  parseTokenInput,
  parseUsdcInput,
} from "../format.js";
import {
  clearSession,
  connectFromInput,
  getSession,
  hasSession,
} from "../session.js";
import {
  approveAll,
  executeBuy,
  executeSell,
  formatBuySummary,
  formatSellSummary,
  getTokenStatus,
  quoteBuy,
  quoteSell,
} from "../trade.js";
import { registerBotCommands } from "./commands.js";
import {
  GROUP_CHAT_HINT,
  HELP_MESSAGE,
  WALLET_CONNECTED,
  WALLET_WARNING,
  WELCOME_MESSAGE,
} from "./messages.js";
import { rateLimit } from "./middleware.js";

function parseTokenAddress(input: string): Address {
  const trimmed = input.trim();
  if (!isAddress(trimmed)) {
    throw new Error("Invalid token address (must be 0x…)");
  }
  return trimmed;
}

async function resolveSellAmount(
  token: Address,
  amountArg: string,
  owner: Address,
): Promise<bigint> {
  const status = await getTokenStatus(token, owner);
  if (status.tokenBal === 0n) throw new Error("No token balance");

  const arg = amountArg.trim().toLowerCase();
  if (arg === "max" || arg === "100%") {
    const sellable =
      status.maxSell > 0n ? status.maxSell : status.tokenBal;
    if (sellable === 0n) {
      throw new Error(
        "Nothing sellable right now (check LT buffer or try again in ~10s)",
      );
    }
    return sellable;
  }

  if (arg.endsWith("%")) {
    const pct = Number(arg.slice(0, -1));
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      throw new Error("Percent must be between 1 and 100");
    }
    const base =
      status.maxSell > 0n && status.maxSell < status.tokenBal
        ? status.maxSell
        : status.tokenBal;
    return (base * BigInt(Math.round(pct * 100))) / 10_000n;
  }

  return parseTokenInput(amountArg);
}

function requireWallet(ctx: { chat?: { id: number } }): void {
  if (!ctx.chat || !hasSession(ctx.chat.id)) {
    throw new Error(
      "No wallet connected. In a private chat, send /wallet with your hot-wallet private key.",
    );
  }
}

async function replyError(ctx: { reply: (text: string) => Promise<unknown> }, e: unknown) {
  const message = e instanceof Error ? e.message : "Unknown error";
  await ctx.reply(`Error: ${message}`);
}

export async function startTelegramBot(): Promise<void> {
  validateBotEnv();

  const bot = new Bot(getTelegramToken());
  const referrer = getReferrerAddress();
  const slippageBps = getSlippageBps();

  bot.use(rateLimit);

  bot.command("start", async (ctx) => {
    if (ctx.chat?.type !== "private") {
      await ctx.reply(`${WELCOME_MESSAGE}\n\n${GROUP_CHAT_HINT}`);
      return;
    }
    await ctx.reply(WELCOME_MESSAGE);
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(HELP_MESSAGE);
  });

  const privateBot = bot.filter((ctx) => ctx.chat?.type === "private");

  privateBot.command("wallet", async (ctx) => {
    const key = ctx.match?.trim();
    if (!key) {
      await ctx.reply(
        `${WALLET_WARNING}\n\nUsage: /wallet <private_key>\nExample: /wallet 0xabc...`,
      );
      return;
    }

    try {
      const address = connectFromInput(ctx.chat.id, key);
      if (ctx.message?.message_id) {
        try {
          await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
        } catch {
          // Deletion may fail for old messages; still continue.
        }
      }
      await ctx.reply(WALLET_CONNECTED(address));
    } catch (e) {
      await replyError(ctx, e);
    }
  });

  privateBot.command("disconnect", async (ctx) => {
    clearSession(ctx.chat.id);
    await ctx.reply("Wallet disconnected. Session cleared from this server.");
  });

  privateBot.command("approve", async (ctx) => {
    try {
      requireWallet(ctx);
      const { wallet } = getSession(ctx.chat.id);
      await ctx.reply("Submitting USDC approval for Zap…");
      const hashes = await approveAll(wallet);
      if (hashes.length === 0) {
        await ctx.reply("USDC is already approved for Zap.");
      } else {
        await ctx.reply(`Approval confirmed.\n${EXPLORER_TX_URL}${hashes[0]}`);
      }
    } catch (e) {
      await replyError(ctx, e);
    }
  });

  privateBot.command("balance", async (ctx) => {
    try {
      requireWallet(ctx);
      const { wallet } = getSession(ctx.chat.id);
      const parts = ctx.match?.trim().split(/\s+/) ?? [];
      if (!parts[0]) {
        await ctx.reply("Usage: /balance <token_address>");
        return;
      }
      const token = parseTokenAddress(parts[0]);
      const s = await getTokenStatus(token, wallet.address);
      await ctx.reply(
        [
          `Wallet: ${wallet.address}`,
          `Token: ${token}`,
          `Lifecycle: ${s.lifecycleText}`,
          `USDC: ${formatUsdc(s.usdcBal)}`,
          `Token balance: ${formatTokens(s.tokenBal)}`,
          s.maxSell > 0n
            ? `Max sellable now: ${formatTokens(s.maxSell)} (LT buffer: ${formatUsdc(s.bufferUsdc)} USDC)`
            : "Max sellable: n/a",
          s.sellNote ?? "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } catch (e) {
      await replyError(ctx, e);
    }
  });

  privateBot.command("quote", async (ctx) => {
    try {
      requireWallet(ctx);
      const { wallet } = getSession(ctx.chat.id);
      const parts = ctx.match?.trim().split(/\s+/) ?? [];
      const side = parts[0]?.toLowerCase();
      const token = parts[1] ? parseTokenAddress(parts[1]) : null;
      if (!side || !token || !parts[2]) {
        await ctx.reply(
          "Usage:\n/quote buy <token> <usdc>\n/quote sell <token> <amount|50%|max>",
        );
        return;
      }

      if (side === "buy") {
        const usdc = parseUsdcInput(parts[2]);
        const q = await quoteBuy(wallet, token, usdc, slippageBps);
        await ctx.reply(formatBuySummary(token, parts[2], q, referrer));
      } else if (side === "sell") {
        const amount = await resolveSellAmount(token, parts[2], wallet.address);
        const q = await quoteSell(wallet, token, amount, slippageBps);
        await ctx.reply(formatSellSummary(token, q));
      } else {
        await ctx.reply('Side must be "buy" or "sell"');
      }
    } catch (e) {
      await replyError(ctx, e);
    }
  });

  privateBot.command("buy", async (ctx) => {
    try {
      requireWallet(ctx);
      const { wallet } = getSession(ctx.chat.id);
      const parts = ctx.match?.trim().split(/\s+/) ?? [];
      if (!parts[0] || !parts[1]) {
        await ctx.reply("Usage: /buy <token_address> <usdc_amount>");
        return;
      }
      const token = parseTokenAddress(parts[0]);
      await ctx.reply("Submitting buy transaction…");
      const { hash, tokensOut } = await executeBuy(
        wallet,
        token,
        parts[1],
        referrer,
        slippageBps,
      );
      await ctx.reply(
        [
          "Buy submitted successfully.",
          `Estimated tokens: ${formatTokens(tokensOut)}`,
          `Tx: ${EXPLORER_TX_URL}${hash}`,
        ].join("\n"),
      );
    } catch (e) {
      await replyError(ctx, e);
    }
  });

  privateBot.command("sell", async (ctx) => {
    try {
      requireWallet(ctx);
      const { wallet } = getSession(ctx.chat.id);
      const parts = ctx.match?.trim().split(/\s+/) ?? [];
      if (!parts[0] || !parts[1]) {
        await ctx.reply("Usage: /sell <token_address> <amount|50%|max>");
        return;
      }
      const token = parseTokenAddress(parts[0]);
      const amount = await resolveSellAmount(token, parts[1], wallet.address);
      await ctx.reply("Submitting sell transaction…");
      const { hash, usdcOut } = await executeSell(
        wallet,
        token,
        amount,
        slippageBps,
      );
      await ctx.reply(
        [
          "Sell submitted successfully.",
          `Estimated USDC: ${formatUsdc(usdcOut)}`,
          `Tx: ${EXPLORER_TX_URL}${hash}`,
        ].join("\n"),
      );
    } catch (e) {
      await replyError(ctx, e);
    }
  });

  // Sensitive commands in groups
  bot.command(["wallet", "approve", "buy", "sell", "quote", "balance", "disconnect"], async (ctx) => {
    if (ctx.chat?.type !== "private") {
      await ctx.reply(GROUP_CHAT_HINT);
    }
  });

  bot.catch((err) => {
    console.error("Telegram bot error:", err);
  });

  await registerBotCommands(bot);

  console.log("Telegram bot started");
  console.log(`Referrer: ${referrer}`);
  console.log(`Slippage: ${slippageBps / 100}%`);

  await bot.start();
}
