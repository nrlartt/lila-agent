const mode = process.argv[2];

if (mode === "bot") {
  const { startTelegramBot } = await import("./bot/telegram.js");
  await startTelegramBot();
} else if (mode === "server") {
  await import("./server/index.js");
} else if (mode === "cli") {
  const { validateCliEnv } = await import("./config.js");
  validateCliEnv();
  process.argv = [process.argv[0], process.argv[1], ...process.argv.slice(3)];
  await import("./cli.js");
} else {
  console.error("Usage:");
  console.error("  npm run start:bot          # Telegram bot");
  console.error("  npm run start:server       # API + indexer + web (prod build)");
  console.error("  npm run start:cli -- ...   # CLI (operator wallet)");
  process.exit(1);
}
