import Store from 'electron-store';

interface FrecencyEntry {
  count: number;
  timestamps: number[]; // last N timestamps of use
}

interface FrecencyData {
  items: Record<string, FrecencyEntry>;
  queryMap: Record<string, string>; // query -> most-selected item ID
}

const MAX_TIMESTAMPS = 20;

const store = new Store<FrecencyData>({
  name: 'frecency-data',
  defaults: {
    items: {},
    queryMap: {},
  },
});

function getRecencyWeight(timestamp: number): number {
  const now = Date.now();
  const hoursAgo = (now - timestamp) / (1000 * 60 * 60);

  if (hoursAgo < 4) return 100;
  if (hoursAgo < 24) return 80;
  if (hoursAgo < 72) return 60;
  if (hoursAgo < 168) return 40; // 1 week
  if (hoursAgo < 720) return 20; // 30 days
  return 10;
}

export function recordInteraction(itemId: string, query?: string): void {
  const items = store.get('items', {});
  const existing = items[itemId] || { count: 0, timestamps: [] };

  existing.count++;
  existing.timestamps.push(Date.now());

  // Keep only the last N timestamps
  if (existing.timestamps.length > MAX_TIMESTAMPS) {
    existing.timestamps = existing.timestamps.slice(-MAX_TIMESTAMPS);
  }

  items[itemId] = existing;
  store.set('items', items);

  // Record query -> item mapping
  if (query) {
    const queryMap = store.get('queryMap', {});
    queryMap[query.toLowerCase().trim()] = itemId;
    store.set('queryMap', queryMap);
  }
}

export function getFrecencyScore(itemId: string): number {
  const items = store.get('items', {});
  const entry = items[itemId];
  if (!entry) return 0;

  // Score = sum of recency weights
  let score = 0;
  for (const ts of entry.timestamps) {
    score += getRecencyWeight(ts);
  }

  // Multiply by log of count for frequency boost
  return score * Math.log2(entry.count + 1);
}

export function getPreferredItemForQuery(query: string): string | null {
  const queryMap = store.get('queryMap', {});
  return queryMap[query.toLowerCase().trim()] || null;
}

export function applyFrecencyBoost(
  results: Array<{ id: string; score: number }>,
  query?: string
): void {
  const preferredId = query ? getPreferredItemForQuery(query) : null;

  for (const result of results) {
    const frecencyScore = getFrecencyScore(result.id);
    if (frecencyScore > 0) {
      // Add frecency as a bonus (max ~200 points)
      result.score += Math.min(frecencyScore * 0.5, 200);
    }

    // Extra boost if this is the user's preferred result for this query
    if (preferredId && result.id === preferredId) {
      result.score += 300;
    }
  }
}
