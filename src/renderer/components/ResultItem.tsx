import React, { memo, useEffect, useState } from 'react';
import type { SearchResult } from '../../shared/types';

interface ResultItemProps {
  result: SearchResult;
  isSelected: boolean;
  index: number;
  onClick: () => void;
  onDoubleClick: () => void;
}

function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

function formatDate(dateString?: string): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}

function getFileIcon(result: SearchResult): string {
  if (result.isDirectory) return '📁';

  const ext = result.extension.toLowerCase();

  const iconMap: Record<string, string> = {
    // Documents
    pdf: '📕',
    doc: '📄',
    docx: '📄',
    txt: '📄',
    rtf: '📄',
    md: '📝',
    // Images
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    webp: '🖼️',
    heic: '🖼️',
    svg: '🖼️',
    // Audio
    mp3: '🎵',
    wav: '🎵',
    m4a: '🎵',
    flac: '🎵',
    // Video
    mp4: '🎬',
    mov: '🎬',
    mkv: '🎬',
    avi: '🎬',
    // Archives
    zip: '📦',
    tar: '📦',
    gz: '📦',
    rar: '📦',
    '7z': '📦',
    // Code
    js: '💻',
    ts: '💻',
    jsx: '💻',
    tsx: '💻',
    py: '💻',
    go: '💻',
    rs: '💻',
    swift: '💻',
    java: '💻',
    c: '💻',
    cpp: '💻',
    h: '💻',
    css: '🎨',
    scss: '🎨',
    html: '🌐',
    json: '📋',
    xml: '📋',
    yaml: '📋',
    yml: '📋',
  };

  return iconMap[ext] || '📄';
}

function truncatePath(path: string, maxLength: number = 60): string {
  if (path.length <= maxLength) return path;

  const parts = path.split('/');
  const fileName = parts.pop() || '';
  let truncated = parts.join('/');

  if (truncated.length > maxLength - 3) {
    truncated = '...' + truncated.slice(-(maxLength - 3 - fileName.length));
  }

  return truncated;
}

export const ResultItem = memo(function ResultItem({
  result,
  isSelected,
  index,
  onClick,
  onDoubleClick,
}: ResultItemProps) {
  const [icon, setIcon] = useState<string | null>(null);

  // Load native file icon
  useEffect(() => {
    let mounted = true;

    window.api.getFileIcon(result.path).then((iconData) => {
      if (mounted && iconData) {
        setIcon(iconData);
      }
    });

    return () => {
      mounted = false;
    };
  }, [result.path]);

  const parentPath = result.path.replace(`/${result.name}`, '');

  return (
    <div
      className={`result-item ${isSelected ? 'selected' : ''}`}
      data-index={index}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="result-icon">
        {icon ? (
          <img src={icon} alt="" width={32} height={32} />
        ) : (
          <span className="result-emoji-icon">{getFileIcon(result)}</span>
        )}
      </div>
      <div className="result-info">
        <div className="result-name">{result.name}</div>
        <div className="result-path">{truncatePath(parentPath)}</div>
      </div>
      <div className="result-meta">
        {result.size !== undefined && (
          <span className="result-size">{formatFileSize(result.size)}</span>
        )}
        {result.modifiedDate && (
          <span className="result-date">{formatDate(result.modifiedDate)}</span>
        )}
      </div>
      {isSelected && (
        <div className="result-actions">
          <button
            className="action-button"
            onClick={async (e) => {
              e.stopPropagation();
              await window.api.openFile(result.path);
            }}
            title="Open (Enter)"
          >
            Open
          </button>
          <button
            className="action-button"
            onClick={(e) => {
              e.stopPropagation();
              window.api.revealFile(result.path);
            }}
            title="Reveal in Finder"
          >
            Reveal
          </button>
          <button
            className="action-button"
            onClick={async (e) => {
              e.stopPropagation();
              await window.api.copyPath(result.path);
            }}
            title="Copy Path"
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
});
