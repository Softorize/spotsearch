// Result categories for the multi-provider search system
export type ResultCategory =
  | 'file'
  | 'app'
  | 'calculator'
  | 'dictionary'
  | 'contact'
  | 'system-command'
  | 'clipboard'
  | 'snippet'
  | 'quicklink'
  | 'bookmark'
  | 'emoji'
  | 'calendar'
  | 'music'
  | 'script'
  | 'workflow'
  | 'window-management';

// Unified result type used across all providers
export interface UnifiedResult {
  id: string;
  name: string;
  subtitle: string;
  icon: string; // emoji, base64 data URL, or file path
  category: ResultCategory;
  score: number; // higher = shown first
  actions: ResultAction[];
  data: Record<string, unknown>; // category-specific payload
}

export interface ResultAction {
  id: string;
  name: string;
  shortcut?: string; // e.g. "Cmd+Enter"
  isDefault?: boolean;
}

// Legacy file search result (used internally by file provider)
export interface SearchResult {
  id: string;
  path: string;
  name: string;
  extension: string;
  isDirectory: boolean;
  size?: number;
  modifiedDate?: string;
  contentType?: string;
}

export interface SearchOptions {
  query: string;
  exactMatch: boolean;
  fileTypes: FileTypeFilter[];
  extension?: string;
  contentSearch?: boolean;
  scope?: string;
}

export type FileTypeFilter =
  | 'all'
  | 'folders'
  | 'documents'
  | 'images'
  | 'archives'
  | 'pdfs'
  | 'audio'
  | 'video'
  | 'code';

export interface SearchStats {
  count: number;
  duration: number;
}

export interface Settings {
  exactMatch: boolean;
  selectedFileTypes: FileTypeFilter[];
  globalHotkey: string;
  extension: string;
  launchAtLogin: boolean;
  showInDock: boolean;
  maxResults: number;
  searchScope: string; // '' for everywhere, or a path
  theme: 'system' | 'dark' | 'light';
}

export interface FileMetadata {
  size: number;
  modifiedDate: Date;
  createdDate: Date;
  contentType: string;
}
