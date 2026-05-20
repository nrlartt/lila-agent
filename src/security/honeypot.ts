import { type Address } from "viem";

import { erc20Abi, zapAbi } from "../abis.js";

import { ADDRESSES } from "../constants.js";

import { getPublicClient } from "../chain.js";

import { getTokenLifecycle } from "../lifecycle.js";

import {

  fetchApiHolders,

  fetchApiSecurity,

  fetchApiToken,

  fetchApiTradesForToken,

  importApiToken,

  type ApiSecurity,

} from "../indexer/altfun-api.js";

import { countTokensByCreator, getToken } from "../indexer/db.js";

import {

  buildCreatorAnalysis,

  buildSocialAnalysis,

  buildTokenCaAnalysis,

  computeOverallScore,

  extractSocialLinks,

  fetchCreatorOnChain,

  scoreToStatus,

  type AnalysisLayer,

  type SocialLinks,

} from "./honeypotAnalysis.js";



export type HoneypotStatus = "clear" | "caution" | "risk" | "unknown";



export type AnalysisSignal = {

  id: string;

  label: string;

  status: "pass" | "warn" | "fail" | "unknown";

  detail: string;

};



export type HoneypotCheck = {

  status: HoneypotStatus;

  score: number;

  isHoneypot: boolean;

  canSell: boolean | null;

  buyFeeBps: number;

  sellFeeBps: number;

  creatorHoldingPct: number | null;

  contractVerified: boolean | null;

  lpLocked: boolean | null;

  recentSellCount: number;

  flags: string[];

  summary: string;

  checkedAt: number;

  creator: string | null;

  social: SocialLinks;

  tokenAnalysis: AnalysisLayer;

  creatorAnalysis: AnalysisLayer;

  socialAnalysis: AnalysisLayer;

};



const CACHE_TTL_MS = 5 * 60_000;

const HONEYPOT_TIMEOUT_MS = 12_000;

const cache = new Map<string, { at: number; data: HoneypotCheck }>();



async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {

  let timer: ReturnType<typeof setTimeout> | undefined;

  try {

    return await Promise.race([

      promise,

      new Promise<null>((resolve) => {

        timer = setTimeout(() => resolve(null), ms);

      }),

    ]);

  } finally {

    if (timer) clearTimeout(timer);

  }

}



export async function checkTokenHoneypot(address: string): Promise<HoneypotCheck> {

  const key = address.toLowerCase();

  const hit = cache.get(key);

  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;



  const report = await withTimeout(runCheck(key as Address), HONEYPOT_TIMEOUT_MS);

  if (!report) {

    return buildTimedOutCheck(key);

  }

  cache.set(key, { at: Date.now(), data: report });

  return report;

}



function buildTimedOutCheck(address: string): HoneypotCheck {

  const checkedAt = Math.floor(Date.now() / 1000);

  const tokenAnalysis: AnalysisLayer = {

    score: 45,

    summary: "Safety scan timed out",

    signals: [

      {

        id: "timeout",

        label: "Scan timeout",

        status: "unknown",

        detail: "Checks took too long — try again shortly",

      },

    ],

  };

  const creatorAnalysis: AnalysisLayer = {

    score: 45,

    summary: "Creator scan incomplete",

    signals: [],

  };

  const socialAnalysis: AnalysisLayer = {

    score: 45,

    summary: "Social scan incomplete",

    signals: [],

  };



  return finish(

    {

      status: "unknown",

      score: 45,

      isHoneypot: false,

      canSell: null,

      buyFeeBps: 0,

      sellFeeBps: 0,

      creatorHoldingPct: null,

      contractVerified: null,

      lpLocked: null,

      recentSellCount: 0,

      summary: "Safety scan timed out — partial results only",

      checkedAt,

      creator: getToken(address)?.creator?.toLowerCase() ?? null,

      social: { twitter: null, telegram: null, website: null },

      tokenAnalysis,

      creatorAnalysis,

      socialAnalysis,

    },

    ["Safety scan timed out"],

  );

}



