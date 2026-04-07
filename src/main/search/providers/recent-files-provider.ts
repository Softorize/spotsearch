import { spawn } from 'child_process';
import { basename, extname } from 'path';
import { shell, clipboard } from 'electron';
import { exec } from 'child_process';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction } from '../../../shared/types';

const FILE_ICON_MAP: Record<string, string> = {
  pdf: '📕', doc: '📄', docx: '📄', txt: '📄', rtf: '📄', md: '📝',
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', heic: '🖼️',
  mp3: '🎵', wav: '🎵', m4a: '🎵', mp4: '🎬', mov: '🎬',
  zip: '📦', tar: '📦', js: '💻', ts: '💻', py: '💻', go: '💻',
  css: '🎨', html: '🌐', json: '📋',
};

export class RecentFilesProvider implements SearchProvider {
  id = 'recent-files';
  name = 'Recent Files';
  priority = 60; // lower priority, shown after other results

  canHandle(query: string): boolean {
    // Only activates when query is empty (show recent files as default view)
    return query.trim().length === 0;
  }

  search(_query: string): Promise<UnifiedResult[]> {
    return new Promise((resolve) => {
      // Get files modified in the last 7 days, sorted by most recent
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

      proc.on('close', () => {
        const paths = output.split('\n').filter((p) => p.trim()).slice(0, 30);
        const results: UnifiedResult[] = paths.map((filePath, i) => {
          const name = basename(filePath);
          const ext = extname(filePath).slice(1).toLowerCase();
          const parentPath = filePath.replace(`/${name}`, '');

          return {
            id: `recent-${i}`,
            name,
            subtitle: parentPath,
            icon: FILE_ICON_MAP[ext] || '📄',
            category: 'file' as const,
            score: 50 - i, // most recent first
            actions: [
              { id: 'open', name: 'Open', shortcut: 'Enter', isDefault: true },
              { id: 'reveal', name: 'Reveal in Finder', shortcut: 'Cmd+Enter' },
              { id: 'copy-path', name: 'Copy Path' },
            ],
            data: {
              _providerId: 'file',
              path: filePath,
              extension: ext,
              isDirectory: false,
            },
          };
        });

        resolve(results);
      });

      proc.on('error', () => resolve([]));

      // Timeout
      setTimeout(() => {
        proc.kill();
        resolve([]);
      }, 3000);
    });
  }

  getActions(result: UnifiedResult): ResultAction[] {
    return [
      { id: 'open', name: 'Open', shortcut: 'Enter', isDefault: true },
      { id: 'reveal', name: 'Reveal in Finder', shortcut: 'Cmd+Enter' },
      { id: 'copy-path', name: 'Copy Path' },
    ];
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    const filePath = result.data.path as string;
    if (!filePath) return;

    switch (actionId) {
      case 'open': {
        const errorMsg = await shell.openPath(filePath);
        if (errorMsg) throw new Error(errorMsg);
        break;
      }
      case 'reveal': {
        const script = `tell application "Finder" to reveal POSIX file "${filePath}"\ntell application "Finder" to activate`;
        exec(`osascript -e '${script.split('\n').join("' -e '")}'`);
        break;
      }
      case 'copy-path':
        clipboard.writeText(filePath);
        break;
    }
  }
}
