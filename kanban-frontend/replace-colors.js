const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'index.css');
let css = fs.readFileSync(cssPath, 'utf8');

// The audit listed some common colors
const replacements = [
  { match: /#94a3b8/g, replace: 'var(--text-disabled)' },
  { match: /#22c55e/g, replace: 'var(--color-success)' },
  { match: /#64748b/g, replace: 'var(--text-muted)' },
  { match: /#ef4444/g, replace: 'var(--color-danger)' },
  { match: /#f59e0b/g, replace: 'var(--color-warning)' },
  { match: /#e2e8f0/g, replace: 'var(--text-primary)' }, // in dark mode
  { match: /#1e293b/g, replace: 'var(--surface-primary)' }, // in dark mode or light text
  { match: /#cbd5e1/g, replace: 'var(--text-secondary)' }, // dark mode
  { match: /#475569/g, replace: 'var(--text-secondary)' }, // light mode
  { match: /rgba\(128, 128, 128, 0\.2\)/g, replace: 'var(--border-default)' },
  { match: /rgba\(128, 128, 128, 0\.35\)/g, replace: 'var(--text-disabled)' },
  { match: /rgba\(128, 128, 128, 0\.03\)/g, replace: 'var(--surface-tertiary)' },
  { match: /rgba\(128, 128, 128, 0\.25\)/g, replace: 'var(--border-strong)' },
  { match: /rgba\(128, 128, 128, 0\.12\)/g, replace: 'var(--border-default)' },
  { match: /rgba\(0, 0, 0, 0\.15\)/g, replace: 'var(--border-strong)' },
  { match: /rgba\(0, 0, 0, 0\.05\)/g, replace: 'var(--border-default)' },
  { match: /rgba\(255, 255, 255, 0\.06\)/g, replace: 'var(--border-default)' },
  { match: /rgba\(255, 255, 255, 0\.8\)/g, replace: 'var(--surface-elevated)' },
  { match: /rgba\(255, 255, 255, 0\.1\)/g, replace: 'var(--border-strong)' },
  { match: /rgba\(0, 0, 0, 0\.06\)/g, replace: 'var(--border-subtle)' },
];

for (const {match, replace} of replacements) {
  css = css.replace(match, replace);
}

fs.writeFileSync(cssPath, css);
console.log('Replaced hardcoded colors in index.css');
