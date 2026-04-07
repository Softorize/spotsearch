import { spawn, ChildProcess } from 'child_process';
import { stat } from 'fs/promises';
import { basename, extname } from 'path';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction, SearchOptions } from '../../../shared/types';
import { getFileEmoji } from '../../../shared/file-icons';
import { buildMdfindArgs } from '../query-builder';
import {
  openFile,
  revealInFinder,
  copyPath,
  previewWithQuickLook,
} from '../../file-actions';

const DEFAULT_FILE_ACTIONS: ResultAction[] = [
  { id: 'open', name: 'Open', shortcut: 'Enter', isDefault: true },
  { id: 'reveal', name: 'Reveal in Finder', shortcut: 'Cmd+Enter' },
  { id: 'copy-path', name: 'Copy Path', shortcut: 'Cmd+C' },
  { id: 'preview', name: 'Quick Look', shortcut: 'Space' },
];

export class FileProvider implements SearchProvider {
  id = 'file';
  name = 'Files';
  priority = 50;
  private currentProcess: ChildProcess | null = null;
  private maxResults = 100;

  private searchOptions: Partial<SearchOptions> = {};

  setSearchOptions(options: Partial<SearchOptions>): void {
    this.searchOptions = options;
  }

  canHandle(query: string): boolean {
    return query.trim().length > 0;
  }

  search(query: string): Promise<UnifiedResult[]> {
    return new Promise((resolve) => {
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
              icon: getFileEmoji(extension, false),
              category: 'file',
              score: 100 - resultCount,
              actions: DEFAULT_FILE_ACTIONS,
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
            actions: DEFAULT_FILE_ACTIONS,
            data: {
              _providerId: this.id,
              path: filePath,
              extension,
              isDirectory: false,
            },
          });
        }

        this.currentProcess = null;
        // Enrich with stat info in background (mutates results for late renderers)
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
    const statPromises = results.map(async (result) => {
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
    });
    await Promise.all(statPromises);
  }

  getActions(result: UnifiedResult): ResultAction[] {
    if (result.category !== 'file') return [];
    return DEFAULT_FILE_ACTIONS;
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
      case 'preview':
        previewWithQuickLook(filePath);
        break;
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
