import React, { useEffect, forwardRef } from 'react';
import { useSearchStore } from '../store/searchStore';

interface SearchInputProps {
  isSearching: boolean;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ isSearching }, ref) => {
    const { query, setQuery } = useSearchStore();

    useEffect(() => {
      const unsubscribe = window.api.onWindowFocus(() => {
        if (ref && 'current' in ref && ref.current) {
          ref.current.focus();
          ref.current.select();
        }
      });

      return unsubscribe;
    }, [ref]);

    useEffect(() => {
      if (ref && 'current' in ref && ref.current) {
        ref.current.focus();
      }
    }, [ref]);

    return (
      <div className="search-input-container">
        <div className="search-logo">
          {isSearching ? (
            <div className="spinner" />
          ) : (
            <svg width="24" height="24" viewBox="0 0 100 100" fill="none">
              <rect width="100" height="100" rx="22" fill="url(#logo-gradient)" />
              <circle cx="42" cy="40" r="18" stroke="white" strokeWidth="6" fill="none" />
              <line x1="56" y1="54" x2="72" y2="70" stroke="white" strokeWidth="7" strokeLinecap="round" />
              <defs>
                <linearGradient id="logo-gradient" x1="0" y1="0" x2="100" y2="100">
                  <stop offset="0%" stopColor="#5B8DEF" />
                  <stop offset="100%" stopColor="#1E40AF" />
                </linearGradient>
              </defs>
            </svg>
          )}
        </div>
        <input
          ref={ref}
          type="text"
          className="search-input"
          placeholder="Search anything..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />
        {query && (
          <button
            className="clear-button"
            onClick={() => setQuery('')}
            tabIndex={-1}
            aria-label="Clear search"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6" />
              <path d="m9 9 6 6" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
