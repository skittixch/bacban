const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'TaskCard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  { match: /\$\{[\s\n]*isDarkMode \? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'[\s\n]*\}/g, replace: 'bg-[var(--surface-input)] border-[var(--border-default)] text-[var(--text-primary)]' },
  { match: /\$\{[\s\n]*isDarkMode \? 'border-gray-700\/60 bg-gray-700\/30 hover:border-gray-500 hover:bg-gray-700\/50'[\s\n]*: 'border-gray-200\/60 bg-gray-50\/80 hover:border-gray-300 hover:bg-blue-50\/40'[\s\n]*\}/g, replace: 'border-[var(--border-default)] bg-[var(--surface-tertiary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]' },
  { match: /\$\{isDarkMode \? 'text-gray-300' : 'text-gray-700'\}/g, replace: 'text-[var(--text-primary)]' },
  { match: /\$\{isDarkMode \? 'text-gray-500' : 'text-gray-400'\}/g, replace: 'text-[var(--text-muted)]' },
  { match: /\$\{[\s\n]*isDarkMode \? 'bg-red-500\/20 text-red-400' : 'bg-red-50 text-red-600'[\s\n]*\}/g, replace: 'bg-[var(--color-danger-light)] text-[var(--color-danger)]' },
  { match: /\$\{[\s\n]*isDarkMode \? 'border-gray-600 bg-gray-700 hover:border-gray-500' : 'border-gray-200 bg-white hover:border-gray-300'[\s\n]*\}/g, replace: 'border-[var(--border-default)] bg-[var(--surface-primary)] hover:border-[var(--border-strong)]' },
  { match: /\$\{[\s\n]*isDarkMode \? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'[\s\n]*\}/g, replace: 'bg-[var(--surface-elevated)] border-[var(--border-strong)]' },
  { match: /\$\{[\s\n]*isDarkMode \? 'bg-gray-600 border border-gray-500' : 'bg-gray-200 border border-gray-300'[\s\n]*\}/g, replace: 'bg-[var(--surface-tertiary)] border-[var(--border-default)]' },
];

for (const {match, replace} of replacements) {
  content = content.replace(match, replace);
}

fs.writeFileSync(filePath, content);
console.log('TaskCard.jsx updated');
