import Store from 'electron-store';
import type { Settings, FileTypeFilter } from '../shared/types';

interface StoreSchema {
  settings: Settings;
}

const defaults: StoreSchema = {
  settings: {
    exactMatch: false,
    selectedFileTypes: ['all'],
    globalHotkey: 'Alt+Space',
    extension: '',
    launchAtLogin: false,
    showInDock: false,
    maxResults: 100,
    searchScope: '',
    theme: 'system',
  },
};

const store = new Store<StoreSchema>({
  name: 'spotsearch-settings',
  defaults,
});

export function getSettings(): Settings {
  return { ...defaults.settings, ...store.get('settings') };
}

export function setSettings(settings: Partial<Settings>): Settings {
  const current = getSettings();
  const updated = { ...current, ...settings };
  store.set('settings', updated);
  return updated;
}

export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  const settings = getSettings();
  return settings[key];
}

export function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K]
): void {
  store.set(`settings.${key}`, value);
}

export function resetSettings(): Settings {
  store.set('settings', defaults.settings);
  return defaults.settings;
}
