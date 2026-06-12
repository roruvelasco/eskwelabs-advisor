import {
  TITLE_MAX_CHARS,
  TITLE_MIN_WORDS,
  TITLE_MAX_WORDS
} from './title-generation.constants';

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\x00-\x1F\x7F]/;
const BACKTICK_PATTERN = /`/;
const HEADING_PATTERN = /^#{1,6}\s/;
const BULLET_PATTERN = /^[-*+]\s/;
const JSON_OBJECT_PATTERN = /^\s*\{.*\}\s*$/;
const JSON_ARRAY_PATTERN = /^\s*\[.*\]\s*$/;
const LINEBREAK_PATTERN = /[\r\n]/;
const LEADING_TITLE_PREFIX = /^title:\s*/i;
const SURROUNDING_QUOTES = /^(['"])(.*)\1$/s;
const TRAILING_PUNCTUATION = /[.!?]+$/;
const REPEATED_WHITESPACE = /\s{2,}/g;

export function normalizeGeneratedConversationTitle(
  raw: string
): string | null {
  if (!raw || raw.trim().length === 0) return null;

  if (LINEBREAK_PATTERN.test(raw)) return null;

  let title = raw.trim();
  title = title.replace(LEADING_TITLE_PREFIX, '');
  title = title.replace(REPEATED_WHITESPACE, ' ');

  const quoteMatch = title.match(SURROUNDING_QUOTES);
  if (quoteMatch && quoteMatch[1] === quoteMatch[2]) {
    title = quoteMatch[2];
  }

  title = title.replace(TRAILING_PUNCTUATION, '');

  title = title.trim();

  if (title.length === 0) return null;

  if (BACKTICK_PATTERN.test(title)) return null;
  if (HEADING_PATTERN.test(title)) return null;
  if (BULLET_PATTERN.test(title)) return null;
  if (JSON_OBJECT_PATTERN.test(title)) return null;
  if (JSON_ARRAY_PATTERN.test(title)) return null;
  if (LINEBREAK_PATTERN.test(title)) return null;
  if (CONTROL_CHAR_PATTERN.test(title)) return null;

  if (title.length > TITLE_MAX_CHARS) return null;

  const words = title.split(/\s+/);
  if (words.length < TITLE_MIN_WORDS || words.length > TITLE_MAX_WORDS)
    return null;

  return title;
}
