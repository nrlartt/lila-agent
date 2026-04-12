import { useState, useEffect, useRef, useCallback } from "react";
import { decodePaymentResponseHeader } from "@x402/fetch";
import { createUserPaidFetch } from "../lib/x402UserClient.js";
import {
  isFreighterInstalled,
  connectFreighter,
  getBalance,
  shortenAddress,
} from "../lib/wallet.js";
import { apiUrl } from "../lib/apiBase.js";

const BOOT_LINES = [
  { text: "[BOOT] Initializing neural core...", delay: 200 },
  { text: "[BOOT] Loading inference stack ...................... OK", delay: 400 },
  { text: "[BOOT] Establishing x402 payment link .............. OK", delay: 300 },
  { text: "[BOOT] Connecting to Stellar testnet ............... OK", delay: 350 },
  { text: "[BOOT] Verifying agent identity .................... OK", delay: 250 },
  { text: "[BOOT] Loading AI service modules .................. OK", delay: 300 },
  { text: "[BOOT] Initializing x402 micropayment engine ....... OK", delay: 400 },
  { text: "", delay: 100 },
  { text: "▸ All systems operational. Neural link active.", delay: 200 },
  { text: "", delay: 100 },
];

const WELCOME_TEXT = `Welcome, Operator. I am LILA, your autonomous AI agent on Stellar.

I offer paid AI services via x402 micropayments:
  /chat <msg>       Neural conversation         $0.001 USDC
  /analyze <query>  Market analysis             $0.01  USDC
  /code <prompt>    Smart contract generation   $0.005 USDC
  /research <topic> Deep research               $0.02  USDC

Wallet commands:
  /wallet           Connect Stellar wallet (Freighter)
  /balance          Check wallet balance
  /status           Connection & payment status

Other commands:
  /services         List available services
  /help             Show this help message
  /clear            Clear terminal

────────────────────────────────────────────────────────────────`;

