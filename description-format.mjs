const PRE_CODE_RE = /<pre\b[^>]*>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi;
const CLASS_ATTR_RE = /\bclass\s*=\s*(["'])(.*?)\1/i;
const NAMED_ENTITIES = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

export function decodeHtmlEntities(text) {
  return String(text).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g, (match, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
        return String.fromCodePoint(codePoint);
      }
      return match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function codeFenceInfo(attributes) {
  const classMatch = attributes.match(CLASS_ATTR_RE);
  if (!classMatch) return "";
  const tokens = classMatch[2].split(/\s+/).filter(Boolean);
  const language = tokens.find((token) => token.startsWith("language-"))?.slice("language-".length);
  const isExample = tokens.includes("example");
  return [language, isExample ? "example" : ""].filter(Boolean).join(" ");
}

function makeFence(code, info) {
  const longestRun = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}${info}\n${code}\n${fence}`;
}

export function htmlToText(html) {
  if (!html) return "";
  const inlineCode = [];
  const withPlaceholders = String(html).replace(
    /<code\b[^>]*>([\s\S]*?)<\/code>/gi,
    (match, code) => {
      // Nested code tags mean the source HTML is malformed. Let the normal
      // tag-stripping pass clean it up instead of preserving the markup.
      if (/<code\b/i.test(code)) return match;
      const placeholder = `\u0000INLINE_CODE_${inlineCode.length}\u0000`;
      inlineCode.push(decodeHtmlEntities(code));
      return placeholder;
    }
  );
  const text = decodeHtmlEntities(
    withPlaceholders
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<\/?(?:p|span|a|strong|em|b|i|ul|ol|li|h[1-6])\b[^>]*>/gi, "")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.replace(/\u0000INLINE_CODE_(\d+)\u0000/g, (_match, index) => {
    return inlineCode[Number(index)] ?? "";
  });
}

/**
 * Convert the HTML descriptions in p5.js-website's MDX frontmatter into the
 * plain-text + fenced-code format the app renders. Code fences may be adjacent
 * to prose or to each other, so the replacement works on every `<pre>` match
 * without relying on surrounding whitespace.
 */
export function descriptionToMarkdown(html) {
  if (!html) return "";
  const source = String(html).replace(/\r\n?/g, "\n");
  const blocks = [];
  let lastIndex = 0;
  let match;

  PRE_CODE_RE.lastIndex = 0;
  while ((match = PRE_CODE_RE.exec(source)) !== null) {
    blocks.push(htmlToText(source.slice(lastIndex, match.index)));
    const code = decodeHtmlEntities(match[2])
      .replace(/\r\n?/g, "\n")
      .replace(/^\n+|\n+$/g, "");
    blocks.push(makeFence(code, codeFenceInfo(match[1])));
    lastIndex = match.index + match[0].length;
  }
  blocks.push(htmlToText(source.slice(lastIndex)));

  return blocks
    .filter((block) => block.length > 0)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * p5.js-website examples are HTML snippets (often malformed `<div><code>`
 * wrappers). Pull out the code so wrapper tags never reach the preview or the
 * syntax highlighter. Comparison operators and HTML strings inside the example
 * are kept because only wrapper tags are removed.
 */
export function normalizeExampleCode(raw) {
  if (!raw) return "";
  let code = String(raw).replace(/\r\n?/g, "\n").trim();
  const wrapped = /^<(?:div|pre|code)\b/i.test(code) || /<\/?(?:div|code)>/i.test(code);
  if (wrapped) {
    code = code.replace(/<\/?(?:div|pre|code)\b[^>]*>/gi, "");
  }
  return decodeHtmlEntities(code).replace(/^\n+|\n+$/g, "").trimEnd();
}
