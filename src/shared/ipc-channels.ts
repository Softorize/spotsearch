export const IPC_CHANNELS = {
  // Search (unified provider system)
  SEARCH_START: 'search:start',
  SEARCH_RESULT: 'search:result',
  SEARCH_COMPLETE: 'search:complete',
  SEARCH_CANCEL: 'search:cancel',
  SEARCH_ERROR: 'search:error',

  // Action execution
  ACTION_EXECUTE: 'action:execute',

  // File actions (used by file provider & keyboard nav)
  FILE_OPEN: 'file:open',
  FILE_REVEAL: 'file:reveal',
  FILE_COPY_PATH: 'file:copy-path',
  FILE_PREVIEW: 'file:preview',
  FILE_GET_ICON: 'file:get-icon',
  FILE_GET_METADATA: 'file:get-metadata',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Window
  WINDOW_HIDE: 'window:hide',
  WINDOW_SHOW: 'window:show',

  // Clipboard
  CLIPBOARD_GET: 'clipboard:get',
  CLIPBOARD_CLEAR: 'clipboard:clear',
  CLIPBOARD_COPY: 'clipboard:copy',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
