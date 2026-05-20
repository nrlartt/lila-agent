import { isAddress, type Address } from "viem";
import {
  getPrivateKeyFromEnv,
  getReferrerAddress,
  getSlippageBps,
} from "./config.js";
import { createTradingWallet } from "./chain.js";
import { EXPLORER_TX_URL } from "./constants.js";
import { formatTokens, formatUsdc, parseTokenInput, parseUsdcInput } from "./format.js";
import {
  approveAll,
  executeBuy,
  executeSell,
  formatBuySummary,
  formatSellSummary,
  getTokenStatus,
  quoteBuy,
  quoteSell,
} from "./trade.js";

function tokenArg(arg: string): Address {
  if (!isAddress(arg)) throw new Error(`Invalid token: ${arg}`);
  return arg;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command) {
    console.log(`Usage:
  cli approve
  cli status <token>
  cli quote buy <token> <usdc>
  cli quote sell <token> <amount>
  cli buy <token> <usdc>
  cli sell <token> <amount|max>`);
    process.exit(1);
  }

  const wallet = createTradingWallet(getPrivateKeyFromEnv());
  const referrer = getReferrerAddress();
  const slippageBps = getSlippageBps();

  switch (command) {
    case "approve": {
      const hashes = await approveAll(wallet);
      console.log(hashes.length ? `Approved: ${EXPLORER_TX_URL}${hashes[0]}` : "Already approved");
      break;
    }
    case "status": {
      const token = tokenArg(rest[0]);
      const s = await getTokenStatus(token, wallet.address);
      console.log(JSON.stringify({
        wallet: wallet.address,
        token,
        lifecycle: s.lifecycleText,
        usdc: formatUsdc(s.usdcBal),
        tokens: formatTokens(s.tokenBal),
        maxSellable: formatTokens(s.maxSell),
        ltBufferUsdc: formatUsdc(s.bufferUsdc),
        note: s.sellNote,
      }, null, 2));
      break;
    }
    case "quote": {
      const [side, tokenRaw, amountRaw] = rest;
      const token = tokenArg(tokenRaw);
      if (side === "buy") {
        const usdc = parseUsdcInput(amountRaw);
        const q = await quoteBuy(wallet, token, usdc, slippageBps);
        console.log(formatBuySummary(token, amountRaw, q, referrer));
      } else if (side === "sell") {
        const amount =
          amountRaw.toLowerCase() === "max"
            ? (await getTokenStatus(token, wallet.address)).maxSell
            : parseTokenInput(amountRaw);
        const q = await quoteSell(wallet, token, amount, slippageBps);
        console.log(formatSellSummary(token, q));
      } else {
        throw new Error("quote side must be buy or sell");
      }
      break;
    }
    case "buy": {
      const [tokenRaw, usdcHuman] = rest;
      const token = tokenArg(tokenRaw);
      const usdc = parseUsdcInput(usdcHuman);
      const q = await quoteBuy(wallet, token, usdc, slippageBps);
      console.log(formatBuySummary(token, usdcHuman, q, referrer));
      const { hash, tokensOut } = await executeBuy(
        wallet,
        token,
        usdcHuman,
        referrer,
        slippageBps,
      );
      console.log(`\nTx: ${EXPLORER_TX_URL}${hash}`);
      console.log(`Est. tokens: ${formatTokens(tokensOut)}`);
      break;
    }
    case "sell": {
      const [tokenRaw, amountRaw] = rest;
      const token = tokenArg(tokenRaw);
      const status = await getTokenStatus(token, wallet.address);
      const amount =
        amountRaw.toLowerCase() === "max"
          ? status.maxSell || status.tokenBal
          : parseTokenInput(amountRaw);
      const q = await quoteSell(wallet, token, amount, slippageBps);
      console.log(formatSellSummary(token, q));
      const { hash, usdcOut } = await executeSell(
        wallet,
        token,
        amount,
        slippageBps,
      );
      console.log(`\nTx: ${EXPLORER_TX_URL}${hash}`);
      console.log(`Est. USDC: ${formatUsdc(usdcOut)}`);
      break;
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
