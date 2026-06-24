const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  { match: /\$\{isDarkMode \? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'\}/g, replace: 'bg-[var(--surface-board)] text-[var(--text-primary)]' },
  { match: /\$\{[\s\n]*isDarkMode \? 'bg-gray-900\/80 border-gray-800' : 'bg-white\/80 border-gray-200'[\s\n]*\}/g, replace: 'bg-[var(--surface-primary)] border-[var(--border-default)]' },
  { match: /\$\{[\s\n]*isDarkMode[\s\n]*\? 'text-gray-400 hover:text-yellow-300 hover:bg-yellow-500\/10'[\s\n]*: 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'[\s\n]*\}/g, replace: 'text-[var(--text-secondary)] hover:bg-[var(--surface-tertiary)] hover:text-[var(--theme-primary)]' },
  { match: /\$\{[\s\n]*isDarkMode[\s\n]*\? 'text-gray-400 hover:text-white hover:bg-gray-700'[\s\n]*: 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'[\s\n]*\}/g, replace: 'text-[var(--text-secondary)] hover:bg-[var(--surface-tertiary)] hover:text-[var(--text-primary)]' },
  { match: /\$\{[\s\n]*isDarkMode \? 'bg-gray-800\/60 border-gray-700' : 'bg-white border-gray-200'[\s\n]*\}/g, replace: 'bg-[var(--surface-primary)] border-[var(--border-default)]' },
  { match: /\$\{[\s\n]*isDarkMode \? 'text-gray-500' : 'text-gray-400'[\s\n]*\}/g, replace: 'text-[var(--text-muted)]' },
  { match: /\$\{isDarkMode \? 'bg-gray-700' : 'bg-gray-100'\}/g, replace: 'bg-[var(--surface-tertiary)]' },
  { match: /\$\{isDarkMode \? 'border-gray-700' : 'border-gray-200'\}/g, replace: 'border-[var(--border-default)]' },
  { match: /\$\{[\s\n]*isDarkMode \? 'bg-gray-700\/50 text-gray-300' : 'bg-gray-100 text-gray-700'[\s\n]*\}/g, replace: 'bg-[var(--surface-input)] text-[var(--text-primary)]' },
  { match: /\$\{[\s\n]*isDarkMode[\s\n]*\? 'border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400 hover:bg-gray-800\/40'[\s\n]*: 'border-gray-200 text-gray-300 hover:border-gray-300 hover:text-gray-400 hover:bg-gray-50'[\s\n]*\}/g, replace: 'border-[var(--border-default)] text-[var(--text-disabled)] hover:border-[var(--border-strong)] hover:text-[var(--text-muted)] hover:bg-[var(--surface-tertiary)]' },
];

for (const {match, replace} of replacements) {
  content = content.replace(match, replace);
}

fs.writeFileSync(filePath, content);
console.log('App.jsx updated');
