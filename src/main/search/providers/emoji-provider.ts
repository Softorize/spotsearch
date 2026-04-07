import { clipboard } from 'electron';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction } from '../../../shared/types';

// Inline emoji data - top ~300 commonly used emojis with search keywords
// This avoids adding a dependency for a simple feature
const EMOJI_DATA: Array<{ emoji: string; name: string; keywords: string[] }> = [
  // Smileys
  { emoji: '😀', name: 'grinning face', keywords: ['happy', 'smile', 'grin'] },
  { emoji: '😃', name: 'grinning face with big eyes', keywords: ['happy', 'smile'] },
  { emoji: '😄', name: 'grinning face with smiling eyes', keywords: ['happy', 'smile', 'laugh'] },
  { emoji: '😁', name: 'beaming face', keywords: ['happy', 'smile', 'grin'] },
  { emoji: '😂', name: 'face with tears of joy', keywords: ['laugh', 'funny', 'lol', 'crying'] },
  { emoji: '🤣', name: 'rolling on the floor laughing', keywords: ['laugh', 'funny', 'lol', 'rofl'] },
  { emoji: '😊', name: 'smiling face with smiling eyes', keywords: ['happy', 'blush', 'smile'] },
  { emoji: '😇', name: 'smiling face with halo', keywords: ['angel', 'innocent'] },
  { emoji: '🥰', name: 'smiling face with hearts', keywords: ['love', 'hearts', 'adore'] },
  { emoji: '😍', name: 'heart eyes', keywords: ['love', 'crush', 'heart'] },
  { emoji: '🤩', name: 'star struck', keywords: ['star', 'eyes', 'excited'] },
  { emoji: '😘', name: 'face blowing a kiss', keywords: ['kiss', 'love'] },
  { emoji: '😜', name: 'winking face with tongue', keywords: ['wink', 'tongue', 'silly'] },
  { emoji: '😎', name: 'smiling face with sunglasses', keywords: ['cool', 'sunglasses'] },
  { emoji: '🤔', name: 'thinking face', keywords: ['think', 'hmm', 'wonder'] },
  { emoji: '🤗', name: 'hugging face', keywords: ['hug', 'embrace'] },
  { emoji: '😢', name: 'crying face', keywords: ['sad', 'cry', 'tear'] },
  { emoji: '😭', name: 'loudly crying face', keywords: ['cry', 'sad', 'sob', 'wail'] },
  { emoji: '😡', name: 'pouting face', keywords: ['angry', 'mad', 'rage'] },
  { emoji: '🤯', name: 'exploding head', keywords: ['mind blown', 'shocked'] },
  { emoji: '😱', name: 'face screaming in fear', keywords: ['scared', 'scream', 'shock'] },
  { emoji: '🥳', name: 'partying face', keywords: ['party', 'celebrate', 'birthday'] },
  { emoji: '😴', name: 'sleeping face', keywords: ['sleep', 'tired', 'zzz'] },
  { emoji: '🤮', name: 'face vomiting', keywords: ['sick', 'vomit', 'gross'] },
  { emoji: '🤧', name: 'sneezing face', keywords: ['sick', 'sneeze', 'cold'] },
  { emoji: '😷', name: 'face with medical mask', keywords: ['sick', 'mask', 'covid'] },
  { emoji: '🤓', name: 'nerd face', keywords: ['nerd', 'geek', 'glasses'] },
  { emoji: '🙄', name: 'face with rolling eyes', keywords: ['eye roll', 'whatever'] },
  { emoji: '😏', name: 'smirking face', keywords: ['smirk', 'sly'] },
  { emoji: '😬', name: 'grimacing face', keywords: ['awkward', 'nervous', 'cringe'] },
  // Hands
  { emoji: '👍', name: 'thumbs up', keywords: ['like', 'yes', 'approve', 'ok', 'good'] },
  { emoji: '👎', name: 'thumbs down', keywords: ['dislike', 'no', 'bad'] },
  { emoji: '👋', name: 'waving hand', keywords: ['wave', 'hello', 'hi', 'bye'] },
  { emoji: '👏', name: 'clapping hands', keywords: ['clap', 'applause', 'bravo'] },
  { emoji: '🙏', name: 'folded hands', keywords: ['pray', 'please', 'thank', 'hope'] },
  { emoji: '🤝', name: 'handshake', keywords: ['deal', 'agree', 'shake'] },
  { emoji: '✌️', name: 'victory hand', keywords: ['peace', 'victory', 'v'] },
  { emoji: '🤞', name: 'crossed fingers', keywords: ['luck', 'hope', 'fingers crossed'] },
  { emoji: '💪', name: 'flexed biceps', keywords: ['strong', 'muscle', 'flex', 'power'] },
  { emoji: '🖐️', name: 'hand with fingers splayed', keywords: ['hand', 'five', 'stop'] },
  { emoji: '☝️', name: 'index pointing up', keywords: ['point', 'up', 'one'] },
  { emoji: '🫡', name: 'saluting face', keywords: ['salute', 'respect', 'yes sir'] },
  // Hearts
  { emoji: '❤️', name: 'red heart', keywords: ['love', 'heart', 'red'] },
  { emoji: '🧡', name: 'orange heart', keywords: ['heart', 'orange'] },
  { emoji: '💛', name: 'yellow heart', keywords: ['heart', 'yellow'] },
  { emoji: '💚', name: 'green heart', keywords: ['heart', 'green'] },
  { emoji: '💙', name: 'blue heart', keywords: ['heart', 'blue'] },
  { emoji: '💜', name: 'purple heart', keywords: ['heart', 'purple'] },
  { emoji: '🖤', name: 'black heart', keywords: ['heart', 'black'] },
  { emoji: '🤍', name: 'white heart', keywords: ['heart', 'white'] },
  { emoji: '💔', name: 'broken heart', keywords: ['heart', 'broken', 'sad'] },
  { emoji: '💖', name: 'sparkling heart', keywords: ['heart', 'sparkle', 'love'] },
  // Animals
  { emoji: '🐶', name: 'dog face', keywords: ['dog', 'puppy', 'pet'] },
  { emoji: '🐱', name: 'cat face', keywords: ['cat', 'kitten', 'pet'] },
  { emoji: '🐻', name: 'bear', keywords: ['bear', 'teddy'] },
  { emoji: '🦊', name: 'fox', keywords: ['fox'] },
  { emoji: '🐵', name: 'monkey face', keywords: ['monkey', 'ape'] },
  { emoji: '🦄', name: 'unicorn', keywords: ['unicorn', 'magic'] },
  { emoji: '🐝', name: 'honeybee', keywords: ['bee', 'honey', 'buzz'] },
  { emoji: '🦋', name: 'butterfly', keywords: ['butterfly', 'insect'] },
  { emoji: '🐍', name: 'snake', keywords: ['snake', 'python'] },
  { emoji: '🐢', name: 'turtle', keywords: ['turtle', 'slow'] },
  // Nature
  { emoji: '🌸', name: 'cherry blossom', keywords: ['flower', 'spring', 'sakura'] },
  { emoji: '🌹', name: 'rose', keywords: ['flower', 'rose', 'love'] },
  { emoji: '🌻', name: 'sunflower', keywords: ['flower', 'sun'] },
  { emoji: '🌈', name: 'rainbow', keywords: ['rainbow', 'color'] },
  { emoji: '⭐', name: 'star', keywords: ['star', 'favorite'] },
  { emoji: '🌙', name: 'crescent moon', keywords: ['moon', 'night'] },
  { emoji: '☀️', name: 'sun', keywords: ['sun', 'sunny', 'bright'] },
  { emoji: '🔥', name: 'fire', keywords: ['fire', 'hot', 'lit', 'flame'] },
  { emoji: '💧', name: 'droplet', keywords: ['water', 'drop', 'tear'] },
  { emoji: '⚡', name: 'high voltage', keywords: ['lightning', 'electric', 'zap', 'power'] },
  // Food
  { emoji: '🍕', name: 'pizza', keywords: ['pizza', 'food'] },
  { emoji: '🍔', name: 'hamburger', keywords: ['burger', 'food', 'fast food'] },
  { emoji: '🍟', name: 'french fries', keywords: ['fries', 'food', 'fast food'] },
  { emoji: '🌮', name: 'taco', keywords: ['taco', 'food', 'mexican'] },
  { emoji: '🍣', name: 'sushi', keywords: ['sushi', 'food', 'japanese'] },
  { emoji: '🍺', name: 'beer mug', keywords: ['beer', 'drink', 'alcohol'] },
  { emoji: '☕', name: 'hot beverage', keywords: ['coffee', 'tea', 'hot', 'drink'] },
  { emoji: '🍷', name: 'wine glass', keywords: ['wine', 'drink', 'alcohol'] },
  { emoji: '🎂', name: 'birthday cake', keywords: ['cake', 'birthday', 'celebrate'] },
  { emoji: '🍎', name: 'red apple', keywords: ['apple', 'fruit'] },
  // Objects
  { emoji: '💻', name: 'laptop', keywords: ['computer', 'laptop', 'code', 'dev'] },
  { emoji: '📱', name: 'mobile phone', keywords: ['phone', 'mobile', 'cell'] },
  { emoji: '⌨️', name: 'keyboard', keywords: ['keyboard', 'type'] },
  { emoji: '🖥️', name: 'desktop computer', keywords: ['computer', 'desktop', 'monitor'] },
  { emoji: '📧', name: 'email', keywords: ['email', 'mail', 'envelope'] },
  { emoji: '📝', name: 'memo', keywords: ['note', 'write', 'memo'] },
  { emoji: '📎', name: 'paperclip', keywords: ['clip', 'attach'] },
  { emoji: '🔑', name: 'key', keywords: ['key', 'lock', 'password'] },
  { emoji: '🔒', name: 'locked', keywords: ['lock', 'secure', 'password'] },
  { emoji: '💡', name: 'light bulb', keywords: ['idea', 'light', 'bulb'] },
  { emoji: '🔔', name: 'bell', keywords: ['bell', 'notification', 'alert'] },
  { emoji: '📌', name: 'pushpin', keywords: ['pin', 'location'] },
  { emoji: '🗂️', name: 'card index dividers', keywords: ['folder', 'file', 'organize'] },
  { emoji: '📁', name: 'file folder', keywords: ['folder', 'directory'] },
  { emoji: '📂', name: 'open file folder', keywords: ['folder', 'open', 'directory'] },
  // Symbols
  { emoji: '✅', name: 'check mark', keywords: ['check', 'done', 'yes', 'complete', 'ok'] },
  { emoji: '❌', name: 'cross mark', keywords: ['no', 'wrong', 'cancel', 'delete', 'x'] },
  { emoji: '⚠️', name: 'warning', keywords: ['warning', 'caution', 'alert'] },
  { emoji: '❓', name: 'question mark', keywords: ['question', 'help'] },
  { emoji: '❗', name: 'exclamation mark', keywords: ['exclamation', 'important', 'alert'] },
  { emoji: '💯', name: 'hundred points', keywords: ['100', 'perfect', 'score'] },
  { emoji: '🎯', name: 'bullseye', keywords: ['target', 'goal', 'aim', 'dart'] },
  { emoji: '🚀', name: 'rocket', keywords: ['rocket', 'launch', 'fast', 'ship'] },
  { emoji: '✨', name: 'sparkles', keywords: ['sparkle', 'magic', 'new', 'clean'] },
  { emoji: '🎉', name: 'party popper', keywords: ['party', 'celebrate', 'congratulations'] },
  { emoji: '🏆', name: 'trophy', keywords: ['trophy', 'win', 'award', 'champion'] },
  { emoji: '🎵', name: 'musical note', keywords: ['music', 'note', 'song'] },
  { emoji: '🎶', name: 'musical notes', keywords: ['music', 'notes', 'song'] },
  { emoji: '💰', name: 'money bag', keywords: ['money', 'dollar', 'rich'] },
  { emoji: '💎', name: 'gem stone', keywords: ['diamond', 'gem', 'precious'] },
  { emoji: '🏠', name: 'house', keywords: ['home', 'house'] },
  { emoji: '🏢', name: 'office building', keywords: ['office', 'building', 'work'] },
  // Arrows & misc
  { emoji: '➡️', name: 'right arrow', keywords: ['arrow', 'right', 'next'] },
  { emoji: '⬅️', name: 'left arrow', keywords: ['arrow', 'left', 'back'] },
  { emoji: '⬆️', name: 'up arrow', keywords: ['arrow', 'up'] },
  { emoji: '⬇️', name: 'down arrow', keywords: ['arrow', 'down'] },
  { emoji: '🔄', name: 'counterclockwise arrows', keywords: ['refresh', 'reload', 'sync', 'update'] },
  { emoji: '➕', name: 'plus', keywords: ['plus', 'add', 'new'] },
  { emoji: '➖', name: 'minus', keywords: ['minus', 'subtract', 'remove'] },
  { emoji: '✏️', name: 'pencil', keywords: ['edit', 'write', 'pencil'] },
  { emoji: '🗑️', name: 'wastebasket', keywords: ['trash', 'delete', 'bin', 'garbage'] },
  { emoji: '📋', name: 'clipboard', keywords: ['clipboard', 'paste', 'copy'] },
  { emoji: '🔗', name: 'link', keywords: ['link', 'url', 'chain'] },
  { emoji: '📊', name: 'bar chart', keywords: ['chart', 'graph', 'stats', 'analytics'] },
  { emoji: '📈', name: 'chart increasing', keywords: ['chart', 'up', 'growth', 'increase'] },
  { emoji: '📉', name: 'chart decreasing', keywords: ['chart', 'down', 'decrease'] },
  { emoji: '⏰', name: 'alarm clock', keywords: ['clock', 'alarm', 'time'] },
  { emoji: '📅', name: 'calendar', keywords: ['calendar', 'date', 'schedule'] },
  { emoji: '🗓️', name: 'spiral calendar', keywords: ['calendar', 'planner'] },
  // People
  { emoji: '👤', name: 'bust in silhouette', keywords: ['person', 'user', 'profile'] },
  { emoji: '👥', name: 'busts in silhouette', keywords: ['people', 'users', 'group', 'team'] },
  { emoji: '🧑‍💻', name: 'technologist', keywords: ['developer', 'programmer', 'coder', 'tech'] },
  { emoji: '👨‍💼', name: 'man office worker', keywords: ['business', 'office', 'work'] },
  { emoji: '🧑‍🎓', name: 'student', keywords: ['student', 'graduate', 'school'] },
  // Transport
  { emoji: '🚗', name: 'automobile', keywords: ['car', 'drive', 'vehicle'] },
  { emoji: '✈️', name: 'airplane', keywords: ['plane', 'fly', 'travel', 'flight'] },
  { emoji: '🚂', name: 'locomotive', keywords: ['train'] },
  // Flags
  { emoji: '🏁', name: 'chequered flag', keywords: ['flag', 'finish', 'race'] },
  { emoji: '🚩', name: 'triangular flag', keywords: ['flag', 'red flag', 'warning'] },
];

