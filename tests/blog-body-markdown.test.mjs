/**
 * Run with: node tests/blog-body-markdown.test.mjs
 */

import { normalizeBlogBodyMarkdown } from '../src/lib/blogBodyMarkdown.js';

let pass = 0;
let fail = 0;

const ok = (cond, label) => {
  if (cond) {
    pass += 1;
    console.log(`  OK    ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}`);
  }
};

const wall =
  'First sentence one. Second sentence two. Third sentence three. Fourth sentence four. Fifth sentence five. Sixth sentence six.';

const normalizedWall = normalizeBlogBodyMarkdown(wall);
ok(normalizedWall.includes('\n\n'), 'wall of text gets paragraph breaks');
ok(normalizedWall.split('\n\n').length >= 2, 'wall of text becomes multiple paragraphs');

const singleNewlines = normalizeBlogBodyMarkdown('Opening line.\nSecond line.\nThird line.');
ok(singleNewlines.split('\n\n').length === 3, 'single newlines become paragraph breaks');

const literalEscapes = normalizeBlogBodyMarkdown('Line one.\\nLine two.\\n\\nLine three.');
ok(literalEscapes.includes('\n\n'), 'literal \\\\n escapes become real newlines');

const existingParagraphs = normalizeBlogBodyMarkdown('Para one.\n\nPara two.');
ok(existingParagraphs === 'Para one.\n\nPara two.', 'existing paragraph breaks are preserved');

const listBlock = normalizeBlogBodyMarkdown('- Tip one\n- Tip two\n- Tip three');
ok(listBlock === '- Tip one\n- Tip two\n- Tip three', 'markdown lists stay compact');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
