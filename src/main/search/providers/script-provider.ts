import { clipboard } from 'electron';
import { Notification } from 'electron';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction } from '../../../shared/types';
import { loadScripts, executeScript, ScriptCommand } from '../../scripts/script-manager';

let scriptsCache: ScriptCommand[] = [];
let lastLoadTime = 0;
const CACHE_TTL = 30 * 1000; // 30 seconds

async function getScripts(): Promise<ScriptCommand[]> {
  const now = Date.now();
  if (scriptsCache.length > 0 && now - lastLoadTime < CACHE_TTL) {
    return scriptsCache;
  }
  scriptsCache = await loadScripts();
  lastLoadTime = Date.now();
  return scriptsCache;
}

export class ScriptProvider implements SearchProvider {
  id = 'script';
  name = 'Script Commands';
  priority = 35;

  async initialize(): Promise<void> {
    getScripts().catch(() => {});
  }

  canHandle(query: string): boolean {
    const q = query.trim().toLowerCase();
    return q.startsWith('run ') || q.startsWith('script ') || q.startsWith('>');
  }

  async search(query: string): Promise<UnifiedResult[]> {
    let q = query.trim();
    if (q.toLowerCase().startsWith('run ')) q = q.slice(4);
    else if (q.toLowerCase().startsWith('script ')) q = q.slice(7);
    else if (q.startsWith('>')) q = q.slice(1);
    q = q.trim();

    const scripts = await getScripts();
    const qLower = q.toLowerCase();
    const parts = q.split(' ');
    const keyword = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    const results: UnifiedResult[] = [];

    for (const script of scripts) {
      let score = 0;
      const titleLower = script.title.toLowerCase();
      const kwLower = script.keyword.toLowerCase();

      if (kwLower === keyword) score = 1000;
      else if (kwLower.startsWith(qLower)) score = 800;
      else if (titleLower.includes(qLower)) score = 600;
      else if (kwLower.includes(qLower)) score = 400;

      if (score > 0) {
        const subtitle = args
          ? `${script.keyword} ${args}`
          : `Keyword: ${script.keyword} - Output: ${script.output}`;

        results.push({
          id: `script-${script.keyword}`,
          name: script.title,
          subtitle,
          icon: script.icon,
          category: 'script',
          score,
          actions: [
            { id: 'execute', name: 'Run', shortcut: 'Enter', isDefault: true },
          ],
          data: {
            _providerId: this.id,
            keyword: script.keyword,
            args,
            filePath: script.filePath,
            output: script.output,
          },
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 10);
  }

  getActions(result: UnifiedResult): ResultAction[] {
    if (result.category !== 'script') return [];
    return [{ id: 'execute', name: 'Run', shortcut: 'Enter', isDefault: true }];
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    if (actionId !== 'execute') return;

    const scripts = await getScripts();
    const keyword = result.data.keyword as string;
    const args = result.data.args as string;
    const script = scripts.find((s) => s.keyword === keyword);

    if (!script) return;

    const scriptArgs = args ? args.split(' ') : [];
    const { stdout } = await executeScript(script, scriptArgs);

    switch (result.data.output) {
      case 'clipboard':
        clipboard.writeText(stdout);
        break;
      case 'notification':
        new Notification({ title: script.title, body: stdout }).show();
        break;
      case 'inline':
      case 'list':
      default:
        // Copy output to clipboard as default
        if (stdout) clipboard.writeText(stdout);
        break;
    }
  }
}
