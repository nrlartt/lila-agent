# Stellar agentic payments & tools (reference)

Curated links for operators integrating **x402**, **MPP**, wallets, and **MCP** with AI agents. LILA uses **x402 on Stellar** (see [Architecture](architecture.md)).

## OpenClaw

- [OpenClaw documentation](https://docs.openclaw.ai/): gateway, channels, dashboard.
- [OpenClaw CLI: `mcp`](https://docs.openclaw.ai/cli/mcp): MCP client registry (`mcp.servers`), stdio (`command`, `args`, `cwd`, `env`), SSE/HTTP.

## x402 on Stellar

- [x402 on Stellar (overview)](https://developers.stellar.org/docs/build/agentic-payments/x402)
- [x402 quickstart](https://developers.stellar.org/docs/build/agentic-payments/x402/quickstart-guide)
- [Built on Stellar x402 facilitator](https://developers.stellar.org/docs/build/agentic-payments/x402/built-on-stellar)
- [x402 Stellar monorepo](https://github.com/stellar/x402-stellar)
- [x402 protocol](https://www.x402.org/)
- [Facilitator supported networks](https://www.x402.org/facilitator/supported)
- [OpenZeppelin x402 facilitator plugin](https://github.com/OpenZeppelin/relayer-plugin-x402-facilitator)
- [OZ facilitator guide (Stellar)](https://docs.openzeppelin.com/relayer/1.4.x/guides/stellar-x402-facilitator-guide)
- Community demo MCP (x402 on Stellar): [jamesbachini/x402-mcp-stellar](https://github.com/jamesbachini/x402-mcp-stellar)
- Testnet playground: [xlm402.com](https://xlm402.com)

## MPP on Stellar

- [MPP overview](https://developers.stellar.org/docs/build/agentic-payments/mpp)
- [MPP Charge guide](https://developers.stellar.org/docs/build/agentic-payments/mpp/charge-guide)
- [MPP Session (channels)](https://developers.stellar.org/docs/build/agentic-payments/mpp/channel-guide)
- [MPP demo](https://mpp.stellar.buzz)
- [one-way-channel (Soroban)](https://github.com/stellar-experimental/one-way-channel)
- [stellar-mpp-sdk](https://github.com/stellar/stellar-mpp-sdk) · [@stellar/mpp (npm)](https://www.npmjs.com/package/@stellar/mpp)

## Stellar developer basics

- [Stellar docs](https://developers.stellar.org/)
- [SDKs](https://developers.stellar.org/docs/tools/sdks)
- [Stellar Lab](https://lab.stellar.org/)
- [llms.txt (docs digest)](https://developers.stellar.org/llms.txt)
- [Contract authorization](https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization)
- [Signing Soroban invocations](https://developers.stellar.org/docs/build/guides/transactions/signing-soroban-invocations)

## Wallets (x402-compatible auth entry signing)

Freighter (browser), Albedo, Hana, HOT, Klever, OneKey. See [Stellar x402 docs](https://developers.stellar.org/docs/build/agentic-payments/x402) for current compatibility notes.

## Related MCP & agent tooling

- [stellar-mcp-server](https://github.com/kalepail/stellar-mcp-server): wallet/token/contract tools for Claude and MCP clients.
- [mcp-stellar-xdr](https://github.com/stellar-experimental/mcp-stellar-xdr): XDR encode/decode.
- [stellar-dev-skill](https://github.com/stellar/stellar-dev-skill): Stellar development skill for AI assistants.

## Coinbase & Stripe protocol references

- [Coinbase x402 docs](https://docs.cdp.coinbase.com/x402/docs/welcome)
- [MPP protocol](https://mpp.dev)
- [Stripe machine payments](https://stripe.com/blog/machine-payments-protocol) · [Stripe MPP docs](https://docs.stripe.com/payments/machine)

LILA's own MCP bridge is documented in [OpenClaw & MCP](openclaw-mcp.md).
