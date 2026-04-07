import React, { forwardRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSearchStore } from '../store/searchStore';
import { ResultItem } from './ResultItem';
import type { UnifiedResult } from '../../shared/types';

interface ResultsListProps {
  results: UnifiedResult[];
  isSearching: boolean;
}

export const ResultsList = forwardRef<HTMLDivElement, ResultsListProps>(
  ({ results, isSearching }, ref) => {
    const { selectedIndex, setSelectedIndex } = useSearchStore();

    const parentRef = ref as React.RefObject<HTMLDivElement>;

    const virtualizer = useVirtualizer({
      count: results.length,
      getScrollElement: () => parentRef?.current,
      estimateSize: () => 52,
      overscan: 5,
    });

    const handleItemClick = useCallback(
      (index: number) => {
        setSelectedIndex(index);
      },
      [setSelectedIndex]
    );

    const handleItemDoubleClick = useCallback(async (result: UnifiedResult) => {
      // Execute the default action
      const defaultAction = result.actions.find((a) => a.isDefault);
      if (defaultAction) {
        await window.api.executeAction(result, defaultAction.id);
      } else if (result.category === 'file') {
        // Fallback for file results
        await window.api.openFile(result.data.path as string);
      }
    }, []);

    if (results.length === 0 && !isSearching) {
      return (
        <div className="results-empty">
          <div className="empty-icon">🔍</div>
          <div className="empty-text">
            {useSearchStore.getState().query
              ? 'No results found'
              : 'Start typing to search'}
          </div>
          <div className="empty-hint">
            Press <kbd>Space</kbd> to preview, <kbd>Enter</kbd> to open
          </div>
        </div>
      );
    }

    return (
      <div ref={ref} className="results-list">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const result = results[virtualRow.index];
            return (
              <div
                key={result.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <ResultItem
                  result={result}
                  isSelected={virtualRow.index === selectedIndex}
                  index={virtualRow.index}
                  onClick={() => handleItemClick(virtualRow.index)}
                  onDoubleClick={() => handleItemDoubleClick(result)}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

ResultsList.displayName = 'ResultsList';
