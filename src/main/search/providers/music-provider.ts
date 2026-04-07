import { exec } from 'child_process';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction } from '../../../shared/types';

interface MusicCommand {
  id: string;
  name: string;
  description: string;
  icon: string;
  keywords: string[];
  script: string;
}

const MUSIC_COMMANDS: MusicCommand[] = [
  {
    id: 'play-pause',
    name: 'Play / Pause',
    description: 'Toggle music playback',
    icon: '⏯️',
    keywords: ['play', 'pause', 'music', 'toggle'],
    script: 'tell application "Music" to playpause',
  },
  {
    id: 'next',
    name: 'Next Track',
    description: 'Skip to next track',
    icon: '⏭️',
    keywords: ['next', 'skip', 'forward'],
    script: 'tell application "Music" to next track',
  },
  {
    id: 'previous',
    name: 'Previous Track',
    description: 'Go to previous track',
    icon: '⏮️',
    keywords: ['previous', 'prev', 'back'],
    script: 'tell application "Music" to previous track',
  },
  {
    id: 'now-playing',
    name: 'Now Playing',
    description: 'Show current track info',
    icon: '🎵',
    keywords: ['now playing', 'current', 'what song', 'playing'],
    script: 'tell application "Music" to get name of current track & " - " & artist of current track',
  },
  {
    id: 'volume-up-music',
    name: 'Music Volume Up',
    description: 'Increase music volume',
    icon: '🔊',
    keywords: ['music volume up', 'louder music'],
    script: 'tell application "Music" to set sound volume to (sound volume + 10)',
  },
  {
    id: 'volume-down-music',
    name: 'Music Volume Down',
    description: 'Decrease music volume',
    icon: '🔉',
    keywords: ['music volume down', 'quieter music'],
    script: 'tell application "Music" to set sound volume to (sound volume - 10)',
  },
];

// Also support Spotify
const SPOTIFY_COMMANDS: MusicCommand[] = [
  {
    id: 'spotify-play-pause',
    name: 'Spotify Play / Pause',
    description: 'Toggle Spotify playback',
    icon: '🎧',
    keywords: ['spotify play', 'spotify pause', 'spotify'],
    script: 'tell application "Spotify" to playpause',
  },
  {
    id: 'spotify-next',
    name: 'Spotify Next',
    description: 'Skip to next Spotify track',
    icon: '⏭️',
    keywords: ['spotify next', 'spotify skip'],
    script: 'tell application "Spotify" to next track',
  },
  {
    id: 'spotify-previous',
    name: 'Spotify Previous',
    description: 'Go to previous Spotify track',
    icon: '⏮️',
    keywords: ['spotify previous', 'spotify prev'],
    script: 'tell application "Spotify" to previous track',
  },
  {
    id: 'spotify-now-playing',
    name: 'Spotify Now Playing',
    description: 'Show current Spotify track',
    icon: '🎧',
    keywords: ['spotify now playing', 'spotify current'],
    script: 'tell application "Spotify" to get name of current track & " - " & artist of current track',
  },
];

const ALL_COMMANDS = [...MUSIC_COMMANDS, ...SPOTIFY_COMMANDS];

export class MusicProvider implements SearchProvider {
  id = 'music';
  name = 'Music Control';
  priority = 30;

  canHandle(query: string): boolean {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return false;
    return ALL_COMMANDS.some((cmd) =>
      cmd.name.toLowerCase().includes(q) ||
      cmd.keywords.some((kw) => kw.includes(q))
    );
  }

  async search(query: string): Promise<UnifiedResult[]> {
    const q = query.trim().toLowerCase();
    const results: UnifiedResult[] = [];

    for (const cmd of ALL_COMMANDS) {
      let score = 0;
      const nameLower = cmd.name.toLowerCase();

      if (nameLower === q) score = 1000;
      else if (nameLower.startsWith(q)) score = 800;
      else if (nameLower.includes(q)) score = 600;
      else {
        for (const kw of cmd.keywords) {
          if (kw === q) { score = 900; break; }
          if (kw.startsWith(q)) { score = Math.max(score, 700); }
          if (kw.includes(q)) { score = Math.max(score, 400); }
        }
      }

      if (score > 0) {
        results.push({
          id: `music-${cmd.id}`,
          name: cmd.name,
          subtitle: cmd.description,
          icon: cmd.icon,
          category: 'music',
          score,
          actions: [
            { id: 'execute', name: cmd.id.includes('now-playing') ? 'Show' : 'Execute', shortcut: 'Enter', isDefault: true },
          ],
          data: {
            _providerId: this.id,
            commandId: cmd.id,
            script: cmd.script,
          },
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 5);
  }

  getActions(result: UnifiedResult): ResultAction[] {
    if (result.category !== 'music') return [];
    return [{ id: 'execute', name: 'Execute', shortcut: 'Enter', isDefault: true }];
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    if (actionId !== 'execute') return;

    const script = result.data.script as string;
    if (!script) return;

    return new Promise((resolve, reject) => {
      exec(`osascript -e '${script}'`, { timeout: 5000 }, (err) => {
        if (err) {
          // App might not be running - that's ok
          console.error(`Music command error:`, err.message);
          resolve();
        } else {
          resolve();
        }
      });
    });
  }
}
