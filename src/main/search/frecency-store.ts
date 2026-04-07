import Store from 'electron-store';

interface FrecencyEntry {
  count: number;
  timestamps: number[];
}

interface FrecencyData {
  items: Record<string, FrecencyEntry>;
  queryMap: Record<string, string>;
}

const MAX_TIMESTAMPS = 20;

const store = new Store<FrecencyData>({
  name: 'frecency-data',
  defaults: {
    items: {},
    queryMap: {},
  },
});

// In-memory cache - loaded once, flushed on writes
let itemsCache: Record<string, FrecencyEntry> = store.get('items', {});
let queryMapCache: Record<string, string> = store.get('queryMap', {});

function getRecencyWeight(timestamp: number): number {
  const now = Date.now();
  const hoursAgo = (now - timestamp) / (1000 * 60 * 60);

  if (hoursAgo < 4) return 100;
  if (hoursAgo < 24) return 80;
  if (hoursAgo < 72) return 60;
  if (hoursAgo < 168) return 40;
  if (hoursAgo < 720) return 20;
  return 10;
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    store.set('items', itemsCache);
    store.set('queryMap', queryMapCache);
    flushTimer = null;
  }, 2000);
}

export function recordInteraction(itemId: string, query?: string): void {
  const existing = itemsCache[itemId] || { count: 0, timestamps: [] };

  existing.count++;
  existing.timestamps.push(Date.now());

  if (existing.timestamps.length > MAX_TIMESTAMPS) {
    existing.timestamps = existing.timestamps.slice(-MAX_TIMESTAMPS);
  }

  itemsCache[itemId] = existing;

  if (query) {
    queryMapCache[query.toLowerCase().trim()] = itemId;
  }

  scheduleFlush();
}

export function getFrecencyScore(itemId: string): number {
  const entry = itemsCache[itemId];
  if (!entry) return 0;

  let score = 0;
  for (const ts of entry.timestamps) {
    score += getRecencyWeight(ts);
  }

  return score * Math.log2(entry.count + 1);
}

export function getPreferredItemForQuery(query: string): string | null {
  return queryMapCache[query.toLowerCase().trim()] || null;
}

export function applyFrecencyBoost(
  results: Array<{ id: string; score: number }>,
  query?: string
): void {
  const preferredId = query ? getPreferredItemForQuery(query) : null;

  for (const result of results) {
    const frecencyScore = getFrecencyScore(result.id);
    if (frecencyScore > 0) {
      result.score += Math.min(frecencyScore * 0.5, 200);
    }

    if (preferredId && result.id === preferredId) {
      result.score += 300;
    }
  }
}
