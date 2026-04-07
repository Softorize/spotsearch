import { exec } from 'child_process';
import { screen, systemPreferences } from 'electron';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction } from '../../../shared/types';

interface WindowCommand {
  id: string;
  name: string;
  description: string;
  icon: string;
  keywords: string[];
  getScript: (workArea: Electron.Rectangle) => string;
}

function makeWindowScript(x: number, y: number, w: number, h: number): string {
  return `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  tell frontApp
    set position of window 1 to {${x}, ${y}}
    set size of window 1 to {${w}, ${h}}
  end tell
end tell
`;
}

function getWindowCommands(): WindowCommand[] {
  return [
    {
      id: 'left-half',
      name: 'Left Half',
      description: 'Move window to left half of screen',
      icon: '◀️',
      keywords: ['left', 'half', 'left half', 'window left'],
      getScript: (wa) => makeWindowScript(wa.x, wa.y, Math.floor(wa.width / 2), wa.height),
    },
    {
      id: 'right-half',
      name: 'Right Half',
      description: 'Move window to right half of screen',
      icon: '▶️',
      keywords: ['right', 'half', 'right half', 'window right'],
      getScript: (wa) => makeWindowScript(wa.x + Math.floor(wa.width / 2), wa.y, Math.floor(wa.width / 2), wa.height),
    },
    {
      id: 'top-half',
      name: 'Top Half',
      description: 'Move window to top half of screen',
      icon: '🔼',
      keywords: ['top', 'half', 'top half', 'window top'],
      getScript: (wa) => makeWindowScript(wa.x, wa.y, wa.width, Math.floor(wa.height / 2)),
    },
    {
      id: 'bottom-half',
      name: 'Bottom Half',
      description: 'Move window to bottom half of screen',
      icon: '🔽',
      keywords: ['bottom', 'half', 'bottom half', 'window bottom'],
      getScript: (wa) => makeWindowScript(wa.x, wa.y + Math.floor(wa.height / 2), wa.width, Math.floor(wa.height / 2)),
    },
    {
      id: 'maximize',
      name: 'Maximize',
      description: 'Maximize window to fill screen',
      icon: '⬜',
      keywords: ['maximize', 'full', 'fullscreen', 'max', 'fill'],
      getScript: (wa) => makeWindowScript(wa.x, wa.y, wa.width, wa.height),
    },
    {
      id: 'center',
      name: 'Center',
      description: 'Center window on screen',
      icon: '🎯',
      keywords: ['center', 'middle'],
      getScript: (wa) => {
        const w = Math.floor(wa.width * 0.6);
        const h = Math.floor(wa.height * 0.7);
        const x = wa.x + Math.floor((wa.width - w) / 2);
        const y = wa.y + Math.floor((wa.height - h) / 2);
        return makeWindowScript(x, y, w, h);
      },
    },
    {
      id: 'top-left',
      name: 'Top Left Quarter',
      description: 'Move window to top-left quarter',
      icon: '◰',
      keywords: ['top left', 'quarter', 'top-left', 'corner'],
      getScript: (wa) => makeWindowScript(wa.x, wa.y, Math.floor(wa.width / 2), Math.floor(wa.height / 2)),
    },
    {
      id: 'top-right',
      name: 'Top Right Quarter',
      description: 'Move window to top-right quarter',
      icon: '◳',
      keywords: ['top right', 'quarter', 'top-right', 'corner'],
      getScript: (wa) => makeWindowScript(wa.x + Math.floor(wa.width / 2), wa.y, Math.floor(wa.width / 2), Math.floor(wa.height / 2)),
    },
    {
      id: 'bottom-left',
      name: 'Bottom Left Quarter',
      description: 'Move window to bottom-left quarter',
      icon: '◱',
      keywords: ['bottom left', 'quarter', 'bottom-left', 'corner'],
      getScript: (wa) => makeWindowScript(wa.x, wa.y + Math.floor(wa.height / 2), Math.floor(wa.width / 2), Math.floor(wa.height / 2)),
    },
    {
      id: 'bottom-right',
      name: 'Bottom Right Quarter',
      description: 'Move window to bottom-right quarter',
      icon: '◲',
      keywords: ['bottom right', 'quarter', 'bottom-right', 'corner'],
      getScript: (wa) => makeWindowScript(wa.x + Math.floor(wa.width / 2), wa.y + Math.floor(wa.height / 2), Math.floor(wa.width / 2), Math.floor(wa.height / 2)),
    },
    {
      id: 'left-third',
      name: 'Left Third',
      description: 'Move window to left third of screen',
      icon: '⫷',
      keywords: ['left third', 'third'],
      getScript: (wa) => makeWindowScript(wa.x, wa.y, Math.floor(wa.width / 3), wa.height),
    },
    {
      id: 'center-third',
      name: 'Center Third',
      description: 'Move window to center third of screen',
      icon: '⊡',
      keywords: ['center third', 'middle third', 'third'],
      getScript: (wa) => makeWindowScript(wa.x + Math.floor(wa.width / 3), wa.y, Math.floor(wa.width / 3), wa.height),
    },
    {
      id: 'right-third',
      name: 'Right Third',
      description: 'Move window to right third of screen',
      icon: '⫸',
      keywords: ['right third', 'third'],
      getScript: (wa) => makeWindowScript(wa.x + Math.floor(wa.width * 2 / 3), wa.y, Math.floor(wa.width / 3), wa.height),
    },
  ];
}

