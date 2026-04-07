import { exec } from 'child_process';
import { clipboard, shell } from 'electron';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction } from '../../../shared/types';

function lookupWord(word: string): Promise<string | null> {
  return new Promise((resolve) => {
    // Use Swift to access macOS Dictionary via DCSCopyTextDefinition
    const swiftCode = `
import CoreServices
let word = "${word.replace(/"/g, '\\"')}"
if let definition = DCSCopyTextDefinition(nil, word as CFString, CFRangeMake(0, word.count))?.takeRetainedValue() as String? {
  print(definition)
} else {
  print("")
}
`;
    exec(`swift -e '${swiftCode.replace(/'/g, "'\\''")}'`, { timeout: 3000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(null);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

// Parse prefixes that trigger dictionary lookup
const DICTIONARY_PREFIXES = ['define ', 'meaning of ', 'what is ', 'whatis '];

function getDictionaryWord(query: string): string | null {
  const q = query.trim().toLowerCase();
  for (const prefix of DICTIONARY_PREFIXES) {
    if (q.startsWith(prefix)) {
      const word = query.trim().slice(prefix.length).trim();
      if (word.length > 0 && !word.includes(' ')) {
        return word;
      }
    }
  }
  return null;
}

export class DictionaryProvider implements SearchProvider {
  id = 'dictionary';
  name = 'Dictionary';
  priority = 15;

  canHandle(query: string): boolean {
    return getDictionaryWord(query) !== null;
  }

  async search(query: string): Promise<UnifiedResult[]> {
    const word = getDictionaryWord(query);
    if (!word) return [];

    const definition = await lookupWord(word);
    if (!definition) {
      return [{
        id: `dict-${word}`,
        name: `No definition found for "${word}"`,
        subtitle: 'Try a different word',
        icon: '📖',
        category: 'dictionary',
        score: 1500,
        actions: [],
        data: { _providerId: this.id, word },
      }];
    }

    // Truncate long definitions for display
    const shortDef = definition.length > 200 ? definition.slice(0, 200) + '...' : definition;

    return [{
      id: `dict-${word}`,
      name: word.charAt(0).toUpperCase() + word.slice(1),
      subtitle: shortDef,
      icon: '📖',
      category: 'dictionary',
      score: 1500,
      actions: this.getDefaultActions(),
      data: {
        _providerId: this.id,
        word,
        definition,
      },
    }];
  }

  private getDefaultActions(): ResultAction[] {
    return [
      { id: 'copy', name: 'Copy Definition', shortcut: 'Enter', isDefault: true },
      { id: 'open-dictionary', name: 'Open in Dictionary', shortcut: 'Cmd+Enter' },
    ];
  }

  getActions(result: UnifiedResult): ResultAction[] {
    if (result.category !== 'dictionary') return [];
    return this.getDefaultActions();
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    switch (actionId) {
      case 'copy': {
        const definition = result.data.definition as string;
        if (definition) clipboard.writeText(definition);
        break;
      }
      case 'open-dictionary': {
        const word = result.data.word as string;
        if (word) shell.openExternal(`dict://${encodeURIComponent(word)}`);
        break;
      }
    }
  }
}
