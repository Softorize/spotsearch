import { shell, clipboard, app, nativeImage } from 'electron';
import { spawn, exec } from 'child_process';
import { stat } from 'fs/promises';
import { join } from 'path';

export async function openFile(filePath: string): Promise<void> {
  const result = await shell.openPath(filePath);
  if (result) {
    throw new Error(result);
  }
}

export function revealInFinder(filePath: string): void {
  // Use AppleScript for reliable Finder reveal on macOS
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
  // Use qlmanage to open QuickLook preview
  const process = spawn('qlmanage', ['-p', filePath], {
    detached: true,
    stdio: 'ignore',
  });

  process.unref();
}

export async function getFileIcon(filePath: string): Promise<string> {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'normal' });
    return icon.toDataURL();
  } catch {
    // Return empty string if icon fetch fails
    return '';
  }
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
