// Natural language query parser
// Translates human-readable queries into mdfind query components

interface ParsedQuery {
  nameQuery?: string;
  contentTypeQuery?: string;
  dateQuery?: string;
  sizeQuery?: string;
  isNaturalLanguage: boolean;
}

// File type keyword mappings
const TYPE_KEYWORDS: Record<string, string> = {
  'photo': 'public.image', 'photos': 'public.image', 'image': 'public.image', 'images': 'public.image',
  'picture': 'public.image', 'pictures': 'public.image', 'pic': 'public.image', 'pics': 'public.image',
  'document': 'public.composite-content', 'documents': 'public.composite-content', 'doc': 'public.composite-content', 'docs': 'public.composite-content',
  'pdf': 'com.adobe.pdf', 'pdfs': 'com.adobe.pdf',
  'video': 'public.movie', 'videos': 'public.movie', 'movie': 'public.movie', 'movies': 'public.movie',
  'audio': 'public.audio', 'music': 'public.audio', 'song': 'public.audio', 'songs': 'public.audio',
  'code': 'public.source-code', 'source': 'public.source-code', 'script': 'public.source-code',
  'presentation': 'public.presentation', 'presentations': 'public.presentation', 'slides': 'public.presentation',
  'spreadsheet': 'public.spreadsheet', 'spreadsheets': 'public.spreadsheet', 'excel': 'public.spreadsheet',
  'archive': 'public.archive', 'archives': 'public.archive', 'zip': 'public.archive',
  'folder': 'public.folder', 'folders': 'public.folder', 'directory': 'public.folder',
  'text': 'public.text', 'txt': 'public.text',
};

function parseTimeExpression(expr: string): string | null {
  const now = new Date();
  const lc = expr.toLowerCase().trim();

  if (lc === 'today') {
    return `$time.today`;
  }
  if (lc === 'yesterday') {
    return `$time.yesterday`;
  }
  if (lc === 'this week' || lc === 'this_week') {
    return `$time.this_week`;
  }
  if (lc === 'last week') {
    return `$time.today(-7)`;
  }
  if (lc === 'this month' || lc === 'this_month') {
    return `$time.this_month`;
  }
  if (lc === 'last month') {
    return `$time.today(-30)`;
  }
  if (lc === 'this year' || lc === 'this_year') {
    return `$time.this_year`;
  }
  if (lc === 'last year') {
    return `$time.today(-365)`;
  }

  // "last N days/weeks/months"
  const lastNMatch = lc.match(/last\s+(\d+)\s+(day|days|week|weeks|month|months)/);
  if (lastNMatch) {
    const n = parseInt(lastNMatch[1]);
    const unit = lastNMatch[2];
    let days = n;
    if (unit.startsWith('week')) days = n * 7;
    if (unit.startsWith('month')) days = n * 30;
    return `$time.today(-${days})`;
  }

  // "in January", "in 2024", etc.
  const months = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];
  for (let i = 0; i < months.length; i++) {
    if (lc.includes(months[i])) {
      const year = now.getFullYear();
      const startDate = new Date(year, i, 1).toISOString().split('T')[0];
      return startDate;
    }
  }

  // Year only
  const yearMatch = lc.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    return `${yearMatch[1]}-01-01`;
  }

  return null;
}

function parseSizeExpression(expr: string): number | null {
  const match = expr.match(/([\d.]+)\s*(b|kb|mb|gb|tb)/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    b: 1, kb: 1024, mb: 1048576, gb: 1073741824, tb: 1099511627776,
  };

  return value * (multipliers[unit] || 1);
}

