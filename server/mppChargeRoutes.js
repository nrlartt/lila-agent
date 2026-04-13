/**
 * Optional MPP Charge (Soroban SAC) payment gate, parallel to x402 on /api/premium/*.
 * Does not modify x402 middleware or existing premium routes.
 *
 * Env: MPP_ENABLED=true, MPP_SECRET_KEY (HMAC for challenges), STELLAR_PAY_TO, STELLAR_NETWORK, STELLAR_RPC_URL
 * @see https://developers.stellar.org/docs/build/agentic-payments/mpp
 */

import { Mppx } from "mppx/express";
import { stellar, Store } from "@stellar/mpp/charge/server";
import {
  STELLAR_PUBNET,
  STELLAR_TESTNET,
  USDC_SAC_MAINNET,
  USDC_SAC_TESTNET,
} from "@stellar/mpp";

/**
 * @param {import("express").Express} app
 * @param {object} ctx
 * @param {boolean} ctx.enabled
 * @param {string} [ctx.secretKey] MPP HMAC secret (not a Stellar key)
 * @param {string} [ctx.recipient] G... public key (same role as STELLAR_PAY_TO)
 * @param {string} ctx.network stellar:testnet | stellar:pubnet
 * @param {string} ctx.rpcUrl Soroban RPC URL
 * @param {(service: string, input: string) => Promise<string | null>} ctx.generateAIResponse
 * @param {(service: string, input: string) => string} ctx.generateResponse
 */
export function registerMppChargeRoutes(app, ctx) {
  const { enabled, secretKey, recipient, network, rpcUrl, generateAIResponse, generateResponse } = ctx;

  if (!enabled) {
    return { mppChargeActive: false };
  }
  if (!secretKey || !recipient) {
    console.warn("[MPP] MPP_ENABLED but MPP_SECRET_KEY or STELLAR_PAY_TO missing; MPP routes off");
    return { mppChargeActive: false };
  }

  const netId = network === STELLAR_PUBNET ? STELLAR_PUBNET : STELLAR_TESTNET;
  const usdcSac = network === STELLAR_PUBNET ? USDC_SAC_MAINNET : USDC_SAC_TESTNET;

  const mppx = Mppx.create({
    secretKey,
    methods: [
      stellar.charge({
        recipient,
        currency: usdcSac,
        network: netId,
        rpcUrl,
        store: Store.memory(),
      }),
    ],
  });

  const gate = (amount, description) => mppx.charge({ amount, description });

  app.post(
    "/api/mpp/premium/chat",
    gate("0.001", "LILA Neural Chat (MPP Charge)"),
    async (req, res) => {
      const input = req.body.message;
      const aiResponse = await generateAIResponse("chat", input).catch(() => null);
      res.json({
        service: "chat",
        payment: "mpp",
        response: aiResponse || generateResponse("chat", input),
        cost: "$0.001",
        ai: !!aiResponse,
      });
    },
  );

  app.post(
    "/api/mpp/premium/analyze",
    gate("0.01", "LILA Market Analysis (MPP Charge)"),
    async (req, res) => {
      const input = req.body.query;
      const aiResponse = await generateAIResponse("analyze", input).catch(() => null);
      res.json({
        service: "analyze",
        payment: "mpp",
        response: aiResponse || generateResponse("analyze", input),
        cost: "$0.01",
        ai: !!aiResponse,
      });
    },
  );

  app.post(
    "/api/mpp/premium/code",
    gate("0.005", "LILA Code Generation (MPP Charge)"),
    async (req, res) => {
      const input = req.body.prompt;
      const aiResponse = await generateAIResponse("code", input).catch(() => null);
      res.json({
        service: "code",
        payment: "mpp",
        response: aiResponse || generateResponse("code", input),
        cost: "$0.005",
        ai: !!aiResponse,
      });
    },
  );

  app.post(
    "/api/mpp/premium/research",
    gate("0.02", "LILA Deep Research (MPP Charge)"),
    async (req, res) => {
      const input = req.body.topic;
      const aiResponse = await generateAIResponse("research", input).catch(() => null);
      res.json({
        service: "research",
        payment: "mpp",
        response: aiResponse || generateResponse("research", input),
        cost: "$0.02",
        ai: !!aiResponse,
      });
    },
  );

  app.post(
    "/api/mpp/premium/strategy",
    gate("0.012", "LILA Strategic Advisory (MPP Charge)"),
    async (req, res) => {
      const input = req.body.brief;
      const aiResponse = await generateAIResponse("strategy", input).catch(() => null);
      res.json({
        service: "strategy",
        payment: "mpp",
        response: aiResponse || generateResponse("strategy", input),
        cost: "$0.012",
        ai: !!aiResponse,
      });
    },
  );

  app.post(
    "/api/mpp/premium/blueprint",
    gate("0.008", "LILA Technical Blueprint (MPP Charge)"),
    async (req, res) => {
      const input = req.body.spec;
      const aiResponse = await generateAIResponse("blueprint", input).catch(() => null);
      res.json({
        service: "blueprint",
        payment: "mpp",
        response: aiResponse || generateResponse("blueprint", input),
        cost: "$0.008",
        ai: !!aiResponse,
      });
    },
  );

  console.log("[MPP] MPP Charge routes active at /api/mpp/premium/* (Soroban SAC, parallel to x402)");
  return { mppChargeActive: true, mppx };
}
