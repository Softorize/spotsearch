import React, { useEffect, forwardRef } from 'react';
import { useSearchStore } from '../store/searchStore';

interface SearchInputProps {
  isSearching: boolean;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ isSearching }, ref) => {
    const { query, setQuery } = useSearchStore();

    // Focus input when window becomes visible
    useEffect(() => {
      const unsubscribe = window.api.onWindowFocus(() => {
        if (ref && 'current' in ref && ref.current) {
          ref.current.focus();
          ref.current.select();
        }
      });

      return unsubscribe;
    }, [ref]);

    // Initial focus
    useEffect(() => {
      if (ref && 'current' in ref && ref.current) {
        ref.current.focus();
      }
    }, [ref]);

    return (
      <div className="search-input-container">
        <div className="search-icon">
          {isSearching ? (
            <div className="spinner" />
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
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
