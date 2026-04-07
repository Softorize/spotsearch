import { spawn, ChildProcess } from 'child_process';
import { stat } from 'fs/promises';
import { basename, extname } from 'path';
import { shell, clipboard, app } from 'electron';
import { exec } from 'child_process';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction, SearchOptions, FileTypeFilter } from '../../../shared/types';
import { buildMdfindArgs } from '../query-builder';

const FILE_ICON_MAP: Record<string, string> = {
  pdf: '📕', doc: '📄', docx: '📄', txt: '📄', rtf: '📄', md: '📝',
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', heic: '🖼️', svg: '🖼️',
  mp3: '🎵', wav: '🎵', m4a: '🎵', flac: '🎵',
  mp4: '🎬', mov: '🎬', mkv: '🎬', avi: '🎬',
  zip: '📦', tar: '📦', gz: '📦', rar: '📦', '7z': '📦',
  js: '💻', ts: '💻', jsx: '💻', tsx: '💻', py: '💻', go: '💻',
  rs: '💻', swift: '💻', java: '💻', c: '💻', cpp: '💻', h: '💻',
  css: '🎨', scss: '🎨', html: '🌐',
  json: '📋', xml: '📋', yaml: '📋', yml: '📋',
};

function getFileEmoji(ext: string, isDirectory: boolean): string {
  if (isDirectory) return '📁';
  return FILE_ICON_MAP[ext.toLowerCase()] || '📄';
}

export class FileProvider implements SearchProvider {
  id = 'file';
  name = 'Files';
  priority = 50; // medium priority - apps and instant answers come first
  private currentProcess: ChildProcess | null = null;
  private maxResults = 100;

  // Store current search options for file type filtering
  private searchOptions: Partial<SearchOptions> = {};

  setSearchOptions(options: Partial<SearchOptions>): void {
    this.searchOptions = options;
  }

  canHandle(query: string): boolean {
    // File search handles everything that isn't a special prefix
    return query.trim().length > 0;
  }

  search(query: string): Promise<UnifiedResult[]> {
    return new Promise((resolve) => {
      // Cancel any existing search
      this.cancelCurrentProcess();

      const options: SearchOptions = {
        query: query.trim(),
        exactMatch: this.searchOptions.exactMatch || false,
        fileTypes: this.searchOptions.fileTypes || ['all'],
        extension: this.searchOptions.extension,
        contentSearch: this.searchOptions.contentSearch,
        scope: this.searchOptions.scope,
      };

      const args = buildMdfindArgs(options);

      if (args.length === 0) {
        resolve([]);
        return;
      }

      const results: UnifiedResult[] = [];
      let resultCount = 0;

      this.currentProcess = spawn('mdfind', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let buffer = '';

      this.currentProcess.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() && resultCount < this.maxResults) {
            resultCount++;
            const filePath = line.trim();
            const name = basename(filePath);
            const extension = extname(filePath).slice(1).toLowerCase();
            const parentPath = filePath.replace(`/${name}`, '');

            results.push({
              id: `file-${resultCount}`,
              name,
              subtitle: parentPath,
              icon: getFileEmoji(extension, false), // will be replaced with native icon in renderer
              category: 'file',
              score: 100 - resultCount, // earlier results scored higher
              actions: this.getDefaultFileActions(),
              data: {
                _providerId: this.id,
                path: filePath,
                extension,
                isDirectory: false,
              },
            });
          }
        }

        if (resultCount >= this.maxResults) {
          this.cancelCurrentProcess();
        }
      });

      this.currentProcess.on('close', () => {
        // Process remaining buffer
        if (buffer.trim() && resultCount < this.maxResults) {
          resultCount++;
          const filePath = buffer.trim();
          const name = basename(filePath);
          const extension = extname(filePath).slice(1).toLowerCase();
          const parentPath = filePath.replace(`/${name}`, '');

          results.push({
            id: `file-${resultCount}`,
            name,
            subtitle: parentPath,
            icon: getFileEmoji(extension, false),
            category: 'file',
            score: 100 - resultCount,
            actions: this.getDefaultFileActions(),
            data: {
              _providerId: this.id,
              path: filePath,
              extension,
              isDirectory: false,
            },
          });
        }

        this.currentProcess = null;

        // Enrich results with stat info asynchronously, but resolve immediately
        this.enrichResults(results);
        resolve(results);
      });

      this.currentProcess.on('error', () => {
        this.currentProcess = null;
        resolve(results);
      });
    });
  }

  private async enrichResults(results: UnifiedResult[]): Promise<void> {
    // Enrich with file stats in background (won't block search)
    for (const result of results) {
      try {
        const filePath = result.data.path as string;
        const stats = await stat(filePath);
        result.data.size = stats.size;
        result.data.modifiedDate = stats.mtime.toISOString();
        result.data.isDirectory = stats.isDirectory();
        if (stats.isDirectory()) {
          result.icon = '📁';
        }
      } catch {
        // File might be inaccessible
      }
    }
  }

  private getDefaultFileActions(): ResultAction[] {
    return [
      { id: 'open', name: 'Open', shortcut: 'Enter', isDefault: true },
      { id: 'reveal', name: 'Reveal in Finder', shortcut: 'Cmd+Enter' },
      { id: 'copy-path', name: 'Copy Path', shortcut: 'Cmd+C' },
      { id: 'preview', name: 'Quick Look', shortcut: 'Space' },
    ];
  }

  getActions(result: UnifiedResult): ResultAction[] {
    if (result.category !== 'file') return [];
    return this.getDefaultFileActions();
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
      case 'preview': {
        const proc = spawn('qlmanage', ['-p', filePath], {
          detached: true,
          stdio: 'ignore',
        });
        proc.unref();
        break;
      }
    }
  }

  private cancelCurrentProcess(): void {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
  }

  destroy(): void {
    this.cancelCurrentProcess();
  }
}
