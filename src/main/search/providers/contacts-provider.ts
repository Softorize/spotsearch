import { exec } from 'child_process';
import { clipboard, shell } from 'electron';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction } from '../../../shared/types';

interface Contact {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
}

let contactsCache: Contact[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function fetchContacts(): Promise<Contact[]> {
  return new Promise((resolve) => {
    const now = Date.now();
    if (contactsCache.length > 0 && now - lastFetchTime < CACHE_TTL) {
      resolve(contactsCache);
      return;
    }

    // Use JXA to query Contacts
    const script = `
const app = Application('Contacts');
const people = app.people();
const result = [];
const max = Math.min(people.length, 500);
for (let i = 0; i < max; i++) {
  try {
    const p = people[i];
    const name = p.name();
    const emails = p.emails();
    const phones = p.phones();
    const company = p.organization();
    result.push(JSON.stringify({
      name: name || '',
      email: emails.length > 0 ? emails[0].value() : '',
      phone: phones.length > 0 ? phones[0].value() : '',
      company: company || ''
    }));
  } catch(e) {}
}
result.join('\\n');
`;

    exec(`osascript -l JavaScript -e '${script.replace(/'/g, "'\\''")}'`,
      { timeout: 10000 },
      (err, stdout) => {
        if (err) {
          console.error('Contacts fetch error:', err.message);
          resolve(contactsCache); // return stale cache
          return;
        }

        try {
          const contacts: Contact[] = stdout
            .trim()
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line));

          contactsCache = contacts;
          lastFetchTime = Date.now();
          resolve(contacts);
        } catch {
          resolve(contactsCache);
        }
      }
    );
  });
}

const CONTACT_PREFIX = '@';

export class ContactsProvider implements SearchProvider {
  id = 'contacts';
  name = 'Contacts';
  priority = 40;

  async initialize(): Promise<void> {
    // Pre-fetch contacts in background
    fetchContacts().catch(() => {});
  }

  canHandle(query: string): boolean {
    const q = query.trim();
    return q.startsWith(CONTACT_PREFIX) || q.toLowerCase().startsWith('contact ');
  }

  async search(query: string): Promise<UnifiedResult[]> {
    let q = query.trim();
    if (q.startsWith(CONTACT_PREFIX)) {
      q = q.slice(1).trim();
    } else if (q.toLowerCase().startsWith('contact ')) {
      q = q.slice(8).trim();
    }

    if (q.length === 0) return [];

    const contacts = await fetchContacts();
    const qLower = q.toLowerCase();

    const results: UnifiedResult[] = [];

    for (const contact of contacts) {
      const nameLower = contact.name.toLowerCase();
      let score = 0;

      if (nameLower === qLower) score = 1000;
      else if (nameLower.startsWith(qLower)) score = 800;
      else if (nameLower.includes(qLower)) score = 600;
      else if (contact.email?.toLowerCase().includes(qLower)) score = 400;
      else if (contact.company?.toLowerCase().includes(qLower)) score = 300;

      if (score > 0) {
        const subtitleParts: string[] = [];
        if (contact.email) subtitleParts.push(contact.email);
        if (contact.phone) subtitleParts.push(contact.phone);
        if (contact.company) subtitleParts.push(contact.company);

        results.push({
          id: `contact-${contact.name}-${contact.email || ''}`,
          name: contact.name,
          subtitle: subtitleParts.join(' - ') || 'No details',
          icon: '👤',
          category: 'contact',
          score,
          actions: this.getActionsForContact(contact),
          data: {
            _providerId: this.id,
            ...contact,
          },
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 10);
  }

  private getActionsForContact(contact: Contact): ResultAction[] {
    const actions: ResultAction[] = [];

    if (contact.email) {
      actions.push({ id: 'email', name: 'Send Email', shortcut: 'Enter', isDefault: true });
      actions.push({ id: 'copy-email', name: 'Copy Email' });
    }
    if (contact.phone) {
      actions.push({ id: 'copy-phone', name: 'Copy Phone' });
    }
    actions.push({ id: 'open-contacts', name: 'Open in Contacts', shortcut: 'Cmd+Enter' });

    return actions;
  }

  getActions(result: UnifiedResult): ResultAction[] {
    if (result.category !== 'contact') return [];
    return this.getActionsForContact(result.data as unknown as Contact);
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    switch (actionId) {
      case 'email': {
        const email = result.data.email as string;
        if (email) shell.openExternal(`mailto:${email}`);
        break;
      }
      case 'copy-email': {
        const email = result.data.email as string;
        if (email) clipboard.writeText(email);
        break;
      }
      case 'copy-phone': {
        const phone = result.data.phone as string;
        if (phone) clipboard.writeText(phone);
        break;
      }
      case 'open-contacts': {
        shell.openExternal('x-apple-contacts://');
        break;
      }
    }
  }
}
