import { spawn } from 'child_process';
import { basename, extname } from 'path';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction } from '../../../shared/types';
import { getFileEmoji } from '../../../shared/file-icons';
import { openFile, revealInFinder, copyPath } from '../../file-actions';

const DEFAULT_RECENT_ACTIONS: ResultAction[] = [
  { id: 'open', name: 'Open', shortcut: 'Enter', isDefault: true },
  { id: 'reveal', name: 'Reveal in Finder', shortcut: 'Cmd+Enter' },
  { id: 'copy-path', name: 'Copy Path' },
];

// Cache recent files for 60 seconds
let recentCache: UnifiedResult[] = [];
let lastCacheTime = 0;
const CACHE_TTL = 60 * 1000;

export class RecentFilesProvider implements SearchProvider {
  id = 'recent-files';
  name = 'Recent Files';
  priority = 60;

  canHandle(query: string): boolean {
    return query.trim().length === 0;
  }

  search(_query: string): Promise<UnifiedResult[]> {
    const now = Date.now();
    if (recentCache.length > 0 && now - lastCacheTime < CACHE_TTL) {
      return Promise.resolve(recentCache);
    }

    return new Promise((resolve) => {
      const proc = spawn('mdfind', [
        '-onlyin', process.env.HOME || '/Users',
        'kMDItemFSContentChangeDate >= $time.today(-7)',
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      proc.stdout?.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });

      let resolved = false;

      proc.on('close', () => {
        if (resolved) return;
        resolved = true;

        const paths = output.split('\n').filter((p) => p.trim()).slice(0, 30);
        const results: UnifiedResult[] = paths.map((filePath, i) => {
          const name = basename(filePath);
          const ext = extname(filePath).slice(1).toLowerCase();
          const parentPath = filePath.replace(`/${name}`, '');

          return {
            id: `recent-${i}`,
            name,
            subtitle: parentPath,
            icon: getFileEmoji(ext, false),
            category: 'file' as const,
            score: 50 - i,
            actions: DEFAULT_RECENT_ACTIONS,
            data: {
              _providerId: 'file',
              path: filePath,
              extension: ext,
              isDirectory: false,
            },
          };
        });

        recentCache = results;
        lastCacheTime = Date.now();
        resolve(results);
      });

      proc.on('error', () => {
        if (!resolved) { resolved = true; resolve(recentCache); }
      });

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proc.kill();
          resolve(recentCache);
        }
      }, 3000);
    });
  }

  getActions(result: UnifiedResult): ResultAction[] {
    return DEFAULT_RECENT_ACTIONS;
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    const filePath = result.data.path as string;
    if (!filePath) return;

    switch (actionId) {
      case 'open':
        await openFile(filePath);
        break;
      case 'reveal':
        revealInFinder(filePath);
        break;
      case 'copy-path':
        copyPath(filePath);
        break;
    }
  }
}
