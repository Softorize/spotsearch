// Shared file icon emoji map - single source of truth
export const FILE_ICON_MAP: Record<string, string> = {
  // Documents
  pdf: '📕', doc: '📄', docx: '📄', txt: '📄', rtf: '📄', md: '📝',
  // Images
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', heic: '🖼️', svg: '🖼️',
  // Audio
  mp3: '🎵', wav: '🎵', m4a: '🎵', flac: '🎵',
  // Video
  mp4: '🎬', mov: '🎬', mkv: '🎬', avi: '🎬',
  // Archives
  zip: '📦', tar: '📦', gz: '📦', rar: '📦', '7z': '📦',
  // Code
  js: '💻', ts: '💻', jsx: '💻', tsx: '💻', py: '💻', go: '💻',
  rs: '💻', swift: '💻', java: '💻', c: '💻', cpp: '💻', h: '💻',
  css: '🎨', scss: '🎨', html: '🌐',
  json: '📋', xml: '📋', yaml: '📋', yml: '📋',
};

export function getFileEmoji(ext: string, isDirectory: boolean): string {
  if (isDirectory) return '📁';
  return FILE_ICON_MAP[ext.toLowerCase()] || '📄';
}
