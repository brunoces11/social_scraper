// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeString(value: any): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeNumber(value: any): number {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

export function extractNamedHashtags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((h: { name?: string } | string) => (typeof h === "string" ? h : h.name || ""))
    .filter(Boolean);
}
