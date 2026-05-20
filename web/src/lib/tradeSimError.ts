const REVERT_PREFIX = 'reverted with the following reason:';

const FRIENDLY: Record<string, string> = {
  "ERC20: transfer amount exceeds balance":
    "Insufficient USDC balance for this buy amount.",
  "ERC20: transfer amount exceeds allowance":
    "Approve USDC before buying.",
};

export function formatTradeSimError(error: Error | null | undefined): string | null {
  if (!error?.message) return null;

  const lines = error.message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const reasonLine = lines.find(
    (line) => !line.includes("Contract Call:") && !line.startsWith("Docs:"),
  );

  let reason = reasonLine ?? error.message;

  const prefixIdx = reason.indexOf(REVERT_PREFIX);
  if (prefixIdx >= 0) {
    const afterPrefix = reason.slice(prefixIdx + REVERT_PREFIX.length).trim();
    if (afterPrefix) {
      reason = afterPrefix;
    } else {
      const lineAfterPrefix = lines[lines.indexOf(reasonLine ?? "") + 1];
      if (lineAfterPrefix) reason = lineAfterPrefix;
    }
  }

  return FRIENDLY[reason] ?? reason;
}
