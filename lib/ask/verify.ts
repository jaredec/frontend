const NUMBER_RE = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
export const GAME_REF_RE = /\[(g\d+)\]/g;

function normalize(raw: string): string {
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? String(n) : raw;
}

export function numbersIn(text: string): string[] {
  return (text.match(NUMBER_RE) ?? []).map(normalize);
}

/** Every number that appears anywhere in the given values (tool outputs, the question). */
export function collectNumbers(values: unknown[]): Set<string> {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "number") found.add(String(v));
    else if (typeof v === "string") for (const n of numbersIn(v)) found.add(n);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  values.forEach(walk);
  return found;
}

/**
 * The hallucination guard: an answer may only state numbers that a tool returned
 * (or the user typed). Game refs like [g123] are citations, not claims, so they
 * are stripped before checking.
 */
export function unverifiedNumbers(answer: string, allowed: Set<string>): string[] {
  const claims = numbersIn(answer.replace(GAME_REF_RE, ""));
  return [...new Set(claims.filter((n) => !allowed.has(n)))];
}
