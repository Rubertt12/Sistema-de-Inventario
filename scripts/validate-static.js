#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = process.cwd();
const IGNORE_DIRS = new Set(['.git', 'node_modules', '.vercel', 'dist', 'build']);
const failures = [];
const stats = { js: 0, css: 0, html: 0 };

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) files.push(...walk(path.join(dir, entry.name)));
    } else if (entry.isFile()) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

const files = walk(ROOT);
const jsFiles = files.filter(file => file.endsWith('.js') && !file.endsWith('.min.js'));
const cssFiles = files.filter(file => file.endsWith('.css'));
const htmlFiles = files.filter(file => file.endsWith('.html'));

for (const file of jsFiles) {
  stats.js++;
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push(`JavaScript inválido: ${path.relative(ROOT, file)}\n${result.stderr || result.stdout}`);
  }
}

for (const file of cssFiles) {
  stats.css++;
  const source = fs.readFileSync(file, 'utf8');
  const cleaned = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
  let depth = 0;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++;
    if (cleaned[i] === '}') depth--;
    if (depth < 0) break;
  }
  if (depth !== 0) failures.push(`Blocos CSS desbalanceados: ${path.relative(ROOT, file)} (saldo ${depth})`);
}

const assetExtensions = /\.(?:css|js|mjs|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|mp4|webm|pdf)$/i;
for (const file of htmlFiles) {
  stats.html++;
  const html = fs.readFileSync(file, 'utf8');
  const refs = html.matchAll(/(?:src|href)\s*=\s*["']([^"'<>]+)["']/gi);
  for (const match of refs) {
    const ref = match[1].trim();
    if (!ref || /^(?:#|https?:|data:|blob:|mailto:|tel:|javascript:|\/\/)/i.test(ref)) continue;
    const clean = decodeURIComponent(ref.split(/[?#]/, 1)[0]);
    if (!assetExtensions.test(clean)) continue;
    const target = path.resolve(path.dirname(file), clean.startsWith('/') ? `.${clean}` : clean);
    if (!target.startsWith(ROOT + path.sep) && target !== ROOT) continue;
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      failures.push(`Recurso local não encontrado: ${path.relative(ROOT, file)} -> ${ref}`);
    }
  }
}

console.log(`Auditoria estática: ${stats.js} JS, ${stats.css} CSS, ${stats.html} HTML.`);
if (failures.length) {
  console.error(`\\nEncontrados ${failures.length} problema(s):\\n\\n${failures.join('\\n\\n')}`);
  process.exit(1);
}
console.log('Sintaxe JavaScript, estrutura básica CSS e referências locais: OK.');
