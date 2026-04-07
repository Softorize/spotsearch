import { shell, clipboard } from 'electron';
import Store from 'electron-store';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction } from '../../../shared/types';

interface QuickLink {
  id: string;
  keyword: string;
  name: string;
  url: string; // supports {query} placeholder
  icon: string;
}

const DEFAULT_QUICKLINKS: QuickLink[] = [
  { id: 'ql-google', keyword: 'g', name: 'Google Search', url: 'https://www.google.com/search?q={query}', icon: '🔍' },
  { id: 'ql-github', keyword: 'gh', name: 'GitHub', url: 'https://github.com/search?q={query}', icon: '🐙' },
  { id: 'ql-stackoverflow', keyword: 'so', name: 'Stack Overflow', url: 'https://stackoverflow.com/search?q={query}', icon: '📚' },
  { id: 'ql-youtube', keyword: 'yt', name: 'YouTube', url: 'https://www.youtube.com/results?search_query={query}', icon: '▶️' },
  { id: 'ql-wikipedia', keyword: 'wiki', name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Special:Search/{query}', icon: '📖' },
  { id: 'ql-npm', keyword: 'npm', name: 'npm', url: 'https://www.npmjs.com/search?q={query}', icon: '📦' },
  { id: 'ql-mdn', keyword: 'mdn', name: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/search?q={query}', icon: '🌐' },
  { id: 'ql-maps', keyword: 'maps', name: 'Google Maps', url: 'https://www.google.com/maps/search/{query}', icon: '🗺️' },
  { id: 'ql-translate', keyword: 'tr', name: 'Google Translate', url: 'https://translate.google.com/?sl=auto&tl=en&text={query}', icon: '🌍' },
  { id: 'ql-amazon', keyword: 'az', name: 'Amazon', url: 'https://www.amazon.com/s?k={query}', icon: '🛒' },
];

interface QuickLinkStoreData {
  quicklinks: QuickLink[];
}

const store = new Store<QuickLinkStoreData>({
  name: 'quicklinks',
  defaults: {
    quicklinks: DEFAULT_QUICKLINKS,
  },
});

export class QuickLinkProvider implements SearchProvider {
  id = 'quicklink';
  name = 'Quick Links';
  priority = 15;

  private getQuickLinks(): QuickLink[] {
    return store.get('quicklinks', DEFAULT_QUICKLINKS);
  }

  canHandle(query: string): boolean {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return false;

    const links = this.getQuickLinks();
    // Match if query starts with a keyword followed by space
    const firstWord = q.split(' ')[0];
    return links.some((link) => link.keyword === firstWord || link.name.toLowerCase().includes(q));
  }

  async search(query: string): Promise<UnifiedResult[]> {
    const q = query.trim();
    const qLower = q.toLowerCase();
    const parts = q.split(' ');
    const keyword = parts[0].toLowerCase();
    const rest = parts.slice(1).join(' ');
    const links = this.getQuickLinks();
    const results: UnifiedResult[] = [];

    for (const link of links) {
      // Exact keyword match with query argument
      if (link.keyword === keyword && rest.length > 0) {
        const url = link.url.replace('{query}', encodeURIComponent(rest));
        results.push({
          id: `ql-${link.id}-${rest}`,
          name: `${link.name}: ${rest}`,
          subtitle: url,
          icon: link.icon,
          category: 'quicklink',
          score: 1800, // high priority for exact keyword match with query
          actions: this.getDefaultActions(),
          data: { _providerId: this.id, url, linkId: link.id },
        });
      }
      // Show quicklink suggestion when keyword matches but no query yet
      else if (link.keyword === keyword && rest.length === 0) {
        results.push({
          id: `ql-${link.id}`,
          name: `${link.name}`,
          subtitle: `Type "${link.keyword} <query>" to search`,
          icon: link.icon,
          category: 'quicklink',
          score: 1200,
          actions: [],
          data: { _providerId: this.id, linkId: link.id },
        });
      }
      // Fuzzy name match
      else if (link.name.toLowerCase().includes(qLower) || link.keyword.includes(qLower)) {
        results.push({
          id: `ql-${link.id}`,
          name: link.name,
          subtitle: `Keyword: ${link.keyword} - ${link.url.replace('{query}', '...')}`,
          icon: link.icon,
          category: 'quicklink',
          score: 500,
          actions: [{ id: 'copy-keyword', name: 'Copy Keyword', isDefault: true }],
          data: { _providerId: this.id, linkId: link.id, keyword: link.keyword },
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 5);
  }

  private getDefaultActions(): ResultAction[] {
    return [
      { id: 'open', name: 'Open', shortcut: 'Enter', isDefault: true },
      { id: 'copy-url', name: 'Copy URL' },
    ];
  }

  getActions(result: UnifiedResult): ResultAction[] {
    if (result.category !== 'quicklink') return [];
    return this.getDefaultActions();
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    switch (actionId) {
      case 'open': {
        const url = result.data.url as string;
        if (url) shell.openExternal(url);
        break;
      }
      case 'copy-url': {
        const url = result.data.url as string;
        if (url) clipboard.writeText(url);
        break;
      }
      case 'copy-keyword': {
        const kw = result.data.keyword as string;
        if (kw) clipboard.writeText(kw);
        break;
      }
    }
  }
}
