import { useEffect, useCallback, RefObject } from 'react';
import { useSearchStore } from '../store/searchStore';

interface UseKeyboardNavOptions {
  inputRef: RefObject<HTMLInputElement | null>;
  listRef: RefObject<HTMLDivElement | null>;
}

export function useKeyboardNav({ inputRef, listRef }: UseKeyboardNavOptions) {
  const {
    results,
    selectedIndex,
    selectNext,
    selectPrevious,
    setSelectedIndex,
    query,
    setQuery,
  } = useSearchStore();

  const getSelectedResult = useCallback(() => {
    return results[selectedIndex] || null;
  }, [results, selectedIndex]);

  const handleKeyDown = useCallback(
    async (event: KeyboardEvent) => {
      const selected = getSelectedResult();

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          selectNext();
          break;

        case 'ArrowUp':
          event.preventDefault();
          selectPrevious();
          break;

        case 'Enter':
          if (selected) {
            event.preventDefault();
            if (event.metaKey || event.ctrlKey) {
              // Cmd+Enter: execute second action (usually "Reveal in Finder" for files)
              const secondAction = selected.actions.find((a) => a.shortcut === 'Cmd+Enter');
              if (secondAction) {
                await window.api.executeAction(selected, secondAction.id);
              } else if (selected.category === 'file') {
                await window.api.revealFile(selected.data.path as string);
              }
            } else {
              // Enter: execute default action
              const defaultAction = selected.actions.find((a) => a.isDefault);
              if (defaultAction) {
                await window.api.executeAction(selected, defaultAction.id);
              } else if (selected.category === 'file') {
                await window.api.openFile(selected.data.path as string);
              }
            }
          }
          break;

        case ' ':
          // Space: QuickLook preview (only when not typing in input)
          if (document.activeElement !== inputRef.current && selected) {
            event.preventDefault();
            if (selected.category === 'file') {
              await window.api.previewFile(selected.data.path as string);
            } else {
              // For non-file results, try the 'preview' action
              const previewAction = selected.actions.find((a) => a.id === 'preview');
              if (previewAction) {
                await window.api.executeAction(selected, previewAction.id);
              }
            }
          }
          break;

        case 'Escape':
          event.preventDefault();
          if (query) {
            // First Escape: Clear query
            setQuery('');
            inputRef.current?.focus();
          } else {
            // Second Escape: Hide window
            window.api.hideWindow();
          }
          break;

        case 'Tab':
          // Allow normal tab behavior when in an input field
          if (document.activeElement instanceof HTMLInputElement) {
            return; // Let Tab work normally for focus navigation
          }
          // Otherwise use Tab for result navigation
          event.preventDefault();
          if (event.shiftKey) {
            selectPrevious();
          } else {
            selectNext();
          }
          break;

        case 'Home':
          event.preventDefault();
          setSelectedIndex(0);
          break;

        case 'End':
          event.preventDefault();
          setSelectedIndex(results.length - 1);
          break;

        case 'PageDown':
          event.preventDefault();
          setSelectedIndex(Math.min(selectedIndex + 10, results.length - 1));
          break;

        case 'PageUp':
          event.preventDefault();
          setSelectedIndex(Math.max(selectedIndex - 10, 0));
          break;

        case 'c':
          // Cmd+C: copy path for file results
          if ((event.metaKey || event.ctrlKey) && selected && document.activeElement !== inputRef.current) {
            event.preventDefault();
            const copyAction = selected.actions.find((a) => a.id === 'copy-path' || a.id === 'copy');
            if (copyAction) {
              await window.api.executeAction(selected, copyAction.id);
            } else if (selected.category === 'file') {
              await window.api.copyPath(selected.data.path as string);
            }
          }
          break;

        default:
          // If typing a character and not in any input, focus the main input
          if (
            event.key.length === 1 &&
            !event.metaKey &&
            !event.ctrlKey &&
            !(document.activeElement instanceof HTMLInputElement)
          ) {
            inputRef.current?.focus();
          }
          break;
      }
    },
    [
      getSelectedResult,
      selectNext,
      selectPrevious,
      setSelectedIndex,
      selectedIndex,
      results.length,
      query,
      setQuery,
      inputRef,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && results.length > 0) {
      const selectedElement = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, listRef, results.length]);

  return {
    selectedIndex,
    getSelectedResult,
  };
}