export default function Terminal() {
  const [lines, setLines] = useState([]);
  const [input, setInput] = useState("");
  const [booting, setBooting] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState({ xlm: "0", usdc: "0" });
  const [processing, setProcessing] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [txCount, setTxCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const terminalRef = useRef(null);
  const inputRef = useRef(null);
  const historyRef = useRef([]);
  const historyIdxRef = useRef(-1);

  const addLine = useCallback((text, type = "output") => {
    setLines((prev) => [...prev, { text, type, ts: Date.now() }]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      for (const line of BOOT_LINES) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, line.delay));
        if (line.text) addLine(line.text, "system");
      }
      WELCOME_TEXT.split("\n").forEach((l) => addLine(l, "welcome"));
      setBooting(false);

      try {
        const res = await fetch(apiUrl("/api/services"));
        const data = await res.json();
        setServerInfo(data);
        if (data.x402Server) {
          addLine("▸ x402: ENABLED. Pay per request from your Freighter wallet (USDC)", "success");
        } else {
          addLine("▸ x402: unavailable in this deployment (demo / offline payments)", "warn");
        }
      } catch {
        addLine("▸ Could not connect to server", "error");
      }
    }
    boot();
    return () => { cancelled = true; };
  }, [addLine]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    if (!booting && inputRef.current) inputRef.current.focus();
  }, [booting]);

  async function refreshBalance(addr) {
    const bal = await getBalance(addr || wallet);
    setBalance(bal);
    return bal;
  }

  async function handleCommand(cmd) {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    historyRef.current.unshift(trimmed);
    historyIdxRef.current = -1;
    addLine(`lila@neural:~$ ${trimmed}`, "command");

    const [command, ...args] = trimmed.split(" ");
    const arg = args.join(" ");
    const cmd_clean = command.toLowerCase().replace(/^\//, "");

    switch (cmd_clean) {
      case "help":
        WELCOME_TEXT.split("\n").forEach((l) => addLine(l, "welcome"));
        break;

      case "clear":
        setLines([]);
        break;

      case "wallet": {
        addLine("[WALLET] Detecting Freighter wallet...", "system");
        const installed = await isFreighterInstalled();
        if (!installed) {
          addLine("✗ Freighter not detected.", "error");
          addLine("  Install from: https://freighter.app", "error");
          addLine("  Then reload this page and try /wallet again.", "dim");
          break;
        }
        try {
          addLine("[WALLET] Requesting access...", "system");
          const addr = await connectFreighter();
          setWallet(addr);
          addLine(`✓ Wallet connected: ${shortenAddress(addr)}`, "success");
          addLine(`  Full address: ${addr}`, "dim");
          const bal = await refreshBalance(addr);
          addLine(`  XLM Balance:  ${bal.xlm}`, "info");
          addLine(`  USDC Balance: ${bal.usdc}`, "info");
        } catch (err) {
          addLine(`✗ Connection failed: ${err.message}`, "error");
        }
        break;
      }

      case "balance": {
        if (!wallet) {
          addLine("✗ No wallet connected. Use /wallet first.", "error");
          break;
        }
        addLine("[WALLET] Fetching balance...", "system");
        const bal = await refreshBalance();
        addLine(`  Address: ${shortenAddress(wallet)}`, "info");
        addLine(`  XLM:    ${bal.xlm}`, "info");
        addLine(`  USDC:   ${bal.usdc}`, "info");
        break;
      }

      case "status": {
        addLine("", "output");
        addLine("━━━ LILA STATUS ━━━━━━━━━━━━━━━━━━━━━━━━━", "accent");
        addLine(`  Stellar:     ${serverInfo?.networkLabel || "Testnet"}`, "info");
        addLine(`  x402:        ${serverInfo?.x402Server ? "ready" : "off"}`, serverInfo?.x402Server ? "success" : "warn");
        addLine(`  AI:          ${serverInfo?.llmReady ? "ready" : "demo / static"}`, serverInfo?.llmReady ? "success" : "warn");
        addLine(`  Your wallet: ${wallet ? shortenAddress(wallet) : "not connected"}`, "info");
        if (serverInfo?.payTo) {
          addLine(`  Pay address: ${shortenAddress(serverInfo.payTo)}`, "dim");
        }
        addLine(`  Session TX:  ${txCount}  │  Spent: ${totalSpent.toFixed(4)} USDC`, "info");
        break;
      }

      case "services": {
        addLine("", "output");
        addLine("╔══════════════════════════════════════════════════════╗", "accent");
        addLine("║          LILA SERVICE CATALOG | x402 Powered         ║", "accent");
        addLine("╚══════════════════════════════════════════════════════╝", "accent");
        addLine("", "output");
        const svcList = serverInfo?.services || [];
        svcList.forEach((s) => {
          addLine(`  ◆ ${s.name.padEnd(25)} ${s.price.padEnd(10)} /${s.id}`, "info");
        });
        addLine("", "output");
        addLine(`  Network:  ${serverInfo?.network || "stellar:testnet"}`, "dim");
        addLine(`  x402:     ${serverInfo?.x402Server ? "ENABLED ✓ (Freighter)" : "DEMO MODE"}`, serverInfo?.x402Server ? "success" : "warn");
        addLine(`  Protocol: Pay-per-request via Stellar USDC`, "dim");
        break;
      }

      case "chat":
      case "analyze":
      case "code":
      case "research": {
        if (!arg) {
          const hint = { chat: "message", analyze: "query", code: "prompt", research: "topic" };
          addLine(`✗ Usage: /${cmd_clean} <your ${hint[cmd_clean]}>`, "error");
          break;
        }
        await callAgentService(cmd_clean, arg);
        break;
      }

      default:
        if (trimmed.startsWith("/")) {
          addLine(`✗ Unknown command: ${command}. Type /help for commands.`, "error");
        } else {
          await callAgentService("chat", trimmed);
        }
    }
  }

  async function callAgentService(service, userInput) {
    const priceMap = { chat: 0.001, analyze: 0.01, code: 0.005, research: 0.02 };
    const price = priceMap[service];
    const bodyKeyMap = {
      chat: "message",
      analyze: "query",
      code: "prompt",
      research: "topic",
    };
    const bodyKey = bodyKeyMap[service];

    addLine("", "output");
    addLine(`[x402] ⚡ Requesting service: ${service}`, "payment");
    addLine(`[x402] Price: $${price} USDC on Stellar testnet`, "payment");
    setProcessing(true);

    try {
      const explorerBase =
        serverInfo?.network === "stellar:pubnet"
          ? "https://stellar.expert/explorer/public/tx/"
          : "https://stellar.expert/explorer/testnet/tx/";

      let res;
      if (serverInfo?.x402Server) {
        if (!wallet) {
          addLine("✗ Connect your wallet first: /wallet", "error");
          addLine("  Real x402 charges come from your Freighter wallet (USDC + XLM for fees).", "dim");
          setProcessing(false);
          return;
        }
        const paidFetch = createUserPaidFetch(
          wallet,
          serverInfo.network,
          serverInfo.rpcUrl,
        );
        res = await paidFetch(apiUrl(`/api/premium/${service}`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [bodyKey]: userInput }),
        });
      } else {
        res = await fetch(apiUrl(`/api/premium/${service}`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [bodyKey]: userInput }),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        addLine(`✗ Error: ${data.error || data.message || "Request failed"}`, "error");
        if (data.detail) addLine(`  ${data.detail}`, "dim");
        if (data.hint) addLine(`  Hint: ${data.hint}`, "warn");
        setProcessing(false);
        return;
      }

      if (serverInfo?.x402Server && wallet) {
        setTxCount((c) => c + 1);
        setTotalSpent((s) => s + price);
        let txHash = null;
        const payHeader =
          res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
        if (payHeader) {
          try {
            const decoded = decodePaymentResponseHeader(payHeader);
            txHash =
              decoded?.txHash ??
              decoded?.transaction ??
              decoded?.transactionId ??
              null;
          } catch {
            /* ignore parse errors */
          }
        }
        if (txHash) {
          addLine(`[x402] ✓ Payment SETTLED on Stellar`, "success");
          addLine(`[x402] TX: ${txHash}`, "success");
          addLine(`[x402] Explorer: ${explorerBase}${txHash}`, "info");
          addLine(`[x402] Payer: ${shortenAddress(wallet)}`, "dim");
        } else {
          addLine(`[x402] ✓ Request completed`, "success");
        }
        addLine(`[x402] Cost: $${price} USDC`, "payment");
      } else {
        addLine(`[x402] ○ Demo mode. No on-chain payment`, "warn");
        addLine(`[x402] Simulated cost: $${price} USDC`, "dim");
      }

      addLine("", "output");
      (data.response || "").split("\n").forEach((line) => {
        addLine(line, "response");
      });
    } catch (err) {
      addLine(`✗ Network error: ${err.message}`, "error");
    }

    setProcessing(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !processing) {
      handleCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const hist = historyRef.current;
      if (hist.length > 0) {
        const idx = Math.min(historyIdxRef.current + 1, hist.length - 1);
        historyIdxRef.current = idx;
        setInput(hist[idx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = historyIdxRef.current - 1;
      if (idx < 0) {
        historyIdxRef.current = -1;
        setInput("");
      } else {
        historyIdxRef.current = idx;
        setInput(historyRef.current[idx]);
      }
    }
  }

  const isLive = serverInfo?.x402Server && !!wallet;

  return (
    <div className="terminal-container" onClick={() => inputRef.current?.focus()}>
      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-left">
          <span className={`status-dot ${isLive ? "" : "dot-warn"}`} />
          <span>LILA NEURAL TERMINAL v4.0</span>
          <span className="separator">│</span>
          <span className="status-network">
            {serverInfo?.networkLabel || "STELLAR"}
          </span>
          <span className="separator">│</span>
          <span className={isLive ? "status-live" : "status-demo"}>
            {isLive ? "x402 LIVE" : "DEMO"}
          </span>
        </div>
        <div className="status-right">
          {wallet && (
            <>
              <span className="status-wallet">◆ {shortenAddress(wallet)}</span>
              <span className="separator">│</span>
              <span className="status-usdc">{balance.usdc} USDC</span>
              <span className="separator">│</span>
            </>
          )}
          <span className="status-tx">TX: {txCount}</span>
          <span className="separator">│</span>
          <span className="status-spent">SPENT: {totalSpent.toFixed(3)} USDC</span>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="terminal-body" ref={terminalRef}>
        <pre className="ascii-header">
{`  ██╗     ██╗██╗      █████╗ 
  ██║     ██║██║     ██╔══██╗
  ██║     ██║██║     ███████║
  ██║     ██║██║     ██╔══██║
  ███████╗██║███████╗██║  ██║
  ╚══════╝╚═╝╚══════╝╚═╝  ╚═╝`}
        </pre>

        {lines.map((line, i) => (
          <div key={i} className={`terminal-line line-${line.type}`}>
            {line.text}
          </div>
        ))}

        {processing && (
          <div className="terminal-line line-processing">
            <span className="spinner" /> Processing query & settling payment...
          </div>
        )}

        {!booting && (
          <div className="input-line">
            <span className="prompt">lila@neural:~$&nbsp;</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="terminal-input"
              spellCheck={false}
              autoComplete="off"
              disabled={processing}
              placeholder={processing ? "settling on Stellar..." : "type a command or message..."}
            />
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="bottom-bar">
        <span>x402 PROTOCOL</span>
        <span className="separator">│</span>
        <span>USDC MICROPAYMENTS</span>
        <span className="separator">│</span>
        <span>STELLAR NETWORK</span>
        <span className="separator">│</span>
        <span className={wallet ? "connected" : "disconnected"}>
          {wallet ? `FREIGHTER: ${shortenAddress(wallet)}` : "FREIGHTER: NOT CONNECTED"}
        </span>
      </div>
    </div>
  );
}