export function parseNaturalLanguageQuery(query: string): ParsedQuery {
  const q = query.trim();
  const qLower = q.toLowerCase();

  const result: ParsedQuery = { isNaturalLanguage: false };

  // Pattern: "{type} from {time}" or "{type} modified {time}"
  const typeTimePattern = /^([\w]+)\s+(?:from|since|modified|created|after)\s+(.+)$/i;
  const typeTimeMatch = qLower.match(typeTimePattern);

  if (typeTimeMatch) {
    const typeWord = typeTimeMatch[1];
    const timeExpr = typeTimeMatch[2];

    const contentType = TYPE_KEYWORDS[typeWord];
    const timeValue = parseTimeExpression(timeExpr);

    if (contentType && timeValue) {
      result.contentTypeQuery = `kMDItemContentTypeTree == "${contentType}"`;
      result.dateQuery = `kMDItemFSContentChangeDate >= ${timeValue}`;
      result.isNaturalLanguage = true;
      return result;
    }
  }

  // Pattern: "files larger/bigger than {size}"
  const sizePattern = /(?:files?\s+)?(?:larger|bigger|greater|over)\s+(?:than\s+)?([\d.]+\s*(?:b|kb|mb|gb|tb))/i;
  const sizeMatch = qLower.match(sizePattern);

  if (sizeMatch) {
    const bytes = parseSizeExpression(sizeMatch[1]);
    if (bytes !== null) {
      result.sizeQuery = `kMDItemFSSize > ${bytes}`;
      result.isNaturalLanguage = true;
    }
  }

  // Pattern: "files smaller than {size}"
  const smallerPattern = /(?:files?\s+)?(?:smaller|less)\s+(?:than\s+)?([\d.]+\s*(?:b|kb|mb|gb|tb))/i;
  const smallerMatch = qLower.match(smallerPattern);

  if (smallerMatch) {
    const bytes = parseSizeExpression(smallerMatch[1]);
    if (bytes !== null) {
      result.sizeQuery = `kMDItemFSSize < ${bytes}`;
      result.isNaturalLanguage = true;
    }
  }

  // Pattern: "{type} files" (just type without time)
  if (!result.isNaturalLanguage) {
    for (const [keyword, contentType] of Object.entries(TYPE_KEYWORDS)) {
      if (qLower === keyword || qLower === `${keyword} files` || qLower.startsWith(`${keyword} `)) {
        const remaining = qLower.replace(keyword, '').replace('files', '').trim();
        result.contentTypeQuery = `kMDItemContentTypeTree == "${contentType}"`;
        result.isNaturalLanguage = true;

        // Check if remaining text has a time expression
        if (remaining) {
          const timeFromRemaining = remaining.replace(/^(?:from|since|modified|created|in)\s+/, '');
          const timeValue = parseTimeExpression(timeFromRemaining);
          if (timeValue) {
            result.dateQuery = `kMDItemFSContentChangeDate >= ${timeValue}`;
          } else {
            // Remaining might be a name filter
            result.nameQuery = remaining;
          }
        }
        break;
      }
    }
  }

  // Pattern: "modified today/yesterday/this week"
  if (!result.isNaturalLanguage) {
    const modifiedPattern = /^(?:files?\s+)?modified\s+(.+)$/i;
    const modifiedMatch = qLower.match(modifiedPattern);
    if (modifiedMatch) {
      const timeValue = parseTimeExpression(modifiedMatch[1]);
      if (timeValue) {
        result.dateQuery = `kMDItemFSContentChangeDate >= ${timeValue}`;
        result.isNaturalLanguage = true;
      }
    }
  }

  // Pattern: "created today/yesterday/etc"
  if (!result.isNaturalLanguage) {
    const createdPattern = /^(?:files?\s+)?created\s+(.+)$/i;
    const createdMatch = qLower.match(createdPattern);
    if (createdMatch) {
      const timeValue = parseTimeExpression(createdMatch[1]);
      if (timeValue) {
        result.dateQuery = `kMDItemFSCreationDate >= ${timeValue}`;
        result.isNaturalLanguage = true;
      }
    }
  }

  return result;
}

function escapeMdfindString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\*/g, '\\*')
    .replace(/\?/g, '\\?');
}

export function buildNlpMdfindQuery(parsed: ParsedQuery): string | null {
  if (!parsed.isNaturalLanguage) return null;

  const parts: string[] = [];

  if (parsed.nameQuery) {
    parts.push(`kMDItemFSName == "*${escapeMdfindString(parsed.nameQuery)}*"c`);
  }
  if (parsed.contentTypeQuery) {
    parts.push(parsed.contentTypeQuery);
  }
  if (parsed.dateQuery) {
    parts.push(parsed.dateQuery);
  }
  if (parsed.sizeQuery) {
    parts.push(parsed.sizeQuery);
  }

  if (parts.length === 0) return null;
  return parts.join(' && ');
}
