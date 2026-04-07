import React from 'react';
import type { SearchStats } from '../../shared/types';

interface StatusBarProps {
  stats: SearchStats | null;
  isSearching: boolean;
  error: string | null;
  resultCount: number;
  onOpenSettings: () => void;
}

export function StatusBar({ stats, isSearching, error, resultCount, onOpenSettings }: StatusBarProps) {
  const settingsButton = (
    <button className="settings-button" onClick={onOpenSettings} title="Settings (Cmd+,)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );

  if (error) {
    return (
      <div className="status-bar error">
        <span className="status-icon">!</span>
        <span className="status-text">{error}</span>
        {settingsButton}
      </div>
    );
  }

  if (isSearching) {
    return (
      <div className="status-bar">
        <span className="status-text">Searching...</span>
        {settingsButton}
      </div>
    );
  }

  if (stats) {
    return (
      <div className="status-bar">
        <span className="status-text">
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
          {stats.count > resultCount && ` (showing first ${resultCount})`}
        </span>
        <span className="status-duration">{stats.duration}ms</span>
        {settingsButton}
      </div>
    );
  }

  return (
    <div className="status-bar">
      <span className="status-text">
        <kbd>↑↓</kbd> navigate · <kbd>Enter</kbd> open · <kbd>Space</kbd> preview
      </span>
      {settingsButton}
    </div>
  );
}
