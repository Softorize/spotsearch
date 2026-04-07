// Shared fuzzy scoring utility for all search providers

export function scoreFuzzyMatch(
  query: string,
  name: string,
  keywords?: string[],
): number {
  const q = query.toLowerCase();
  const nameLower = name.toLowerCase();
  let score = 0;

  // Name matching
  if (nameLower === q) score = 1000;
  else if (nameLower.startsWith(q)) score = 800;
  else if (nameLower.includes(q)) score = 600;

  // Keyword matching (if name didn't match)
  if (score === 0 && keywords) {
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      if (kwLower === q) { score = 900; break; }
      if (kwLower.startsWith(q)) { score = Math.max(score, 700); }
      if (kwLower.includes(q)) { score = Math.max(score, 400); }
    }
  }

  return score;
}