export class WindowProvider implements SearchProvider {
  id = 'window-management';
  name = 'Window Management';
  priority = 25;

  canHandle(query: string): boolean {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return false;

    const commands = getWindowCommands();
    return commands.some((cmd) =>
      cmd.name.toLowerCase().includes(q) ||
      cmd.keywords.some((kw) => kw.includes(q))
    ) || q.startsWith('window ');
  }

  async search(query: string): Promise<UnifiedResult[]> {
    const q = query.trim().toLowerCase().replace(/^window\s+/, '');
    const commands = getWindowCommands();
    const results: UnifiedResult[] = [];

    for (const cmd of commands) {
      const nameLower = cmd.name.toLowerCase();
      let score = 0;

      if (nameLower === q) score = 1000;
      else if (nameLower.startsWith(q)) score = 800;
      else if (nameLower.includes(q)) score = 600;

      if (score === 0) {
        for (const kw of cmd.keywords) {
          if (kw === q) { score = 900; break; }
          if (kw.startsWith(q)) { score = Math.max(score, 700); }
          if (kw.includes(q)) { score = Math.max(score, 400); }
        }
      }

      if (score > 0) {
        const hasAccess = systemPreferences.isTrustedAccessibilityClient(false);
        const subtitle = hasAccess
          ? cmd.description
          : cmd.description + ' (requires Accessibility permission)';

        results.push({
          id: `win-${cmd.id}`,
          name: cmd.name,
          subtitle,
          icon: cmd.icon,
          category: 'window-management',
          score,
          actions: [{ id: 'execute', name: 'Apply', shortcut: 'Enter', isDefault: true }],
          data: {
            _providerId: this.id,
            commandId: cmd.id,
          },
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 8);
  }

  getActions(result: UnifiedResult): ResultAction[] {
    if (result.category !== 'window-management') return [];
    return [{ id: 'execute', name: 'Apply', shortcut: 'Enter', isDefault: true }];
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    if (actionId !== 'execute') return;

    // Check accessibility permission
    const hasAccess = systemPreferences.isTrustedAccessibilityClient(true);
    if (!hasAccess) return;

    const commandId = result.data.commandId as string;
    const commands = getWindowCommands();
    const cmd = commands.find((c) => c.id === commandId);
    if (!cmd) return;

    const primaryDisplay = screen.getPrimaryDisplay();
    const workArea = primaryDisplay.workArea;

    const script = cmd.getScript(workArea);

    return new Promise((resolve, reject) => {
      exec(`osascript -e '${script.replace(/'/g, "'\\''").replace(/\n/g, "' -e '")}'`,
        { timeout: 5000 },
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}
