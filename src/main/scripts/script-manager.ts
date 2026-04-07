import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync } from 'fs';
import { exec } from 'child_process';

export interface ScriptCommand {
  title: string;
  keyword: string;
  icon: string;
  argument?: string; // "optional" | "required" | undefined
  output: string; // "clipboard" | "notification" | "list" | "inline"
  filePath: string;
  interpreter: string;
}

const SCRIPTS_DIR = join(homedir(), '.spotsearch', 'scripts');

// Ensure scripts directory exists
function ensureScriptsDir(): void {
  if (!existsSync(SCRIPTS_DIR)) {
    mkdirSync(SCRIPTS_DIR, { recursive: true });
  }
}

const INTERPRETERS: Record<string, string> = {
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'zsh',
  '.py': 'python3',
  '.js': 'node',
  '.ts': 'npx ts-node',
  '.swift': 'swift',
  '.applescript': 'osascript',
  '.scpt': 'osascript',
  '.rb': 'ruby',
};

function parseScriptHeader(content: string): Partial<ScriptCommand> {
  const result: Partial<ScriptCommand> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    // Stop parsing when we hit a non-comment line (after shebang)
    if (!line.startsWith('#') && !line.startsWith('//') && line.trim().length > 0) break;

    const match = line.match(/@spotsearch\.(\w+)\s+(.+)/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();

      switch (key) {
        case 'title': result.title = value; break;
        case 'keyword': result.keyword = value; break;
        case 'icon': result.icon = value; break;
        case 'argument': result.argument = value; break;
        case 'output': result.output = value; break;
      }
    }
  }

  return result;
}

export async function loadScripts(): Promise<ScriptCommand[]> {
  ensureScriptsDir();

  try {
    const files = await readdir(SCRIPTS_DIR);
    const scripts: ScriptCommand[] = [];

    for (const file of files) {
      const ext = extname(file);
      const interpreter = INTERPRETERS[ext];
      if (!interpreter) continue;

      const filePath = join(SCRIPTS_DIR, file);
      try {
        const content = await readFile(filePath, 'utf-8');
        const parsed = parseScriptHeader(content);

        if (parsed.title) {
          scripts.push({
            title: parsed.title,
            keyword: parsed.keyword || file.replace(ext, ''),
            icon: parsed.icon || '📜',
            argument: parsed.argument,
            output: parsed.output || 'inline',
            filePath,
            interpreter,
          });
        }
      } catch {
        // Skip files we can't read
      }
    }

    return scripts;
  } catch {
    return [];
  }
}

export function executeScript(
  script: ScriptCommand,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const command = `${script.interpreter} "${script.filePath}" ${args.map((a) => `"${a}"`).join(' ')}`;

    exec(command, { timeout: 30000, cwd: homedir() }, (err, stdout, stderr) => {
      if (err && !stdout) {
        reject(err);
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });
  });
}