async function runCheck(token: Address): Promise<HoneypotCheck> {

  const checkedAt = Math.floor(Date.now() / 1000);

  const flags: string[] = [];



  let tokenRow = getToken(token) ?? null;

  if (!tokenRow) {

    const apiToken = await fetchApiToken(token);

    if (apiToken) {

      importApiToken(apiToken);

      tokenRow = getToken(token) ?? null;

    }

  }



  const lifecycle = await getTokenLifecycle(token);

  const creator = tokenRow?.creator?.toLowerCase() ?? null;

  const social = extractSocialLinks(tokenRow);



  if (lifecycle === "graduating") {

    return finish(

      buildGraduatingCheck(checkedAt, creator, social),

      flags,

    );

  }



  if (lifecycle === "unknown") {

    return finish(

      buildUnknownCheck(checkedAt, creator, social),

      flags,

    );

  }



  const client = getPublicClient();



  const [security, trades, holders, buyFeeBps, sellFeeBps, creatorOnChain] = await Promise.all([

    fetchApiSecurity(token).catch(() => null),

    fetchApiTradesForToken(token, 20, { maxPages: 2 }).catch(() => []),

    fetchApiHolders(token, 12).catch(() => null),

    client.readContract({

      address: ADDRESSES.zap,

      abi: zapAbi,

      functionName: "buyFeeBps",

    }).catch(() => 0n),

    client.readContract({

      address: ADDRESSES.zap,

      abi: zapAbi,

      functionName: "sellFeeBps",

    }).catch(() => 0n),

    fetchCreatorOnChain(

      creator,

      creator ? countTokensByCreator(creator) : null,

      (address) => client.getTransactionCount({ address }),

    ),

  ]);



  const recentSellCount = trades.filter((t) => !t.isBuy).length;

  if (recentSellCount > 0) {

    flags.push(`${recentSellCount} recent sell(s) on alt.fun`);

  }



  applySecurityFlags(security, flags);



  const buyBps = Number(buyFeeBps);

  const sellBps = Number(sellFeeBps);

  if (buyBps > 500) flags.push(`Elevated buy fee (${(buyBps / 100).toFixed(1)}%)`);

  if (sellBps > 500) flags.push(`Elevated sell fee (${(sellBps / 100).toFixed(1)}%)`);



  let canSell: boolean | null = null;



  if (recentSellCount > 0) {

    canSell = true;

  } else {

    canSell = await simulateSellFromHolder(token, holders?.holders ?? []);

    if (canSell === true) flags.push("Sell path simulates OK");

    else if (canSell === false) flags.push("Sell simulation failed");

    else flags.push("Sell path not verified (no recent sells)");

  }



  const tokenAnalysis = buildTokenCaAnalysis({

    security,

    holders,

    canSell,

    recentSellCount,

    buyFeeBps: buyBps,

    sellFeeBps: sellBps,

    lifecycle,

    tokenRow,

  });



  const creatorAnalysis = buildCreatorAnalysis({

    creator,

    security,

    holders: holders?.holders ?? [],

    onChain: creatorOnChain,

  });



  const socialAnalysis = buildSocialAnalysis(social);



  const score = computeOverallScore({

    token: tokenAnalysis,

    creator: creatorAnalysis,

    social: socialAnalysis,

  });



  const hardFails =

    canSell === false ||

    (security?.creatorHoldingPct ?? 0) >= 50 ||

    (lifecycle === "graduated" && security != null && !security.lpLocked);



  let status = scoreToStatus(score, canSell, hardFails);

  if (status === "clear" && hasCautionSignals(security, buyBps, sellBps)) {

    status = "caution";

  }



  const isHoneypot = status === "risk";



  const summary =

    status === "clear"

      ? `Safety score ${score}/100 — no major honeypot signals`

      : status === "caution"

        ? `Safety score ${score}/100 — review warnings before trading`

        : status === "risk"

          ? `Safety score ${score}/100 — high risk, selling may fail`

          : `Safety score ${score}/100 — sell safety not fully confirmed`;



  return finish(

    {

      status,

      score,

      isHoneypot,

      canSell,

      buyFeeBps: buyBps,

      sellFeeBps: sellBps,

      creatorHoldingPct: security?.creatorHoldingPct ?? null,

      contractVerified: security?.contractVerified ?? null,

      lpLocked: security?.lpLocked ?? null,

      recentSellCount,

      summary,

      checkedAt,

      creator,

      social,

      tokenAnalysis,

      creatorAnalysis,

      socialAnalysis,

    },

    flags,

  );

}



function buildGraduatingCheck(

  checkedAt: number,

  creator: string | null,

  social: SocialLinks,

): Omit<HoneypotCheck, "flags"> {

  const tokenAnalysis: AnalysisLayer = {

    score: 45,

    summary: "Trading paused during graduation",

    signals: [

      {

        id: "graduating",

        label: "Graduation",

        status: "warn",

        detail: "Trading paused — migrating to HyperSwap",

      },

    ],

  };

  const creatorAnalysis = buildCreatorAnalysis({

    creator,

    security: null,

    holders: [],

    onChain: { txCount: null, launchCount: creator ? countTokensByCreator(creator) : null },

  });

  const socialAnalysis = buildSocialAnalysis(social);

  const score = computeOverallScore({ token: tokenAnalysis, creator: creatorAnalysis, social: socialAnalysis });



  return {

    status: "caution",

    score,

    isHoneypot: false,

    canSell: false,

    buyFeeBps: 0,

    sellFeeBps: 0,

    creatorHoldingPct: null,

    contractVerified: null,

    lpLocked: null,

    recentSellCount: 0,

    summary: "Trading paused — graduating to HyperSwap",

    checkedAt,

    creator,

    social,

    tokenAnalysis,

    creatorAnalysis,

    socialAnalysis,

  };

}

