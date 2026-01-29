import { app, ipcMain, Tray, BrowserWindow, nativeImage, globalShortcut, screen } from 'electron';
import { join } from 'path';
import { setupIpcHandlers } from './ipc-handlers';
import { IPC_CHANNELS } from '../shared/ipc-channels';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // Module not available in dev mode
}

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;

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
    // Delay hide slightly to allow button clicks to complete
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide();
        mainWindow.webContents.send('window:blur');
      }
    }, 100);
  });

  mainWindow.on('show', () => {
    mainWindow?.webContents.send('window:focus');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray(): void {
  // Create tray icon
  const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;
  const assetsPath = isDev
    ? join(app.getAppPath(), 'assets/icons')
    : join(process.resourcesPath, 'assets/icons');

  // Try to load 2x version for Retina displays
  const icon2xPath = join(assetsPath, 'trayTemplate@2x.png');
  const icon1xPath = join(assetsPath, 'trayTemplate.png');

  let icon = nativeImage.createFromPath(icon2xPath);

  if (icon.isEmpty()) {
    icon = nativeImage.createFromPath(icon1xPath);
  }

  if (icon.isEmpty()) {
    // Create a fallback search icon
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAQklEQVQ4y2NgGAWjYBSMAlLAyMDAYMDAwHCAgYHhP5KYAZYYOmD4DwPIYgZYYkMeMDIwMDAONhdQDEYDcRQMe8AIARI5E8bwhp0AAAAASUVORK5CYII='
    );
  }

  // Resize for menu bar (18x18 is ideal for macOS menu bar)
  icon = icon.resize({ width: 18, height: 18 });

  tray = new Tray(icon);
  tray.setToolTip('SpotSearch - Press ⌥Space to search');

  tray.on('click', () => {
    toggleWindow();
  });
}

function toggleWindow(): void {
  if (!mainWindow) return;

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

function showWindow(): void {
  if (!mainWindow) return;

  // Center the window on screen
  mainWindow.center();
  mainWindow.show();
  mainWindow.focus();
}

export function getWindow(): BrowserWindow | undefined {
  return mainWindow || undefined;
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
    // Hide dock icon (menu bar app)
    app.dock?.hide();

    createWindow();
    createTray();
    setupIpcHandlers(getWindow);

    // Handle window hide request from renderer
    ipcMain.on(IPC_CHANNELS.WINDOW_HIDE, () => {
      mainWindow?.hide();
    });

    // Register global shortcut
    const shortcut = 'Option+Space';
    console.log(`Attempting to register shortcut: ${shortcut}`);

    const registered = globalShortcut.register(shortcut, () => {
      console.log('Shortcut triggered!');
      toggleWindow();
    });

    if (registered) {
      console.log(`✅ Shortcut registered successfully: ${shortcut}`);
      console.log(`Is registered: ${globalShortcut.isRegistered(shortcut)}`);
    } else {
      console.error(`❌ Failed to register shortcut: ${shortcut}`);
    }

    console.log('SpotSearch is ready!');
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });
}
