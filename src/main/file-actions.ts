import { shell, clipboard, app, nativeImage } from 'electron';
import { spawn, exec } from 'child_process';
import { stat, readFile } from 'fs/promises';
import { join, extname } from 'path';
import { existsSync } from 'fs';

export async function openFile(filePath: string): Promise<void> {
  const result = await shell.openPath(filePath);
  if (result) {
    throw new Error(result);
  }
}

export function revealInFinder(filePath: string): void {
  const script = `tell application "Finder" to reveal POSIX file "${filePath}"
tell application "Finder" to activate`;
  exec(`osascript -e '${script.split('\n').join("' -e '")}'`, (err) => {
    if (err) console.error('Reveal error:', err);
  });
}

export function copyPath(filePath: string): void {
  clipboard.writeText(filePath);
}

export function previewWithQuickLook(filePath: string): void {
  const process = spawn('qlmanage', ['-p', filePath], {
    detached: true,
    stdio: 'ignore',
  });
  process.unref();
}

// Icon cache
const iconCache = new Map<string, string>();

// Extract app icon directly from the .app bundle (like Raycast/Alfred)
function getAppBundleIcon(appPath: string): Promise<string> {
  return new Promise((resolve) => {
    // Read CFBundleIconFile from Info.plist
    exec(
      `defaults read "${appPath}/Contents/Info" CFBundleIconFile 2>/dev/null`,
      { timeout: 2000 },
      (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve('');
          return;
        }

        let iconName = stdout.trim();
        // Add .icns extension if missing
        if (!iconName.endsWith('.icns')) {
          iconName += '.icns';
        }

        const icnsPath = join(appPath, 'Contents', 'Resources', iconName);
        if (!existsSync(icnsPath)) {
          resolve('');
          return;
        }

        // Convert .icns to PNG using sips (macOS native, fast)
        const tmpPng = `/tmp/spotsearch-icon-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
        exec(
          `sips -s format png "${icnsPath}" --out "${tmpPng}" -z 64 64 2>/dev/null`,
          { timeout: 3000 },
          async (sipsErr) => {
            if (sipsErr) {
              resolve('');
              return;
            }

            try {
              const pngData = await readFile(tmpPng);
              const dataUrl = `data:image/png;base64,${pngData.toString('base64')}`;
              // Clean up temp file in background
              exec(`rm -f "${tmpPng}"`);
              resolve(dataUrl);
            } catch {
              resolve('');
            }
          }
        );
      }
    );
  });
}

// Throttled queue for non-app file icons via Electron API
let activeIconFetches = 0;
const MAX_CONCURRENT_ICONS = 3;
const iconQueue: Array<{ filePath: string; resolve: (val: string) => void }> = [];

function processIconQueue(): void {
  while (activeIconFetches < MAX_CONCURRENT_ICONS && iconQueue.length > 0) {
    const item = iconQueue.shift()!;
    activeIconFetches++;

    app.getFileIcon(item.filePath, { size: 'normal' })
      .then((icon) => {
        const dataUrl = icon.toDataURL();
        iconCache.set(item.filePath, dataUrl);
        item.resolve(dataUrl);
      })
      .catch(() => {
        iconCache.set(item.filePath, '');
        item.resolve('');
      })
      .finally(() => {
        activeIconFetches--;
        processIconQueue();
      });
  }
}

export async function getFileIcon(filePath: string): Promise<string> {
  const cached = iconCache.get(filePath);
  if (cached !== undefined) return cached;

  // Cap cache size
  if (iconCache.size > 500) {
    const firstKey = iconCache.keys().next().value;
    if (firstKey) iconCache.delete(firstKey);
  }

  // For .app bundles, extract icon directly from the bundle
  if (filePath.endsWith('.app')) {
    try {
      const dataUrl = await getAppBundleIcon(filePath);
      if (dataUrl) {
        iconCache.set(filePath, dataUrl);
        return dataUrl;
      }
    } catch {
      // Fall through to Electron API
    }
  }

  // For other files, use Electron's getFileIcon with throttling
  return new Promise((resolve) => {
    iconQueue.push({ filePath, resolve });
    processIconQueue();
  });
}

export async function getFileMetadata(
  filePath: string
): Promise<{ size: number; modifiedDate: string; createdDate: string }> {
  const stats = await stat(filePath);
  return {
    size: stats.size,
    modifiedDate: stats.mtime.toISOString(),
    createdDate: stats.birthtime.toISOString(),
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}
