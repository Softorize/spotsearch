import { spawn } from 'child_process';
import { app, shell } from 'electron';
import { readdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import { watch, FSWatcher } from 'fs';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction } from '../../../shared/types';

interface AppEntry {
  name: string;
  path: string;
  icon?: string;
}

export class AppProvider implements SearchProvider {
  id = 'app';
  name = 'Applications';
  priority = 10; // highest priority - apps should appear first
  private apps: AppEntry[] = [];
  private watchers: FSWatcher[] = [];
  private indexReady = false;

  async initialize(): Promise<void> {
    await this.buildIndex();
    this.watchForChanges();
  }

  private async buildIndex(): Promise<void> {
    const appDirs = [
      '/Applications',
      '/System/Applications',
      '/System/Applications/Utilities',
      join(app.getPath('home'), 'Applications'),
    ];

    const apps: AppEntry[] = [];

    for (const dir of appDirs) {
      try {
        const entries = await readdir(dir);
        for (const entry of entries) {
          if (entry.endsWith('.app')) {
            const appPath = join(dir, entry);
            const appName = entry.replace(/\.app$/, '');
            apps.push({ name: appName, path: appPath });
          }
        }
      } catch {
        // Directory may not exist (e.g., ~/Applications)
      }
    }

    // Also find apps via mdfind for apps in non-standard locations
    try {
      const mdfindApps = await this.findAppsViaMdfind();
      for (const appPath of mdfindApps) {
        const appName = basename(appPath).replace(/\.app$/, '');
        if (!apps.some((a) => a.path === appPath)) {
          apps.push({ name: appName, path: appPath });
        }
      }
    } catch {
      // mdfind may fail, that's ok
    }

    this.apps = apps;
    this.indexReady = true;
  }

  private findAppsViaMdfind(): Promise<string[]> {
    return new Promise((resolve) => {
      const proc = spawn('mdfind', ['kMDItemContentType == "com.apple.application-bundle"'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      proc.stdout?.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });

      proc.on('close', () => {
        const paths = output.split('\n').filter((p) => p.trim());
        resolve(paths);
      });

      proc.on('error', () => resolve([]));

      // Timeout after 5 seconds
      setTimeout(() => {
        proc.kill();
        resolve([]);
      }, 5000);
    });
  }

  private watchForChanges(): void {
    const dirs = ['/Applications', '/System/Applications'];
    for (const dir of dirs) {
      try {
        const watcher = watch(dir, { persistent: false }, () => {
          this.buildIndex();
        });
        this.watchers.push(watcher);
      } catch {
        // May not have permission
      }
    }
  }

  canHandle(query: string): boolean {
    return query.trim().length > 0;
  }

  async search(query: string): Promise<UnifiedResult[]> {
    if (!this.indexReady) return [];

    const q = query.toLowerCase().trim();
    const results: UnifiedResult[] = [];

    for (const appEntry of this.apps) {
      const nameLower = appEntry.name.toLowerCase();

      // Score based on match quality
      let score = 0;
      if (nameLower === q) {
        score = 1000; // exact match
      } else if (nameLower.startsWith(q)) {
        score = 900; // starts with
      } else if (nameLower.includes(q)) {
        score = 700; // contains
      } else {
        // Fuzzy: check if all chars of query appear in order
        let qi = 0;
        for (let i = 0; i < nameLower.length && qi < q.length; i++) {
          if (nameLower[i] === q[qi]) qi++;
        }
        if (qi === q.length) {
          score = 500; // fuzzy match
        }
      }

      if (score > 0) {
        results.push({
          id: `app-${appEntry.path}`,
          name: appEntry.name,
          subtitle: appEntry.path,
          icon: '📱',
          category: 'app',
          score,
          actions: this.getDefaultActions(),
          data: {
            _providerId: this.id,
            path: appEntry.path,
          },
        });
      }
    }

    // Sort by score descending, limit to 10
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 10);
  }

  private getDefaultActions(): ResultAction[] {
    return [
      { id: 'open', name: 'Launch', shortcut: 'Enter', isDefault: true },
      { id: 'reveal', name: 'Show in Finder', shortcut: 'Cmd+Enter' },
    ];
  }

  getActions(result: UnifiedResult): ResultAction[] {
    if (result.category !== 'app') return [];
    return this.getDefaultActions();
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    const appPath = result.data.path as string;
    if (!appPath) return;

    switch (actionId) {
      case 'open':
        await shell.openPath(appPath);
        break;
      case 'reveal':
        shell.showItemInFolder(appPath);
        break;
    }
  }

  destroy(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }
}
