import type { Context, NextFunction } from "grammy";
import { GROUP_CHAT_HINT } from "./messages.js";

const rateLimits = new Map<number, number[]>();
const MAX_REQUESTS = 20;
const WINDOW_MS = 60_000;

export async function requirePrivateChat(ctx: Context, next: NextFunction) {
  if (ctx.chat?.type !== "private") {
    await ctx.reply(GROUP_CHAT_HINT);
    return;
  }
  await next();
}

export async function rateLimit(ctx: Context, next: NextFunction) {
  const userId = ctx.from?.id;
  if (!userId) {
    await next();
    return;
  }

  const now = Date.now();
  const timestamps = rateLimits.get(userId) ?? [];
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    await ctx.reply("Too many requests. Please wait a minute and try again.");
    return;
  }

  recent.push(now);
  rateLimits.set(userId, recent);
  await next();
}
