import { create } from 'zustand';
import type { UnifiedResult, FileTypeFilter, SearchStats } from '../../shared/types';

interface SearchState {
  // Query state
  query: string;
  exactMatch: boolean;
  selectedFileTypes: FileTypeFilter[];
  extension: string;

  // Results (now unified)
  results: UnifiedResult[];
  isSearching: boolean;
  stats: SearchStats | null;
  error: string | null;

  // Selection
  selectedIndex: number;

  // Actions
  setQuery: (query: string) => void;
  setExactMatch: (exactMatch: boolean) => void;
  setSelectedFileTypes: (types: FileTypeFilter[]) => void;
  toggleFileType: (type: FileTypeFilter) => void;
  setExtension: (extension: string) => void;

  addResult: (result: UnifiedResult) => void;
  clearResults: () => void;
  setIsSearching: (isSearching: boolean) => void;
  setStats: (stats: SearchStats | null) => void;
  setError: (error: string | null) => void;

  setSelectedIndex: (index: number) => void;
  selectNext: () => void;
  selectPrevious: () => void;

  reset: () => void;
}

const initialState = {
  query: '',
  exactMatch: false,
  selectedFileTypes: ['all'] as FileTypeFilter[],
  extension: '',
  results: [] as UnifiedResult[],
  isSearching: false,
  stats: null,
  error: null,
  selectedIndex: 0,
};

export const useSearchStore = create<SearchState>((set, get) => ({
  ...initialState,

  setQuery: (query) => set({ query }),

  setExactMatch: (exactMatch) => set({ exactMatch }),

  setExtension: (extension) => set({ extension }),

  setSelectedFileTypes: (types) => set({ selectedFileTypes: types }),

  toggleFileType: (type) => {
    const current = get().selectedFileTypes;

    if (type === 'all') {
      set({ selectedFileTypes: ['all'] as FileTypeFilter[] });
      return;
    }

    // Remove 'all' if selecting specific type
    let newTypes: FileTypeFilter[] = current.filter((t) => t !== 'all');

    if (newTypes.includes(type)) {
      newTypes = newTypes.filter((t) => t !== type);
    } else {
      newTypes = [...newTypes, type];
    }

    // If no types selected, default to 'all'
    if (newTypes.length === 0) {
      newTypes = ['all'] as FileTypeFilter[];
    }

    set({ selectedFileTypes: newTypes });
  },

  addResult: (result) =>
    set((state) => ({
      results: [...state.results, result],
    })),

  clearResults: () => set({ results: [], stats: null, error: null, selectedIndex: 0 }),

  setIsSearching: (isSearching) => set({ isSearching }),

  setStats: (stats) => set({ stats }),

  setError: (error) => set({ error }),

  setSelectedIndex: (index) => {
    const { results } = get();
    const maxIndex = results.length - 1;
    const clampedIndex = Math.max(0, Math.min(index, maxIndex));
    set({ selectedIndex: clampedIndex });
  },

  selectNext: () => {
    const { selectedIndex, results } = get();
    if (selectedIndex < results.length - 1) {
      set({ selectedIndex: selectedIndex + 1 });
    }
  },

  selectPrevious: () => {
    const { selectedIndex } = get();
    if (selectedIndex > 0) {
      set({ selectedIndex: selectedIndex - 1 });
    }
  },

  reset: () => set(initialState),
}));
