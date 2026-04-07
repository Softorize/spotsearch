// Shell-escape a string for safe use in shell commands
export function shellEscape(str: string): string {
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

// Escape for AppleScript string literals (double-quoted)
export function appleScriptEscape(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}
