import { clipboard } from 'electron';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction } from '../../../shared/types';
import { getSnippets, expandSnippet, pasteSnippet } from '../../snippets/snippet-manager';

export class SnippetProvider implements SearchProvider {
  id = 'snippet';
  name = 'Snippets';
  priority = 18;

  canHandle(query: string): boolean {
    const q = query.trim();
    // Trigger on ! prefix (snippet keywords start with !) or "snippet " prefix
    return q.startsWith('!') || q.toLowerCase().startsWith('snippet ') || q.toLowerCase().startsWith('snip ');
  }

  async search(query: string): Promise<UnifiedResult[]> {
    let q = query.trim();
    if (q.toLowerCase().startsWith('snippet ')) {
      q = q.slice(8).trim();
    } else if (q.toLowerCase().startsWith('snip ')) {
      q = q.slice(5).trim();
    }

    const qLower = q.toLowerCase();
    const snippets = getSnippets();
    const results: UnifiedResult[] = [];

    for (const snippet of snippets) {
      let score = 0;

      // Check keyword match
      if (snippet.keyword.toLowerCase() === qLower) score = 1000;
      else if (snippet.keyword.toLowerCase().startsWith(qLower)) score = 800;
      // Check name match
      else if (snippet.name.toLowerCase().includes(qLower)) score = 600;
      // Check content match
      else if (snippet.content.toLowerCase().includes(qLower)) score = 300;

      if (score > 0) {
        const preview = snippet.content.length > 80
          ? snippet.content.slice(0, 80) + '...'
          : snippet.content;

        results.push({
          id: snippet.id,
          name: snippet.name,
          subtitle: `${snippet.keyword} - ${preview}`,
          icon: '📋',
          category: 'snippet',
          score,
          actions: [
            { id: 'paste', name: 'Paste', shortcut: 'Enter', isDefault: true },
            { id: 'copy', name: 'Copy' },
          ],
          data: {
            _providerId: this.id,
            snippetId: snippet.id,
            keyword: snippet.keyword,
            content: snippet.content,
          },
        });
      }
    }

    // If no query, show all snippets
    if (qLower.length === 0 || qLower === '!') {
      for (const snippet of snippets) {
        if (!results.some((r) => r.id === snippet.id)) {
          const preview = snippet.content.length > 80
            ? snippet.content.slice(0, 80) + '...'
            : snippet.content;

          results.push({
            id: snippet.id,
            name: snippet.name,
            subtitle: `${snippet.keyword} - ${preview}`,
            icon: '📋',
            category: 'snippet',
            score: 100 + snippet.usageCount,
            actions: [
              { id: 'paste', name: 'Paste', shortcut: 'Enter', isDefault: true },
              { id: 'copy', name: 'Copy' },
            ],
            data: {
              _providerId: this.id,
              snippetId: snippet.id,
              keyword: snippet.keyword,
              content: snippet.content,
            },
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 20);
  }

  getActions(result: UnifiedResult): ResultAction[] {
    if (result.category !== 'snippet') return [];
    return [
      { id: 'paste', name: 'Paste', shortcut: 'Enter', isDefault: true },
      { id: 'copy', name: 'Copy' },
    ];
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    const snippetId = result.data.snippetId as string;
    const content = result.data.content as string;

    switch (actionId) {
      case 'paste':
        if (snippetId) pasteSnippet(snippetId);
        break;
      case 'copy':
        if (content) {
          const expanded = expandSnippet(content);
          clipboard.writeText(expanded);
        }
        break;
    }
  }
}
