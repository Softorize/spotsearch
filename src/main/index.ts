import { app, ipcMain, Tray, BrowserWindow, nativeImage, globalShortcut, nativeTheme } from 'electron';
import { join } from 'path';
import { setupIpcHandlers } from './ipc-handlers';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { startClipboardMonitor, stopClipboardMonitor } from './clipboard-monitor';
import { getSetting, setSetting, getSettings, setSettings } from './settings-store';
import type { Settings } from '../shared/types';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // Module not available in dev mode
}

// Prevent crashes from unhandled promise rejections and exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let isTogglingWindow = false;
let currentShortcut: string | null = null;

function createWindow(): void {
  const indexUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? MAIN_WINDOW_VITE_DEV_SERVER_URL
    : `file://${join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)}`;

  mainWindow = new BrowserWindow({
    width: 680,
    height: 480,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadURL(indexUrl);

  mainWindow.on('blur', () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !isTogglingWindow) {
        mainWindow.hide();
        mainWindow.webContents.send('window:blur');
      }
    }, 150);
  });

  mainWindow.on('show', () => {
    mainWindow?.webContents.send('window:focus');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray(): void {
  const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;
  const assetsPath = isDev
    ? join(app.getAppPath(), 'assets/icons')
    : join(process.resourcesPath, 'icons');

  const icon2xPath = join(assetsPath, 'trayTemplate@2x.png');
  const icon1xPath = join(assetsPath, 'trayTemplate.png');

  let icon = nativeImage.createFromPath(icon2xPath);

  if (icon.isEmpty()) {
    icon = nativeImage.createFromPath(icon1xPath);
  }

  if (icon.isEmpty()) {
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAQklEQVQ4y2NgGAWjYBSMAlLAyMDAYMDAwHCAgYHhP5KYAZYYOmD4DwPIYgZYYkMeMDIwMDAONhdQDEYDcRQMe8AIARI5E8bwhp0AAAAASUVORK5CYII='
    );
  }

  icon = icon.resize({ width: 18, height: 18 });

  tray = new Tray(icon);
  tray.setToolTip('SpotSearch');

  tray.on('click', () => {
    toggleWindow();
  });
}

function toggleWindow(): void {
  if (!mainWindow) return;

  isTogglingWindow = true;

  if (mainWindow.isVisible()) {
    mainWindow.hide();
    mainWindow.webContents.send('window:blur');
  } else {
    showWindow();
  }

  setTimeout(() => {
    isTogglingWindow = false;
  }, 200);
}

function showWindow(): void {
  if (!mainWindow) return;
  mainWindow.center();
  mainWindow.show();
  mainWindow.focus();
}

export function getWindow(): BrowserWindow | undefined {
  return mainWindow || undefined;
}

function registerHotkey(shortcut: string): boolean {
  // Unregister previous shortcut
  if (currentShortcut) {
    try { globalShortcut.unregister(currentShortcut); } catch {}
    currentShortcut = null;
  }

  if (!shortcut) return false;

  try {
    const registered = globalShortcut.register(shortcut, () => {
      toggleWindow();
    });

    if (registered) {
      currentShortcut = shortcut;
      console.log(`Shortcut registered: ${shortcut}`);
      return true;
    }

    console.error(`Failed to register shortcut: ${shortcut}`);

    // If the requested shortcut failed, try the default as fallback
    if (shortcut !== 'Alt+Space') {
      console.log('Falling back to Alt+Space');
      return registerHotkey('Alt+Space');
    }

    return false;
  } catch (err) {
    console.error(`Error registering shortcut ${shortcut}:`, err);
    // Fallback to default
    if (shortcut !== 'Alt+Space') {
      return registerHotkey('Alt+Space');
    }
    return false;
  }
}

function applyTheme(theme: string): void {
  if (theme === 'dark') {
    nativeTheme.themeSource = 'dark';
  } else if (theme === 'light') {
    nativeTheme.themeSource = 'light';
  } else {
    nativeTheme.themeSource = 'system';
  }
}

function applyLaunchAtLogin(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled });
}

function applyDockVisibility(show: boolean): void {
  if (show) {
    app.dock?.show();
  } else {
    app.dock?.hide();
  }
}

// Apply a setting change and handle side effects
function applySettingChange(key: keyof Settings, value: unknown): void {
  switch (key) {
    case 'globalHotkey':
      registerHotkey(value as string);
      break;
    case 'theme':
      applyTheme(value as string);
      break;
    case 'launchAtLogin':
      applyLaunchAtLogin(value as boolean);
      break;
    case 'showInDock':
      applyDockVisibility(value as boolean);
      break;
  }
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      showWindow();
    }
  });

  app.whenReady().then(() => {
    const settings = getSettings();

    // Apply initial settings
    applyDockVisibility(settings.showInDock);
    applyTheme(settings.theme);
    applyLaunchAtLogin(settings.launchAtLogin);

    createWindow();
    createTray();
    setupIpcHandlers(getWindow);
    startClipboardMonitor();

    // Handle window hide request from renderer
    ipcMain.on(IPC_CHANNELS.WINDOW_HIDE, () => {
      mainWindow?.hide();
    });

    // Register hotkey from settings
    registerHotkey(settings.globalHotkey || 'Alt+Space');

    // Handle settings changes from renderer
    ipcMain.on('settings:apply', (_event, key: keyof Settings, value: unknown) => {
      setSetting(key, value as any);
      applySettingChange(key, value);

      // Notify renderer of the change
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.SETTINGS_CHANGED, getSettings());
      }
    });

    console.log('SpotSearch is ready!');
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    stopClipboardMonitor();
  });
}
