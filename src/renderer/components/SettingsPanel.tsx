import React, { useState, useEffect, useCallback } from 'react';
import type { Settings } from '../../shared/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const HOTKEY_OPTIONS = [
  { label: 'Option + Space', value: 'Alt+Space' },
  { label: 'Cmd + Space', value: 'CommandOrControl+Space' },
  { label: 'Ctrl + Space', value: 'Control+Space' },
  { label: 'Option + S', value: 'Alt+S' },
  { label: 'Cmd + Shift + Space', value: 'CommandOrControl+Shift+Space' },
  { label: 'Option + Shift + Space', value: 'Alt+Shift+Space' },
  { label: 'Cmd + K', value: 'CommandOrControl+K' },
  { label: 'Cmd + Shift + K', value: 'CommandOrControl+Shift+K' },
  { label: 'F1', value: 'F1' },
  { label: 'F2', value: 'F2' },
];

const MAX_RESULTS_OPTIONS = [50, 100, 200, 500];

const THEME_OPTIONS: Array<{ label: string; value: Settings['theme'] }> = [
  { label: 'System', value: 'system' },
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
];

export function SettingsPanel({ isOpen, onClose }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [hotkeyStatus, setHotkeyStatus] = useState<string>('');
  const [customHotkey, setCustomHotkey] = useState('');
  const [useCustomHotkey, setUseCustomHotkey] = useState(false);
  const [recordingHotkey, setRecordingHotkey] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    window.api.getSettings().then((s) => {
      setSettings(s);
      const isPreset = HOTKEY_OPTIONS.some((o) => o.value === s.globalHotkey);
      if (!isPreset) {
        setUseCustomHotkey(true);
        setCustomHotkey(s.globalHotkey);
      }
    });

    const unsub = window.api.onSettingsChanged((s) => {
      setSettings(s);
    });

    return unsub;
  }, [isOpen]);

  const updateSetting = useCallback((key: keyof Settings, value: unknown) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
    window.api.applySetting(key, value);
    if (key === 'globalHotkey') {
      setHotkeyStatus('Shortcut updated');
      setTimeout(() => setHotkeyStatus(''), 2000);
    }
  }, []);

  const handleHotkeyRecord = useCallback((e: React.KeyboardEvent) => {
    if (!recordingHotkey) return;
    e.preventDefault();

    const parts: string[] = [];
    if (e.metaKey) parts.push('CommandOrControl');
    if (e.ctrlKey && !e.metaKey) parts.push('Control');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    const key = e.key;
    if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
      parts.push(key.length === 1 ? key.toUpperCase() : key);
      const combo = parts.join('+');
      setCustomHotkey(combo);
      setRecordingHotkey(false);
      updateSetting('globalHotkey', combo);
    }
  }, [recordingHotkey, updateSetting]);

  if (!isOpen || !settings) return null;

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose} title="Close (Esc)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m18 6-12 12" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="settings-body">
          {/* General */}
          <div className="settings-section">
            <h3 className="settings-section-title">General</h3>

            <div className="setting-row">
              <div className="setting-label">
                <span>Launch at login</span>
                <span className="setting-hint">Start SpotSearch when you log in</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.launchAtLogin}
                  onChange={(e) => updateSetting('launchAtLogin', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-row">
              <div className="setting-label">
                <span>Show in Dock</span>
                <span className="setting-hint">Show app icon in the macOS Dock</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.showInDock}
                  onChange={(e) => updateSetting('showInDock', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-row">
              <div className="setting-label">
                <span>Theme</span>
                <span className="setting-hint">App appearance</span>
              </div>
              <select
                className="setting-select"
                value={settings.theme}
                onChange={(e) => updateSetting('theme', e.target.value)}
              >
                {THEME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Keyboard Shortcut */}
          <div className="settings-section">
            <h3 className="settings-section-title">Keyboard Shortcut</h3>

            <div className="setting-row">
              <div className="setting-label">
                <span>Activation hotkey</span>
                <span className="setting-hint">Global shortcut to toggle SpotSearch</span>
              </div>
              {!useCustomHotkey ? (
                <select
                  className="setting-select"
                  value={settings.globalHotkey}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setUseCustomHotkey(true);
                    } else {
                      updateSetting('globalHotkey', e.target.value);
                    }
                  }}
                >
                  {HOTKEY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                  <option value="__custom__">Custom...</option>
                </select>
              ) : (
                <div className="hotkey-custom">
                  <input
                    className="hotkey-input"
                    value={recordingHotkey ? 'Press keys...' : customHotkey || settings.globalHotkey}
                    onKeyDown={handleHotkeyRecord}
                    onFocus={() => setRecordingHotkey(true)}
                    onBlur={() => setRecordingHotkey(false)}
                    readOnly
                    placeholder="Click and press keys"
                  />
                  <button
                    className="hotkey-reset"
                    onClick={() => {
                      setUseCustomHotkey(false);
                      setCustomHotkey('');
                      updateSetting('globalHotkey', 'Alt+Space');
                    }}
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
            {hotkeyStatus && (
              <div className="setting-status">{hotkeyStatus}</div>
            )}
          </div>

          {/* Search */}
          <div className="settings-section">
            <h3 className="settings-section-title">Search</h3>

            <div className="setting-row">
              <div className="setting-label">
                <span>Max results</span>
                <span className="setting-hint">Maximum number of search results</span>
              </div>
              <select
                className="setting-select"
                value={settings.maxResults}
                onChange={(e) => updateSetting('maxResults', parseInt(e.target.value))}
              >
                {MAX_RESULTS_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="setting-row">
              <div className="setting-label">
                <span>Exact match</span>
                <span className="setting-hint">Only show exact filename matches</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.exactMatch}
                  onChange={(e) => updateSetting('exactMatch', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-row">
              <div className="setting-label">
                <span>Search scope</span>
                <span className="setting-hint">Limit file search to a directory (leave empty for everywhere)</span>
              </div>
              <input
                className="setting-text-input"
                type="text"
                value={settings.searchScope}
                onChange={(e) => updateSetting('searchScope', e.target.value)}
                placeholder="e.g. ~/Documents"
              />
            </div>
          </div>

          {/* About */}
          <div className="settings-section">
            <h3 className="settings-section-title">About</h3>
            <div className="about-info">
              <span className="about-name">SpotSearch</span>
              <span className="about-version">v1.4.0</span>
            </div>
            <div className="about-hint">
              Press the activation hotkey to toggle the search bar.
              Use natural language like "photos from last week" or math like "2+2".
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
