import { exec } from 'child_process';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction } from '../../../shared/types';
import { scoreFuzzyMatch } from '../../../shared/scoring';

interface SystemCommand {
  id: string;
  name: string;
  description: string;
  icon: string;
  keywords: string[];
  command: string;
  requiresConfirmation: boolean;
}

const SYSTEM_COMMANDS: SystemCommand[] = [
  {
    id: 'sleep',
    name: 'Sleep',
    description: 'Put your Mac to sleep',
    icon: '😴',
    keywords: ['sleep', 'suspend', 'nap'],
    command: 'osascript -e \'tell application "System Events" to sleep\'',
    requiresConfirmation: false,
  },
  {
    id: 'lock',
    name: 'Lock Screen',
    description: 'Lock the screen',
    icon: '🔒',
    keywords: ['lock', 'screen', 'lock screen'],
    command: 'pmset displaysleepnow',
    requiresConfirmation: false,
  },
  {
    id: 'restart',
    name: 'Restart',
    description: 'Restart your Mac',
    icon: '🔄',
    keywords: ['restart', 'reboot'],
    command: 'osascript -e \'tell application "System Events" to restart\'',
    requiresConfirmation: true,
  },
  {
    id: 'shutdown',
    name: 'Shut Down',
    description: 'Shut down your Mac',
    icon: '⏻',
    keywords: ['shutdown', 'shut down', 'power off', 'turn off'],
    command: 'osascript -e \'tell application "System Events" to shut down\'',
    requiresConfirmation: true,
  },
  {
    id: 'logout',
    name: 'Log Out',
    description: 'Log out of your account',
    icon: '🚪',
    keywords: ['logout', 'log out', 'sign out'],
    command: 'osascript -e \'tell application "System Events" to log out\'',
    requiresConfirmation: true,
  },
  {
    id: 'empty-trash',
    name: 'Empty Trash',
    description: 'Empty the trash',
    icon: '🗑️',
    keywords: ['empty trash', 'trash', 'clean trash', 'delete trash'],
    command: 'osascript -e \'tell application "Finder" to empty the trash\'',
    requiresConfirmation: true,
  },
  {
    id: 'toggle-dark-mode',
    name: 'Toggle Dark Mode',
    description: 'Switch between light and dark mode',
    icon: '🌓',
    keywords: ['dark mode', 'light mode', 'toggle dark', 'appearance', 'theme'],
    command: 'osascript -e \'tell app "System Events" to tell appearance preferences to set dark mode to not dark mode\'',
    requiresConfirmation: false,
  },
  {
    id: 'screensaver',
    name: 'Start Screen Saver',
    description: 'Activate screen saver',
    icon: '🖥️',
    keywords: ['screensaver', 'screen saver'],
    command: 'open -a ScreenSaverEngine',
    requiresConfirmation: false,
  },
  {
    id: 'eject-all',
    name: 'Eject All Disks',
    description: 'Eject all mounted external disks',
    icon: '⏏️',
    keywords: ['eject', 'eject all', 'unmount', 'disk'],
    command: 'osascript -e \'tell application "Finder" to eject (every disk whose ejectable is true)\'',
    requiresConfirmation: false,
  },
  {
    id: 'toggle-hidden',
    name: 'Toggle Hidden Files',
    description: 'Show or hide hidden files in Finder',
    icon: '👁️',
    keywords: ['hidden files', 'show hidden', 'hide files', 'dotfiles'],
    command: 'osascript -e \'do shell script "defaults read com.apple.finder AppleShowAllFiles"\' 2>/dev/null | grep -q "1" && defaults write com.apple.finder AppleShowAllFiles -bool false || defaults write com.apple.finder AppleShowAllFiles -bool true; killall Finder',
    requiresConfirmation: false,
  },
  {
    id: 'mute',
    name: 'Toggle Mute',
    description: 'Mute or unmute system volume',
    icon: '🔇',
    keywords: ['mute', 'unmute', 'sound', 'volume mute'],
    command: 'osascript -e \'set curVolume to output muted of (get volume settings)\' -e \'if curVolume then\' -e \'set volume without output muted\' -e \'else\' -e \'set volume with output muted\' -e \'end if\'',
    requiresConfirmation: false,
  },
  {
    id: 'volume-up',
    name: 'Volume Up',
    description: 'Increase system volume',
    icon: '🔊',
    keywords: ['volume up', 'louder', 'increase volume'],
    command: 'osascript -e \'set volume output volume ((output volume of (get volume settings)) + 10)\'',
    requiresConfirmation: false,
  },
  {
    id: 'volume-down',
    name: 'Volume Down',
    description: 'Decrease system volume',
    icon: '🔉',
    keywords: ['volume down', 'quieter', 'decrease volume'],
    command: 'osascript -e \'set volume output volume ((output volume of (get volume settings)) - 10)\'',
    requiresConfirmation: false,
  },
  {
    id: 'quit-all',
    name: 'Quit All Apps',
    description: 'Quit all running applications',
    icon: '❌',
    keywords: ['quit all', 'close all', 'kill all apps'],
    command: 'osascript -e \'tell application "System Events" to set theProcesses to every application process whose visible is true and name is not "Finder" and name is not "SpotSearch"\' -e \'repeat with proc in theProcesses\' -e \'tell proc to quit\' -e \'end repeat\'',
    requiresConfirmation: true,
  },
  {
    id: 'do-not-disturb',
    name: 'Toggle Do Not Disturb',
    description: 'Toggle Focus / Do Not Disturb mode',
    icon: '🔕',
    keywords: ['do not disturb', 'dnd', 'focus', 'notifications'],
    command: 'shortcuts run "Toggle Focus"',
    requiresConfirmation: false,
  },
];

export class SystemCommandsProvider implements SearchProvider {
  id = 'system-commands';
  name = 'System Commands';
  priority = 20;

  canHandle(query: string): boolean {
    return query.trim().length >= 2;
  }

  async search(query: string): Promise<UnifiedResult[]> {
    const q = query.trim();
    const results: UnifiedResult[] = [];

    for (const cmd of SYSTEM_COMMANDS) {
      const score = scoreFuzzyMatch(q, cmd.name, cmd.keywords);

      if (score > 0) {
        const suffix = cmd.requiresConfirmation ? ' (requires confirmation)' : '';
        results.push({
          id: `syscmd-${cmd.id}`,
          name: cmd.name,
          subtitle: cmd.description + suffix,
          icon: cmd.icon,
          category: 'system-command',
          score,
          actions: [
            { id: 'execute', name: cmd.requiresConfirmation ? 'Confirm & Execute' : 'Execute', shortcut: 'Enter', isDefault: true },
          ],
          data: {
            _providerId: this.id,
            commandId: cmd.id,
            command: cmd.command,
            requiresConfirmation: cmd.requiresConfirmation,
          },
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 5);
  }

  getActions(result: UnifiedResult): ResultAction[] {
    if (result.category !== 'system-command') return [];
    return [
      { id: 'execute', name: 'Execute', shortcut: 'Enter', isDefault: true },
    ];
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    if (actionId !== 'execute') return;

    const command = result.data.command as string;
    if (!command) return;

    return new Promise((resolve, reject) => {
      exec(command, { timeout: 10000 }, (err) => {
        if (err) {
          console.error(`System command error (${result.data.commandId}):`, err.message);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
