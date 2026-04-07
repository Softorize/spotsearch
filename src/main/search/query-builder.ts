import type { SearchOptions } from '../../shared/types';
import { getFilterQuery } from './file-type-filters';
import { parseNaturalLanguageQuery, buildNlpMdfindQuery } from './nlp/query-parser';

// Tokenize query with boolean operators, respecting quoted phrases
interface Token {
  type: 'term' | 'and' | 'or' | 'not';
  value: string;
}

function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const q = query.trim();

  while (i < q.length) {
    // Skip whitespace
    while (i < q.length && q[i] === ' ') i++;
    if (i >= q.length) break;

    // Check for quoted phrase
    if (q[i] === '"') {
      const end = q.indexOf('"', i + 1);
      if (end !== -1) {
        tokens.push({ type: 'term', value: q.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // Extract word
    let word = '';
    while (i < q.length && q[i] !== ' ') {
      word += q[i];
      i++;
    }

    // Check for boolean operators (must be uppercase)
    if (word === 'AND') tokens.push({ type: 'and', value: 'AND' });
    else if (word === 'OR') tokens.push({ type: 'or', value: 'OR' });
    else if (word === 'NOT') tokens.push({ type: 'not', value: 'NOT' });
    else tokens.push({ type: 'term', value: word });
  }

  return tokens;
}

function hasBooleanOperators(query: string): boolean {
  return /\b(AND|OR|NOT)\b/.test(query);
}

function buildBooleanQuery(query: string, exactMatch: boolean): string {
  const tokens = tokenize(query);
  const parts: string[] = [];
  let nextOperator = '&&';
  let negate = false;

  for (const token of tokens) {
    if (token.type === 'and') {
      nextOperator = '&&';
    } else if (token.type === 'or') {
      nextOperator = '||';
    } else if (token.type === 'not') {
      negate = true;
    } else {
      const escaped = escapeQueryString(token.value);
      let condition: string;

      if (negate) {
        condition = `kMDItemFSName != "*${escaped}*"c`;
        negate = false;
      } else if (exactMatch) {
        condition = `kMDItemFSName == "${escaped}"c`;
      } else {
        condition = `kMDItemFSName == "*${escaped}*"c`;
      }

      if (parts.length > 0) {
        parts.push(nextOperator);
        nextOperator = '&&'; // reset to default
      }
      parts.push(condition);
    }
  }

  return parts.join(' ');
}

export function buildMdfindQuery(options: SearchOptions): string[] {
  const { query, exactMatch, fileTypes, extension, contentSearch } = options;

  if (!query.trim()) {
    return [];
  }

  // Try natural language parsing first
  const nlpParsed = parseNaturalLanguageQuery(query);
  const nlpQuery = buildNlpMdfindQuery(nlpParsed);

  if (nlpQuery) {
    return [nlpQuery];
  }

  // Build the name/content query
  let mainQuery: string;

  if (contentSearch) {
    // Content search mode - search inside file contents
    const escapedQuery = escapeQueryString(query);
    mainQuery = `kMDItemTextContent == "*${escapedQuery}*"c`;
  } else if (hasBooleanOperators(query)) {
    // Boolean operators mode
    mainQuery = buildBooleanQuery(query, exactMatch);
  } else {
    // Standard name search
    const escapedQuery = escapeQueryString(query);
    if (exactMatch) {
      mainQuery = `kMDItemFSName == "${escapedQuery}"c`;
    } else {
      mainQuery = `kMDItemFSName == "*${escapedQuery}*"c`;
    }
  }

  // Get file type filter
  const typeQuery = getFilterQuery(fileTypes);

  // Build extension filter if provided
  let extensionQuery: string | null = null;
  if (extension && extension.trim()) {
    const ext = extension.trim().replace(/^\./, '');
    const escapedExt = escapeQueryString(ext);
    extensionQuery = `kMDItemFSName == "*.${escapedExt}"c`;
  }

  // Combine queries
  let fullQuery: string = mainQuery;

  if (typeQuery) {
    fullQuery = `${fullQuery} && ${typeQuery}`;
  }

  if (extensionQuery) {
    fullQuery = `${fullQuery} && ${extensionQuery}`;
  }

  return [fullQuery];
}

function escapeQueryString(query: string): string {
  return query
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\*/g, '\\*')
    .replace(/\?/g, '\\?');
}

export function buildMdfindArgs(options: SearchOptions): string[] {
  const query = buildMdfindQuery(options);

  if (query.length === 0) {
    return [];
  }

  const args: string[] = [];

  // Add scope if specified
  if (options.scope) {
    args.push('-onlyin', options.scope);
  }

  args.push(...query);

  return args;
}
