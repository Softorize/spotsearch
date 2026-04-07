import { exec } from 'child_process';
import { shell } from 'electron';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction } from '../../../shared/types';

interface CalendarEvent {
  title: string;
  startDate: string;
  endDate: string;
  calendar: string;
  location?: string;
}

function fetchUpcomingEvents(): Promise<CalendarEvent[]> {
  return new Promise((resolve) => {
    const script = `
const cal = Application('Calendar');
const now = new Date();
const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
const calendars = cal.calendars();
const results = [];

for (let c = 0; c < Math.min(calendars.length, 10); c++) {
  try {
    const events = calendars[c].events.whose({
      startDate: { _greaterThanEquals: now },
      startDate: { _lessThanEquals: nextWeek }
    })();
    for (let i = 0; i < Math.min(events.length, 20); i++) {
      try {
        results.push(JSON.stringify({
          title: events[i].summary(),
          startDate: events[i].startDate().toISOString(),
          endDate: events[i].endDate().toISOString(),
          calendar: calendars[c].name(),
          location: events[i].location() || ''
        }));
      } catch(e) {}
    }
  } catch(e) {}
}
results.join('\\n');
`;

    exec(`osascript -l JavaScript -e '${script.replace(/'/g, "'\\''")}'`,
      { timeout: 10000 },
      (err, stdout) => {
        if (err) {
          resolve([]);
          return;
        }
        try {
          const events = stdout.trim().split('\n')
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line) as CalendarEvent);
          events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
          resolve(events);
        } catch {
          resolve([]);
        }
      }
    );
  });
}

function formatEventTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today at ${time}`;
  if (isTomorrow) return `Tomorrow at ${time}`;
  return `${date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}`;
}

export class CalendarProvider implements SearchProvider {
  id = 'calendar';
  name = 'Calendar';
  priority = 35;

  canHandle(query: string): boolean {
    const q = query.trim().toLowerCase();
    return q.startsWith('calendar') || q.startsWith('events') || q.startsWith('schedule') ||
      q.startsWith('meeting') || q.startsWith('upcoming');
  }

  async search(query: string): Promise<UnifiedResult[]> {
    const events = await fetchUpcomingEvents();
    const q = query.trim().toLowerCase()
      .replace(/^(calendar|events|schedule|meeting|upcoming)\s*/, '').trim();

    let filtered = events;
    if (q.length > 0) {
      filtered = events.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        e.calendar.toLowerCase().includes(q) ||
        (e.location && e.location.toLowerCase().includes(q))
      );
    }

    return filtered.slice(0, 10).map((event, i) => ({
      id: `cal-${i}-${event.title}`,
      name: event.title,
      subtitle: `${formatEventTime(event.startDate)} - ${event.calendar}${event.location ? ` - ${event.location}` : ''}`,
      icon: '📅',
      category: 'calendar' as const,
      score: 800 - i,
      actions: [
        { id: 'open-calendar', name: 'Open Calendar', shortcut: 'Enter', isDefault: true },
      ],
      data: {
        _providerId: this.id,
        ...event,
      },
    }));
  }

  getActions(result: UnifiedResult): ResultAction[] {
    if (result.category !== 'calendar') return [];
    return [{ id: 'open-calendar', name: 'Open Calendar', shortcut: 'Enter', isDefault: true }];
  }

  async executeAction(_result: UnifiedResult, actionId: string): Promise<void> {
    if (actionId === 'open-calendar') {
      shell.openExternal('x-apple-calendar://');
    }
  }
}
