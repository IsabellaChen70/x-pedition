import { readFileSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mdPath = resolve(root, 'docs/PRD.md');
const htmlPath = resolve(root, 'docs/PRD.html');
const pdfPath = resolve(root, 'docs/PRD.pdf');

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inCode = false;
  let inTable = false;
  let listType = null;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  const closeTable = () => {
    if (inTable) {
      out.push('</tbody></table>');
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.startsWith('```')) {
      if (!inCode) {
        closeList();
        closeTable();
        inCode = true;
        out.push('<pre><code>');
      } else {
        inCode = false;
        out.push('</code></pre>');
      }
      continue;
    }

    if (inCode) {
      out.push(escapeHtml(line));
      continue;
    }

    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^-+$/.test(c.replace(/:/g, '')))) continue;
      if (!inTable) {
        closeList();
        inTable = true;
        out.push('<table><thead><tr>');
        cells.forEach((c) => out.push(`<th>${inline(c)}</th>`));
        out.push('</tr></thead><tbody>');
        continue;
      }
      out.push('<tr>');
      cells.forEach((c) => out.push(`<td>${inline(c)}</td>`));
      out.push('</tr>');
      continue;
    } else {
      closeTable();
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      closeList();
      out.push('<hr />');
      continue;
    }

    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      if (listType !== 'ul') {
        closeList();
        out.push('<ul>');
        listType = 'ul';
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (listType !== 'ol') {
        closeList();
        out.push('<ol>');
        listType = 'ol';
      }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    if (line.trim() === '') {
      closeList();
      out.push('');
      continue;
    }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  closeTable();
  return out.join('\n');
}

function inline(text) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

const md = readFileSync(mdPath, 'utf8');
const body = mdToHtml(md);
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>PRD — Algebra Learn-by-Doing App</title>
  <style>
    @page { margin: 0.5in; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.3;
      color: #111;
      max-width: 7.5in;
      margin: 0 auto;
      padding: 0.4in;
    }
    h1 { font-size: 14pt; border-bottom: 2px solid #222; padding-bottom: 0.15em; page-break-after: avoid; }
    h2 { font-size: 11pt; margin-top: 0.8em; border-bottom: 1px solid #ccc; padding-bottom: 0.1em; page-break-after: avoid; }
    h3 { font-size: 10pt; margin-top: 0.6em; page-break-after: avoid; }
    h4 { font-size: 11.5pt; margin-top: 0.9em; page-break-after: avoid; }
    p, li { orphans: 3; widows: 3; }
    pre {
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 0.75em;
      font-size: 9pt;
      white-space: pre-wrap;
      word-break: break-word;
      page-break-inside: avoid;
    }
    code {
      font-family: Menlo, Monaco, Consolas, monospace;
      font-size: 9pt;
      background: #f2f2f2;
      padding: 0.1em 0.25em;
      border-radius: 3px;
    }
    pre code { background: none; padding: 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
      margin: 0.75em 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 0.35em 0.5em;
      text-align: left;
      vertical-align: top;
    }
    th { background: #f0f0f0; font-weight: 600; }
    hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
    ul, ol { padding-left: 1.4em; }
    a { color: #1155cc; text-decoration: none; }
  </style>
</head>
<body>
${body}
</body>
</html>`;

writeFileSync(htmlPath, html);

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
execFileSync(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  `--print-to-pdf=${pdfPath}`,
  htmlPath,
], { stdio: 'inherit' });

console.log(`Wrote ${pdfPath}`);