const EMOJI_PREFIX = ':';
const EMOJI_KEYWORD = 'emoji ';

export class EmojiProvider implements SearchProvider {
  id = 'emoji';
  name = 'Emoji Picker';
  priority = 25;

  canHandle(query: string): boolean {
    const q = query.trim();
    return q.startsWith(EMOJI_PREFIX) || q.toLowerCase().startsWith(EMOJI_KEYWORD);
  }

  async search(query: string): Promise<UnifiedResult[]> {
    let q = query.trim();
    if (q.startsWith(EMOJI_PREFIX)) {
      q = q.slice(1).trim();
    } else if (q.toLowerCase().startsWith(EMOJI_KEYWORD)) {
      q = q.slice(EMOJI_KEYWORD.length).trim();
    }

    if (q.length === 0) {
      // Show popular emojis
      return EMOJI_DATA.slice(0, 20).map((e, i) => this.toResult(e, 100 - i));
    }

    const qLower = q.toLowerCase();
    const results: Array<{ emoji: typeof EMOJI_DATA[0]; score: number }> = [];

    for (const entry of EMOJI_DATA) {
      let score = 0;
      const nameLower = entry.name.toLowerCase();

      if (nameLower === qLower) score = 1000;
      else if (nameLower.startsWith(qLower)) score = 800;
      else if (nameLower.includes(qLower)) score = 600;
      else {
        for (const kw of entry.keywords) {
          if (kw === qLower) { score = Math.max(score, 700); break; }
          if (kw.startsWith(qLower)) { score = Math.max(score, 500); }
          if (kw.includes(qLower)) { score = Math.max(score, 300); }
        }
      }

      if (score > 0) {
        results.push({ emoji: entry, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 20).map((r) => this.toResult(r.emoji, r.score));
  }

  private toResult(entry: typeof EMOJI_DATA[0], score: number): UnifiedResult {
    return {
      id: `emoji-${entry.emoji}`,
      name: `${entry.emoji}  ${entry.name}`,
      subtitle: entry.keywords.join(', '),
      icon: entry.emoji,
      category: 'emoji',
      score,
      actions: [
        { id: 'copy', name: 'Copy', shortcut: 'Enter', isDefault: true },
      ],
      data: {
        _providerId: this.id,
        emoji: entry.emoji,
        name: entry.name,
      },
    };
  }

  getActions(result: UnifiedResult): ResultAction[] {
    if (result.category !== 'emoji') return [];
    return [{ id: 'copy', name: 'Copy', shortcut: 'Enter', isDefault: true }];
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    if (actionId === 'copy') {
      const emoji = result.data.emoji as string;
      if (emoji) clipboard.writeText(emoji);
    }
  }
}
