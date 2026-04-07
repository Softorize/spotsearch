import { shell, clipboard } from 'electron';
import { readFile } from 'fs/promises';
import { exec } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction } from '../../../shared/types';

interface Bookmark {
  title: string;
  url: string;
  source: string; // browser name
}

let bookmarkCache: Bookmark[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function readChromeBookmarks(profilePath: string, browserName: string): Promise<Bookmark[]> {
  try {
    const bookmarksPath = join(profilePath, 'Bookmarks');
    const data = JSON.parse(await readFile(bookmarksPath, 'utf-8'));
    const bookmarks: Bookmark[] = [];

    function extractBookmarks(node: any): void {
      if (!node) return;
      if (node.type === 'url' && node.url) {
        bookmarks.push({
          title: node.name || node.url,
          url: node.url,
          source: browserName,
        });
      }
      if (node.children) {
        for (const child of node.children) {
          extractBookmarks(child);
        }
      }
    }

    if (data.roots) {
      for (const root of Object.values(data.roots)) {
        extractBookmarks(root);
      }
    }

    return bookmarks;
  } catch {
    return [];
  }
}

async function readSafariBookmarks(): Promise<Bookmark[]> {
  return new Promise((resolve) => {
    const plistPath = join(homedir(), 'Library/Safari/Bookmarks.plist');

    exec(`plutil -convert json -o - "${plistPath}"`, { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout) {
        resolve([]);
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const bookmarks: Bookmark[] = [];

        function extract(node: any): void {
          if (!node) return;
          if (node.URIDictionary && node.URLString) {
            bookmarks.push({
              title: node.URIDictionary.title || node.URLString,
              url: node.URLString,
              source: 'Safari',
            });
          }
          if (node.Children) {
            for (const child of node.Children) {
              extract(child);
            }
          }
        }

        extract(data);
        resolve(bookmarks);
      } catch {
        resolve([]);
      }
    });
  });
}

async function fetchAllBookmarks(): Promise<Bookmark[]> {
  const now = Date.now();
  if (bookmarkCache.length > 0 && now - lastFetchTime < CACHE_TTL) {
    return bookmarkCache;
  }

  const home = homedir();

  // Fetch all browsers in parallel
  const results = await Promise.all([
    readChromeBookmarks(join(home, 'Library/Application Support/Google/Chrome/Default'), 'Chrome'),
    readChromeBookmarks(join(home, 'Library/Application Support/Google/Chrome/Profile 1'), 'Chrome'),
    readChromeBookmarks(join(home, 'Library/Application Support/Arc/User Data/Default'), 'Arc'),
    readChromeBookmarks(join(home, 'Library/Application Support/BraveSoftware/Brave-Browser/Default'), 'Brave'),
    readChromeBookmarks(join(home, 'Library/Application Support/Microsoft Edge/Default'), 'Edge'),
    readSafariBookmarks(),
  ]);

  const allBookmarks = results.flat();

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped: Bookmark[] = [];
  for (const bm of allBookmarks) {
    if (!seen.has(bm.url)) {
      seen.add(bm.url);
      deduped.push(bm);
    }
  }

  bookmarkCache = deduped;
  lastFetchTime = Date.now();
  return deduped;
}

export class BookmarkProvider implements SearchProvider {
  id = 'bookmark';
  name = 'Bookmarks';
  priority = 45;

  async initialize(): Promise<void> {
    // Pre-fetch bookmarks
    fetchAllBookmarks().catch(() => {});
  }

  canHandle(query: string): boolean {
    return query.trim().length >= 2;
  }

  async search(query: string): Promise<UnifiedResult[]> {
    const q = query.trim().toLowerCase();
    const bookmarks = await fetchAllBookmarks();
    const results: UnifiedResult[] = [];

    for (const bm of bookmarks) {
      const titleLower = bm.title.toLowerCase();
      const urlLower = bm.url.toLowerCase();
      let score = 0;

      if (titleLower === q) score = 800;
      else if (titleLower.startsWith(q)) score = 600;
      else if (titleLower.includes(q)) score = 400;
      else if (urlLower.includes(q)) score = 300;

      if (score > 0) {
        results.push({
          id: `bm-${bm.url}`,
          name: bm.title,
          subtitle: `${bm.source} - ${bm.url}`,
          icon: '🔖',
          category: 'bookmark',
          score,
          actions: this.getDefaultActions(),
          data: {
            _providerId: this.id,
            url: bm.url,
            source: bm.source,
          },
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 10);
  }

  private getDefaultActions(): ResultAction[] {
    return [
      { id: 'open', name: 'Open', shortcut: 'Enter', isDefault: true },
      { id: 'copy-url', name: 'Copy URL' },
    ];
  }

  getActions(result: UnifiedResult): ResultAction[] {
    if (result.category !== 'bookmark') return [];
    return this.getDefaultActions();
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    const url = result.data.url as string;
    if (!url) return;

    switch (actionId) {
      case 'open':
        shell.openExternal(url);
        break;
      case 'copy-url':
        clipboard.writeText(url);
        break;
    }
  }
}
