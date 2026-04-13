/**
 * Parse env flags from OpenClaw / shell (strings only). Case-insensitive.
 */
export function envBool(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
}
