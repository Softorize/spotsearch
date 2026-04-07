import React, { memo, useEffect, useState } from 'react';
import type { UnifiedResult } from '../../shared/types';

interface ResultItemProps {
  result: UnifiedResult;
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

function getCategoryBadge(category: string): string | null {
  switch (category) {
    case 'app': return 'App';
    case 'calculator': return 'Calc';
    case 'dictionary': return 'Dict';
    case 'contact': return 'Contact';
    case 'system-command': return 'System';
    case 'clipboard': return 'Clipboard';
    case 'snippet': return 'Snippet';
    case 'quicklink': return 'Link';
    case 'bookmark': return 'Bookmark';
    case 'emoji': return 'Emoji';
    case 'calendar': return 'Calendar';
    case 'music': return 'Music';
    case 'script': return 'Script';
    case 'workflow': return 'Workflow';
    case 'window-management': return 'Window';
    default: return null;
  }
}

export const ResultItem = memo(function ResultItem({
  result,
  isSelected,
  index,
  onClick,
  onDoubleClick,
}: ResultItemProps) {
  const [nativeIcon, setNativeIcon] = useState<string | null>(null);

  // Load native file icon for file results
  useEffect(() => {
    if (result.category !== 'file' && result.category !== 'app') return;

    const filePath = result.data.path as string;
    if (!filePath) return;

    let mounted = true;

    window.api.getFileIcon(filePath).then((iconData) => {
      if (mounted && iconData) {
        setNativeIcon(iconData);
      }
    });

    return () => {
      mounted = false;
    };
  }, [result.data.path, result.category]);

  const handleAction = async (actionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await window.api.executeAction(result, actionId);
  };

  const categoryBadge = getCategoryBadge(result.category);

  // For file results, show file metadata
  const size = result.data.size as number | undefined;
  const modifiedDate = result.data.modifiedDate as string | undefined;

  return (
    <div
      className={`result-item ${isSelected ? 'selected' : ''}`}
      data-index={index}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="result-icon">
        {nativeIcon ? (
          <img src={nativeIcon} alt="" width={32} height={32} />
        ) : (
          <span className="result-emoji-icon">{result.icon}</span>
        )}
      </div>
      <div className="result-info">
        <div className="result-name">
          {result.name}
          {categoryBadge && (
            <span className="result-category-badge">{categoryBadge}</span>
          )}
        </div>
        <div className="result-path">{truncatePath(result.subtitle)}</div>
      </div>
      <div className="result-meta">
        {size !== undefined && (
          <span className="result-size">{formatFileSize(size)}</span>
        )}
        {modifiedDate && (
          <span className="result-date">{formatDate(modifiedDate)}</span>
        )}
      </div>
      {isSelected && result.actions.length > 0 && (
        <div className="result-actions">
          {result.actions.slice(0, 3).map((action) => (
            <button
              key={action.id}
              className="action-button"
              onClick={(e) => handleAction(action.id, e)}
              title={action.shortcut ? `${action.name} (${action.shortcut})` : action.name}
            >
              {action.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
