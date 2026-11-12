import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeHtmlEntities,
  descriptionToMarkdown,
  htmlToText,
  normalizeExampleCode,
} from "./description-format.mjs";

test("descriptionToMarkdown keeps every fenced block, even when adjacent", () => {
  const markdown = descriptionToMarkdown(
    "<p>Before.</p><pre><code class=\"language-js example\">circle(1);</code></pre>" +
      "<pre><code class=\"language-js\">line(2);</code></pre><p>After.</p>"
  );

  assert.equal(
    markdown,
    "Before.\n\n```js example\ncircle(1);\n```\n\n```js\nline(2);\n```\n\nAfter."
  );
});

test("descriptionToMarkdown preserves the example marker after the language", () => {
  const markdown = descriptionToMarkdown(
    "<pre><code class=\"language-js example\">function setup() {}</code></pre>"
  );

  assert.match(markdown, /^```js example\n/);
  assert.match(markdown, /\n```$/);
});

test("descriptionToMarkdown decodes entities inside code without leaking wrappers", () => {
  const markdown = descriptionToMarkdown(
    "<pre><code class=\"language-js\">if (a &lt; b) {\n  text('&amp;');\n}</code></pre>"
  );

  assert.match(markdown, /if \(a < b\) \{/);
  assert.match(markdown, /text\('&'\);/);
  assert.doesNotMatch(markdown, /<\/?code/);
});

test("descriptionToMarkdown leaves comparison operators in prose alone", () => {
  const text = htmlToText("<p>Use a &lt; b when mouseX < width.</p>");
  assert.equal(text, "Use a < b when mouseX < width.");
});

test("htmlToText keeps literal HTML tags inside inline code", () => {
  assert.equal(
    htmlToText("<p>Creates a <code><div/></code> element.</p>"),
    "Creates a <div/> element."
  );
});

test("htmlToText does not leak malformed nested inline code", () => {
  const text = htmlToText(
    '<p>Use <code><</code>, <code><< code="">, <code>>=</code>.</p>'
  );
  assert.doesNotMatch(text, /<\/?code\b/i);
});

test("normalizeExampleCode removes malformed HTML wrappers", () => {
  const code = normalizeExampleCode(`<div>
<code>
let x = 1;
</code>
</div>
function draw() {
  circle(x, 1, 2);
}`);

  assert.equal(code, "let x = 1;\n\n\nfunction draw() {\n  circle(x, 1, 2);\n}");
  assert.doesNotMatch(code, /<\/?div|<\/?code/);
});

test("normalizeExampleCode keeps HTML-looking strings and comparisons", () => {
  const code = normalizeExampleCode(`<div>
<code>
let div = createDiv('<h3>p5*js</h3>');
if (mouseX < width && mouseY > 0) {
  circle(1, 1, 2);
}
</code>
</div>`);

  assert.match(code, /<h3>p5\*js<\/h3>/);
  assert.match(code, /mouseX < width && mouseY > 0/);
  assert.doesNotMatch(code, /^\s*<div>/);
});

test("decodeHtmlEntities handles numeric entities", () => {
  assert.equal(decodeHtmlEntities("&#39;x&#x27;"), "'x'");
});
