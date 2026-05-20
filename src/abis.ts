export const zapAbi = [
  {
    type: "function",
    name: "buy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenAddress", type: "address" },
      { name: "usdcAmount", type: "uint256" },
      { name: "minTokensOut", type: "uint256" },
      { name: "referrer", type: "address" },
    ],
    outputs: [{ name: "tokensOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "sell",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenAddress", type: "address" },
      { name: "tokenAmount", type: "uint256" },
      { name: "minUsdcOut", type: "uint256" },
    ],
    outputs: [{ name: "usdcOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "buyFeeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "sellFeeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "MIN_USDC_AMOUNT",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "bonding",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "usdc",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

export const bondingEventsAbi = [
  {
    type: "event",
    name: "TokenLaunched",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "ltAddress", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "ticker", type: "string", indexed: false },
      { name: "k", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Trade",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "isBuy", type: "bool", indexed: true },
      { name: "ltAmount", type: "uint256", indexed: false },
      { name: "tokenAmount", type: "uint256", indexed: false },
      { name: "newCurveSupply", type: "uint256", indexed: false },
      { name: "newLtReserve", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TokenGraduating",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "tokensForLP", type: "uint256", indexed: false },
      { name: "ltFromPair", type: "uint256", indexed: false },
      { name: "lpBurned", type: "uint256", indexed: false },
      { name: "unsoldBurned", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TokenGraduated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "pairAddress", type: "address", indexed: true },
      { name: "liquidity", type: "uint256", indexed: false },
      { name: "tokensInLP", type: "uint256", indexed: false },
      { name: "lpBurned", type: "uint256", indexed: false },
      { name: "unsoldBurned", type: "uint256", indexed: false },
    ],
  },
] as const;

export const bondingAbi = [
  ...bondingEventsAbi,
  {
    type: "function",
    name: "getTokenInfo",
    stateMutability: "view",
    inputs: [{ name: "token_", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "pair", type: "address" },
          { name: "ltAddress", type: "address" },
          { name: "name", type: "string" },
          { name: "ticker", type: "string" },
          { name: "description", type: "string" },
          { name: "image", type: "string" },
          { name: "urls", type: "string[3]" },
          { name: "lifecycle", type: "uint8" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "canGraduate",
    stateMutability: "view",
    inputs: [{ name: "token_", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "isTrading",
    stateMutability: "view",
    inputs: [{ name: "token_", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "isGraduating",
    stateMutability: "view",
    inputs: [{ name: "token_", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "isGraduated",
    stateMutability: "view",
    inputs: [{ name: "token_", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "ltOf",
    stateMutability: "view",
    inputs: [{ name: "token_", type: "address" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "previewLtUntilGraduation",
    stateMutability: "view",
    inputs: [{ name: "token_", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "creatorOf",
    stateMutability: "view",
    inputs: [{ name: "token_", type: "address" }],
    outputs: [{ type: "address" }],
  },
] as const;

export const pairAbi = [
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "reserveToken", type: "uint256" },
      { name: "reserveAsset", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "tokenBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

export const bounceLtAbi = [
  {
    type: "function",
    name: "baseAssetBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "exchangeRate",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;
