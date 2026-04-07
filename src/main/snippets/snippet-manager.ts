import Store from 'electron-store';
import { clipboard } from 'electron';
import { exec } from 'child_process';

export interface Snippet {
  id: string;
  keyword: string;
  name: string;
  content: string;
  category?: string;
  createdAt: number;
  usageCount: number;
}

interface SnippetStoreData {
  snippets: Snippet[];
}

const store = new Store<SnippetStoreData>({
  name: 'snippets',
  defaults: {
    snippets: [
      {
        id: 'snip-email',
        keyword: '!email',
        name: 'Email Signature',
        content: 'Best regards,\n{clipboard}',
        category: 'email',
        createdAt: Date.now(),
        usageCount: 0,
      },
      {
        id: 'snip-date',
        keyword: '!date',
        name: 'Today\'s Date',
        content: '{date}',
        category: 'general',
        createdAt: Date.now(),
        usageCount: 0,
      },
      {
        id: 'snip-datetime',
        keyword: '!now',
        name: 'Current Date & Time',
        content: '{datetime}',
        category: 'general',
        createdAt: Date.now(),
        usageCount: 0,
      },
    ],
  },
});

export function getSnippets(): Snippet[] {
  return store.get('snippets', []);
}

export function addSnippet(snippet: Omit<Snippet, 'id' | 'createdAt' | 'usageCount'>): Snippet {
  const snippets = getSnippets();
  const newSnippet: Snippet = {
    ...snippet,
    id: `snip-${Date.now()}`,
    createdAt: Date.now(),
    usageCount: 0,
  };
  snippets.push(newSnippet);
  store.set('snippets', snippets);
  return newSnippet;
}

export function updateSnippet(id: string, updates: Partial<Snippet>): void {
  const snippets = getSnippets();
  const idx = snippets.findIndex((s) => s.id === id);
  if (idx !== -1) {
    snippets[idx] = { ...snippets[idx], ...updates };
    store.set('snippets', snippets);
  }
}

export function deleteSnippet(id: string): void {
  const snippets = getSnippets().filter((s) => s.id !== id);
  store.set('snippets', snippets);
}

export function expandSnippet(content: string): string {
  const now = new Date();
  let expanded = content;

  // Replace dynamic placeholders
  expanded = expanded.replace(/\{date\}/g, now.toLocaleDateString());
  expanded = expanded.replace(/\{time\}/g, now.toLocaleTimeString());
  expanded = expanded.replace(/\{datetime\}/g, now.toLocaleString());
  expanded = expanded.replace(/\{clipboard\}/g, clipboard.readText());
  expanded = expanded.replace(/\{year\}/g, String(now.getFullYear()));
  expanded = expanded.replace(/\{month\}/g, String(now.getMonth() + 1).padStart(2, '0'));
  expanded = expanded.replace(/\{day\}/g, String(now.getDate()).padStart(2, '0'));

  // Remove cursor placeholder (just for future use in a text editor context)
  expanded = expanded.replace(/\{cursor\}/g, '');

  return expanded;
}

export function pasteSnippet(snippetId: string): void {
  const snippets = getSnippets();
  const snippet = snippets.find((s) => s.id === snippetId);
  if (!snippet) return;

  // Expand and paste
  const expanded = expandSnippet(snippet.content);
  clipboard.writeText(expanded);

  // Simulate Cmd+V to paste
  exec('osascript -e \'tell application "System Events" to keystroke "v" using command down\'');

  // Record usage
  const idx = snippets.findIndex((s) => s.id === snippetId);
  if (idx !== -1) {
    snippets[idx].usageCount++;
    store.set('snippets', snippets);
  }
}
