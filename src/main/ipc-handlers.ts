import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { SearchOptions, UnifiedResult, SearchStats } from '../shared/types';
import { searchCoordinator } from './search/search-coordinator';
import { recordInteraction } from './search/frecency-store';
import { FileProvider } from './search/providers/file-provider';
import { AppProvider } from './search/providers/app-provider';
import { CalculatorProvider } from './search/providers/calculator-provider';
import { DictionaryProvider } from './search/providers/dictionary-provider';
import { ContactsProvider } from './search/providers/contacts-provider';
import { SystemCommandsProvider } from './search/providers/system-commands-provider';
import { QuickLinkProvider } from './search/providers/quicklink-provider';
import { EmojiProvider } from './search/providers/emoji-provider';
import { BookmarkProvider } from './search/providers/bookmark-provider';
import { WindowProvider } from './search/providers/window-provider';
import { SnippetProvider } from './search/providers/snippet-provider';
import { RecentFilesProvider } from './search/providers/recent-files-provider';
import { ScriptProvider } from './search/providers/script-provider';
import { WorkflowProvider } from './search/providers/workflow-provider';
import { CalendarProvider } from './search/providers/calendar-provider';
import { MusicProvider } from './search/providers/music-provider';
import {
  openFile,
  revealInFinder,
  copyPath,
  previewWithQuickLook,
  getFileIcon,
  getFileMetadata,
} from './file-actions';
import { getSettings, setSettings, getSetting, setSetting } from './settings-store';
import { getClipboardHistory, clearClipboardHistory, copyFromHistory } from './clipboard-monitor';

// Keep a reference to the file provider so we can update its options
let fileProvider: FileProvider | null = null;
// Track current query for frecency recording
let currentQuery = '';

export function setupIpcHandlers(getWindow: () => BrowserWindow | undefined): void {
  // Initialize and register all providers
  fileProvider = new FileProvider();
  searchCoordinator.registerProvider(fileProvider);
  searchCoordinator.registerProvider(new AppProvider());
  searchCoordinator.registerProvider(new CalculatorProvider());
  searchCoordinator.registerProvider(new DictionaryProvider());
  searchCoordinator.registerProvider(new ContactsProvider());
  searchCoordinator.registerProvider(new SystemCommandsProvider());
  searchCoordinator.registerProvider(new QuickLinkProvider());
  searchCoordinator.registerProvider(new EmojiProvider());
  searchCoordinator.registerProvider(new BookmarkProvider());
  searchCoordinator.registerProvider(new WindowProvider());
  searchCoordinator.registerProvider(new SnippetProvider());
  searchCoordinator.registerProvider(new RecentFilesProvider());
  searchCoordinator.registerProvider(new ScriptProvider());
  searchCoordinator.registerProvider(new WorkflowProvider());
  searchCoordinator.registerProvider(new CalendarProvider());
  searchCoordinator.registerProvider(new MusicProvider());

  // Set up coordinator listeners once (not per-search)
  searchCoordinator.on('result', (result: UnifiedResult) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.SEARCH_RESULT, result);
    }
  });

  searchCoordinator.on('complete', (stats: SearchStats) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.SEARCH_COMPLETE, stats);
    }
  });

  searchCoordinator.on('error', (error: string) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.SEARCH_ERROR, error);
    }
  });

  // Search handler
  ipcMain.on(IPC_CHANNELS.SEARCH_START, (_event, options: SearchOptions) => {
    if (fileProvider) {
      fileProvider.setSearchOptions(options);
    }

    currentQuery = options.query;
    searchCoordinator.search(options.query).catch((err) => {
      console.error('Search error:', err);
    });
  });

  ipcMain.on(IPC_CHANNELS.SEARCH_CANCEL, () => {
    searchCoordinator.cancel();
  });

  // Action execution handler
  ipcMain.handle(IPC_CHANNELS.ACTION_EXECUTE, async (_event, result: UnifiedResult, actionId: string) => {
    try {
      await searchCoordinator.executeAction(result, actionId);
      // Record interaction for frecency
      recordInteraction(result.id, currentQuery);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // File action handlers (kept for backward compatibility and direct keyboard shortcuts)
  ipcMain.handle(IPC_CHANNELS.FILE_OPEN, async (_event, filePath: string) => {
    try {
      await openFile(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_REVEAL, (_event, filePath: string) => {
    console.log('Revealing file:', filePath);
    try {
      revealInFinder(filePath);
      console.log('Reveal completed');
      return { success: true };
    } catch (error) {
      console.error('Reveal error:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_COPY_PATH, (_event, filePath: string) => {
    copyPath(filePath);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.FILE_PREVIEW, (_event, filePath: string) => {
    previewWithQuickLook(filePath);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.FILE_GET_ICON, async (_event, filePath: string) => {
    return await getFileIcon(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_GET_METADATA, async (_event, filePath: string) => {
    try {
      return await getFileMetadata(filePath);
    } catch {
      return null;
    }
  });

  // Settings handlers
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (_event, key?: string) => {
    if (key) {
      return getSetting(key as keyof typeof getSettings);
    }
    return getSettings();
  });

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET,
    (_event, keyOrSettings: string | object, value?: unknown) => {
      if (typeof keyOrSettings === 'string') {
        setSetting(keyOrSettings as any, value as any);
      } else {
        setSettings(keyOrSettings as any);
      }
      return getSettings();
    }
  );

  // Clipboard handlers
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_GET, () => {
    return getClipboardHistory();
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_CLEAR, () => {
    clearClipboardHistory();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_COPY, (_event, id: string) => {
    return { success: copyFromHistory(id) };
  });
}

// Export for registering additional providers from outside
export function registerSearchProvider(provider: import('./search/search-provider').SearchProvider): void {
  searchCoordinator.registerProvider(provider);
}