function buildUnknownCheck(

  checkedAt: number,

  creator: string | null,

  social: SocialLinks,

): Omit<HoneypotCheck, "flags"> {

  const tokenAnalysis: AnalysisLayer = {

    score: 20,

    summary: "Token not found on alt.fun bonding",

    signals: [

      {

        id: "unknown",

        label: "Bonding status",

        status: "unknown",

        detail: "Unable to verify — not on bonding curve",

      },

    ],

  };

  const creatorAnalysis = buildCreatorAnalysis({

    creator,

    security: null,

    holders: [],

    onChain: { txCount: null, launchCount: creator ? countTokensByCreator(creator) : null },

  });

  const socialAnalysis = buildSocialAnalysis(social);

  const score = computeOverallScore({ token: tokenAnalysis, creator: creatorAnalysis, social: socialAnalysis });



  return {

    status: "unknown",

    score,

    isHoneypot: false,

    canSell: null,

    buyFeeBps: 0,

    sellFeeBps: 0,

    creatorHoldingPct: null,

    contractVerified: null,

    lpLocked: null,

    recentSellCount: 0,

    summary: "Unable to verify — not on bonding curve",

    checkedAt,

    creator,

    social,

    tokenAnalysis,

    creatorAnalysis,

    socialAnalysis,

  };

}



function applySecurityFlags(security: ApiSecurity | null, flags: string[]) {

  if (!security) {

    flags.push("alt.fun security data unavailable");

    return;

  }

  if (!security.contractVerified) flags.push("Contract not verified");

  if (security.creatorHoldingPct >= 50) {

    flags.push(`Creator holds ${security.creatorHoldingPct.toFixed(1)}%`);

  } else if (security.creatorHoldingPct >= 25) {

    flags.push(`Creator holds ${security.creatorHoldingPct.toFixed(1)}%`);

  }

  if (security.graduated && !security.lpLocked) {

    flags.push("LP not locked (graduated)");

  }

}



function hasCautionSignals(

  security: ApiSecurity | null,

  buyBps: number,

  sellBps: number,

): boolean {

  if (!security?.contractVerified) return true;

  if (security.creatorHoldingPct >= 50) return true;

  if (security.graduated && !security.lpLocked) return true;

  if (buyBps > 500 || sellBps > 500) return true;

  return false;

}



async function simulateSellFromHolder(

  token: Address,

  holders: { wallet: string; balance: string }[],

): Promise<boolean | null> {

  const client = getPublicClient();



  for (const h of holders) {

    const holder = h.wallet.toLowerCase() as Address;

    let balance: bigint;

    try {

      balance = await client.readContract({

        address: token,

        abi: erc20Abi,

        functionName: "balanceOf",

        args: [holder],

      });

    } catch {

      continue;

    }



    if (balance === 0n) continue;



    const allowance = await client.readContract({

      address: token,

      abi: erc20Abi,

      functionName: "allowance",

      args: [holder, ADDRESSES.zap],

    });



    const probe = balance / 200n || 1n;

    if (allowance < probe) continue;



    try {

      await client.simulateContract({

        address: ADDRESSES.zap,

        abi: zapAbi,

        functionName: "sell",

        args: [token, probe, 0n],

        account: holder,

      });

      return true;

    } catch {

      return false;

    }

  }



  return null;

}



function finish(

  check: Omit<HoneypotCheck, "flags"> & { flags?: string[] },

  extraFlags: string[],

): HoneypotCheck {

  const mergedFlags = [...new Set([...(check.flags ?? []), ...extraFlags])];

  for (const layer of [check.tokenAnalysis, check.creatorAnalysis, check.socialAnalysis]) {

    for (const sig of layer.signals) {

      if (sig.status === "fail" || sig.status === "warn") {

        const line = `${sig.label}: ${sig.detail}`;

        if (!mergedFlags.some((f) => f.startsWith(sig.label))) mergedFlags.push(line);

      }

    }

  }

  return { ...check, flags: mergedFlags.slice(0, 12) };

}


