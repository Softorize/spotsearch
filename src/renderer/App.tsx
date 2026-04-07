import React, { useRef, useState, useEffect, useCallback, Component, ReactNode } from 'react';
import { SearchInput } from './components/SearchInput';
import { FilterBar } from './components/FilterBar';
import { ResultsList } from './components/ResultsList';
import { StatusBar } from './components/StatusBar';
import { ClipboardHistory } from './components/ClipboardHistory';
import { SettingsPanel } from './components/SettingsPanel';
import { useSearch } from './hooks/useSearch';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import './styles/global.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Component error:', error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [clipboardExpanded, setClipboardExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { results, isSearching, stats, error } = useSearch();

  useKeyboardNav({ inputRef, listRef });

  // Cmd+, to open settings, Escape to close
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      setSettingsOpen((prev) => !prev);
    }
    if (e.key === 'Escape' && settingsOpen) {
      e.preventDefault();
      e.stopPropagation();
      setSettingsOpen(false);
    }
  }, [settingsOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [handleGlobalKeyDown]);

  return (
    <div className="app">
      <SearchInput ref={inputRef} isSearching={isSearching} />
      <ErrorBoundary>
        <ClipboardHistory
          isExpanded={clipboardExpanded}
          onToggle={() => setClipboardExpanded(!clipboardExpanded)}
        />
      </ErrorBoundary>
      <FilterBar />
      <ResultsList ref={listRef} results={results} isSearching={isSearching} />
      <StatusBar
        stats={stats}
        isSearching={isSearching}
        error={error}
        resultCount={results.length}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
