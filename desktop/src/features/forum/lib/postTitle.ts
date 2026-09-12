/**
 * Forum posts carry no title field — a post is one markdown body. A list of
 * bodies is unscannable, so the list derives a title from the opening line the
 * same way every forum author already writes one.
 */

/** Longest opening line still read as a title rather than a paragraph. */
export const MAX_FORUM_TITLE_LENGTH = 120;

const QUOTE_PREFIX = /^>\s?/;
const HEADING_PREFIX = /^#{1,6}\s+/;
const LIST_PREFIX = /^(?:[-*+]\s+|\d+[.)]\s+)/;
const IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
const LINK = /\[([^\]]+)\]\([^)]*\)/g;
const CODE_SPAN = /`([^`]+)`/g;
const EMPHASIS = /^(\*\*|__|\*|_)([\s\S]+)\1$/;
const HAS_WORD = /[\p{L}\p{N}]/u;

export type ForumPostContent = {
  /** Scannable heading, or null when the opening line is prose or decoration. */
  title: string | null;
  /** Everything the title did not consume. */
  body: string;
};

function stripDecorations(line: string): string {
  let text = line
    .trim()
    .replace(QUOTE_PREFIX, "")
    .replace(HEADING_PREFIX, "")
    .replace(LIST_PREFIX, "")
    .replace(IMAGE, "")
    .replace(LINK, "$1")
    .replace(CODE_SPAN, "$1")
    .trim();

  let emphasis = EMPHASIS.exec(text);
  while (emphasis) {
    text = emphasis[2].trim();
    emphasis = EMPHASIS.exec(text);
  }

  return text;
}

export function splitForumPostContent(content: string): ForumPostContent {
  const lines = content.split("\n");
  let index = 0;
  while (index < lines.length && lines[index].trim() === "") {
    index += 1;
  }
  if (index >= lines.length) {
    return { title: null, body: content };
  }

  const firstLine = lines[index].trim().replace(QUOTE_PREFIX, "");
  const isHeading = HEADING_PREFIX.test(firstLine);
  const candidate = stripDecorations(firstLine);

  // A bare image, a rule, or an emoji-only line is decoration, not a heading.
  if (!HAS_WORD.test(candidate)) {
    return { title: null, body: content };
  }

  // A long opening paragraph is prose. Promoting it would clip the post's own
  // first sentence, so leave the whole body to render as it always has.
  if (!isHeading && candidate.length > MAX_FORUM_TITLE_LENGTH) {
    return { title: null, body: content };
  }

  const title =
    candidate.length > MAX_FORUM_TITLE_LENGTH
      ? `${candidate.slice(0, MAX_FORUM_TITLE_LENGTH).trimEnd()}…`
      : candidate;

  return {
    title,
    body: lines
      .slice(index + 1)
      .join("\n")
      .trim(),
  };
}
