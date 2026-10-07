// The fixture vault deliberately contains exactly two audit errors (a broken wikilink and an
// image without alt text). CI asserts that the audit finds those and nothing else.
import fs from 'node:fs';

const report = JSON.parse(fs.readFileSync('dev/fixture-site/.paperwhite/audit.json', 'utf8'));
const errors = report.issues.filter((i) => i.level === 'error').map((i) => `${i.rule} ${i.page}`).sort();
const expected = ['broken-wikilink posts/obsidian-syntax/wikilinks.md', 'image-alt posts/missing-alt.md'];
if (JSON.stringify(errors) !== JSON.stringify(expected)) {
  console.error('Unexpected audit errors:\n', errors.join('\n'));
  process.exit(1);
}
console.log(`audit OK: ${report.pages} pages, the 2 deliberate errors, ${report.warnings} warnings`);

const budgets = JSON.parse(fs.readFileSync('dev/fixture-site/.paperwhite/budgets.json', 'utf8'));
if (budgets.maxPostJs > 30 * 1024) {
  console.error(`post page JS ${budgets.maxPostJs} bytes exceeds the 30 KB budget`);
  process.exit(1);
}
console.log(`JS budget OK: max ${(budgets.maxPostJs / 1024).toFixed(1)} KB on post pages`);
